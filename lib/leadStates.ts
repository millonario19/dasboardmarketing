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

export type EstadoLead = "frio" | "tibio" | "caliente" | "fuego" | "venta";

export const ESTADOS: EstadoLead[] = ["frio", "tibio", "caliente", "fuego", "venta"];

export const ESTADO_META: Record<EstadoLead, { nombre: string; emoji: string; color: string; que: string }> = {
  frio: { nombre: "Frío", emoji: "🔵", color: "#7C8AA5", que: "No hizo nada" },
  tibio: { nombre: "Tibio", emoji: "🟡", color: "#E0A800", que: "Hizo una sola cosa" },
  caliente: { nombre: "Caliente", emoji: "🟠", color: "#E8720C", que: "Hizo dos, o bajó a WhatsApp" },
  fuego: { nombre: "Fuego", emoji: "🔥", color: "#D93A2B", que: "Se registró en el broker" },
  venta: { nombre: "Venta", emoji: "🟢", color: "#158F5B", que: "Hizo su primer depósito" },
};

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
 * Estado del lead: el escalón más alto que alcanzó.
 *
 * Registro y venta se validan con el link de afiliado propio del agente, la
 * misma regla que ya usa el conteo de registros y FTD del dashboard, para que
 * un mismo contacto no cuente como Fuego acá y no cuente como registro allá.
 */
export function estadoDeLead(contacto: GhlContact): EstadoLead {
  const conLinkPropio = hasOwnAffiliateLink(contacto);
  if (isFtdEfectuado(contacto) && conLinkPropio) return "venta";
  if (isRegistrado(contacto) && conLinkPropio) return "fuego";
  if (tiene(contacto, TAG_BUSINESS)) return "caliente";

  const señales = (interactuo(contacto) ? 1 : 0) + (tiene(contacto, TAG_CANAL_FREE) ? 1 : 0);
  if (señales >= 2) return "caliente";
  if (señales === 1) return "tibio";
  return "frio";
}

export function conteoVacio(): Record<EstadoLead, number> {
  return { frio: 0, tibio: 0, caliente: 0, fuego: 0, venta: 0 };
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
  const conLinkPropio = hasOwnAffiliateLink(contacto);
  const acciones: string[] = [];
  if (interactuo(contacto)) acciones.push("Respondió");
  if (tiene(contacto, TAG_CANAL_FREE)) acciones.push("Entró al canal");
  if (tiene(contacto, TAG_BUSINESS)) acciones.push("Bajó a WhatsApp");
  if (isRegistrado(contacto) && conLinkPropio) acciones.push("Se registró");
  if (isFtdEfectuado(contacto) && conLinkPropio) acciones.push("Depositó");
  return acciones;
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
      return "Falta la segunda señal: invitarlo al canal o romper el hielo";
    case "caliente":
      return "Acompañarlo a registrarse con su link";
    case "fuego":
      return "Empujar el primer depósito";
    case "venta":
      return "Ciclo completo";
  }
}
