"use client";

/**
 * Entrar al panel en nombre de otro.
 *
 * La dirección no quiere un resumen de su gente: quiere abrir el panel de
 * Tatiana y ver lo que Tatiana ve, completo y funcionando. Para eso todas las
 * consultas de la pantalla tienen que decir de quién están hablando.
 *
 * Vive en una variable de módulo y no en un contexto de React porque quien
 * necesita el dato no son solo los componentes: también la caché compartida
 * del seguimiento, que es una función suelta. Un contexto obligaría a pasarlo
 * por diez props hasta llegar ahí.
 *
 * La seguridad no está acá. Esto solo agrega un parámetro a la URL; quién
 * puede mirar a quién lo decide el servidor contra la base, en `lib/verComo`.
 * Un agente que fuerce este valor sigue viendo lo suyo.
 */

let mirado: string | null = null;

export function mirarA(agentId: string | null): void {
  mirado = agentId;
}

export function agenteMirado(): string | null {
  return mirado;
}

/** Le pega `?agente=` a una ruta, respetando los parámetros que ya traiga. */
export function conAgente(ruta: string): string {
  if (!mirado) return ruta;
  return `${ruta}${ruta.includes("?") ? "&" : "?"}agente=${encodeURIComponent(mirado)}`;
}
