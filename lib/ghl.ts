const GHL_BASE_URL = "https://services.leadconnectorhq.com";

export type GhlContact = {
  id: string;
  dateAdded: string;
  dateUpdated?: string;
  assignedTo?: string | null;
  tags?: string[];
  customFields?: { id: string; value: string }[];
  contactName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  email?: string | null;
  searchAfter?: [number, string];
};

export type Attribution = {
  agent: string;
  agentId: string | null;
  office: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

function ghlHeaders() {
  return {
    Authorization: `Bearer ${requireEnv("GHL_API_TOKEN")}`,
    Version: process.env.GHL_API_VERSION ?? "2021-07-28",
    "Content-Type": "application/json",
  };
}

// El escaneo completo del histórico (necesario para validar FTD por fecha de
// depósito real, no de creación) hace cientos de requests seguidos a GHL;
// un error transitorio de red no debería tirar abajo todo el escaneo.
async function fetchWithRetry(url: string, init: RequestInit, retries = 3): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok && res.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

const PAGE_LIMIT = 100;
const HARD_CAP_PAGES = 500;

export type SearchFilter =
  | { field: string; operator: "eq"; value: string }
  | { field: string; operator: "contains"; value: string }
  | { field: string; operator: "range"; value: { gte?: string; lte?: string } };

// Búsqueda puntual server-side (POST /contacts/search): mucho más barata que
// fetchAllContacts cuando ya sabemos qué tag/agente/rango de fecha buscamos —
// GHL filtra en su lado y devuelve solo lo relevante (ms en vez de segundos).
export async function searchContacts(filters: SearchFilter[]): Promise<GhlContact[]> {
  const locationId = requireEnv("GHL_LOCATION_ID");
  const contacts: GhlContact[] = [];
  let searchAfter: [number, string] | undefined;

  for (let page = 0; page < HARD_CAP_PAGES; page++) {
    const body: Record<string, unknown> = { locationId, pageLimit: PAGE_LIMIT, filters };
    if (searchAfter) body.searchAfter = searchAfter;

    const res = await fetchWithRetry(`${GHL_BASE_URL}/contacts/search`, {
      method: "POST",
      headers: ghlHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GHL search error (${res.status}): ${text}`);
    }

    const data = await res.json();
    const batch: GhlContact[] = data.contacts ?? [];
    contacts.push(...batch);

    if (batch.length < PAGE_LIMIT) return contacts;

    const last = batch[batch.length - 1];
    if (!last.searchAfter) return contacts;
    searchAfter = last.searchAfter;

    if (page === HARD_CAP_PAGES - 1) {
      throw new Error(`searchContacts alcanzó el límite de seguridad de ${HARD_CAP_PAGES} páginas`);
    }
  }

  return contacts;
}

/**
 * Agrega o quita una etiqueta de un contacto.
 *
 * Es la única escritura que el dashboard hace sobre GHL. Se usa para que el
 * agente confirme si una bajada a WhatsApp ocurrió de verdad: la respuesta
 * vive como etiqueta en el CRM y no en una base aparte, porque todo el resto
 * del sistema lee etiquetas y una confirmación escondida sería invisible para
 * los flujos y para cualquiera que abra la ficha.
 */
async function cambiarTag(contactId: string, tag: string, metodo: "POST" | "DELETE"): Promise<void> {
  const res = await fetchWithRetry(`${GHL_BASE_URL}/contacts/${encodeURIComponent(contactId)}/tags`, {
    method: metodo,
    headers: ghlHeaders(),
    body: JSON.stringify({ tags: [tag] }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GHL no aceptó el cambio de etiqueta (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
}

export const agregarTag = (contactId: string, tag: string) => cambiarTag(contactId, tag, "POST");
export const quitarTag = (contactId: string, tag: string) => cambiarTag(contactId, tag, "DELETE");

const userNameCache = new Map<string, string>();

async function resolveUserName(userId: string): Promise<string> {
  if (userNameCache.has(userId)) return userNameCache.get(userId)!;
  try {
    const res = await fetch(`${GHL_BASE_URL}/users/${userId}`, {
      headers: ghlHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return userId;
    const data = await res.json();
    const name = [data.firstName, data.lastName].filter(Boolean).join(" ") || data.name || userId;
    userNameCache.set(userId, name);
    return name;
  } catch {
    return userId;
  }
}

function customFieldValue(contact: GhlContact, fieldKey: string): string | undefined {
  return contact.customFields?.find((f) => f.id === fieldKey)?.value;
}

// Tag que el workflow de n8n pone cuando el lead se registra en el broker
// (ej. "tag-julian-registrado" para Oficina Prime). GHL no guarda cuándo se
// agregó un tag, así que contamos "registrado" entre los contactos creados
// en el rango de fechas — válido porque el contacto se crea/actualiza en GHL
// justo cuando ocurre el registro.
export function isRegistrado(contact: GhlContact): boolean {
  const tag = (process.env.GHL_REGISTRO_TAG ?? "tag-julian-registrado").toLowerCase();
  return (contact.tags ?? []).some((t) => t.toLowerCase() === tag);
}

export function isFtdEfectuado(contact: GhlContact): boolean {
  const tag = (process.env.GHL_FTD_TAG ?? "ftd-efectuado").toLowerCase();
  return (contact.tags ?? []).some((t) => t.toLowerCase() === tag);
}

// Regla 1 para contar un "lead": el agente pone este tag manualmente cada vez
// que entra un lead nuevo desde la pauta. Sin este tag, un contacto creado en
// GHL no cuenta como lead (puede ser un contacto de otra fuente, una prueba, etc).
export function isIngresoPauta(contact: GhlContact): boolean {
  const tag = (process.env.GHL_LEAD_TAG ?? "ingreso de pauta").toLowerCase();
  return (contact.tags ?? []).some((t) => t.toLowerCase() === tag);
}

// Mapa userId de GHL -> número(s) de link de afiliado, extraído del AGENT_MAP
// real del workflow "[Maestro] Registro Nexus" (nodo "Filtrar Maestro") para
// el equipo "julian" (Oficina Prime). Un agente puede tener más de un link si
// se lo cambiaron en algún momento (ej. María José Cerquera: 695 y luego 959).
// Si en n8n le asignan un link nuevo a alguien, hay que agregarlo acá también.
const AGENT_LINKS: Record<string, string[]> = {
  WL0bTSVg0SHGdMXNZ3YH: ["692"], // JULIAN ALFREDO LOPEZ MUÑOZ
  AcG6jQ0a1jfnPkEoz34N: ["693"], // Claudia Córdoba
  "158eTBSD5RsSTYt6fzZ8": ["694"], // Erik Santiago López
  ufOnlG9NuWGk4AU8vnK6: ["695", "959"], // María José Cerquera
  s0gGSn5rlJ1wqzJ4yHHt: ["780"], // Jose Dario Velasquez Perdomo
  U39rcEyiJPNyvXY9ztur: ["822"], // Esteban lasso Chavarro
  IGgS4TFaFOKBeA8Qlwow: ["676"], // Diana Córdoba
  "5OXpsty1ZSoTsheA2rMT": ["689"], // Stefanny Vasquez saenz
  sReoJvXnWFSORDy01DqL: ["696"], // Jacky Nataly Cavanzo Leon
  QnqjG0vZxh9mscSOn0Ld: ["697"], // Yeison Esteban Díaz Castillo
  cxOXq6kaQRdPFMVldVcI: ["791"], // Tatiana Peña
  dQSJrM4ldpyNddlse1p9: ["889"], // Juan Andrés Ahumada López
  Sb9y5M2lPBRnfNtNC6pN: ["890"], // José Felipe Carreño Castañeda
  sFU0j7drIoMx0mDzSUM3: ["891"], // Thiare Lisseth Vargas Valencia
};

// Regla 2 para validar un "registrado" con precisión: no basta el tag
// "registrado" — el contacto también debe tener el tag "link-<N>" del link de
// afiliado propio del agente asignado. Así se descarta un registro con el tag
// genérico pero de un link que no es del agente (mal asignado / de otro equipo).
export function hasOwnAffiliateLink(contact: GhlContact): boolean {
  const links = contact.assignedTo ? AGENT_LINKS[contact.assignedTo] : undefined;
  if (!links) return false;
  const tags = (contact.tags ?? []).map((t) => t.toLowerCase());
  return links.some((link) => tags.includes(`link-${link}`));
}

export function contactDisplayName(contact: GhlContact): string {
  return (
    contact.contactName?.trim() ||
    [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() ||
    contact.phone ||
    contact.email ||
    "Sin nombre"
  );
}

/**
 * Determina agente y oficina de un contacto según GHL_AGENT_SOURCE / GHL_OFFICE_SOURCE.
 * Ajusta esta función si tu subcuenta usa otra convención (tags, otro custom field, etc).
 */
export async function extractAttribution(contact: GhlContact): Promise<Attribution> {
  const agentSource = process.env.GHL_AGENT_SOURCE ?? "assignedTo";
  const officeSource = process.env.GHL_OFFICE_SOURCE ?? "fixed:Oficina Prime";

  let agent = "Sin asignar";
  let agentId: string | null = null;
  if (agentSource === "assignedTo") {
    if (contact.assignedTo) {
      agent = await resolveUserName(contact.assignedTo);
      agentId = contact.assignedTo;
    }
  } else if (agentSource.startsWith("customField:")) {
    const key = agentSource.split(":")[1];
    agent = customFieldValue(contact, key) ?? "Sin asignar";
  }

  let office = "Sin oficina";
  if (officeSource.startsWith("fixed:")) {
    office = officeSource.split(":")[1] ?? "Sin oficina";
  } else if (officeSource === "tag") {
    office = contact.tags?.[0] ?? "Sin oficina";
  } else if (officeSource.startsWith("customField:")) {
    const key = officeSource.split(":")[1];
    office = customFieldValue(contact, key) ?? "Sin oficina";
  }

  return { agent, agentId, office };
}
