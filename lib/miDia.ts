import { searchContacts, obtenerContacto, extractAttribution, contactDisplayName, type GhlContact } from "./ghl";
import { getPool } from "./db";
import {
  estadoDeLead,
  recorridoDeLead,
  accionesDeLead,
  yaDeposito,
  conteoVacio,
  TAG_BUSINESS,
  TAG_CANAL_FREE,
  TAG_INTERACCION_AUTO,
  TAG_INTERACCION_MANUAL,
  type EstadoLead,
} from "./leadStates";

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Cuánto se trae de GHL: 30 días.
 *
 * La curva real de depósitos muestra que el 44% deposita entre la semana 2 y
 * la 4. Cortar la búsqueda antes escondería justamente donde está la plata, y
 * los rescates dejarían de existir.
 */
const VENTANA_DIAS = 30;

/**
 * Los bloques del día miran una ventana más corta que la búsqueda.
 *
 * Un caliente de hace tres semanas no es el trabajo de hoy — o ya se cerró, o
 * pasó a ser un rescate. Rescates es el único bloque sin recorte: ahí va todo
 * lo que la búsqueda encuentre, porque es justo lo que no hay que perder.
 */
const DIAS_CALIENTE = 7;

// Tope de seguridad por bloque. No es un recorte de trabajo —la pantalla
// pagina— sino un freno para que una respuesta no crezca sin control. Está
// muy por encima de lo que da un mes de la oficina entera: si algún día se
// alcanza, la pantalla avisa cuántos quedaron afuera en vez de mentir.
const TOPE = 2000;

export type LeadItem = {
  id: string;
  nombre: string;
  telefono: string | null;
  agenteId: string | null;
  agente: string;
  estado: EstadoLead;
  recorrido: string;
  // Acciones sueltas, para dibujar la escala de puntos del embudo. El
  // recorrido ya viene armado como texto, pero la escala necesita saber cuáles
  // se cumplieron y cuáles no, una por una.
  acciones: string[];
  dias: number; // días desde que entró
  // Momento exacto en que entró. El agente necesita la hora, no solo "hace 2
  // días": a las 7 de la mañana y a las 8 de la noche no se trabaja igual.
  creado: string;
  movimiento?: { que: string; cuando: string; cuandoMs: number; esRescate: boolean };
};

export type Bloque = {
  id: string;
  titulo: string;
  subtitulo: string;
  tono: EstadoLead | "movimiento" | "rescate";
  items: LeadItem[];
  total: number;
};

export type MiDia = {
  bloques: Bloque[];
  agentes: { id: string; nombre: string }[];
  locationId: string;
  generadoEn: string;
  // Qué ventana de fechas se consultó. La pantalla la muestra para que nunca
  // se confunda "no hay leads" con "no los pediste".
  rango: { desde: string; hasta: string };
  // Cuántos leads de la lista hay en cada temperatura.
  porEstado: Record<EstadoLead, number>;
  // true mientras es solo el arranque rápido: falta el resto de la lista.
  parcial?: boolean;
};

// Nombre humano de cada etiqueta, para el feed de movimientos. Las que no
// están acá (pauta juniors, link-NNN, país) no son acciones del cliente y no
// se muestran.
const ACCION_DE_TAG: Record<string, string> = {
  [TAG_INTERACCION_AUTO]: "respondió",
  [TAG_INTERACCION_MANUAL]: "respondió",
  [TAG_CANAL_FREE]: "entró al canal",
  [TAG_BUSINESS]: "bajó a WhatsApp",
  "tag-julian-registrado": "se registró",
  "ftd-efectuado": "depositó",
};

