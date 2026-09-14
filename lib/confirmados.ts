import { getPool } from "./db";

/**
 * Cuándo el agente confirmó que el cliente llegó a su WhatsApp Business.
 *
 * La respuesta del paso 3 se guarda como etiqueta en GHL —ahí es donde vive
 * todo lo demás y donde cualquier flujo puede leerla—, pero una etiqueta no
 * trae hora. Y la hora es justo lo que necesita esta lista: el seguimiento de
 * un confirmado no arranca el día que el lead entró por la pauta, arranca el
 * día que el agente dijo «sí, ya está en mi WhatsApp».
 *
 * Por eso el momento se anota acá. GHL sigue siendo la fuente de verdad de
 * *si* está confirmado; esta tabla solo dice *cuándo*.
 */

export type Confirmacion = {
  contactId: string;
  usuario: string | null;
  confirmadoEn: string;
};

let tablaLista: Promise<void> | undefined;

function asegurarTabla(): Promise<void> {
  if (!tablaLista) {
    tablaLista = getPool()
      .query(
        `create table if not exists bajadas_confirmadas (
           contact_id    text primary key,
           usuario       text,
           confirmado_en timestamptz not null default now()
         )`
      )
      .then(() => undefined)
      .catch((e) => {
        tablaLista = undefined;
        throw e;
      });
  }
  return tablaLista;
}

/** El agente contestó que sí. Si cambia de opinión, la fila se borra. */
export async function anotarConfirmacion(
  contactId: string,
  usuario: string | null,
  confirmado: boolean
): Promise<void> {
  await asegurarTabla();
  if (!confirmado) {
    await getPool().query(`delete from bajadas_confirmadas where contact_id = $1`, [contactId]);
    return;
  }
  // La hora de la primera vez es la que vale: si vuelve a confirmar el mismo
  // contacto, el seguimiento no se reinicia.
  await getPool().query(
    `insert into bajadas_confirmadas (contact_id, usuario)
     values ($1, $2)
     on conflict (contact_id) do nothing`,
    [contactId, usuario]
  );
}

/**
 * Cuándo se confirmó cada uno de estos contactos.
 *
 * Los que ya tenían la etiqueta en GHL desde antes de que existiera esta tabla
 * no tienen fila. Se les crea una al primer vistazo para que dejen de quedar
 * sin fecha; la hora será la de ese momento y no la real, que se perdió.
 */
export async function confirmadosDe(ids: string[]): Promise<Map<string, string>> {
  const salida = new Map<string, string>();
  if (ids.length === 0) return salida;
  try {
    await asegurarTabla();
    const { rows } = await getPool().query<{ contact_id: string; confirmado_en: Date }>(
      `select contact_id, confirmado_en from bajadas_confirmadas where contact_id = any($1::text[])`,
      [ids]
    );
    for (const f of rows) salida.set(f.contact_id, f.confirmado_en.toISOString());

    const faltan = ids.filter((id) => !salida.has(id));
    if (faltan.length > 0) {
      const { rows: nuevas } = await getPool().query<{ contact_id: string; confirmado_en: Date }>(
        `insert into bajadas_confirmadas (contact_id)
         select unnest($1::text[])
         on conflict (contact_id) do nothing
         returning contact_id, confirmado_en`,
        [faltan]
      );
      for (const f of nuevas) salida.set(f.contact_id, f.confirmado_en.toISOString());
    }
  } catch {
    // Sin base, la lista se ordena por la fecha de entrada del lead.
  }
  return salida;
}
