import { getPool } from "./db";

/**
 * Lo que el agente escribe de su puño sobre cada cliente.
 *
 * Hoy eso vive en un Excel, y ahí está el problema: el agente sí documenta —lo
 * hace todos los días— pero en un lugar que el sistema no puede leer. La
 * conversación se muda al WhatsApp Business del agente y de ahí en adelante lo
 * único que existe es lo que él cuente.
 *
 * Por eso los tres campos son los que un Excel tiene y un formulario suele
 * perder: texto libre sin menú, una próxima acción y una fecha. Nada
 * obligatorio, nada de botón guardar. Si escribir acá cuesta más que escribir
 * en la planilla, vuelven a la planilla.
 */

export type Nota = {
  contactId: string;
  nota: string | null;
  proximaAccion: string | null;
  proximaEn: string | null;
  actualizadoEn: string;
  actualizadoPor: string;
};

let tablaLista: Promise<void> | undefined;

function asegurarTabla(): Promise<void> {
  if (!tablaLista) {
    tablaLista = getPool()
      .query(
        `create table if not exists notas_seguimiento (
           contact_id      text        primary key,
           nota            text,
           proxima_accion  text,
           proxima_en      timestamptz,
           actualizado_en  timestamptz not null default now(),
           actualizado_por text        not null
         )`
      )
      .then(() =>
        getPool().query(
          `create index if not exists notas_proxima_idx on notas_seguimiento (proxima_en)`
        )
      )
      .then(() => undefined)
      .catch((e) => {
        tablaLista = undefined;
        throw e;
      });
  }
  return tablaLista;
}

type Fila = {
  contact_id: string;
  nota: string | null;
  proxima_accion: string | null;
  proxima_en: Date | null;
  actualizado_en: Date;
  actualizado_por: string;
};

const aNota = (f: Fila): Nota => ({
  contactId: f.contact_id,
  nota: f.nota,
  proximaAccion: f.proxima_accion,
  proximaEn: f.proxima_en?.toISOString() ?? null,
  actualizadoEn: f.actualizado_en.toISOString(),
  actualizadoPor: f.actualizado_por,
});

/** Las notas de varios leads de una vez: una consulta por pantalla, no por fila. */
export async function notasDe(ids: string[]): Promise<Map<string, Nota>> {
  if (ids.length === 0) return new Map();
  try {
    await asegurarTabla();
    const { rows } = await getPool().query<Fila>(
      `select * from notas_seguimiento where contact_id = any($1::text[])`,
      [ids]
    );
    return new Map(rows.map((f) => [f.contact_id, aNota(f)]));
  } catch {
    // Sin notas la pantalla igual sirve: los datos de GHL son lo principal.
    return new Map();
  }
}

/**
 * Guarda lo que el agente escribió.
 *
 * Se guarda al salir del campo, no con un botón: una planilla tampoco tiene
 * botón de guardar, y cada clic de más es una razón para volver a ella.
 */
export async function guardarNota(
  contactId: string,
  datos: { nota?: string | null; proximaAccion?: string | null; proximaEn?: string | null },
  usuario: string
): Promise<Nota> {
  await asegurarTabla();
  const { rows } = await getPool().query<Fila>(
    `insert into notas_seguimiento (contact_id, nota, proxima_accion, proxima_en, actualizado_por)
     values ($1, $2, $3, $4, $5)
     on conflict (contact_id) do update set
       nota            = coalesce(excluded.nota, notas_seguimiento.nota),
       proxima_accion  = coalesce(excluded.proxima_accion, notas_seguimiento.proxima_accion),
       proxima_en      = coalesce(excluded.proxima_en, notas_seguimiento.proxima_en),
       actualizado_en  = now(),
       actualizado_por = excluded.actualizado_por
     returning *`,
    [
      contactId,
      datos.nota ?? null,
      datos.proximaAccion ?? null,
      datos.proximaEn ?? null,
      usuario,
    ]
  );
  return aNota(rows[0]);
}
