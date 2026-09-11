import { searchContacts, extractAttribution, contactDisplayName } from "./ghl";
import { getPool } from "./db";
import {
  estadoDeLead,
  recorridoDeLead,
  accionesDeLead,
  yaDeposito,
  TAG_BUSINESS,
  TAG_CANAL_FREE,
  TAG_INTERACCION_AUTO,
  TAG_INTERACCION_MANUAL,
  type EstadoLead,
} from "./leadStates";

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

// Ventana de la lista. 30 días porque la curva real de depósitos muestra que
// el 44% deposita entre la semana 2 y la 4: cortar antes esconde justo donde
// está la plata.
const VENTANA_DIAS = 30;
// Tope por bloque. Una lista de 300 no la trabaja nadie; el total igual se
// muestra para que se sepa cuántos quedaron afuera.
const TOPE = 40;

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

export async function computeMiDia(agenteId?: string | null): Promise<MiDia> {
  const ahora = Date.now();
  const hoyMs = inicioDeHoyBogota(ahora);
  const desde = new Date(ahora - VENTANA_DIAS * DIA_MS).toISOString();

  const [contactos, movimientos] = await Promise.all([
    searchContacts([
      { field: "tags", operator: "contains", value: process.env.GHL_LEAD_TAG ?? "ingreso de pauta" },
      { field: "dateAdded", operator: "range", value: { gte: desde, lte: new Date(ahora).toISOString() } },
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

    const { agent, agentId } = await extractAttribution(c);
    if (agentId && (!filtrado || agentId === agenteId)) agentes.set(agentId, agent);
    if (filtrado && agentId !== agenteId) continue;

    const altaMs = new Date(c.dateAdded).getTime();
    const mov = movimientos.get(c.id);

    items.push({
      id: c.id,
      nombre: contactDisplayName(c),
      telefono: c.phone ?? null,
      agenteId: agentId,
      agente: agent,
      estado: estadoDeLead(c),
      recorrido: recorridoDeLead(c),
      acciones: accionesDeLead(c),
      dias: Math.floor((hoyMs - inicioDeHoyBogota(altaMs)) / DIA_MS),
      movimiento: mov
        ? {
            que: ACCION_DE_TAG[mov.tag] ?? mov.tag,
            cuando: haceCuanto(mov.ms, ahora),
            cuandoMs: mov.ms,
            esRescate: altaMs < hoyMs,
          }
        : undefined,
    });
  }

  const usados = new Set<string>();
  function tomar(filtro: (l: LeadItem) => boolean, orden: (a: LeadItem, b: LeadItem) => number) {
    const todos = items.filter((l) => !usados.has(l.id) && filtro(l)).sort(orden);
    for (const l of todos.slice(0, TOPE)) usados.add(l.id);
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
    (l) => l.estado === "caliente",
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
  };
}
