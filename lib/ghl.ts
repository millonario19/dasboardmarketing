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
  /** Por dónde entró: «whatsapp» (anuncio de clic a WhatsApp), «facebook», «instagram». */
  attributionSource?: { medium?: string | null; sessionSource?: string | null } | null;
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
      // 429 es el límite de ráfaga de GHL, que se mide en ventanas de diez
      // segundos: reintentar a los 500 ms vuelve a chocar. Por eso espera
      // bastante más que un error de servidor común.
      if (!res.ok && res.status === 429 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
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

/**
 * Corrige el nombre de un contacto en GHL.
 *
 * Media base viene del formulario de Facebook con lo que el cliente quiso
 * escribir: «mi guía», «mi hijo», un corazón. El agente que ya habló con esa
 * persona sabe cómo se llama, y es el único que lo sabe.
 */
export async function actualizarNombreContacto(
  contactId: string,
  firstName: string,
  lastName: string
): Promise<void> {
  const res = await fetchWithRetry(`${GHL_BASE_URL}/contacts/${encodeURIComponent(contactId)}`, {
    method: "PUT",
    headers: ghlHeaders(),
    body: JSON.stringify({ firstName, lastName }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GHL no aceptó el nombre (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
}

/**
 * Ponerle el teléfono a un contacto que llegó sin él.
 *
 * Los leads de anuncios de clic a WhatsApp y los de Messenger entran sin
 * número: Meta no lo entrega, ni en el contacto ni en la conversación. La
 * única forma de tenerlo es que el cliente lo escriba, y cuando lo escribe hay
 * que poder guardarlo o se pierde en el chat.
 *
 * Se guarda en GHL y no solo en el tablero para que sirva en los dos lados:
 * el que llama desde acá y el que abre la ficha en el CRM.
 */
export async function actualizarTelefonoContacto(
  contactId: string,
  telefono: string
): Promise<void> {
  const res = await fetchWithRetry(`${GHL_BASE_URL}/contacts/${encodeURIComponent(contactId)}`, {
    method: "PUT",
    headers: ghlHeaders(),
    body: JSON.stringify({ phone: telefono }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GHL no aceptó el número (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
}

export type UsuarioGhl = { id: string; nombre: string; email: string | null };

/**
 * Usuarios de la subcuenta, para elegir a qué agente se ata cada login.
 *
 * El id que devuelve es el mismo que GHL pone en assignedTo de cada contacto,
 * que es con lo que se filtran los leads. Escribir ese id a mano sería la
 * forma más fácil de atar a alguien al agente equivocado sin que nada falle.
 */
export async function listarUsuariosGhl(): Promise<UsuarioGhl[]> {
  const locationId = requireEnv("GHL_LOCATION_ID");
  const res = await fetchWithRetry(`${GHL_BASE_URL}/users/?locationId=${encodeURIComponent(locationId)}`, {
    headers: ghlHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GHL no devolvió los usuarios (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  const usuarios: UsuarioGhl[] = (data.users ?? []).map((u: Record<string, string>) => ({
    id: u.id,
    nombre: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || u.email || u.id,
    email: u.email ?? null,
  }));
  return usuarios.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * Un contacto puntual, por id.
 *
 * Existe para el arranque rápido de Mi día: los movimientos del día salen de
 * Postgres en milisegundos y solo hace falta traer esos contactos, en vez de
 * esperar la búsqueda de un mes entera para mostrar la primera pantalla.
 */
export async function obtenerContacto(contactId: string): Promise<GhlContact | null> {
  try {
    const res = await fetchWithRetry(
      `${GHL_BASE_URL}/contacts/${encodeURIComponent(contactId)}`,
      { headers: ghlHeaders(), cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const contacto = data.contact as (GhlContact & { fullNameLowerCase?: string }) | undefined;
    if (!contacto) return null;

    // Este endpoint no devuelve contactName, que es de donde sale el nombre
    // que se muestra; la búsqueda sí. Sin esto, el mismo lead aparece con una
    // capitalización en la carga rápida y con otra cuando llega la completa.
    if (!contacto.contactName && contacto.fullNameLowerCase) {
      contacto.contactName = contacto.fullNameLowerCase;
    }
    return contacto;
  } catch {
    // Un contacto que no se pudo traer no puede tumbar la lista entera.
    return null;
  }
}

export type GhlMensaje = {
  id: string;
  direction: "inbound" | "outbound";
  dateAdded: string;
  messageType?: string;
  // "workflow" cuando lo mandó una automatización, "app" cuando lo escribió
  // una persona. Es la diferencia entre atender y no atender.
  source?: string;
  body?: string;
  userId?: string;
  // WhatsApp manda las notas de voz y las imágenes como adjuntos, con el
  // cuerpo vacío. La URL del .ogg es directa y se puede reproducir.
  attachments?: string[];
};

/** La conversación de un contacto, o null si nunca hubo uno. */
export class ConversacionNoLeida extends Error {}

export async function buscarConversacion(contactId: string): Promise<string | null> {
  const locationId = requireEnv("GHL_LOCATION_ID");
  try {
    const res = await fetchWithRetry(
      `${GHL_BASE_URL}/conversations/search?locationId=${encodeURIComponent(locationId)}&contactId=${encodeURIComponent(contactId)}`,
      { headers: ghlHeaders(), cache: "no-store" }
    );
    // Sin conversación es un dato (el lead nunca escribió); un error es otra
    // cosa y no puede confundirse con eso, o la lista miente por lo bajo.
    if (!res.ok) throw new ConversacionNoLeida(`GHL ${res.status}`);
    const data = await res.json();
    return data.conversations?.[0]?.id ?? null;
  } catch (e) {
    if (e instanceof ConversacionNoLeida) throw e;
    throw new ConversacionNoLeida(e instanceof Error ? e.message : "error de red");
  }
}

export type GhlConversacion = {
  id: string;
  contactId: string;
  contactName?: string | null;
  phone?: string | null;
  tags?: string[];
  assignedTo?: string | null;
  dateAdded: number;
  lastMessageDate: number;
  lastMessageBody?: string | null;
  lastMessageDirection?: "inbound" | "outbound";
  lastMessageType?: string;
  unreadCount?: number;
};

/**
 * Las conversaciones más recientes de la subcuenta, de la última hablada hacia
 * atrás.
 *
 * Es la forma barata de saber qué se movió: una sola llamada devuelve cien
 * conversaciones con la hora del último mensaje, quién lo mandó, cuántos hay
 * sin leer, las etiquetas del contacto y a qué agente está asignado. La
 * alternativa —recorrer noventa días de contactos— son miles de fichas y
 * decenas de llamadas para llegar al mismo dato.
 */
export async function conversacionesRecientes(limite = 100): Promise<GhlConversacion[]> {
  const locationId = requireEnv("GHL_LOCATION_ID");
  const res = await fetchWithRetry(
    `${GHL_BASE_URL}/conversations/search?locationId=${encodeURIComponent(locationId)}` +
      `&limit=${limite}&sort=desc&sortBy=last_message_date`,
    { headers: ghlHeaders(), cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`GHL no devolvió las conversaciones (${res.status})`);
  }
  const data = await res.json();
  return data.conversations ?? [];
}

/**
 * Los mensajes de una conversación.
 *
 * GHL devuelve los últimos ~20 y pagina hacia atrás con lastMessageId. Para el
 * día en curso alcanza con la primera página: una conversación de hoy rara vez
 * pasa de veinte mensajes, y traer más multiplicaría las llamadas.
 */
export async function mensajesDeConversacion(conversacionId: string): Promise<GhlMensaje[]> {
  try {
    const res = await fetchWithRetry(
      `${GHL_BASE_URL}/conversations/${encodeURIComponent(conversacionId)}/messages`,
      { headers: ghlHeaders(), cache: "no-store" }
    );
    if (!res.ok) throw new ConversacionNoLeida(`GHL ${res.status}`);
    const data = await res.json();
    return (data.messages?.messages ?? []) as GhlMensaje[];
  } catch (e) {
    if (e instanceof ConversacionNoLeida) throw e;
    throw new ConversacionNoLeida(e instanceof Error ? e.message : "error de red");
  }
}

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

/**
 * Mandar un WhatsApp al contacto, por el número de la oficina.
 *
 * Cae en la misma conversación que todo lo demás, así que el mensaje queda en
 * el historial de GHL como cualquier otro y el dashboard lo lee sin cambios.
 *
 * Solo funciona con la ventana de 24 horas abierta. Afuera Meta no entrega
 * texto libre y GHL devuelve error — por eso el panel calcula la ventana antes
 * de ofrecer el botón, en vez de intentar y fallar en silencio.
 */
export async function enviarWhatsApp(
  contactId: string,
  texto: string,
  tipo = "WhatsApp"
): Promise<void> {
  const res = await fetchWithRetry(`${GHL_BASE_URL}/conversations/messages`, {
    method: "POST",
    headers: { ...ghlHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ contactId, type: tipo, message: texto }),
    cache: "no-store",
  });
  if (!res.ok) {
    const cuerpo = await res.text();
    throw new Error(`GHL no pudo mandar el WhatsApp (${res.status}): ${cuerpo.slice(0, 300)}`);
  }
}

/**
 * Los flujos publicados de la subcuenta, por nombre.
 *
 * El panel lo usa para no ofrecer un botón que no hace nada: mandar una
 * plantilla es poner una etiqueta, y una etiqueta sin flujo que la escuche no
 * manda nada y encima queda pegada al contacto para siempre.
 */
export async function flujosPublicados(): Promise<string[]> {
  const locationId = requireEnv("GHL_LOCATION_ID");
  try {
    const res = await fetchWithRetry(
      `${GHL_BASE_URL}/workflows/?locationId=${encodeURIComponent(locationId)}`,
      { headers: ghlHeaders(), cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.workflows ?? []) as { name?: string; status?: string }[])
      .filter((w) => w.status === "published" && w.name)
      .map((w) => w.name as string);
  } catch {
    return [];
  }
}

export type LlamadaGhl = {
  mensajeId: string;
  en: string;
  direccion: "inbound" | "outbound";
  estado: string;
  /** Segundos. Cero cuando no contestaron. */
  duracion: number;
  desde: string | null;
  hacia: string | null;
};

/**
 * Las llamadas que salieron por el CRM, no las del celular del agente.
 *
 * Son las únicas que traen la verdad completa: hora exacta, si contestaron,
 * cuánto duró y —si la grabación está encendida— el audio. Del celular del
 * agente solo sabemos que tocó el botón.
 */
export async function llamadasDeContacto(contactId: string): Promise<LlamadaGhl[]> {
  try {
    const conversacion = await buscarConversacion(contactId);
    if (!conversacion) return [];
    const res = await fetchWithRetry(
      `${GHL_BASE_URL}/conversations/${conversacion}/messages?limit=40`,
      { headers: ghlHeaders(), cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    type Cruda = {
      id: string;
      messageType?: string;
      direction?: string;
      status?: string;
      dateAdded: string;
      from?: string;
      to?: string;
      meta?: { call?: { duration?: number } };
    };
    return ((data.messages?.messages ?? []) as Cruda[])
      .filter((m) => m.messageType === "TYPE_CALL")
      .map((m) => ({
        mensajeId: m.id,
        en: m.dateAdded,
        direccion: m.direction === "inbound" ? ("inbound" as const) : ("outbound" as const),
        estado: m.status ?? "",
        duracion: m.meta?.call?.duration ?? 0,
        desde: m.from ?? null,
        hacia: m.to ?? null,
      }));
  } catch {
    return [];
  }
}
