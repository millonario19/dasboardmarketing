import { getPool } from "./db";
import { TIPO_CIERRE, TIPOS_DEL_EMBUDO, type TipoAccion } from "./tiposAccion";

/**
 * Todo lo que el agente hace con un cliente, una fila por vez.
 *
 * Antes esto era un solo casillero por cliente —un texto, una acción, una
 * fecha— y escribir lo de mañana borraba lo de hoy. Pero una tarde con un
 * cliente no es un dato: es «lo llamé, no contestó, me escribió, dijo que
 * mañana a las 11 ya tiene la plata». Son cuatro hechos y una tarea.
 *
 * Por eso hay una sola tabla y no dos. Un registro y una tarea son la misma
 * cosa mirada desde distinto lado del tiempo:
 *
 *   hecha_en puesto, vence_en vacío  -> pasó
 *   vence_en puesto, hecha_en vacío  -> hay que hacerlo
 *
 * Y cuando el agente registra algo, las tareas abiertas de ese cliente se
 * cierran solas: si acaba de llamarlo, la tarea de llamarlo ya no existe.
 *
 * El nombre y el teléfono viajan en la fila, como en `llamadas`. La lista de
 * «hoy tenés que llamar» se arma solo con esta tabla, sin ir a GHL a buscar
 * quién es cada uno: ese viaje tarda segundos y es lo primero que se abre.
 */

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

export type Accion = {
  id: number;
  contactId: string;
  nombre: string | null;
  telefono: string | null;
  usuario: string;
  tipo: TipoAccion;
  detalle: string | null;
  /** Cuándo pasó. Vacío mientras sea una tarea por hacer. */
  hechaEn: string | null;
  /** Cuándo hay que hacerlo. Vacío si es solo el registro de algo que pasó. */
  venceEn: string | null;
  cerradaEn: string | null;
  creadaEn: string;
};

let tablaLista: Promise<void> | undefined;

function asegurarTabla(): Promise<void> {
  if (!tablaLista) {
    tablaLista = getPool()
      .query(
        `create table if not exists acciones (
           id         bigserial   primary key,
           contact_id text        not null,
           nombre     text,
           telefono   text,
           usuario    text        not null,
           tipo       text        not null,
           detalle    text,
           hecha_en   timestamptz,
           vence_en   timestamptz,
           cerrada_en timestamptz,
           creada_en  timestamptz not null default now()
         )`
      )
      .then(() =>
        getPool().query(`create index if not exists acciones_contacto_idx on acciones (contact_id, creada_en desc)`)
      )
      .then(() =>
        getPool().query(
          `create index if not exists acciones_pendientes_idx
             on acciones (usuario, vence_en)
             where vence_en is not null and cerrada_en is null and hecha_en is null`
        )
      )
      .then(() => migrarNotasViejas())
      .then(() => undefined)
      .catch((e) => {
        tablaLista = undefined;
        throw e;
      });
  }
  return tablaLista;
}

/**
 * Lo que los agentes ya habían escrito, antes de que esto fuera un hilo.
 *
 * `notas_seguimiento` guardaba una fila por cliente: un texto, una próxima
 * acción y una fecha. Poco, pero escrito a mano por alguien que habló con el
 * cliente, y por eso no se tira. Cada nota pasa a ser una acción registrada y
 * cada próxima acción, una tarea.
 *
 * Corre una sola vez: la marca queda en `migraciones`.
 */
const NOMBRES_VIEJOS: Record<string, TipoAccion> = {
  llamar: "llame",
  escribir: "escribi",
  "enviar audio": "audio",
  "reenviar el link": "escribi",
  "video testimonio": "video",
  "video de la operativa": "video",
  "invitar a la sesión": "sesion",
  "cerrar seguimiento": "cerrar",
};

