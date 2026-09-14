/**
 * La tabla de comisión por FTD.
 *
 * Vive aparte de lib/metas porque ese módulo abre la base de datos, y la
 * pantalla necesita estas cuentas del lado del navegador: importarlo desde un
 * componente arrastraría el driver de Postgres al paquete del cliente.
 *
 * Los escalones son «al menos»: con 50 FTD se cobra el de 45 hasta llegar a
 * 65. No es proporcional — entre un escalón y el siguiente el pago no se
 * mueve, y por eso saber cuánto falta para el próximo es lo que empuja.
 */

export const ESCALONES: [number, number][] = [
  [35, 280],
  [45, 360],
  [65, 585],
  [90, 850],
  [120, 1200],
  [150, 1500],
  [180, 1800],
];

export function comisionPorFtd(ftd: number): {
  pago: number;
  escalon: number | null;
  siguiente: [number, number] | null;
} {
  let pago = 0;
  let escalon: number | null = null;
  let siguiente: [number, number] | null = null;
  for (const [desde, monto] of ESCALONES) {
    if (ftd >= desde) {
      pago = monto;
      escalon = desde;
    } else if (!siguiente) {
      siguiente = [desde, monto];
    }
  }
  return { pago, escalon, siguiente };
}
