import {
  isRegistrado,
  isFtdEfectuado,
  hasOwnAffiliateLink,
  type GhlContact,
} from "./ghl";

export const TAG_INTERACCION_AUTO = "cliente interactuo";
export const TAG_INTERACCION_MANUAL = "interactuó";
export const TAG_CANAL_FREE = "ingresó al canal free";
export const TAG_BUSINESS = "bajado a business";

/**
 * Fecha desde la que cada automatización de GHL existe y su tag es confiable.
 *
 * No es un detalle: `cliente interactuo` daba 0% todos los días hasta el 6 de
 * septiembre y salta a ~55% desde el 7, porque la automatización se encendió
 * ese día. Promediar sobre períodos anteriores no mide un embudo malo, mide
 * una automatización que todavía no existía.
 *
 * Cuando se encienda una automatización nueva, agregá su fecha acá.
 */
export const TAG_CONFIABLE_DESDE: Record<string, string> = {
  [TAG_INTERACCION_AUTO]: "2026-09-07",
  [TAG_BUSINESS]: "2026-09-09",
};

export function tagConfiableEn(tag: string, fechaIso: string): boolean {
  const desde = TAG_CONFIABLE_DESDE[tag];
  if (!desde) return true;
  return fechaIso.slice(0, 10) >= desde;
}

export type EstadoLead = "frio" | "tibio" | "caliente";

export const ESTADOS: EstadoLead[] = ["frio", "tibio", "caliente"];

export const ESTADO_META: Record<
  EstadoLead,
  {
    nombre: string;
    que: string;
    // Escala de temperatura: azul frío, naranja tibio, rojo caliente. Los
    // tres van en bloque saturado con letra blanca, que es lo que da el
    // contraste; el semáforo se descartó porque leer "Caliente" en verde
    // contradecía el nombre del estado.
    color: string;   // fondo del bloque
    sobre: string;   // texto encima del bloque
    fuerte: string;  // versión oscura, para el botón y los checks
    sobreFuerte: string;
  }
> = {
  frio: {
    nombre: "Frío",
    que: "No hizo nada",
    color: "#2A78D6",
    sobre: "#FFFFFF",
    fuerte: "#1B5AA8",
    sobreFuerte: "#FFFFFF",
  },
  tibio: {
    nombre: "Tibio",
    que: "Respondió o entró al canal",
    color: "#F97316",
    sobre: "#FFFFFF",
    fuerte: "#C2560F",
    sobreFuerte: "#FFFFFF",
  },
  caliente: {
    nombre: "Caliente",
    que: "Bajó a WhatsApp o se registró",
    color: "#DC2626",
    sobre: "#FFFFFF",
    fuerte: "#A21C1C",
    sobreFuerte: "#FFFFFF",
  },
};

// Los cuatro pasos del embudo, en orden. El desglose de cada estado los cuenta
// uno por uno: cuántos de esos leads hicieron cada cosa.
export const ACCIONES_EMBUDO = ["Respondió", "Entró al canal", "Bajó a WhatsApp", "Se registró"] as const;

export const SIN_ACCIONES = "Solo entró, sin responder";

function tiene(contacto: GhlContact, tag: string): boolean {
  const t = tag.toLowerCase();
  return (contacto.tags ?? []).some((x) => x.toLowerCase() === t);
}

// Los dos tags de interacción se leen juntos: el automático es la base y el
// manual lo complementa cuando el flujo no llegó a detectar la respuesta.
export function interactuo(contacto: GhlContact): boolean {
  return tiene(contacto, TAG_INTERACCION_AUTO) || tiene(contacto, TAG_INTERACCION_MANUAL);
}

export function interactuoAuto(contacto: GhlContact): boolean {
  return tiene(contacto, TAG_INTERACCION_AUTO);
}

/**
 * Estado del lead, con una sola regla que divide aguas: bajar a WhatsApp o
 * registrarse es lo único que separa a un interesado de un cliente real.
 *
 *   Caliente -> bajó a WhatsApp o se registró (el depósito ya implica esto)
 *   Tibio    -> respondió o entró al canal, pero nada de lo anterior
 *   Frío     -> no hizo nada
 *
 * Contar señales sueltas (una = tibio, dos = caliente) mezclaba cosas que no
 * valen lo mismo: responder y entrar al canal son interés, bajar a WhatsApp
 * es intención de comprar.
 *
 * El registro se valida con el link de afiliado propio del agente, la misma
 * regla que usa el conteo de registros y FTD, para que un mismo contacto no
 * cuente como Caliente acá y no cuente como registro allá.
 */
export function estadoDeLead(contacto: GhlContact): EstadoLead {
  const conLinkPropio = hasOwnAffiliateLink(contacto);
  if ((isFtdEfectuado(contacto) || isRegistrado(contacto)) && conLinkPropio) return "caliente";
  if (tiene(contacto, TAG_BUSINESS)) return "caliente";
  if (interactuo(contacto) || tiene(contacto, TAG_CANAL_FREE)) return "tibio";
  return "frio";
}

export function conteoVacio(): Record<EstadoLead, number> {
  return { frio: 0, tibio: 0, caliente: 0 };
}

/**
 * Qué hizo concretamente el lead, en orden del embudo.
 *
 * El estado por sí solo esconde información: dos leads Tibios pueden ser uno
 * que respondió y otro que solo entró al canal, y son situaciones distintas
 * que piden acciones distintas. Esto devuelve las acciones reales para poder
 * desglosar cada estado en pantalla.
 */
export function accionesDeLead(contacto: GhlContact): string[] {
  const acciones: string[] = [];
  // Los dos tags de interacción cuentan como una sola acción: son el mismo
  // hecho visto por el flujo y por el agente, no dos cosas distintas.
  if (interactuo(contacto)) acciones.push("Respondió");
  if (tiene(contacto, TAG_CANAL_FREE)) acciones.push("Entró al canal");
  if (tiene(contacto, TAG_BUSINESS)) acciones.push("Bajó a WhatsApp");
  if (isRegistrado(contacto) && hasOwnAffiliateLink(contacto)) acciones.push("Se registró");
  return acciones;
}

// El depósito saca al lead del panel: ya se cuenta en las tarjetas de FTD.
export function yaDeposito(contacto: GhlContact): boolean {
  return isFtdEfectuado(contacto) && hasOwnAffiliateLink(contacto);
}

// Etiqueta legible del recorrido de un lead: "Respondió + Entró al canal".
export function recorridoDeLead(contacto: GhlContact): string {
  const acciones = accionesDeLead(contacto);
  return acciones.length === 0 ? "Solo entró, sin responder" : acciones.join(" + ");
}

/**
 * Qué le falta a un lead para subir un escalón. Es lo que convierte el panel
 * en algo accionable en vez de un gráfico más.
 */
export function accionSugerida(estado: EstadoLead): string {
  switch (estado) {
    case "frio":
      return "Nunca respondió — revisar si el agente escribió";
    case "tibio":
      return "Falta bajarlo a WhatsApp";
    case "caliente":
      return "Cerrar: registro y primer depósito";
  }
}
