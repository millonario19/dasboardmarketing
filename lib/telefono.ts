/**
 * A formato internacional.
 *
 * El agente lo va a pegar como se lo mandaron —con espacios, con guiones, con
 * o sin indicativo— y GHL necesita E.164 o no lo guarda. Colombia es el caso
 * normal: diez dígitos que empiezan por 3.
 */
export function normalizarTelefono(crudo: string): string | null {
  const d = crudo.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  const soloDigitos = d.replace(/\D/g, "");
  if (d.startsWith("+")) return soloDigitos.length >= 10 ? `+${soloDigitos}` : null;
  // Celular colombiano suelto: 3XXXXXXXXX.
  if (soloDigitos.length === 10 && soloDigitos.startsWith("3")) return `+57${soloDigitos}`;
  // Ya viene con el indicativo pero sin el más.
  if (soloDigitos.length === 12 && soloDigitos.startsWith("573")) return `+${soloDigitos}`;
  // Fijo de Bogotá y similares: se acepta con indicativo del país.
  if (soloDigitos.length >= 11 && soloDigitos.length <= 15) return `+${soloDigitos}`;
  return null;
}