async function migrarNotasViejas(): Promise<void> {
  const pool = getPool();
  await pool.query(
    `create table if not exists migraciones (
       nombre     text primary key,
       corrida_en timestamptz not null default now()
     )`
  );
  const { rowCount } = await pool.query(
    `insert into migraciones (nombre) values ('notas_a_acciones')
     on conflict (nombre) do nothing`
  );
  if (!rowCount) return;

  const { rows } = await pool.query<{
    contact_id: string;
    nota: string | null;
    proxima_accion: string | null;
    proxima_en: Date | null;
    actualizado_en: Date;
    actualizado_por: string;
  }>(`select * from notas_seguimiento`);

  for (const n of rows) {
    if (n.nota?.trim()) {
      await pool.query(
        `insert into acciones (contact_id, usuario, tipo, detalle, hecha_en)
         values ($1, $2, 'escribi', $3, $4)`,
        [n.contact_id, n.actualizado_por, n.nota.trim(), n.actualizado_en]
      );
    }
    const tipo = NOMBRES_VIEJOS[(n.proxima_accion ?? "").trim().toLowerCase()];
    if (tipo && n.proxima_en) {
      await pool.query(
        `insert into acciones (contact_id, usuario, tipo, vence_en)
         values ($1, $2, $3, $4)`,
        [n.contact_id, n.actualizado_por, tipo, n.proxima_en]
      );
    }
  }
}

type Fila = {
  id: string | number;
  contact_id: string;
  nombre: string | null;
  telefono: string | null;
  usuario: string;
  tipo: string;
  detalle: string | null;
  hecha_en: Date | null;
  vence_en: Date | null;
  cerrada_en: Date | null;
  creada_en: Date;
};

const aAccion = (f: Fila): Accion => ({
  id: Number(f.id),
  contactId: f.contact_id,
  nombre: f.nombre,
  telefono: f.telefono,
  usuario: f.usuario,
  tipo: f.tipo as TipoAccion,
  detalle: f.detalle,
  hechaEn: f.hecha_en?.toISOString() ?? null,
  venceEn: f.vence_en?.toISOString() ?? null,
  cerradaEn: f.cerrada_en?.toISOString() ?? null,
  creadaEn: f.creada_en.toISOString(),
});

export type Quien = {
  contactId: string;
  nombre?: string | null;
  telefono?: string | null;
  usuario: string;
};

/**
 * Registrar algo que ya pasó, y de paso cerrar lo que quedaba pendiente.
 *
 * Las dos cosas van en la misma transacción: si se cerrara la tarea sin haber
 * guardado el registro, el cliente quedaría sin nada que hacer y sin rastro de
 * por qué.
 */
export async function registrarAccion(
  quien: Quien,
  tipo: TipoAccion,
  detalle: string | null
): Promise<Accion> {
  await asegurarTabla();
  const cliente = await getPool().connect();
  try {
    await cliente.query("begin");
    const { rows } = await cliente.query<Fila>(
      `insert into acciones (contact_id, nombre, telefono, usuario, tipo, detalle, hecha_en)
       values ($1, $2, $3, $4, $5, $6, now())
       returning *`,
      [quien.contactId, quien.nombre ?? null, quien.telefono ?? null, quien.usuario, tipo, detalle]
    );
    await cliente.query(
      `update acciones set cerrada_en = now()
        where contact_id = $1 and vence_en is not null and hecha_en is null and cerrada_en is null`,
      [quien.contactId]
    );
    await cliente.query("commit");
    return aAccion(rows[0]);
  } catch (e) {
    await cliente.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    cliente.release();
  }
}

