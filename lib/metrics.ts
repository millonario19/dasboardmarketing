import {
  searchContacts,
  extractAttribution,
  isRegistrado,
  isFtdEfectuado,
  isIngresoPauta,
  hasOwnAffiliateLink,
  contactDisplayName,
  type GhlContact,
} from "./ghl";
import {
  estadoDeLead,
  accionesDeLead,
  confirmacionDeBajada,
  TAG_BUSINESS,
  yaDeposito,
  interactuoAuto,
  conteoVacio,
  ESTADOS,
  TAG_CONFIABLE_DESDE,
  TAG_INTERACCION_AUTO,
  type EstadoLead,
} from "./leadStates";

/**
 * Deja solo los contactos de un agente.
 *
 * Es el filtro que hace que un agente vea su propio tablero: se aplica apenas
 * vuelven los contactos de GHL, así que todo lo que se calcula después —las
 * tarjetas, el panel de estados, la tabla, los totales— ya sale con sus
 * números y no hay ningún camino por el que se le escape un lead ajeno.
 *
 * El id llega siempre de la cookie firmada, nunca de la URL.
 */
async function soloDelAgente<T extends GhlContact>(
  contactos: T[],
  agentId: string | null | undefined
): Promise<T[]> {
  if (!agentId) return contactos;
  const propios: T[] = [];
  for (const contacto of contactos) {
    const { agentId: suyo } = await extractAttribution(contacto);
    if (suyo === agentId) propios.push(contacto);
  }
  return propios;
}

// Colombia no tiene horario de verano: UTC-5 todo el año.
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