function inicioDeHoyBogota(ahoraMs: number): number {
  const local = new Date(ahoraMs - BOGOTA_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + BOGOTA_OFFSET_MS;
}

function haceCuanto(desdeMs: number, ahoraMs: number): string {
  const min = Math.max(Math.round((ahoraMs - desdeMs) / 60000), 0);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

/**
 * Movimientos de hoy, del cuaderno de etiquetas.
 *
 * Solo filas 'poll': las de 'backfill' son etiquetas que ya existían cuando el
 * sondeo vio al contacto por primera vez y su hora no es confiable. Meterlas
 * acá llenaría el feed de movimientos que nunca ocurrieron hoy.
 */
async function movimientosDeHoy(desdeMs: number): Promise<Map<string, { tag: string; ms: number }>> {
  const { rows } = await getPool().query<{ contact_id: string; tag: string; occurred_at: Date }>(
    `select contact_id, tag, occurred_at
       from tag_history
      where source = 'poll'
        and occurred_at >= $1
        and tag = any($2::text[])
      order by occurred_at asc`,
    [new Date(desdeMs), Object.keys(ACCION_DE_TAG)]
  );

  // Nos quedamos con el último movimiento de cada contacto: es el que define
  // en qué anda ahora.
  const ultimo = new Map<string, { tag: string; ms: number }>();
  for (const r of rows) ultimo.set(r.contact_id, { tag: r.tag, ms: r.occurred_at.getTime() });
  return ultimo;
}

type Movimientos = Map<string, { tag: string; ms: number }>;

async function aLeadItem(
  c: GhlContact,
  ahora: number,
  hoyMs: number,
  movimientos: Movimientos
): Promise<{ item: LeadItem; agentId: string | null; agente: string }> {
  const { agent, agentId } = await extractAttribution(c);
  const altaMs = new Date(c.dateAdded).getTime();
  const mov = movimientos.get(c.id);

  return {
    agentId,
    agente: agent,
    item: {
      id: c.id,
      nombre: contactDisplayName(c),
      telefono: c.phone ?? null,
      agenteId: agentId,
      agente: agent,
      estado: estadoDeLead(c),
      recorrido: recorridoDeLead(c),
      acciones: accionesDeLead(c),
      dias: Math.floor((hoyMs - inicioDeHoyBogota(altaMs)) / DIA_MS),
      creado: c.dateAdded,
      movimiento: mov
        ? {
            que: ACCION_DE_TAG[mov.tag] ?? mov.tag,
            cuando: haceCuanto(mov.ms, ahora),
            cuandoMs: mov.ms,
            esRescate: altaMs < hoyMs,
          }
        : undefined,
    },
  };
}

/**
 * Solo el bloque "Se movieron hoy", para la primera pantalla.
 *
 * Los movimientos salen de Postgres en milisegundos y son un puñado, así que
 * se traen esos contactos uno por uno en vez de esperar la búsqueda del mes
 * entero. El agente ve en un segundo lo único que cambió desde ayer, y el
 * resto de la lista llega después sin que haya tenido que mirar una pantalla
 * vacía nueve segundos.
 */
export async function computeMovimientosDeHoy(agenteId?: string | null): Promise<MiDia> {
  const ahora = Date.now();
  const hoyMs = inicioDeHoyBogota(ahora);
  const filtrado = Boolean(agenteId) && agenteId !== "todos";

  const movimientos = await movimientosDeHoy(hoyMs).catch(() => new Map() as Movimientos);
  const contactos = (await Promise.all([...movimientos.keys()].map(obtenerContacto))).filter(
    (c): c is GhlContact => c !== null
  );

  const porEstado = conteoVacio();
  const items: LeadItem[] = [];

  for (const c of contactos) {
    if (yaDeposito(c)) continue;
    const { item, agentId } = await aLeadItem(c, ahora, hoyMs, movimientos);
    if (filtrado && agentId !== agenteId) continue;
    items.push(item);
    porEstado[item.estado] += 1;
  }

  items.sort((a, b) => (b.movimiento?.cuandoMs ?? 0) - (a.movimiento?.cuandoMs ?? 0));

  return {
    bloques: [
      {
        id: "movimiento",
        titulo: "Se movieron hoy",
        subtitulo: "Mientras la mecha está prendida",
        tono: "movimiento",
        items,
        total: items.length,
      },
    ],
    // El selector de agentes lo llena la carga completa: para armarlo hay que
    // haber visto todos los contactos, no solo los que se movieron.
    agentes: [],
    locationId: process.env.GHL_LOCATION_ID ?? "",
    generadoEn: new Date(ahora).toISOString(),
    rango: { desde: new Date(hoyMs).toISOString(), hasta: new Date(ahora).toISOString() },
    porEstado,
    parcial: true,
  };
}

export async function computeMiDia(
  agenteId?: string | null,
  rango?: { desde?: string | null; hasta?: string | null }
): Promise<MiDia> {
  const ahora = Date.now();
  const hoyMs = inicioDeHoyBogota(ahora);

  // El rango pedido manda; si no viene, la última semana.
  const desde = rango?.desde || new Date(ahora - VENTANA_DIAS * DIA_MS).toISOString();
  const hasta = rango?.hasta || new Date(ahora).toISOString();

  const [contactos, movimientos] = await Promise.all([
    searchContacts([
      { field: "tags", operator: "contains", value: process.env.GHL_LEAD_TAG ?? "ingreso de pauta" },
      { field: "dateAdded", operator: "range", value: { gte: desde, lte: hasta } },
    ]),
    movimientosDeHoy(hoyMs).catch(() => new Map<string, { tag: string; ms: number }>()),
  ]);

  // Los nombres de todos los agentes solo sirven para el selector de la
  // dirección. Cuando la lista viene filtrada a una persona, el resto no se
  // manda: no tiene por qué enterarse de quiénes son sus compañeros.
  const filtrado = Boolean(agenteId) && agenteId !== "todos";
  const agentes = new Map<string, string>();
  const items: LeadItem[] = [];

  for (const c of contactos) {
    // El que ya depositó no es una oportunidad abierta: está en FTD.
    if (yaDeposito(c)) continue;

    const { item, agentId, agente } = await aLeadItem(c, ahora, hoyMs, movimientos);
    if (agentId && (!filtrado || agentId === agenteId)) agentes.set(agentId, agente);
    if (filtrado && agentId !== agenteId) continue;

    items.push(item);
  }

  const usados = new Set<string>();

  // Reparto por temperatura de lo que realmente entra a la lista.
  //
  // Se cuenta acá y no en la pantalla porque no todos los leads caen en un
  // bloque (un frío de anteayer no es el trabajo de hoy), y porque los
  // bloques recortan a TOPE: contando lo que se muestra, el arco diría un
  // total distinto al que tiene al lado.
  const porEstado = conteoVacio();

  function tomar(filtro: (l: LeadItem) => boolean, orden: (a: LeadItem, b: LeadItem) => number) {
    const todos = items.filter((l) => !usados.has(l.id) && filtro(l)).sort(orden);
    for (const l of todos) {
      usados.add(l.id);
      porEstado[l.estado] += 1;
    }
    return { items: todos.slice(0, TOPE), total: todos.length };
  }

  // El orden de los bloques es el orden en que conviene trabajar, y cada lead
  // cae en uno solo: el primero que lo reclama. Si un lead se movió hoy va
  // arriba aunque también sea caliente, porque tiene la mecha prendida.
  const masReciente = (a: LeadItem, b: LeadItem) => a.dias - b.dias;

  // Lo más reciente primero: el que se movió hace 10 minutos vale más que el
  // que se movió esta mañana.
  const movHoy = tomar(
    (l) => !!l.movimiento,
    (a, b) => b.movimiento!.cuandoMs - a.movimiento!.cuandoMs
  );
  const calientes = tomar(
    (l) => l.estado === "caliente" && l.dias <= DIAS_CALIENTE,
    masReciente
  );
  const tibios = tomar((l) => l.estado === "tibio" && l.dias <= 3, masReciente);
  const frios = tomar((l) => l.estado === "frio" && l.dias === 0, masReciente);
  // Los calientes viejos ya se los llevó su propio bloque, así que acá quedan
  // los tibios estancados. Se muestran del más reciente al más viejo: alguien
  // que respondió hace 5 días todavía se acuerda de la conversación, uno de
  // hace 30 arranca de cero.
  const rescates = tomar(
    (l) => l.dias >= 4 && l.estado !== "frio",
    (a, b) => a.dias - b.dias
  );

  const bloques: Bloque[] = [
    {
      id: "movimiento",
      titulo: "Se movieron hoy",
      subtitulo: "Mientras la mecha está prendida",
      tono: "movimiento",
      ...movHoy,
    },
    {
      id: "caliente",
      titulo: "Calientes",
      subtitulo: "Lo más cerca de la plata",
      tono: "caliente",
      ...calientes,
    },
    {
      id: "tibio",
      titulo: "Tibios de los últimos 3 días",
      subtitulo: "Falta bajarlos a WhatsApp",
      tono: "tibio",
      ...tibios,
    },
    {
      id: "frio",
      titulo: "Fríos de hoy",
      subtitulo: "Primer contacto, todavía no respondieron",
      tono: "frio",
      ...frios,
    },
    {
      id: "rescate",
      titulo: "Rescates",
      // Antes decía "acá deposita el 44%", que se leía como si el 44% de estos
      // leads fuera a depositar. El 44% es la porción de TODOS los depósitos
      // que hace gente entrada hace 2 a 4 semanas: es un argumento para
      // priorizar el bloque, no un dato que el agente necesite mientras
      // trabaja la lista.
      subtitulo: "Respondieron y nadie los movió",
      tono: "rescate",
      ...rescates,
    },
  ];

  return {
    bloques,
    agentes: [...agentes.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    locationId: process.env.GHL_LOCATION_ID ?? "",
    generadoEn: new Date(ahora).toISOString(),
    rango: { desde, hasta },
    porEstado,
  };
}