/** Dejar programado lo que sigue. Es lo único que crea trabajo para mañana. */
export async function programarTarea(
  quien: Quien,
  tipo: TipoAccion,
  detalle: string | null,
  venceEn: string
): Promise<Accion> {
  await asegurarTabla();
  const { rows } = await getPool().query<Fila>(
    `insert into acciones (contact_id, nombre, telefono, usuario, tipo, detalle, vence_en)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [
      quien.contactId,
      quien.nombre ?? null,
      quien.telefono ?? null,
      quien.usuario,
      tipo,
      detalle,
      venceEn,
    ]
  );
  return aAccion(rows[0]);
}

/** El hilo completo de un cliente, lo viejo arriba. */
export async function hiloDe(contactId: string): Promise<Accion[]> {
  try {
    await asegurarTabla();
    const { rows } = await getPool().query<Fila>(
      `select * from acciones where contact_id = $1 order by coalesce(hecha_en, vence_en, creada_en)`,
      [contactId]
    );
    return rows.map(aAccion);
  } catch {
    return [];
  }
}

/** La tarea abierta de cada uno de estos clientes, para pintarla en la fila. */
export async function tareasDe(contactIds: string[]): Promise<Map<string, Accion>> {
  const salida = new Map<string, Accion>();
  if (contactIds.length === 0) return salida;
  try {
    await asegurarTabla();
    const { rows } = await getPool().query<Fila>(
      `select distinct on (contact_id) *
         from acciones
        where contact_id = any($1::text[])
          and vence_en is not null and hecha_en is null and cerrada_en is null
        order by contact_id, vence_en`,
      [contactIds]
    );
    for (const f of rows) salida.set(f.contact_id, aAccion(f));
  } catch {
    /* sin base, la fila se muestra sin tarea */
  }
  return salida;
}

/**
 * ¿Ya le salió un seguimiento del embudo hoy?
 *
 * El tope de uno por día lo lleva el dashboard porque GHL no puede: un flujo no
 * sabe cuántas veces se disparó hoy sobre el mismo contacto. Y dos mensajes el
 * mismo día es justo lo que hace que a un número lo bloqueen.
 */
export async function enviadoHoy(contactId: string): Promise<boolean> {
  try {
    await asegurarTabla();
    const local = new Date(Date.now() - BOGOTA_OFFSET_MS);
    const arranca = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + BOGOTA_OFFSET_MS
    ).toISOString();
    const { rows } = await getPool().query<{ n: string }>(
      `select count(*) as n from acciones
        where contact_id = $1 and hecha_en >= $2 and tipo = any($3::text[])`,
      [contactId, arranca, TIPOS_DEL_EMBUDO]
    );
    return Number(rows[0]?.n ?? 0) > 0;
  } catch {
    // Sin base no se puede saber. Dejar pasar es peor que no dejar: preferimos
    // no mandar nada a mandar el segundo del día.
    return true;
  }
}

/** Cuáles de estos ya recibieron el seguimiento de hoy. */
export async function enviadosHoy(contactIds: string[]): Promise<Map<string, string>> {
  const salida = new Map<string, string>();
  if (contactIds.length === 0) return salida;
  try {
    await asegurarTabla();
    const local = new Date(Date.now() - BOGOTA_OFFSET_MS);
    const arranca = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + BOGOTA_OFFSET_MS
    ).toISOString();
    const { rows } = await getPool().query<{ contact_id: string; hecha_en: Date }>(
      `select distinct on (contact_id) contact_id, hecha_en from acciones
        where contact_id = any($1::text[]) and hecha_en >= $2 and tipo = any($3::text[])
        order by contact_id, hecha_en desc`,
      [contactIds, arranca, TIPOS_DEL_EMBUDO]
    );
    for (const f of rows) salida.set(f.contact_id, f.hecha_en.toISOString());
  } catch {
    /* sin base, la fila se muestra sin marca */
  }
  return salida;
}

/** A quién le cerraron el seguimiento a mano. */
export async function cerrados(contactIds: string[]): Promise<Set<string>> {
  const salida = new Set<string>();
  if (contactIds.length === 0) return salida;
  try {
    await asegurarTabla();
    const { rows } = await getPool().query<{ contact_id: string }>(
      `select distinct contact_id from acciones
        where contact_id = any($1::text[]) and tipo = $2`,
      [contactIds, TIPO_CIERRE]
    );
    for (const f of rows) salida.add(f.contact_id);
  } catch {
    /* sin base no se cerró nadie */
  }
  return salida;
}

function finDeHoyBogota(): string {
  const local = new Date(Date.now() - BOGOTA_OFFSET_MS);
  const inicioManana =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) + BOGOTA_OFFSET_MS;
  return new Date(inicioManana).toISOString();
}

export type Tareas = {
  vencidas: Accion[];
  hoy: Accion[];
  /** Lo que ya está agendado para más adelante; no es trabajo de hoy. */
  masAdelante: number;
};

/**
 * Lo que hay que hacer hoy.
 *
 * Vencidas y de hoy van separadas a propósito: son dos urgencias distintas y
 * juntarlas en una lista hace que lo que se pasó ayer se pierda entre lo de
 * hoy. Las vencidas no caducan solas — se arrastran hasta que alguien las
 * haga o cierre el cliente.
 */
export async function tareasDeHoy(usuario: string | null): Promise<Tareas> {
  try {
    await asegurarTabla();
    const corte = finDeHoyBogota();
    const { rows } = await getPool().query<Fila>(
      `select * from acciones
        where vence_en is not null and hecha_en is null and cerrada_en is null
          ${usuario ? "and usuario = $1" : ""}
        order by vence_en`,
      usuario ? [usuario] : []
    );
    const todas = rows.map(aAccion);
    const ahora = Date.now();
    return {
      vencidas: todas.filter((a) => new Date(a.venceEn!).getTime() < ahora),
      hoy: todas.filter(
        (a) => new Date(a.venceEn!).getTime() >= ahora && a.venceEn! < corte
      ),
      masAdelante: todas.filter((a) => a.venceEn! >= corte).length,
    };
  } catch {
    return { vencidas: [], hoy: [], masAdelante: 0 };
  }
}

export type ResumenDelDia = {
  llamadas: number;
  mensajes: number;
  material: number;
  cumplidas: number;
  vencidas: number;
};

/**
 * El marcador del día, contado de las mismas filas.
 *
 * Es el número que hoy vive en el Excel escrito a mano. Acá sale solo: si cada
 * acción es una fila con tipo y hora, nadie tiene que escribirlo dos veces.
 */
export async function resumenDeHoy(usuario: string | null): Promise<ResumenDelDia> {
  const vacio = { llamadas: 0, mensajes: 0, material: 0, cumplidas: 0, vencidas: 0 };
  try {
    await asegurarTabla();
    const local = new Date(Date.now() - BOGOTA_OFFSET_MS);
    const arranca = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + BOGOTA_OFFSET_MS
    ).toISOString();
    const args: unknown[] = [arranca];
    if (usuario) args.push(usuario);
    const filtro = usuario ? "and usuario = $2" : "";

    const { rows } = await getPool().query<{ tipo: string; n: string }>(
      `select tipo, count(*) as n from acciones
        where hecha_en >= $1 ${filtro}
        group by tipo`,
      args
    );
    const por = (t: string) => Number(rows.find((r) => r.tipo === t)?.n ?? 0);

    const { rows: cerradas } = await getPool().query<{ n: string }>(
      `select count(*) as n from acciones
        where cerrada_en >= $1 and vence_en is not null ${filtro}`,
      args
    );
    const { rows: vencidas } = await getPool().query<{ n: string }>(
      `select count(*) as n from acciones
        where vence_en < now() and hecha_en is null and cerrada_en is null ${usuario ? "and usuario = $1" : ""}`,
      usuario ? [usuario] : []
    );

    return {
      llamadas: por("llame"),
      mensajes: por("escribi") + por("me-escribio"),
      material: por("video") + por("foto") + por("audio"),
      cumplidas: Number(cerradas[0]?.n ?? 0),
      vencidas: Number(vencidas[0]?.n ?? 0),
    };
  } catch {
    return vacio;
  }
}
