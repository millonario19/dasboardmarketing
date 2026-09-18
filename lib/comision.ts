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

/**
 * Las membresías, que es la otra mitad de la comisión.
 *
 * Acá no hay escalones: cada venta paga lo suyo desde la primera. Por eso el
 * agente arma su meta de membresías como una lista de cuántas piensa vender de
 * cada una, y esa lista se convierte en plata de una multiplicación.
 */
export type ClaseMembresia = "oro" | "platino" | "vip" | "gopro";

export type MetaMembresia = {
  id: ClaseMembresia;
  nombre: string;
  /** Lo que paga cada una, en dólares. */
  usd: number;
  color: string;
};

export const MEMBRESIAS: MetaMembresia[] = [
  { id: "oro", nombre: "Miembro Oro", usd: 200, color: "#f5a623" },
  { id: "platino", nombre: "Miembro Platino", usd: 100, color: "#8e9bb3" },
  { id: "vip", nombre: "Miembro VIP", usd: 50, color: "#2563eb" },
  { id: "gopro", nombre: "Bot GoPro", usd: 250, color: "#157f52" },
];

export type Membresias = Record<ClaseMembresia, number>;

export const SIN_MEMBRESIAS: Membresias = { oro: 0, platino: 0, vip: 0, gopro: 0 };

export function usdDeMembresias(c: Membresias): number {
  return MEMBRESIAS.reduce((s, m) => s + (c[m.id] || 0) * m.usd, 0);
}

export function unidadesDeMembresias(c: Membresias): number {
  return MEMBRESIAS.reduce((s, m) => s + (c[m.id] || 0), 0);
}

/** Cuántos días tiene el mes en curso en Bogotá. */
export function diasDelMes(ahora = Date.now()): number {
  const local = new Date(ahora - 5 * 3600e3);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
}

/** Qué día del mes es hoy en Bogotá. */
export function diaDelMes(ahora = Date.now()): number {
  return new Date(ahora - 5 * 3600e3).getUTCDate();
}

/**
 * La meta de hoy, en números enteros.
 *
 * Se redondea hacia arriba a propósito: medio FTD no existe, y redondeando
 * hacia abajo el agente cumple su meta todos los días y llega corto a fin de
 * mes, que es la peor manera de fallar.
 */
export function metaDiaria(metaFtd: number, ahora = Date.now()): number {
  return Math.ceil(metaFtd / Math.max(1, diasDelMes(ahora)));
}

/** Cuántos por día hacen falta de acá al cierre, con lo que ya lleva. */
export function ritmoQueFalta(metaFtd: number, logrado: number, ahora = Date.now()): number {
  const faltan = Math.max(0, metaFtd - logrado);
  const quedan = Math.max(1, diasDelMes(ahora) - diaDelMes(ahora) + 1);
  return Math.ceil(faltan / quedan);
}
