import {
  searchContacts,
  buscarConversacion,
  mensajesDeConversacion,
  extractAttribution,
  contactDisplayName,
  type GhlContact,
  type GhlMensaje,
} from "./ghl";

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

// Cuántos leads se revisan por consulta. Cada uno cuesta dos llamadas a GHL.
const TOPE_LEADS = 60;

// El buscador lee menos: se usa para mirar un caso puntual, y cada resultado
// cuesta las mismas dos llamadas a GHL que un lead del día.
const TOPE_BUSQUEDA = 12;

/**
 * Cuántas conversaciones se piden al mismo tiempo.
 *
 * Con Promise.all sobre 47 leads salían 94 peticiones de golpe y GHL respondía
 * 429 «Too Many Requests» — no solo a esto, también a las búsquedas de la
 * pantalla, que quedaba en blanco. De a cuatro la lista carga en pocos
 * segundos y deja aire para las otras consultas del tablero, que corren al
 * mismo tiempo.
 */
const EN_PARALELO = 4;

// Releer las mismas conversaciones cada vez que alguien abre el tablero es
// gastar el límite de GHL en datos que no cambiaron. Un minuto es suficiente:
// el módulo se usa para ver quién está esperando ahora, no el segundo exacto.
const CACHE_MS = 60_000;
const cache = new Map<string, { en: number; datos: Interaccion }>();

async function enTandas<T, R>(items: T[], hacer: (x: T) => Promise<R>): Promise<R[]> {
  const salida: R[] = [];
  for (let i = 0; i < items.length; i += EN_PARALELO) {
    salida.push(...(await Promise.all(items.slice(i, i + EN_PARALELO).map(hacer))));
  }
  return salida;
}

// Mensajes que GHL crea solo por existir: el formulario de Facebook llega como
// mensaje entrante del cliente, pero no lo escribió nadie.
const ES_FORMULARIO = /^\*Headline:\*/;

// WhatsApp manda las notas de voz en .ogg; el resto de adjuntos (fotos,
// documentos) no se reproducen y quedan afuera.
const ES_AUDIO = /\.(ogg|oga|mp3|m4a|aac|wav|opus)(\?|$)/i;

export type Turno = {
  quien: "cliente" | "flujo" | "agente";
  hora: string;
  // URL del adjunto cuando el mensaje es una nota de voz. GHL la sirve
  // directa, así que se puede escuchar desde acá en vez de quedarse con «no
  // se puede leer».
  audio: string | null;
  // null cuando el mensaje es una nota de voz o una imagen: GHL manda el
  // archivo, no su contenido. Se muestra como tal en vez de inventar texto.
  texto: string | null;
  // Minutos que pasaron desde el mensaje del cliente anterior. Solo en los
  // turnos del agente que responden a algo.
  esperaMin?: number;
};

export type LeadInteraccion = {
  id: string;
  nombre: string;
  agente: string;
  telefono: string | null;
  // Cuándo entró el lead. Una conversación puede empezar un día y seguir al
  // siguiente, así que la hora sola no ubica nada.
  creado: string;
  // Enlace a la ficha en GHL: lo que se ve acá es una foto del momento en que
  // se leyó; el CRM es la conversación en vivo.
  crmUrl: string;
  // Lo que dijo el cliente, en sus palabras, para leerlo sin abrir el hilo.
  mensaje: string;
  escribio: string | null;
  respondio: string | null;
  esperaMin: number | null;
  pendiente: boolean;
  notasDeVoz: number;
  turnos: Turno[];
};

export type Interaccion = {
  leads: LeadInteraccion[];
  resumen: {
    leads: number;
    escribieron: number;
    masDe5Min: number;
    sinResponder: number;
  };
  recortado: boolean;
  // Conversaciones que GHL no dejó leer. Se muestran en pantalla: una lista
  // corta sin explicación se lee como "hoy hubo poco", que es falso.
  noLeidas: number;
  generadoEn: string;
};

/** La ficha del contacto en GHL, en la marca blanca de la oficina. */
function fichaEnCrm(contactId: string): string {
  const base = (process.env.GHL_CRM_URL ?? "https://app.nexusia.com.co").replace(/\/+$/, "");
  return `${base}/v2/location/${process.env.GHL_LOCATION_ID}/contacts/detail/${contactId}`;
}

