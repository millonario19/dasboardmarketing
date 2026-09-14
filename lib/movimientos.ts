import { conversacionesRecientes, type GhlConversacion, type GhlContact } from "./ghl";
import { estadoDeLead, type EstadoLead } from "./leadStates";
import { getPool } from "./db";

/**
 * Todo lo que se movió hoy, sin importar cuándo entró el lead.
 *
 * El tablero miraba solo los leads del día. Pero un lead del 1 de septiembre
 * que escribe hoy a las 12 es la mejor oportunidad que hay en la pantalla, y
 * no aparecía en ningún lado: se perdía entre setecientos contactos viejos.
 *
 * Un movimiento es una de dos cosas:
 *
 *   · un mensaje — de la lista de conversaciones de GHL, que en una sola
 *     llamada devuelve las cien últimas ordenadas por quién habló recién;
 *   · una etiqueta — del cuaderno que llena el sondeo cada cinco minutos,
 *     que es lo que atrapa al lead que no escribió pero entró al canal o
 *     bajó a WhatsApp.
 */

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

// Una llamada trae cien conversaciones. En un día normal la oficina no pasa de
// cincuenta movimientos, así que alcanza de sobra; si algún día no alcanzara,
// se nota porque el más viejo del feed sería de hoy y no de ayer.
const TOPE_CONVERSACIONES = 100;

const CACHE_MS = 45_000;
let cache: { en: number; datos: Movimiento[] } | null = null;

export type Movimiento = {
  contactId: string;
  nombre: string;
  telefono: string | null;
  agenteId: string | null;
  hora: string;
  dia: "hoy" | "ayer";
  tipo: "mensaje" | "etiqueta";
  /** Lo que pasó, en una línea: el mensaje del cliente o el paso que dio. */
  detalle: string;
  /** Qué hacer con esto. Es lo único que convierte el feed en trabajo. */
  siguiente: string;
  estado: EstadoLead;
  llegado: string;
  sinLeer: number;
  /** El último mensaje es del cliente: nadie le contestó todavía. */
  esperando: boolean;
};