function bogotaRange(refMs: number, unit: "day" | "month"): { from: string; to: string } {
  const local = new Date(refMs - BOGOTA_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();

  const startLocalMs = unit === "day" ? Date.UTC(y, m, d) : Date.UTC(y, m, 1);
  const endLocalMs = unit === "day" ? Date.UTC(y, m, d + 1) : Date.UTC(y, m + 1, 1);

  return {
    from: new Date(startLocalMs + BOGOTA_OFFSET_MS).toISOString(),
    to: new Date(endLocalMs + BOGOTA_OFFSET_MS).toISOString(),
  };
}

function updatedMs(contact: GhlContact): number {
  return new Date(contact.dateUpdated ?? contact.dateAdded).getTime();
}

const LEAD_TAG = () => process.env.GHL_LEAD_TAG ?? "ingreso de pauta";
const REGISTRO_TAG = () => process.env.GHL_REGISTRO_TAG ?? "tag-julian-registrado";
const FTD_TAG = () => process.env.GHL_FTD_TAG ?? "ftd-efectuado";

export type ContactDetail = {
  id: string;
  name: string;
  phone: string | null;
  dateAdded: string;
  tags: string[];
  registrado: boolean;
  ftd: boolean;
  ftdEventDate: string | null; // fecha real del depósito (dateUpdated), no dateAdded
  // La temperatura del lead, con la misma regla del panel: el agente ve en su
  // lista quién está caliente sin tener que interpretar las etiquetas.
  estado: EstadoLead;
  // El flujo marcó una bajada a WhatsApp sobre este contacto.
  marcadoBajada: boolean;
  // Qué respondió el agente sobre esa bajada: sí, no, o todavía nada.
  confirmacion: "si" | "no" | null;
};

// Detalle de los contactos de un agente en un rango. Dos búsquedas puntuales
// (por assignedTo, filtradas server-side en GHL) en vez de escanear todo el
// histórico de la cuenta:
//   1. Contactos de este agente creados en el rango (leads/registros).
//   2. Contactos de este agente con FTD cuya fecha real de depósito cae en
//      el rango, aunque hayan sido creados antes.
export async function listContactsForAgent(from: string, to: string, agentId: string): Promise<ContactDetail[]> {
  const [arrived, ftdCarryover] = await Promise.all([
    searchContacts([
      { field: "assignedTo", operator: "eq", value: agentId },
      { field: "dateAdded", operator: "range", value: { gte: from, lte: to } },
    ]),
    searchContacts([
      { field: "assignedTo", operator: "eq", value: agentId },
      { field: "tags", operator: "contains", value: FTD_TAG() },
      { field: "dateUpdated", operator: "range", value: { gte: from, lte: to } },
    ]),
  ]);

  const byId = new Map<string, GhlContact>();
  for (const c of arrived) byId.set(c.id, c);
  for (const c of ftdCarryover) if (!byId.has(c.id)) byId.set(c.id, c);

  const details: ContactDetail[] = [...byId.values()].map((contact) => {
    const ftdValido = isFtdEfectuado(contact) && hasOwnAffiliateLink(contact);
    return {
      id: contact.id,
      name: contactDisplayName(contact),
      phone: contact.phone ?? null,
      dateAdded: contact.dateAdded,
      tags: contact.tags ?? [],
      registrado: isRegistrado(contact) && hasOwnAffiliateLink(contact),
      ftd: ftdValido,
      ftdEventDate: ftdValido ? contact.dateUpdated ?? null : null,
      estado: estadoDeLead(contact),
      marcadoBajada: (contact.tags ?? []).some((t) => t.toLowerCase() === TAG_BUSINESS),
      confirmacion: confirmacionDeBajada(contact),
    };
  });

  details.sort((a, b) => {
    const aDate = a.ftdEventDate ?? a.dateAdded;
    const bDate = b.ftdEventDate ?? b.dateAdded;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
  return details;
}

export type AgentProductionRow = {
  agent: string;
  agentId: string | null;
  office: string;
  leadsHoy: number;
  leadsMes: number;
  registrosHoy: number;
  ftdHoy: number;
  registrosMes: number;
  ftdMes: number;
};

export type Alerta = {
  id: string;
  tipo: "pauta" | "agente" | "productividad";
  severidad: "alta" | "media";
  titulo: string;
  detalle: string;
};

export type PanelEstados = {
  hoy: Record<EstadoLead, number>;
  mes: Record<EstadoLead, number>;
  interaccion: {
    tasaHoy: number | null; // % sobre leads maduros de hoy, solo tag automático
    madurosHoy: number;
    baseline: number | null; // mediana de los días válidos anteriores
    diasValidos: number;
  };
  alertas: Alerta[];
  // Las fechas exactas de cada ventana. Van acá para que la pantalla pueda
  // pedir el detalle de una tarjeta sin rehacer la cuenta de la zona horaria
  // de Bogotá, que es justo donde se cuelan los errores de un día.
  rango: { hoy: Rango; mes: Rango };
};

export type Rango = { from: string; to: string };

export type AgentProduction = {
  rows: AgentProductionRow[];
  totals: {
    leadsHoy: number;
    leadsMes: number;
    registrosHoy: number;
    ftdHoy: number;
    registrosMes: number;
    ftdMes: number;
  };
  panel: PanelEstados;
  range: { today: { from: string; to: string }; month: { from: string; to: string } };
};

// Un lead recién entrado todavía no tuvo tiempo de responder. Si se lo contara
// en la tasa de interacción, a primera hora del día la tasa siempre daría por
// el piso y la alerta de pauta sonaría todas las mañanas.
const MADUREZ_MS = 60 * 60 * 1000;

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

function diaBogota(iso: string): string {
  return new Date(new Date(iso).getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Estados, tasas de interacción y alertas, todo sobre los contactos que ya se
 * trajeron para contar leads. No agrega ni una llamada a GHL.
 */
function calcularPanel(
  leadContacts: GhlContact[],
  registroContacts: GhlContact[],
  nombrePorAgente: Map<string, string>,
  ahoraMs: number,
  todayFromMs: number,
  todayToMs: number
): Omit<PanelEstados, "rango"> {
  const hoy = conteoVacio();
  const mes = conteoVacio();
  const hoyStr = diaBogota(new Date(ahoraMs).toISOString());
  const desdeConfiable = TAG_CONFIABLE_DESDE[TAG_INTERACCION_AUTO];

  // Tasa de interacción automática por día, para el baseline histórico.
  const porDia = new Map<string, { leads: number; auto: number }>();
  // Por agente, solo lo de hoy y ya filtrado a leads maduros.
  const porAgente = new Map<string, { maduros: number; auto: number }>();

  for (const contacto of leadContacts) {
    const t = new Date(contacto.dateAdded).getTime();
    const dia = diaBogota(contacto.dateAdded);

    // Los que ya depositaron salen del panel: su lugar es la tarjeta de FTD.
    // Igual siguen contando para la tasa de interacción, que mide si el
    // agente atendió al lead y no en qué estado terminó.
    const enPanel = !yaDeposito(contacto);
    if (enPanel) {
      const estado = estadoDeLead(contacto);
      mes[estado] += 1;
      if (t >= todayFromMs && t < todayToMs) hoy[estado] += 1;
    }

    if (!porDia.has(dia)) porDia.set(dia, { leads: 0, auto: 0 });
    const d = porDia.get(dia)!;
    d.leads += 1;
    if (interactuoAuto(contacto)) d.auto += 1;

    if (t >= todayFromMs && t < todayToMs) {
      if (ahoraMs - t >= MADUREZ_MS) {
        const id = contacto.assignedTo ?? "sin-asignar";
        if (!porAgente.has(id)) porAgente.set(id, { maduros: 0, auto: 0 });
        const a = porAgente.get(id)!;
        a.maduros += 1;
        if (interactuoAuto(contacto)) a.auto += 1;
      }
    }
  }

  const madurosHoy = [...porAgente.values()].reduce((s, a) => s + a.maduros, 0);
  const autoHoy = [...porAgente.values()].reduce((s, a) => s + a.auto, 0);
  const tasaHoy = madurosHoy > 0 ? (autoHoy / madurosHoy) * 100 : null;

  // Solo días completos anteriores a hoy y posteriores al encendido del tag.
  const tasasPrevias = [...porDia.entries()]
    .filter(([dia, d]) => dia < hoyStr && dia >= desdeConfiable && d.leads >= 10)
    .map(([, d]) => (d.auto / d.leads) * 100);
  const baseline = tasasPrevias.length >= 3 ? mediana(tasasPrevias) : null;

  const alertas: Alerta[] = [];

  // 1. Pauta sospechosa: cae la oficina entera, no un agente.
  if (baseline !== null && tasaHoy !== null && madurosHoy >= 20 && tasaHoy < baseline * 0.6) {
    alertas.push({
      id: "pauta",
      tipo: "pauta",
      severidad: "alta",
      titulo: "La pauta de hoy no está respondiendo",
      detalle:
        `${tasaHoy.toFixed(0)}% de interacción sobre ${madurosHoy} leads maduros, contra ` +
        `${baseline.toFixed(0)}% habitual. Cuando cae la oficina entera y no un agente suelto, ` +
        `el sospechoso es la segmentación del público.`,
    });
  }

  const tresDiasMs = ahoraMs - 3 * 24 * 60 * 60 * 1000;

  // 2. Agente muy por debajo del histórico de la oficina.
  //
  //    La ventana es de 3 días, no de hoy: cada agente recibe unos 8 leads
  //    diarios, y sobre 6 leads sacar 1 sola interacción pasa por puro azar
  //    más del 10% de las veces. Con ~24 leads la señal ya es real y la
  //    alerta deja de sonar en falso.
  if (baseline !== null) {
    const por3d = new Map<string, { maduros: number; auto: number }>();
    for (const c of leadContacts) {
      const t = new Date(c.dateAdded).getTime();
      if (t < tresDiasMs) continue;
      if (ahoraMs - t < MADUREZ_MS) continue;
      if (diaBogota(c.dateAdded) < desdeConfiable) continue;
      const id = c.assignedTo ?? "sin-asignar";
      if (!por3d.has(id)) por3d.set(id, { maduros: 0, auto: 0 });
      const a = por3d.get(id)!;
      a.maduros += 1;
      if (interactuoAuto(c)) a.auto += 1;
    }
    for (const [id, a] of por3d) {
      if (id === "sin-asignar" || a.maduros < 15) continue;
      const tasa = (a.auto / a.maduros) * 100;
      if (tasa >= baseline * 0.5) continue;
      alertas.push({
        id: `agente-${id}`,
        tipo: "agente",
        severidad: "media",
        titulo: `${nombrePorAgente.get(id) ?? id} casi no está interactuando`,
        detalle:
          `${tasa.toFixed(0)}% sobre ${a.maduros} leads de los últimos 3 días, contra ` +
          `${baseline.toFixed(0)}% de la oficina. El resto del equipo está normal, así que no es la pauta.`,
      });
    }
  }

  // 3. Volumen sin resultado: se mira a 3 días porque los registros son
  //    escasos (~4 por día en toda la oficina) y a un día no dice nada.
  const leads3d = new Map<string, number>();
  for (const c of leadContacts) {
    if (new Date(c.dateAdded).getTime() < tresDiasMs) continue;
    const id = c.assignedTo ?? "sin-asignar";
    leads3d.set(id, (leads3d.get(id) ?? 0) + 1);
  }
  const registros3d = new Set<string>();
  for (const c of registroContacts) {
    if (new Date(c.dateAdded).getTime() < tresDiasMs) continue;
    if (!hasOwnAffiliateLink(c)) continue;
    if (c.assignedTo) registros3d.add(c.assignedTo);
  }
  for (const [id, n] of leads3d) {
    if (id === "sin-asignar" || n < 20 || registros3d.has(id)) continue;
    alertas.push({
      id: `sin-registros-${id}`,
      tipo: "productividad",
      severidad: "media",
      titulo: `${nombrePorAgente.get(id) ?? id} sin registros en 3 días`,
      detalle: `${n} leads recibidos y ningún registro. Revisar si el problema es el cierre o la bajada.`,
    });
  }

  alertas.sort((a, b) => (a.severidad === b.severidad ? 0 : a.severidad === "alta" ? -1 : 1));

  return {
    hoy,
    mes,
    interaccion: { tasaHoy, madurosHoy, baseline, diasValidos: tasasPrevias.length },
    alertas,
  };
}

type MutableRow = Omit<AgentProductionRow, "agentId"> & { agentId: string | null };

function ensureRow(counts: Map<string, MutableRow>, agent: string, agentId: string | null, office: string) {
  const key = `${agentId ?? agent}::${office}`;
  const existing = counts.get(key);
  if (existing) return existing;
  const row: MutableRow = {
    agent,
    agentId,
    office,
    leadsHoy: 0,
    leadsMes: 0,
    registrosHoy: 0,
    registrosMes: 0,
    ftdHoy: 0,
    ftdMes: 0,
  };
  counts.set(key, row);
  return row;
}

// Vista única de producción por agente, validada con 3 reglas contra tags
// reales de GHL — 3 búsquedas puntuales server-side (por tag + rango de
// fecha), NO un escaneo del histórico completo de la cuenta:
//   Regla 1 — Lead: tag "ingreso de pauta", por fecha de creación (Creada).
//   Regla 2 — Registro: tag de registro + tag del link de afiliado propio
//             del agente, por fecha de creación.
//   Regla 3 — FTD: tag ftd-efectuado + tag del link propio, por fecha REAL
//             del depósito (dateUpdated) — el depósito casi siempre pasa
//             días después del registro, así que no sirve filtrar por Creada.
export async function computeAgentProduction(soloAgente?: string | null): Promise<AgentProduction> {
  const now = Date.now();
  const today = bogotaRange(now, "day");
  const month = bogotaRange(now, "month");
  const todayFromMs = new Date(today.from).getTime();
  const todayToMs = new Date(today.to).getTime();

  const [todosLeads, todosRegistros, todosFtd] = await Promise.all([
    searchContacts([
      { field: "tags", operator: "contains", value: LEAD_TAG() },
      { field: "dateAdded", operator: "range", value: { gte: month.from, lte: month.to } },
    ]),
    searchContacts([
      { field: "tags", operator: "contains", value: REGISTRO_TAG() },
      { field: "dateAdded", operator: "range", value: { gte: month.from, lte: month.to } },
    ]),
    searchContacts([
      { field: "tags", operator: "contains", value: FTD_TAG() },
      { field: "dateUpdated", operator: "range", value: { gte: month.from, lte: month.to } },
    ]),
  ]);

  const [leadContacts, registroContacts, ftdContacts] = await Promise.all([
    soloDelAgente(todosLeads, soloAgente),
    soloDelAgente(todosRegistros, soloAgente),
    soloDelAgente(todosFtd, soloAgente),
  ]);

  const counts = new Map<string, MutableRow>();

  for (const contact of leadContacts) {
    const t = new Date(contact.dateAdded).getTime();
    const { agent, agentId, office } = await extractAttribution(contact);
    const row = ensureRow(counts, agent, agentId, office);
    row.leadsMes += 1;
    if (t >= todayFromMs && t < todayToMs) row.leadsHoy += 1;
  }

  for (const contact of registroContacts) {
    if (!hasOwnAffiliateLink(contact)) continue;
    const t = new Date(contact.dateAdded).getTime();
    const { agent, agentId, office } = await extractAttribution(contact);
    const row = ensureRow(counts, agent, agentId, office);
    row.registrosMes += 1;
    if (t >= todayFromMs && t < todayToMs) row.registrosHoy += 1;
  }

  for (const contact of ftdContacts) {
    if (!hasOwnAffiliateLink(contact)) continue;
    const t = updatedMs(contact);
    const { agent, agentId, office } = await extractAttribution(contact);
    const row = ensureRow(counts, agent, agentId, office);
    row.ftdMes += 1;
    if (t >= todayFromMs && t < todayToMs) row.ftdHoy += 1;
  }

  const rows = [...counts.values()].sort((a, b) => b.leadsHoy - a.leadsHoy || b.ftdMes - a.ftdMes);

  // Los nombres ya se resolvieron arriba al atribuir cada contacto, así que el
  // panel los reusa en vez de volver a pegarle a /users de GHL.
  const nombrePorAgente = new Map<string, string>();
  for (const r of rows) if (r.agentId) nombrePorAgente.set(r.agentId, r.agent);

  const panel: PanelEstados = {
    ...calcularPanel(leadContacts, registroContacts, nombrePorAgente, now, todayFromMs, todayToMs),
    rango: { hoy: today, mes: month },
  };

  return {
    rows,
    panel,
    totals: {
      leadsHoy: rows.reduce((s, r) => s + r.leadsHoy, 0),
      leadsMes: rows.reduce((s, r) => s + r.leadsMes, 0),
      registrosHoy: rows.reduce((s, r) => s + r.registrosHoy, 0),
      ftdHoy: rows.reduce((s, r) => s + r.ftdHoy, 0),
      registrosMes: rows.reduce((s, r) => s + r.registrosMes, 0),
      ftdMes: rows.reduce((s, r) => s + r.ftdMes, 0),
    },
    range: { today, month },
  };
}

/**
 * Los leads que están en un estado, con nombre y teléfono.
 *
 * El panel dice cuántos hay; esto dice quiénes son. Sin esto, "Frío: 47" es un
 * número que no se puede trabajar: no hay a quién llamar.
 *
 * Usa exactamente las mismas reglas que el panel —misma búsqueda, mismo
 * descarte de los que ya depositaron, mismo estadoDeLead— para que la lista
 * nunca contradiga al número de la tarjeta de la que salió.
 */
export type LeadDeEstado = {
  id: string;
  nombre: string;
  telefono: string | null;
  creado: string;
  agente: string;
  acciones: string[];
  // El flujo de GHL marcó la bajada a WhatsApp, y qué contestó el agente
  // cuando se le preguntó si de verdad ocurrió.
  marcadoBajada: boolean;
  confirmacion: "si" | "no" | null;
};

// Tope por si un mes entero de leads fríos crece demasiado: la pantalla avisa
// cuántos quedaron afuera en vez de intentar dibujar mil filas.
const TOPE_LISTA = 400;

export async function listarLeadsPorEstado(
  from: string,
  to: string,
  estado: EstadoLead,
  soloAgente?: string | null
): Promise<{ leads: LeadDeEstado[]; total: number }> {
  const contactos = await soloDelAgente(
    await searchContacts([
      { field: "tags", operator: "contains", value: LEAD_TAG() },
      { field: "dateAdded", operator: "range", value: { gte: from, lte: to } },
    ]),
    soloAgente
  );

  const leads: LeadDeEstado[] = [];
  for (const contacto of contactos) {
    if (yaDeposito(contacto)) continue;
    if (estadoDeLead(contacto) !== estado) continue;
    const { agent } = await extractAttribution(contacto);
    leads.push({
      id: contacto.id,
      nombre: contactDisplayName(contacto),
      telefono: contacto.phone ?? null,
      creado: contacto.dateAdded,
      agente: agent,
      acciones: accionesDeLead(contacto),
      marcadoBajada: (contacto.tags ?? []).some((t) => t.toLowerCase() === TAG_BUSINESS),
      confirmacion: confirmacionDeBajada(contacto),
    });
  }

  leads.sort((a, b) => new Date(b.creado).getTime() - new Date(a.creado).getTime());
  return { leads: leads.slice(0, TOPE_LISTA), total: leads.length };
}

export type EstadosDeUnRango = {
  conteos: Record<EstadoLead, number>;
  total: number;
  depositaron: number;
};

/**
 * Los mismos estados del panel, pero para un rango de fechas cualquiera.
 *
 * Es una COHORTE por fecha de entrada: "los leads que entraron el 9 de
 * septiembre, en el estado que tienen hoy". No es una foto congelada de cómo
 * se veían ese día —GHL no guarda cuándo se puso cada etiqueta—, sino cómo
 * terminaron madurando. Que es justamente lo que sirve para juzgar la pauta
 * de un día: no cuántos habían respondido a las 6 de la tarde, sino cuántos
 * respondieron en total.
 */
export async function computeEstadosDeUnRango(
  from: string,
  to: string,
  soloAgente?: string | null
): Promise<EstadosDeUnRango> {
  const leadContacts = await soloDelAgente(
    await searchContacts([
      { field: "tags", operator: "contains", value: LEAD_TAG() },
      { field: "dateAdded", operator: "range", value: { gte: from, lte: to } },
    ]),
    soloAgente
  );

  const conteos = conteoVacio();
  let depositaron = 0;

  for (const contacto of leadContacts) {
    // Los que depositaron salen de las tarjetas, igual que en el panel, pero
    // se cuentan aparte para que el total del día cierre.
    if (yaDeposito(contacto)) {
      depositaron += 1;
      continue;
    }
    conteos[estadoDeLead(contacto)] += 1;
  }

  return { conteos, total: leadContacts.length, depositaron };
}

// Igual que computeAgentProduction pero para un rango de fechas arbitrario
// (el calendario "desde/hasta" del dashboard), sin distinción hoy/mes.
export type AgentRangeRow = {
  agent: string;
  agentId: string | null;
  office: string;
  leads: number;
  registros: number;
  ftd: number;
};

export async function computeAgentRange(
  from: string,
  to: string,
  soloAgente?: string | null
): Promise<{ rows: AgentRangeRow[] }> {
  const [todosLeads, todosRegistros, todosFtd] = await Promise.all([
    searchContacts([
      { field: "tags", operator: "contains", value: LEAD_TAG() },
      { field: "dateAdded", operator: "range", value: { gte: from, lte: to } },
    ]),
    searchContacts([
      { field: "tags", operator: "contains", value: REGISTRO_TAG() },
      { field: "dateAdded", operator: "range", value: { gte: from, lte: to } },
    ]),
    searchContacts([
      { field: "tags", operator: "contains", value: FTD_TAG() },
      { field: "dateUpdated", operator: "range", value: { gte: from, lte: to } },
    ]),
  ]);

  const [leadContacts, registroContacts, ftdContacts] = await Promise.all([
    soloDelAgente(todosLeads, soloAgente),
    soloDelAgente(todosRegistros, soloAgente),
    soloDelAgente(todosFtd, soloAgente),
  ]);

  const counts = new Map<string, { agent: string; agentId: string | null; office: string; leads: number; registros: number; ftd: number }>();
  function ensure(agent: string, agentId: string | null, office: string) {
    const key = `${agentId ?? agent}::${office}`;
    const existing = counts.get(key);
    if (existing) return existing;
    const row = { agent, agentId, office, leads: 0, registros: 0, ftd: 0 };
    counts.set(key, row);
    return row;
  }

  for (const contact of leadContacts) {
    const { agent, agentId, office } = await extractAttribution(contact);
    ensure(agent, agentId, office).leads += 1;
  }
  for (const contact of registroContacts) {
    if (!hasOwnAffiliateLink(contact)) continue;
    const { agent, agentId, office } = await extractAttribution(contact);
    ensure(agent, agentId, office).registros += 1;
  }
  for (const contact of ftdContacts) {
    if (!hasOwnAffiliateLink(contact)) continue;
    const { agent, agentId, office } = await extractAttribution(contact);
    ensure(agent, agentId, office).ftd += 1;
  }

  const rows = [...counts.values()].sort(
    (a, b) => b.leads - a.leads || b.registros - a.registros || b.ftd - a.ftd || a.agent.localeCompare(b.agent)
  );
  return { rows };
}