function inicioDeHoyBogota(ms: number): number {
  const local = new Date(ms - BOGOTA_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + BOGOTA_OFFSET_MS;
}

function quienEs(m: GhlMensaje): Turno["quien"] {
  if (m.direction === "inbound") return "cliente";
  return m.source === "workflow" ? "flujo" : "agente";
}

/**
 * Arma la conversación de un lead y mide cuánto esperó.
 *
 * La espera se cuenta desde el primer mensaje que el cliente escribió de
 * verdad —no el formulario de Facebook, que GHL guarda como mensaje entrante—
 * hasta el primer mensaje de una persona. Los mensajes del flujo no cuentan
 * como respuesta: contestar con un robot no es atender.
 */
function armarLead(c: GhlContact, agente: string, mensajes: GhlMensaje[]): LeadInteraccion | null {
  const utiles = mensajes
    .filter((m) => !(m.messageType ?? "").includes("ACTIVITY"))
    .sort((a, b) => a.dateAdded.localeCompare(b.dateAdded));
  if (utiles.length === 0) return null;

  const turnos: Turno[] = utiles.map((m) => ({
    quien: quienEs(m),
    hora: m.dateAdded,
    texto: (m.body ?? "").trim() || null,
    audio: (m.attachments ?? []).find((a) => ES_AUDIO.test(a)) ?? null,
  }));

  // El cliente "levanta la mano" con su primer mensaje propio.
  const iCliente = utiles.findIndex(
    (m) => m.direction === "inbound" && !ES_FORMULARIO.test((m.body ?? "").trim())
  );

  let escribio: string | null = null;
  let respondio: string | null = null;
  let esperaMin: number | null = null;
  let pendiente = false;

  if (iCliente >= 0) {
    escribio = utiles[iCliente].dateAdded;
    const iAgente = utiles.findIndex(
      (m, i) => i > iCliente && m.direction === "outbound" && m.source !== "workflow"
    );
    if (iAgente >= 0) {
      respondio = utiles[iAgente].dateAdded;
      esperaMin = Math.round(
        (new Date(respondio).getTime() - new Date(escribio).getTime()) / 60000
      );
    } else {
      pendiente = true;
      esperaMin = Math.round((Date.now() - new Date(escribio).getTime()) / 60000);
    }
  }

  // La espera de cada tramo, no solo la primera: una conversación puede tener
  // tres idas y vueltas y lo que interesa es dónde se cortó.
  let ultimoCliente: number | null = null;
  turnos.forEach((t) => {
    if (t.quien === "cliente") ultimoCliente = new Date(t.hora).getTime();
    else if (t.quien === "agente" && ultimoCliente !== null) {
      t.esperaMin = Math.round((new Date(t.hora).getTime() - ultimoCliente) / 60000);
      ultimoCliente = null;
    }
  });

  const dichos = turnos
    .filter((t) => t.quien === "cliente" && t.texto && !ES_FORMULARIO.test(t.texto))
    .map((t) => `«${t.texto}»`);

  return {
    id: c.id,
    nombre: contactDisplayName(c),
    agente,
    telefono: c.phone ?? null,
    creado: c.dateAdded,
    crmUrl: fichaEnCrm(c.id),
    mensaje: dichos.slice(0, 3).join(" · ") || "No escribió nada",
    escribio,
    respondio,
    esperaMin,
    pendiente,
    notasDeVoz: turnos.filter((t) => t.quien === "agente" && t.texto === null).length,
    turnos,
  };
}

/**
 * Las conversaciones del día: quién escribió, qué dijo y a qué hora le
 * respondieron.
 *
 * No devuelve promedios a propósito. Un promedio de una hora, cuando alguien
 * esperó cinco, esconde justamente el caso que hay que ver.
 */
export async function computeInteraccion(
  soloAgente?: string | null,
  dia?: string | null
): Promise<Interaccion> {
  const ahora = Date.now();
  const llave = `${soloAgente ?? "todos"}|${dia ?? "hoy"}`;
  const guardado = cache.get(llave);
  if (guardado && ahora - guardado.en < CACHE_MS) return guardado.datos;

  const base = dia ? new Date(`${dia}T12:00:00-05:00`).getTime() : ahora;
  const desde = new Date(inicioDeHoyBogota(base)).toISOString();
  const hasta = new Date(Math.min(inicioDeHoyBogota(base) + 864e5, ahora)).toISOString();

  const contactos = await searchContacts([
    { field: "tags", operator: "contains", value: process.env.GHL_LEAD_TAG ?? "ingreso de pauta" },
    { field: "dateAdded", operator: "range", value: { gte: desde, lte: hasta } },
  ]);

  const mios: { c: GhlContact; agente: string }[] = [];
  for (const c of contactos) {
    const { agent, agentId } = await extractAttribution(c);
    if (soloAgente && agentId !== soloAgente) continue;
    mios.push({ c, agente: agent });
  }

  const recortado = mios.length > TOPE_LEADS;
  const aRevisar = mios.slice(0, TOPE_LEADS);

  let noLeidas = 0;
  const leads = (
    await enTandas(aRevisar, async ({ c, agente }) => {
      try {
        const conversacionId = await buscarConversacion(c.id);
        if (!conversacionId) return null;
        return armarLead(c, agente, await mensajesDeConversacion(conversacionId));
      } catch {
        noLeidas += 1;
        return null;
      }
    })
  ).filter((l): l is LeadInteraccion => l !== null);

  // Primero los que están esperando, después por espera más larga. Un lead sin
  // responder es trabajo pendiente; los demás ya son historia.
  leads.sort((a, b) => {
    if (a.pendiente !== b.pendiente) return a.pendiente ? -1 : 1;
    return (b.esperaMin ?? -1) - (a.esperaMin ?? -1);
  });

  const escribieron = leads.filter((l) => l.escribio);
  const datos: Interaccion = {
    leads,
    resumen: {
      leads: mios.length,
      escribieron: escribieron.length,
      // Cinco minutos, no una hora: a la hora el lead ya se enfrió y el dato
      // llega tarde para hacer algo con él.
      masDe5Min: escribieron.filter((l) => (l.esperaMin ?? 0) > 5).length,
      sinResponder: leads.filter((l) => l.pendiente).length,
    },
    recortado,
    noLeidas,
    generadoEn: new Date(ahora).toISOString(),
  };

  if (noLeidas === 0) cache.set(llave, { en: ahora, datos });
  return datos;
}

/**
 * Busca una persona por nombre o teléfono, sin importar el día en que entró.
 *
 * El módulo normal solo lee los leads de un día: es lo que se puede sostener
 * contra el límite de GHL. Pero la pregunta «¿qué pasó con Julio?» no viene
 * con la fecha puesta, y obligar a adivinar el día para encontrarlo hacía el
 * buscador inútil. Acá se busca en toda la pauta y se arman las
 * conversaciones de los primeros resultados.
 */
export async function buscarLeads(
  soloAgente: string | null | undefined,
  texto: string
): Promise<{ leads: LeadInteraccion[]; encontrados: number; noLeidas: number }> {
  const contactos = await searchContacts(
    [{ field: "tags", operator: "contains", value: process.env.GHL_LEAD_TAG ?? "ingreso de pauta" }],
    texto
  );

  const mios: { c: GhlContact; agente: string }[] = [];
  for (const c of contactos) {
    const { agent, agentId } = await extractAttribution(c);
    if (soloAgente && agentId !== soloAgente) continue;
    mios.push({ c, agente: agent });
  }

  // Los más recientes primero: quien busca un nombre suele querer la última
  // vez que esa persona apareció, no la primera.
  mios.sort((a, b) => b.c.dateAdded.localeCompare(a.c.dateAdded));

  let noLeidas = 0;
  const leads = (
    await enTandas(mios.slice(0, TOPE_BUSQUEDA), async ({ c, agente }) => {
      try {
        const conversacionId = await buscarConversacion(c.id);
        if (!conversacionId) return null;
        return armarLead(c, agente, await mensajesDeConversacion(conversacionId));
      } catch {
        noLeidas += 1;
        return null;
      }
    })
  ).filter((l): l is LeadInteraccion => l !== null);

  return { leads, encontrados: mios.length, noLeidas };
}
