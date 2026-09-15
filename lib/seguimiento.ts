import {
  searchContacts,
  extractAttribution,
  contactDisplayName,
  type GhlContact,
} from "./ghl";
import {
  estadoDeLead,
  accionesDeLead,
  yaDeposito,
  confirmacionDeBajada,
  TAG_BUSINESS,
  TAG_BAJADA_SI,
  type EstadoLead,
} from "./leadStates";
import { notasDe, type Nota } from "./notas";
import { confirmadosDe } from "./confirmados";
import { tareasDe, cerrados, enviadosHoy, type Accion } from "./acciones";
import { ventanasDe, SIN_VENTANA, type Ventana } from "./ventana";
import { soloDelAgente } from "./metrics";
import { getPool } from "./db";

/**
 * El seguimiento de los días anteriores.
 *
 * El tablero mostraba el día de hoy y el mes entero, y entremedio no había
 * nada. Pero el trabajo de la mañana no es el mes: es «a quién de ayer le
 * quedé debiendo algo», y después antier, y después el de hace tres días. Un
 * lead de hace cuatro días ya está frío y no vale el mismo esfuerzo; uno de
 * ayer todavía se acuerda de la conversación.
 *
 * Aparte de los leads por día va la agenda: lo que un cliente prometió y no
 * cumplió. Ese dato no está en GHL ni en ninguna etiqueta — nace cuando el
 * agente reporta una llamada y dice «va a depositar el martes a las 9». Es el
 * único dato del tablero que crea trabajo para mañana.
 */

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

// Hoy y los tres días anteriores. Más atrás el lead ya se enfrió y la lista se
// vuelve un archivo en vez de una tarea.
export const DIAS_DE_SEGUIMIENTO = 2;

const CACHE_MS = 60_000;
const cache = new Map<string, { en: number; datos: Seguimiento }>();

/**
 * Por dónde va este lead.
 *
 * No es la temperatura —eso dice cuánto interés tiene— sino qué hay que hacer
 * con él. La diferencia que importa es una sola: si llegó o no al WhatsApp
 * Business del agente, porque a partir de ahí el sistema deja de ver.
 */
export type Via = "llego" | "clic-sin-llegar" | "tibio-sin-bajar" | "no-responde";

export const VIA_TITULO: Record<Via, string> = {
  llego: "Calientes · falta confirmar",
  "clic-sin-llegar": "Hizo clic y no llegó",
  "tibio-sin-bajar": "Tibio sin bajar",
  "no-responde": "No responde",
};

export type LeadDeSeguimiento = {
  id: string;
  nombre: string;
  telefono: string | null;
  creado: string;
  agente: string;
  estado: EstadoLead;
  acciones: string[];
  via: Via;
  /** Lo que el agente escribió de su puño; vacío hasta que escriba. */
  nota: Nota | null;
  /**
   * La próxima tarea que el agente se puso. Vacío significa algo concreto: a
   * este cliente nadie le programó nada, y un cliente sin próxima tarea se
   * muere solo. Por eso la lista lo marca en rojo en vez de dejarlo pasar.
   */
  tarea: Accion | null;
  /**
   * Cuánto le queda de la ventana de 24 horas de Meta. De acá sale si el
   * seguimiento del día sale gratis o hay que gastar una plantilla — y si se
   * puede mandar algo, para empezar.
   */
  ventana: Ventana;
  /** Si ya le salió el seguimiento del embudo hoy, a qué hora. */
  enviadoHoy: string | null;
};

/**
 * Alguien que ya está en el WhatsApp Business del agente.
 *
 * Es la lista que de verdad importa: el cliente salió del alcance de GHL y
 * ahora depende de que el agente lo trabaje. No entra por el día en que el
 * lead llegó por la pauta —eso es otra cosa— sino por el día en que el agente
 * confirmó que lo tiene, y no se cae a los tres días: se sale de la lista
 * cuando deposita o cuando el agente marca «Cerrar seguimiento».
 */
export type LeadEnBusiness = LeadDeSeguimiento & {
  /** Cuándo el agente dijo que sí. */
  confirmadoEn: string;
  /** Días completos desde entonces, para saber por dónde va la cadencia. */
  dias: number;
};

