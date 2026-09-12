/**
 * Nombres cortos para la pantalla.
 *
 * En GHL los usuarios están cargados con el nombre completo colombiano —dos
 * nombres y dos apellidos—, y «Jose Dario Velasquez Perdomo» en la cabecera de
 * un móvil de 375 px estira la página entera. Acá se recorta a nombre y primer
 * apellido.
 */

// Partículas que nunca van solas: si el primer apellido empieza con una,
// «Ana de» no es un nombre, es un recorte mal hecho.
const PARTICULAS = new Set([
  "de", "del", "la", "las", "los", "san", "santa", "da", "di", "van", "von",
]);

/**
 * Arregla los extremos de mayúsculas.
 *
 * En la misma lista conviven «JULIAN ALFREDO LOPEZ MUÑOZ» y «sebastian
 * toledo»: cada quien se registró como quiso. Solo se tocan esos dos casos;
 * un «McCarthy» o un «de la Cruz» ya escritos a mano se dejan intactos.
 */
function capitalizar(parte: string): string {
  const bajo = parte.toLocaleLowerCase("es");
  if (parte !== parte.toLocaleUpperCase("es") && parte !== bajo) return parte;
  return bajo.charAt(0).toLocaleUpperCase("es") + bajo.slice(1);
}

/** Solo el nombre de pila, para saludar. */
export function primerNombre(nombre: string | null | undefined): string {
  const partes = (nombre ?? "").trim().split(/\s+/).filter(Boolean);
  return partes.length > 0 ? capitalizar(partes[0]) : "";
}

/** Nombre de pila y primer apellido, cuando se puede saber cuál es. */
export function nombreCorto(nombre: string | null | undefined): string {
  const partes = (nombre ?? "").trim().split(/\s+/).filter(Boolean).map(capitalizar);

  if (partes.length === 0) return "";
  if (partes.length <= 2) return partes.join(" ");

  // Con tres partes no hay forma de distinguir un segundo nombre («Erik
  // Santiago López») de un primer apellido («Stefanny Vasquez saenz»). Poner
  // el apellido equivocado en la cabecera de alguien es peor que no ponerlo.
  if (partes.length === 3) return partes[0];

  // Cuatro o más: nombre nombre apellido apellido.
  return PARTICULAS.has(partes[2].toLocaleLowerCase("es")) ? partes[0] : `${partes[0]} ${partes[2]}`;
}
