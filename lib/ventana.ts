import { conversacionesRecientes, mensajesDeConversacion, type GhlConversacion } from "./ghl";

/**
 * Cuánto queda de la ventana de 24 horas de cada cliente.
 *
 * Meta abre una ventana de 24 horas cada vez que el cliente escribe. Adentro se
 * le puede mandar texto libre y no cuesta nada; afuera solo entran plantillas
 * aprobadas, y cada una se cobra.
 *
 * De ahí sale la regla del seguimiento del día 2: sale a la hora 20 de esa
 * ventana, con cuatro horas de margen, gratis. Y de ahí sale también por qué
 * el panel calcula esto antes de mostrar el botón: mandar afuera de la ventana
 * no da error visible, Meta simplemente no lo entrega. En la subcuenta ya hay
 * una etiqueta `no se pudo enviar seguimiento` que huele exactamente a eso.
 */

const VENTANA_MS = 24 * 60 * 60 * 1000;

/** A la hora 20 se manda: quedan cuatro horas de colchón. */
export const HORA_DE_ENVIO = 20;

/**
 * Por dónde habla este cliente.
 *
 * No todos llegan por WhatsApp: un buen tercio entra por Instagram o Facebook
 * y esos no tienen teléfono. Ofrecerles «escribirle por WhatsApp» era mandar
 * al agente a un error de GHL —«Missing phone number»— en vez de escribirle
 * por donde sí se puede.
 */
export type Canal = "whatsapp" | "instagram" | "facebook" | "sms" | null;

const CANALES: Record<string, Canal> = {
  TYPE_WHATSAPP: "whatsapp",
  TYPE_INSTAGRAM: "instagram",
  TYPE_FACEBOOK: "facebook",
  TYPE_SMS: "sms",
};

/** El nombre del canal en la API de mensajes de GHL. */
export const TIPO_GHL: Record<NonNullable<Canal>, string> = {
  whatsapp: "WhatsApp",
  instagram: "IG",
  facebook: "FB",
  sms: "SMS",
};

export const CANAL_NOMBRE: Record<NonNullable<Canal>, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Messenger",
  sms: "SMS",
};

export type Ventana = {
  /** Por dónde habla. Null si no se pudo saber. */
  canal: Canal;
  /** Cuándo escribió el cliente por última vez. */
  ultimoEntrante: string | null;
  /** Hora a la que Meta cierra la puerta. */
  cierraEn: string | null;
  /** Horas transcurridas desde que el cliente escribió. */
  horas: number | null;
  abierta: boolean;
  /** Ya pasó la hora 20 y todavía está abierta: es ahora o nunca. */
  porCerrarse: boolean;
};

export const SIN_VENTANA: Ventana = {
  canal: null,
  ultimoEntrante: null,
  cierraEn: null,
  horas: null,
  abierta: false,
  porCerrarse: false,
};

function calcular(ultimoEntrante: string | null, canal: Canal = null): Ventana {
  if (!ultimoEntrante) return { ...SIN_VENTANA, canal };
  const desde = new Date(ultimoEntrante).getTime();
  const horas = (Date.now() - desde) / 3600e3;
  const abierta = horas < 24;
  return {
    canal,
    ultimoEntrante,
    cierraEn: new Date(desde + VENTANA_MS).toISOString(),
    horas,
    abierta,
    porCerrarse: abierta && horas >= HORA_DE_ENVIO,
  };
}

/**
 * La ventana de cada uno de estos contactos.
 *
 * El barrido de conversaciones ya trae la hora del último mensaje y quién lo
 * mandó. Cuando ese último es del cliente, ahí termina: es el dato. Cuando es
 * nuestro —el caso normal, porque casi siempre respondemos— hay que abrir la
 * conversación y buscar el último entrante, y eso es una llamada por lead.
 *
 * Por eso el tope: `maxDetalle` limita cuántas conversaciones se abren. Los que
 * quedan afuera se devuelven sin ventana, que en pantalla se lee «no sé» y no
 * «cerrada» — prefiero que el agente no vea botón a que vea uno que no entrega.
 */
export async function ventanasDe(
  contactIds: string[],
  maxDetalle = 40
): Promise<Map<string, Ventana>> {
  const salida = new Map<string, Ventana>();
  if (contactIds.length === 0) return salida;

  const quiero = new Set(contactIds);
  let conversaciones: GhlConversacion[] = [];
  try {
    conversaciones = await conversacionesRecientes(100);
  } catch {
    return salida;
  }

  const porContacto = new Map<string, GhlConversacion>();
  for (const c of conversaciones) {
    if (!quiero.has(c.contactId)) continue;
    // El barrido viene ordenado de la última hablada hacia atrás: la primera
    // que aparece de cada contacto es la que vale.
    if (!porContacto.has(c.contactId)) porContacto.set(c.contactId, c);
  }

  const aAbrir: GhlConversacion[] = [];
  for (const [id, c] of porContacto) {
    const canal = CANALES[c.lastMessageType ?? ""] ?? null;
    if (c.lastMessageDirection === "inbound") {
      salida.set(id, calcular(new Date(c.lastMessageDate).toISOString(), canal));
    } else {
      aAbrir.push(c);
    }
  }

  // Los más recientes primero: son los que todavía pueden tener ventana viva.
  aAbrir.sort((a, b) => b.lastMessageDate - a.lastMessageDate);

  /**
   * De a seis a la vez.
   *
   * Cada conversación es una llamada a GHL de medio segundo, y en fila india
   * cuarenta de esas son veinte segundos de pantalla en blanco. En paralelo son
   * tres. El tope de seis es por el límite de ráfaga de GHL: más arriba empieza
   * a contestar 429 y el reintento sale más caro que la espera.
   */
  const pendientes = aAbrir.slice(0, maxDetalle);
  const EN_PARALELO = 6;
  let siguiente = 0;
  async function trabajar(): Promise<void> {
    for (;;) {
      const c = pendientes[siguiente++];
      if (!c) return;
      try {
        const mensajes = await mensajesDeConversacion(c.id);
        const entrantes = mensajes
          .filter((m) => m.direction === "inbound")
          .map((m) => m.dateAdded)
          .sort();
        const ultimo = entrantes[entrantes.length - 1] ?? null;
        salida.set(c.contactId, calcular(ultimo, CANALES[c.lastMessageType ?? ""] ?? null));
      } catch {
        /* sin mensajes no se sabe: mejor sin ventana que con una inventada */
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(EN_PARALELO, pendientes.length) }, () => trabajar())
  );

  return salida;
}