/** Un clic en «bajar a WhatsApp» que nadie respondió si terminó en algo. */
export type PorConfirmar = {
  id: string;
  nombre: string;
  telefono: string | null;
  agente: string;
  creado: string;
};

export type Promesa = {
  llamadaId: number;
  contactId: string;
  nombre: string | null;
  telefono: string | null;
  /** Cuándo dijo el cliente que iba a hacerlo. */
  cuando: string;
  /** Ya pasó la hora y nadie volvió a llamar. */
  vencida: boolean;
  resultado: string | null;
  nota: string | null;
};

export type DiaDeSeguimiento = {
  fecha: string; // YYYY-MM-DD en Bogotá
  etiqueta: string; // «Hoy», «Ayer», «Antier», «Hace 3 días»
  leads: LeadDeSeguimiento[];
  // Cuántos hay de cada temperatura, para verlo sin abrir la pestaña.
  porEstado: Record<EstadoLead, number>;
};

export type Seguimiento = {
  dias: DiaDeSeguimiento[];
  /** Los que ya están en el WhatsApp Business del agente. */
  enBusiness: LeadEnBusiness[];
  /** Lo primero del día: el sistema sabe que hicieron clic, no si llegaron. */
  porConfirmar: PorConfirmar[];
  promesas: Promesa[];
  generadoEn: string;
};

