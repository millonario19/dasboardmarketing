import { getPool } from "./db";
import { comisionPorFtd } from "./comision";

export { ESCALONES, comisionPorFtd, MEMBRESIAS, SIN_MEMBRESIAS } from "./comision";
import { SIN_MEMBRESIAS, usdDeMembresias, type Membresias } from "./comision";

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
  /** El escalón de FTD que se propuso alcanzar. */
  ftd: number;
  /** Lo que suman las dos metas: el escalón de FTD más las membresías. */
  usd: number;
  /** Cuántas membresías de cada clase piensa vender. */
  plan: Membresias;
  /** Cuántas lleva vendidas. Las anota él: no hay de dónde leerlas. */
  vendidas: Membresias;
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
      // Las membresías llegaron después de la tabla: en las bases que ya
      // existen hay que agregarlas aparte. Van en columnas y no en un JSON
      // porque son cuatro y fijas, y así se pueden sumar desde SQL el día que
      // la dirección quiera el total de la oficina.
      .then(() =>
        getPool().query(
          ["oro", "platino", "vip", "gopro"]
            .flatMap((c) => [
              `alter table metas add column if not exists plan_${c} integer not null default 0`,
              `alter table metas add column if not exists vend_${c} integer not null default 0`,
            ])
            .join("; ")
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

export async function leerMeta(usuario: string, mes = mesActual()): Promise<Meta | null> {
  try {
    await asegurarTabla();
    const { rows } = await getPool().query<Record<string, number | string>>(
      `select meta_ftd, meta_usd,
              plan_oro, plan_platino, plan_vip, plan_gopro,
              vend_oro, vend_platino, vend_vip, vend_gopro
         from metas where usuario = $1 and mes = $2`,
      [usuario, mes]
    );
    if (rows.length === 0) return null;
    const f = rows[0];
    const cuenta = (prefijo: string): Membresias => ({
      oro: Number(f[`${prefijo}_oro`] ?? 0),
      platino: Number(f[`${prefijo}_platino`] ?? 0),
      vip: Number(f[`${prefijo}_vip`] ?? 0),
      gopro: Number(f[`${prefijo}_gopro`] ?? 0),
    });
    return {
      mes,
      ftd: Number(f.meta_ftd),
      usd: Number(f.meta_usd),
      plan: cuenta("plan"),
      vendidas: cuenta("vend"),
    };
  } catch {
    // Sin meta guardada la tarjeta se muestra igual, invitando a ponerla.
    return null;
  }
}

const entero = (x: unknown) => Math.max(0, Math.round(Number(x) || 0));
const limpiar = (c?: Partial<Membresias> | null): Membresias => ({
  oro: entero(c?.oro),
  platino: entero(c?.platino),
  vip: entero(c?.vip),
  gopro: entero(c?.gopro),
});

export async function guardarMeta(
  usuario: string,
  datos: { ftd: number; plan?: Partial<Membresias> | null; vendidas?: Partial<Membresias> | null },
  mes = mesActual()
): Promise<Meta> {
  await asegurarTabla();
  const ftd = entero(datos.ftd);
  const plan = limpiar(datos.plan);
  const vendidas = limpiar(datos.vendidas);
  // El total no se pide: se calcula. Guardarlo suelto dejaría que la meta
  // dijera un número y sus dos mitades sumaran otro.
  const usd = comisionPorFtd(ftd).pago + usdDeMembresias(plan);

  await getPool().query(
    `insert into metas (usuario, mes, meta_ftd, meta_usd,
                        plan_oro, plan_platino, plan_vip, plan_gopro,
                        vend_oro, vend_platino, vend_vip, vend_gopro)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (usuario, mes) do update
       set meta_ftd = excluded.meta_ftd, meta_usd = excluded.meta_usd,
           plan_oro = excluded.plan_oro, plan_platino = excluded.plan_platino,
           plan_vip = excluded.plan_vip, plan_gopro = excluded.plan_gopro,
           vend_oro = excluded.vend_oro, vend_platino = excluded.vend_platino,
           vend_vip = excluded.vend_vip, vend_gopro = excluded.vend_gopro,
           guardada_en = now()`,
    [usuario, mes, ftd, usd,
     plan.oro, plan.platino, plan.vip, plan.gopro,
     vendidas.oro, vendidas.platino, vendidas.vip, vendidas.gopro]
  );
  return { mes, ftd, usd, plan, vendidas };
}
