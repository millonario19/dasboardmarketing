import { getPool } from "./db";

export { ESCALONES, comisionPorFtd } from "./comision";

/**
 * La meta del mes de cada agente.
 *
 * Un tablero que solo mide no mueve a nadie. La meta es lo único de la
 * pantalla que habla de la plata del agente, y por eso va arriba de todo: no
 * es un resumen, es el motivo por el que abre el tablero.
 *
 * La meta la escribe él. Dos números: cuántos FTD y cuánto quiere ganar.
 */

export type Meta = {
  mes: string; // YYYY-MM
  ftd: number;
  usd: number;
};

/** El mes en curso en Bogotá, que es el que cuenta para la comisión. */
export function mesActual(): string {
  return new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 7);
}

let tablaLista: Promise<void> | undefined;

function asegurarTabla(): Promise<void> {
  if (!tablaLista) {
    tablaLista = getPool()
      .query(
        `create table if not exists metas (
           usuario   text not null,
           mes       text not null,
           meta_ftd  integer not null default 0,
           meta_usd  numeric not null default 0,
           guardada_en timestamptz not null default now(),
           primary key (usuario, mes)
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

export async function leerMeta(usuario: string, mes = mesActual()): Promise<Meta | null> {
  try {
    await asegurarTabla();
    const { rows } = await getPool().query<{ meta_ftd: number; meta_usd: string }>(
      `select meta_ftd, meta_usd from metas where usuario = $1 and mes = $2`,
      [usuario, mes]
    );
    if (rows.length === 0) return null;
    return { mes, ftd: Number(rows[0].meta_ftd), usd: Number(rows[0].meta_usd) };
  } catch {
    // Sin meta guardada la tarjeta se muestra igual, invitando a ponerla.
    return null;
  }
}

export async function guardarMeta(usuario: string, ftd: number, usd: number, mes = mesActual()): Promise<Meta> {
  await asegurarTabla();
  await getPool().query(
    `insert into metas (usuario, mes, meta_ftd, meta_usd)
     values ($1, $2, $3, $4)
     on conflict (usuario, mes) do update
       set meta_ftd = excluded.meta_ftd, meta_usd = excluded.meta_usd, guardada_en = now()`,
    [usuario, mes, Math.max(0, Math.round(ftd)), Math.max(0, usd)]
  );
  return { mes, ftd: Math.round(ftd), usd };
}
