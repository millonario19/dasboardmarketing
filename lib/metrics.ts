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
  range: { today: { from: string; to: string }; month: { from: string; to: string } };
};

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
export async function computeAgentProduction(): Promise<AgentProduction> {
  const now = Date.now();
  const today = bogotaRange(now, "day");
  const month = bogotaRange(now, "month");
  const todayFromMs = new Date(today.from).getTime();
  const todayToMs = new Date(today.to).getTime();

  const [leadContacts, registroContacts, ftdContacts] = await Promise.all([
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

  return {
    rows,
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

export async function computeAgentRange(from: string, to: string): Promise<{ rows: AgentRangeRow[] }> {
  const [leadContacts, registroContacts, ftdContacts] = await Promise.all([
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