function inicioDeDiaBogota(ms: number): number {
  const local = new Date(ms - BOGOTA_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + BOGOTA_OFFSET_MS;
}

function diaBogota(iso: string): string {
  return new Date(new Date(iso).getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

function viaDeLead(contacto: GhlContact, estado: EstadoLead): Via {
  const hizoClic = (contacto.tags ?? []).some((t) => t.toLowerCase() === TAG_BUSINESS);
  // El «no» del agente no lo devuelve al montón de tibios: este ya levantó la
  // mano y se cayó en el último paso, y se trabaja distinto.
  if (hizoClic && confirmacionDeBajada(contacto) === "no") return "clic-sin-llegar";
  // Los confirmados salieron de las pestañas por día: tienen su propia lista,
  // ordenada por cuándo se confirmaron. Lo que queda acá es el caliente al que
  // todavía nadie le verificó que llegó.
  if (estado === "caliente") return "llego";
  if (estado === "tibio") return "tibio-sin-bajar";
  return "no-responde";
}

/**
 * Los que ya están en el WhatsApp Business del agente.
 *
 * Búsqueda propia, sin la ventana de tres días: a estos no se los deja de
 * seguir porque hayan entrado hace una semana. Se cierran solos cuando
 * depositan, y a mano cuando el agente elige «Cerrar seguimiento».
 */
async function enMiBusiness(soloAgente: string | null | undefined): Promise<LeadEnBusiness[]> {
  const contactos = await soloDelAgente(
    await searchContacts([
      { field: "tags", operator: "contains", value: process.env.GHL_LEAD_TAG ?? "ingreso de pauta" },
      { field: "tags", operator: "contains", value: TAG_BAJADA_SI },
    ]),
    soloAgente
  );

  const conVida = (contactos as GhlContact[]).filter((c) => !yaDeposito(c));
  const idsTodos = conVida.map((c) => c.id);
  const yaCerrados = await cerrados(idsTodos);
  // El agente da por terminado el seguimiento desde la misma ficha donde lo
  // hace todo. Sin esa salida la lista solo crece.
  const vivos = conVida.filter((c) => !yaCerrados.has(c.id));
  const ids = vivos.map((c) => c.id);
  const [notas, confirmados, tareas] = await Promise.all([
    notasDe(ids),
    confirmadosDe(ids),
    tareasDe(ids),
  ]);

  const ahora = Date.now();
  const salida: LeadEnBusiness[] = [];

  for (const contacto of vivos) {
    const nota = notas.get(contacto.id) ?? null;
    if (nota?.proximaAccion === CERRADO) continue;

    const { agent } = await extractAttribution(contacto);
    const confirmadoEn = confirmados.get(contacto.id) ?? contacto.dateAdded;
    salida.push({
      id: contacto.id,
      nombre: contactDisplayName(contacto),
      telefono: contacto.phone ?? null,
      creado: contacto.dateAdded,
      agente: agent,
      estado: estadoDeLead(contacto),
      acciones: accionesDeLead(contacto),
      via: "llego",
      nota,
      tarea: tareas.get(contacto.id) ?? null,
      // Los confirmados no reciben automáticos: su ventana no se mira.
      ventana: SIN_VENTANA,
      enviadoHoy: null,
      confirmadoEn,
      dias: Math.max(
        0,
        Math.floor((inicioDeDiaBogota(ahora) - inicioDeDiaBogota(new Date(confirmadoEn).getTime())) / 864e5)
      ),
    });
  }

  // El último confirmado arriba: es el que todavía está caliente.
  salida.sort((a, b) => b.confirmadoEn.localeCompare(a.confirmadoEn));
  return salida;
}

/** Lo que el agente elige cuando ya no hay nada más que hacer con el cliente. */
export const CERRADO = "Cerrar seguimiento";

// El embudo los cuenta desde que el lead entró: el día 1 es el día que llegó.
// «Hoy / Ayer / Antier» decía lo mismo pero no dejaba hablar del día 2 con
// marketing ni con los flujos, que se llaman igual.
const ETIQUETAS = ["Día 1", "Día 2", "Día 3", "Día 4", "Día 5", "Día 6"];

/**
 * Lo que el cliente prometió, todavía sin cumplir.
 *
 * Solo entran las llamadas donde el agente dejó una fecha: «va a depositar» o
 * «volver a llamar». Las que ya vencieron van primero, porque son las que
 * alguien dejó pasar.
 */
async function promesasPendientes(usuario: string | null): Promise<Promesa[]> {
  try {
    const { rows } = await getPool().query<{
      id: string | number;
      contact_id: string;
      nombre: string | null;
      telefono: string | null;
      promesa_en: Date;
      resultado: string | null;
      nota: string | null;
    }>(
      `select id, contact_id, nombre, telefono, promesa_en, resultado, nota
         from llamadas
        where promesa_en is not null
          and reportado_en is not null
          and promesa_en >= now() - interval '15 days'
          ${usuario ? "and usuario = $1" : ""}
        order by promesa_en`,
      usuario ? [usuario] : []
    );
    const ahora = Date.now();
    return rows.map((f) => ({
      llamadaId: Number(f.id),
      contactId: f.contact_id,
      nombre: f.nombre,
      telefono: f.telefono,
      cuando: f.promesa_en.toISOString(),
      vencida: f.promesa_en.getTime() < ahora,
      resultado: f.resultado,
      nota: f.nota,
    }));
  } catch {
    // La tabla se crea sola en el primer reporte de llamada; hasta entonces no
    // hay agenda, y eso no es un error.
    return [];
  }
}

export async function computeSeguimiento(
  soloAgente: string | null | undefined,
  usuario: string | null,
  dias = DIAS_DE_SEGUIMIENTO
): Promise<Seguimiento> {
  const ahora = Date.now();
  const llave = `${soloAgente ?? "todos"}|${usuario ?? "-"}|${dias}`;
  const guardado = cache.get(llave);
  if (guardado && ahora - guardado.en < CACHE_MS) return guardado.datos;

  const arrancaHoy = inicioDeDiaBogota(ahora);
  // La ventana incluye hoy: el seguimiento del día en curso es el primero que
  // se mira, no el último.
  const desde = new Date(arrancaHoy - dias * 864e5).toISOString();
  const hasta = new Date(ahora).toISOString();

  // Una sola búsqueda cubre los tres días; separarlos serían tres consultas
  // para el mismo dato.
  const contactos = await soloDelAgente(
    await searchContacts([
      { field: "tags", operator: "contains", value: process.env.GHL_LEAD_TAG ?? "ingreso de pauta" },
      { field: "dateAdded", operator: "range", value: { gte: desde, lte: hasta } },
    ]),
    soloAgente
  );

  const porDia = new Map<string, LeadDeSeguimiento[]>();
  const porConfirmar: PorConfirmar[] = [];
  const utiles: { contacto: GhlContact; agente: string; estado: EstadoLead }[] = [];

  for (const contacto of contactos as GhlContact[]) {
    // Los que ya depositaron salen: el seguimiento es de lo que falta cerrar.
    if (yaDeposito(contacto)) continue;
    // Y los confirmados también: están en su propia lista, que no se cae a los
    // tres días. Dejarlos acá los mostraba dos veces y con dos relojes.
    if (confirmacionDeBajada(contacto) === "si") continue;
    const { agent } = await extractAttribution(contacto);
    const estado = estadoDeLead(contacto);
    utiles.push({ contacto, agente: agent, estado });

    // El clic está registrado y nadie dijo si del otro lado apareció alguien.
    const hizoClic = (contacto.tags ?? []).some((t) => t.toLowerCase() === TAG_BUSINESS);
    if (hizoClic && confirmacionDeBajada(contacto) === null) {
      porConfirmar.push({
        id: contacto.id,
        nombre: contactDisplayName(contacto),
        telefono: contacto.phone ?? null,
        agente: agent,
        creado: contacto.dateAdded,
      });
    }
  }

  const idsUtiles = utiles.map((u) => u.contacto.id);
  const [notas, tareasPorDia, cerradosPorDia, ventanas, enviados] = await Promise.all([
    notasDe(idsUtiles),
    tareasDe(idsUtiles),
    cerrados(idsUtiles),
    ventanasDe(idsUtiles),
    enviadosHoy(idsUtiles),
  ]);

  for (const { contacto, agente, estado } of utiles) {
    // Cerrado a mano en la ficha: no vuelve a salir en ninguna pestaña.
    if (cerradosPorDia.has(contacto.id)) continue;
    const dia = diaBogota(contacto.dateAdded);
    const lista = porDia.get(dia) ?? [];
    lista.push({
      id: contacto.id,
      nombre: contactDisplayName(contacto),
      telefono: contacto.phone ?? null,
      creado: contacto.dateAdded,
      agente,
      estado,
      acciones: accionesDeLead(contacto),
      via: viaDeLead(contacto, estado),
      nota: notas.get(contacto.id) ?? null,
      tarea: tareasPorDia.get(contacto.id) ?? null,
      ventana: ventanas.get(contacto.id) ?? SIN_VENTANA,
      enviadoHoy: enviados.get(contacto.id) ?? null,
    });
    porDia.set(dia, lista);
  }

  // Caliente primero: es donde está la plata más cerca. Y dentro de cada
  // temperatura, la ventana que se cierra antes — esa se pierde si nadie la
  // toca hoy, y con ella el envío gratis.
  const orden: Record<EstadoLead, number> = { caliente: 0, tibio: 1, frio: 2 };
  const salida: DiaDeSeguimiento[] = [];
  for (let i = 0; i <= dias; i++) {
    const fecha = diaBogota(new Date(arrancaHoy - i * 864e5 + 3600e3).toISOString());
    const leads = (porDia.get(fecha) ?? []).sort(
      (a, b) =>
        orden[a.estado] - orden[b.estado] ||
        (a.ventana.cierraEn ?? "9").localeCompare(b.ventana.cierraEn ?? "9") ||
        b.creado.localeCompare(a.creado)
    );
    const porEstado = { frio: 0, tibio: 0, caliente: 0 } as Record<EstadoLead, number>;
    for (const l of leads) porEstado[l.estado] += 1;
    salida.push({ fecha, etiqueta: ETIQUETAS[i] ?? `Día ${i + 1}`, leads, porEstado });
  }

  const [enBusiness, promesas] = await Promise.all([
    enMiBusiness(soloAgente),
    promesasPendientes(usuario),
  ]);

  const datos: Seguimiento = {
    dias: salida,
    enBusiness,
    porConfirmar,
    promesas,
    generadoEn: new Date(ahora).toISOString(),
  };
  cache.set(llave, { en: ahora, datos });
  return datos;
}