function inicioDeHoyBogota(ms: number): number {
  const local = new Date(ms - BOGOTA_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + BOGOTA_OFFSET_MS;
}

function tieneTagDePauta(tags: string[]): boolean {
  const buscado = (process.env.GHL_LEAD_TAG ?? "ingreso de pauta").toLowerCase();
  return tags.some((t) => t.toLowerCase() === buscado);
}

// El estado se calcula con las etiquetas que ya vienen en la conversación, sin
// pedir la ficha del contacto: cien fichas serían cien llamadas más.
function estadoPorTags(tags: string[]): EstadoLead {
  return estadoDeLead({ id: "", dateAdded: "", tags } as GhlContact);
}

function dias(desdeIso: string, hastaMs: number): number {
  return Math.floor((hastaMs - new Date(desdeIso).getTime()) / 864e5);
}

/**
 * Qué hacer con este lead, dicho en una frase.
 *
 * «Interactuó» no es una instrucción; «escribió hace 8 minutos y nadie le
 * contestó» sí. El feed sin esta línea es un registro de eventos, y lo que
 * hace falta es una lista de trabajo.
 */
function queHacer(c: GhlConversacion, estado: EstadoLead, ahora: number): string {
  const sinLeer = c.unreadCount ?? 0;
  const esperando = c.lastMessageDirection === "inbound";
  const desdeQueLlego = dias(new Date(c.dateAdded).toISOString(), ahora);

  if (esperando && sinLeer > 1) return `Te escribió ${sinLeer} veces y nadie contestó`;
  if (esperando) return "Te escribió y nadie contestó";
  if (estado === "caliente") return "Ya bajó a WhatsApp: falta cerrar el depósito";
  if (estado === "tibio") return "Se movió, pero todavía no baja a WhatsApp";
  if (desdeQueLlego >= 7) return `Entró hace ${desdeQueLlego} días y sigue frío`;
  return "Volvió a aparecer: aprovechalo ahora";
}

/** Los movimientos por etiqueta de hoy, del cuaderno del sondeo. */
async function movimientosPorEtiqueta(
  desdeMs: number
): Promise<Map<string, { hora: string; texto: string }>> {
  const salida = new Map<string, { hora: string; texto: string }>();
  const ETIQUETAS: Record<string, string> = {
    "cliente interactuo": "Interactuó",
    "interactuó": "Interactuó",
    "ingresó al canal free": "Entró al canal",
    "bajado a business": "Bajó a WhatsApp",
    "clic comunidad": "Clic en la comunidad",
  };

  try {
    const { rows } = await getPool().query<{ contact_id: string; tag: string; occurred_at: Date }>(
      `select contact_id, tag, occurred_at
         from tag_history
        where source = 'poll' and occurred_at >= $1
        order by occurred_at`,
      [new Date(desdeMs).toISOString()]
    );
    for (const f of rows) {
      const texto = ETIQUETAS[f.tag.toLowerCase()];
      if (!texto) continue;
      // Se queda el último del día: es el paso más avanzado que dio.
      salida.set(f.contact_id, { hora: f.occurred_at.toISOString(), texto });
    }
  } catch {
    /* sin cuaderno, el feed igual funciona con los mensajes */
  }
  return salida;
}

export async function movimientosDeHoy(soloAgente?: string | null): Promise<Movimiento[]> {
  const ahora = Date.now();
  if (!cache || ahora - cache.en > CACHE_MS) {
    cache = { en: ahora, datos: await leerMovimientos(ahora) };
  }
  return soloAgente ? cache.datos.filter((m) => m.agenteId === soloAgente) : cache.datos;
}

async function leerMovimientos(ahora: number): Promise<Movimiento[]> {
  const arrancaHoy = inicioDeHoyBogota(ahora);
  // La ventana empieza ayer, no hoy. Un agente que abre el tablero a las 7 de
  // la mañana con «hoy» vería una pantalla vacía —lo comprobamos: a las 8 am
  // había un solo movimiento en toda la oficina— cuando lo que necesita es
  // justamente lo que se movió mientras no estaba.
  const desde = arrancaHoy - 864e5;
  const [conversaciones, porEtiqueta] = await Promise.all([
    conversacionesRecientes(TOPE_CONVERSACIONES),
    movimientosPorEtiqueta(desde),
  ]);

  const movimientos: Movimiento[] = [];
  const vistos = new Set<string>();

  for (const c of conversaciones) {
    const tags = c.tags ?? [];
    if (!tieneTagDePauta(tags)) continue;

    const etiqueta = porEtiqueta.get(c.contactId);
    const horaMensaje = c.lastMessageDate ?? 0;
    const hayMensajeHoy = horaMensaje >= desde;
    if (!hayMensajeHoy && !etiqueta) continue;

    const horaFinal = hayMensajeHoy && (!etiqueta || horaMensaje >= new Date(etiqueta.hora).getTime())
      ? horaMensaje
      : new Date(etiqueta!.hora).getTime();

    // Si el lead escribió y además cambió de etiqueta, manda lo más reciente:
    // es lo que explica en qué está ahora.
    const porMensaje = hayMensajeHoy && (!etiqueta || horaMensaje >= new Date(etiqueta.hora).getTime());
    const estado = estadoPorTags(tags);

    vistos.add(c.contactId);
    movimientos.push({
      contactId: c.contactId,
      nombre: (c.contactName || "").trim() || c.phone || "Sin nombre",
      telefono: c.phone ?? null,
      agenteId: c.assignedTo ?? null,
      hora: porMensaje ? new Date(horaMensaje).toISOString() : etiqueta!.hora,
      dia: horaFinal >= arrancaHoy ? "hoy" : "ayer",
      tipo: porMensaje ? "mensaje" : "etiqueta",
      detalle: porMensaje
        ? (c.lastMessageBody || "").trim().slice(0, 160) || "Mandó un audio o una imagen"
        : etiqueta!.texto,
      siguiente: queHacer(c, estado, ahora),
      estado,
      llegado: new Date(c.dateAdded).toISOString(),
      sinLeer: c.unreadCount ?? 0,
      esperando: c.lastMessageDirection === "inbound",
    });
  }

  movimientos.sort((a, b) => b.hora.localeCompare(a.hora));
  return movimientos;
}
