/**
 * El día de Bogotá, en un solo lugar.
 *
 * Colombia no tiene horario de verano: UTC-5 todo el año, así que restar el
 * desfase y cortar el ISO alcanza. Cuatro componentes tenían su propia copia
 * de esta función; con una sola fecha mandando en toda la pantalla, tienen que
 * ser exactamente la misma cuenta o los pasos discrepan por un día.
 */

const BOGOTA_OFFSET_MS = 5 * 3600e3;

/** Hoy en Bogotá, «2026-09-19». */
export function hoyBogota(): string {
  return new Date(Date.now() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** El día de Bogotá al que pertenece un instante. Sin argumento, ahora. */
export function diaBogota(iso?: string | null): string {
  const ms = iso ? new Date(iso).getTime() : Date.now();
  return new Date(ms - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** «viernes, 19 de septiembre», para títulos. */
export function diaLargo(dia: string): string {
  return new Date(`${dia}T12:00:00-05:00`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  });
}

/** Cuántos días atrás puede irse el selector: lo que guarda el seguimiento. */
export const DIAS_ATRAS_MAX = 6;

/** El día más viejo que se puede elegir, «2026-09-13». */
export function diaMasViejo(): string {
  return new Date(Date.now() - BOGOTA_OFFSET_MS - DIAS_ATRAS_MAX * 864e5)
    .toISOString()
    .slice(0, 10);
}
