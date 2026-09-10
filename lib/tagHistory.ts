import { searchContacts, type GhlContact } from "./ghl";
import { getPool } from "./db";

// Solapamiento entre corridas: GHL puede indexar un cambio con unos segundos
// de retraso, así que cada vuelta re-mira un poco hacia atrás. Los duplicados
// no importan: el unique (contact_id, tag) los descarta.
const SOLAPE_MS = 2 * 60 * 1000;
// Primera corrida sin marca de agua: no barremos el histórico entero, alcanza
// con una ventana corta. Los contactos viejos se van incorporando solos a
// medida que reciben etiquetas nuevas.
const PRIMERA_VENTANA_MS = 15 * 60 * 1000;

export type ResultadoSondeo = {
  desde: string;
  hasta: string;
  contactosRevisados: number;
  etiquetasNuevas: number;
  etiquetasDeArrastre: number;
};

/**
 * Trae los contactos que cambiaron desde la última corrida y anota las
 * etiquetas que no estaban registradas.
 *
 * La distinción clave es si el tiempo es confiable o no:
 *
 *  - Contacto creado dentro de la ventana -> es un lead nuevo, todas sus
 *    etiquetas nacieron ahora: 'poll'.
 *  - Contacto que ya figura en el cuaderno -> lo veníamos seguiendo, así que
 *    una etiqueta que no teníamos es genuinamente nueva: 'poll'.
 *  - Contacto viejo que vemos por primera vez -> sus etiquetas pueden ser de
 *    hace semanas y no hay forma de saberlo: 'backfill', y quedan excluidas de
 *    cualquier cálculo de tiempos.
 *
 * Sin esa tercera regla, un contacto de hace un mes que hoy recibe una
 * etiqueta haría que sus otras cuatro se registraran como si acabaran de
 * ocurrir, inventando tiempos de respuesta que nunca existieron.
 */
export async function runTagSnapshot(): Promise<ResultadoSondeo> {
  const pool = getPool();
  const ahora = new Date();

  const estado = await pool.query<{ last_updated_at: Date | null }>(
    `select last_updated_at from tag_sync_state where id = 1`
  );
  const marca = estado.rows[0]?.last_updated_at ?? null;
  const desde = marca
    ? new Date(marca.getTime() - SOLAPE_MS)
    : new Date(ahora.getTime() - PRIMERA_VENTANA_MS);

  const contactos = await searchContacts([
    { field: "dateUpdated", operator: "range", value: { gte: desde.toISOString(), lte: ahora.toISOString() } },
  ]);

  let nuevas = 0;
  let arrastre = 0;

  if (contactos.length > 0) {
    const ids = contactos.map((c) => c.id);
    const conocidos = await pool.query<{ contact_id: string }>(
      `select distinct contact_id from tag_history where contact_id = any($1::text[])`,
      [ids]
    );
    const yaSeguidos = new Set(conocidos.rows.map((r) => r.contact_id));

    for (const contacto of contactos) {
      const tags = contacto.tags ?? [];
      if (tags.length === 0) continue;

      const esLeadNuevo = new Date(contacto.dateAdded).getTime() >= desde.getTime();
      const confiable = esLeadNuevo || yaSeguidos.has(contacto.id);
      const source = confiable ? "poll" : "backfill";
      const occurredAt = fechaDeCambio(contacto, ahora);

      for (const tag of tags) {
        const res = await pool.query(
          `insert into tag_history (contact_id, tag, occurred_at, agent_id, source)
           values ($1, $2, $3, $4, $5)
           on conflict (contact_id, tag) do nothing`,
          [contacto.id, tag, occurredAt, contacto.assignedTo ?? null, source]
        );
        if (res.rowCount) {
          if (confiable) nuevas += 1;
          else arrastre += 1;
        }
      }
    }
  }

  await pool.query(
    `update tag_sync_state set last_updated_at = $1, last_run_at = now() where id = 1`,
    [ahora]
  );

  return {
    desde: desde.toISOString(),
    hasta: ahora.toISOString(),
    contactosRevisados: contactos.length,
    etiquetasNuevas: nuevas,
    etiquetasDeArrastre: arrastre,
  };
}

// dateUpdated es el momento real en que GHL tocó el contacto, así que es mucho
// más preciso que la hora de la corrida: si el tag se puso hace 3 minutos, esa
// es la marca que queda, no el instante en que el sondeo lo descubrió.
function fechaDeCambio(contacto: GhlContact, tope: Date): Date {
  const bruto = contacto.dateUpdated ?? contacto.dateAdded;
  const fecha = new Date(bruto);
  if (isNaN(fecha.getTime()) || fecha > tope) return tope;
  return fecha;
}
