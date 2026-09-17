/**
 * Cuándo lo vuelvo a llamar, en toques.
 *
 * Es la pieza central del CRM de llamadas. El agente cuelga y el cliente le
 * acaba de decir algo muy concreto —«mañana en la mañana deposito, llamame a
 * las 8», «llamame en tres horas cuando salga del trabajo»—, y ese dato tiene
 * que quedar guardado antes de que marque el siguiente número. Un selector de
 * fecha y hora ahí es un trámite: son cinco toques, se hace en el celular, y
 * después de la décima llamada nadie lo llena.
 *
 * Así que las respuestas del cliente ya están puestas como botones. «En 3
 * horas» es un toque. Y la fecha exacta sigue estando, para el caso raro.
 *
 * Vive aparte de lib/acciones porque de acá lee el navegador: ese módulo
 * importa Postgres y traérselo al cliente arrastra el driver entero.
 */

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Hoy a esta hora, en Bogotá, corrido tantos días. */
function enBogota(diasAdelante: number, hora: number, desde = Date.now()): string {
  const local = new Date(desde - BOGOTA_OFFSET_MS);
  const ms =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() + diasAdelante,
      hora
    ) + BOGOTA_OFFSET_MS;
  return new Date(ms).toISOString();
}

/** Días hasta el próximo lunes. Si hoy es lunes, el de la semana que viene. */
function hastaElLunes(desde = Date.now()): number {
  const diaBogota = new Date(desde - BOGOTA_OFFSET_MS).getUTCDay();
  return ((8 - diaBogota) % 7) || 7;
}

export type OpcionCuando = {
  id: string;
  /** Lo que dice el botón. */
  texto: string;
  /** Lo que se lee en el resumen: «lo llamás mañana 8:00 a. m.». */
  calcular: (desde?: number) => string | null;
};

export const CUANDO: OpcionCuando[] = [
  { id: "1h", texto: "En 1 hora", calcular: (d = Date.now()) => new Date(d + 3600e3).toISOString() },
  { id: "3h", texto: "En 3 horas", calcular: (d = Date.now()) => new Date(d + 3 * 3600e3).toISOString() },
  { id: "manana-8", texto: "Mañana 8:00 a. m.", calcular: (d) => enBogota(1, 8, d) },
  { id: "manana-14", texto: "Mañana 2:00 p. m.", calcular: (d) => enBogota(1, 14, d) },
  { id: "lunes", texto: "El lunes", calcular: (d = Date.now()) => enBogota(hastaElLunes(d), 9, d) },
  // Las dos que no calculan nada: una la escribe el agente, la otra cierra.
  { id: "otro", texto: "Otro día…", calcular: () => null },
  { id: "nunca", texto: "No lo llamo más", calcular: () => null },
];

export const opcionCuando = (id: string): OpcionCuando | undefined =>
  CUANDO.find((c) => c.id === id);

/**
 * Cómo salió la llamada.
 *
 * Cada resultado trae puesto cuándo se vuelve a llamar, y ese es todo el
 * truco: el agente toca «no contestó» y el sistema ya dejó marcado «en 3
 * horas», que es lo que iba a elegir igual. Si el cliente dijo otra cosa, lo
 * corrige con un toque más. La mayoría de las veces no tiene que corregir
 * nada.
 */
export type MetaResultado = {
  id: string;
  texto: string;
  /** Qué opción de «cuándo» queda marcada al elegir este resultado. */
  cuando: string;
  tono: "bueno" | "malo" | "normal";
  /** Cuenta como llamada efectiva en el marcador del día. */
  efectiva?: boolean;
};

export const RESULTADOS: MetaResultado[] = [
  { id: "registro", texto: "Se registró", cuando: "manana-8", tono: "bueno", efectiva: true },
  { id: "deposita", texto: "Va a depositar", cuando: "manana-8", tono: "bueno", efectiva: true },
  { id: "piensa", texto: "Lo está pensando", cuando: "manana-14", tono: "normal" },
  { id: "no-contesto", texto: "No contestó", cuando: "3h", tono: "malo" },
  { id: "ocupado", texto: "Ocupado, después", cuando: "3h", tono: "malo" },
  { id: "no-interesa", texto: "No le interesa", cuando: "nunca", tono: "malo" },
  { id: "equivocado", texto: "Número equivocado", cuando: "nunca", tono: "malo" },
];

export const metaResultado = (id: string): MetaResultado | undefined =>
  RESULTADOS.find((r) => r.id === id);

export const esResultado = (x: unknown): x is string =>
  typeof x === "string" && RESULTADOS.some((r) => r.id === x);

/** «mañana 8:00 a. m.», «hoy 7:10 p. m.» — para confirmar antes de guardar. */
export function leerCuando(iso: string | null): string {
  if (!iso) return "no lo llamás más";
  const cuando = new Date(iso);
  const dia = (ms: number) =>
    new Date(ms - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
  const hoy = dia(Date.now());
  const manana = dia(Date.now() + 864e5);
  const suyo = dia(cuando.getTime());
  const hora = cuando.toLocaleTimeString("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
  if (suyo === hoy) return `hoy ${hora}`;
  if (suyo === manana) return `mañana ${hora}`;
  const fecha = cuando.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "America/Bogota",
  });
  return `${fecha} ${hora}`;
}
