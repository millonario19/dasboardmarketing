import {
  searchContacts,
  extractAttribution,
  contactDisplayName,
  type GhlContact,
} from "./ghl";
import { estadoDeLead, accionesDeLead, yaDeposito, type EstadoLead } from "./leadStates";
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

// Tres días hacia atrás, sin contar hoy. Más atrás el lead ya se enfrió y la
// lista se vuelve un archivo en vez de una tarea.
export const DIAS_DE_SEGUIMIENTO = 3;

const CACHE_MS = 60_000;
const cache = new Map<string, { en: number; datos: Seguimiento }>();

export type LeadDeSeguimiento = {
  id: string;
  nombre: string;
  telefono: string | null;
  creado: string;
  agente: string;
  estado: EstadoLead;
  acciones: string[];
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
  etiqueta: string; // «Ayer», «Antier», «Hace 3 días»
  leads: LeadDeSeguimiento[];
};

export type Seguimiento = {
  dias: DiaDeSeguimiento[];
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

const ETIQUETAS = ["Ayer", "Antier", "Hace 3 días", "Hace 4 días", "Hace 5 días"];

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
  const desde = new Date(arrancaHoy - dias * 864e5).toISOString();
  const hasta = new Date(arrancaHoy).toISOString();

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
  for (const contacto of contactos as GhlContact[]) {
    // Los que ya depositaron salen: el seguimiento es de lo que falta cerrar.
    if (yaDeposito(contacto)) continue;
    const { agent } = await extractAttribution(contacto);
    const dia = diaBogota(contacto.dateAdded);
    const lista = porDia.get(dia) ?? [];
    lista.push({
      id: contacto.id,
      nombre: contactDisplayName(contacto),
      telefono: contacto.phone ?? null,
      creado: contacto.dateAdded,
      agente: agent,
      estado: estadoDeLead(contacto),
      acciones: accionesDeLead(contacto),
    });
    porDia.set(dia, lista);
  }

  // Caliente primero: es donde está la plata más cerca.
  const orden: Record<EstadoLead, number> = { caliente: 0, tibio: 1, frio: 2 };
  const salida: DiaDeSeguimiento[] = [];
  for (let i = 1; i <= dias; i++) {
    const fecha = diaBogota(new Date(arrancaHoy - i * 864e5 + 3600e3).toISOString());
    const leads = (porDia.get(fecha) ?? []).sort(
      (a, b) => orden[a.estado] - orden[b.estado] || b.creado.localeCompare(a.creado)
    );
    salida.push({ fecha, etiqueta: ETIQUETAS[i - 1] ?? `Hace ${i} días`, leads });
  }

  const datos: Seguimiento = {
    dias: salida,
    promesas: await promesasPendientes(usuario),
    generadoEn: new Date(ahora).toISOString(),
  };
  cache.set(llave, { en: ahora, datos });
  return datos;
}
