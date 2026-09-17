import type { EstadoLead } from "./leadStates";

/**
 * Las etiquetas que disparan los flujos del embudo en GHL.
 *
 * El dashboard no manda el mensaje: pone la etiqueta y GHL hace el resto. Esa
 * separación es a propósito — la API de GHL no deja crear ni editar flujos, así
 * que el texto que ve el cliente vive donde marketing lo puede cambiar sin
 * tocar código.
 *
 * El flujo tiene que QUITAR la etiqueta al final. Si queda puesta, no se vuelve
 * a disparar sobre ese contacto nunca más.
 */

/**
 * El día 1 se sumó después. No tiene flujo ni plantilla —la ventana de Meta
 * está abierta, el cliente acaba de escribir— así que el mensaje sale derecho
 * desde el panel. La etiqueta se mantiene igual para que el hilo y el tope de
 * uno por día cuenten los tres días con la misma regla.
 */
export type DiaDelEmbudo = 1 | 2 | 3;

export function etiquetaDeSeguimiento(dia: DiaDelEmbudo, estado: EstadoLead): string {
  const temp = estado === "caliente" ? "caliente" : estado === "tibio" ? "tibio" : "frio";
  return `seg-d${dia}-${temp}`;
}

/** Todas, para armarlas de una en GHL. */
export const ETIQUETAS_DEL_EMBUDO: string[] = ([2, 3] as DiaDelEmbudo[]).flatMap((d) =>
  (["caliente", "tibio", "frio"] as const).map((t) => `seg-d${d}-${t}`)
);
