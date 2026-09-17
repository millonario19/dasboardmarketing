import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getPool } from "./db";
import type { Rol } from "./auth";

const scrypt = promisify(scryptCallback) as (
  clave: string,
  sal: Buffer,
  largo: number
) => Promise<Buffer>;

export type Usuario = {
  id: number;
  usuario: string;
  nombre: string;
  agentId: string;
  rol: Rol;
  /** A qué oficina pertenece. Vacío solo en el admin, que no es de ninguna. */
  oficinaId: number | null;
  // No devolvemos el hash nunca; solo si la persona tiene contraseña propia o
  // sigue usando la común del equipo.
  clavePropia: boolean;
  activo: boolean;
};

type Fila = {
  id: number;
  usuario: string;
  nombre: string;
  agent_id: string;
  rol: Rol;
  oficina_id: number | null;
  password_hash: string | null;
  activo: boolean;
};

function aUsuario(f: Fila): Usuario {
  return {
    id: f.id,
    usuario: f.usuario,
    nombre: f.nombre,
    agentId: f.agent_id,
    rol: f.rol,
    oficinaId: f.oficina_id,
    clavePropia: f.password_hash !== null,
    activo: f.activo,
  };
}

// La tabla se crea sola en la primera consulta. El deploy es copiar archivos y
// levantar el contenedor, sin paso de migraciones, así que una migración que
// hay que acordarse de correr a mano es una migración que algún día no se
// corre y rompe el login.
let tablaLista: Promise<void> | undefined;

function asegurarTabla(): Promise<void> {
  if (!tablaLista) {
    tablaLista = getPool()
      .query(
        `create table if not exists usuarios (
           id            serial primary key,
           usuario       text        not null unique,
           nombre        text        not null,
           agent_id      text        not null,
           rol           text        not null default 'agente',
           password_hash text,
           activo        boolean     not null default true,
           creado_en     timestamptz not null default now()
         )`
      )
      .then(() => getPool().query(`create index if not exists usuarios_agent_id_idx on usuarios (agent_id)`))
      // La columna y el rol nuevo llegaron después de la tabla: en las bases
      // que ya existen hay que agregarlos aparte. El `check` se reescribe
      // entero porque el viejo solo admitía admin y agente, y un director no
      // habría podido guardarse.
      .then(() => getPool().query(`alter table usuarios add column if not exists oficina_id integer`))
      .then(() => getPool().query(`alter table usuarios drop constraint if exists usuarios_rol_check`))
      .then(() =>
        getPool().query(
          `alter table usuarios add constraint usuarios_rol_check
             check (rol in ('admin', 'director', 'agente'))`
        )
      )
      .then(() => getPool().query(`create index if not exists usuarios_oficina_idx on usuarios (oficina_id)`))
      .then(() => undefined)
      .catch((e) => {
        // Si falló, que el próximo intento lo vuelva a probar en vez de
        // quedarse con la promesa rechazada para siempre.
        tablaLista = undefined;
        throw e;
      });
  }
  return tablaLista;
}

const COLUMNAS = "id, usuario, nombre, agent_id, rol, oficina_id, password_hash, activo";

export function normalizarUsuario(texto: string): string {
  return texto.trim().toLowerCase();
}

export async function hashearClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(clave, sal, 32);
  return `scrypt$${sal.toString("hex")}$${hash.toString("hex")}`;
}

export async function claveCoincide(clave: string, guardado: string): Promise<boolean> {
  const [alg, salHex, hashHex] = guardado.split("$");
  if (alg !== "scrypt" || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const calculado = await scrypt(clave, Buffer.from(salHex, "hex"), esperado.length);
  return esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
}

// Para la contraseña común, que vive en texto plano en app.env y no como hash.
export function textoCoincide(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function buscarPorUsuario(usuario: string): Promise<(Usuario & { hash: string | null }) | null> {
  await asegurarTabla();
  const { rows } = await getPool().query<Fila>(
    `select ${COLUMNAS} from usuarios where usuario = $1`,
    [normalizarUsuario(usuario)]
  );
  if (rows.length === 0) return null;
  return { ...aUsuario(rows[0]), hash: rows[0].password_hash };
}

export async function listarUsuarios(): Promise<Usuario[]> {
  await asegurarTabla();
  const { rows } = await getPool().query<Fila>(
    `select ${COLUMNAS} from usuarios order by activo desc, nombre asc`
  );
  return rows.map(aUsuario);
}

export async function crearUsuario(datos: {
  usuario: string;
  nombre: string;
  agentId: string;
  rol: Rol;
  oficinaId?: number | null;
  clave?: string | null;
}): Promise<Usuario> {
  await asegurarTabla();
  const hash = datos.clave ? await hashearClave(datos.clave) : null;
  const { rows } = await getPool().query<Fila>(
    `insert into usuarios (usuario, nombre, agent_id, rol, oficina_id, password_hash)
     values ($1, $2, $3, $4, $5, $6)
     returning ${COLUMNAS}`,
    [
      normalizarUsuario(datos.usuario),
      datos.nombre.trim(),
      datos.agentId,
      datos.rol,
      datos.oficinaId ?? null,
      hash,
    ]
  );
  return aUsuario(rows[0]);
}

export async function actualizarUsuario(
  id: number,
  cambios: {
    nombre?: string;
    agentId?: string;
    rol?: Rol;
    oficinaId?: number | null;
    activo?: boolean;
    clave?: string | null;
  }
): Promise<Usuario | null> {
  await asegurarTabla();
  const sets: string[] = [];
  const valores: unknown[] = [];
  const agregar = (columna: string, valor: unknown) => {
    valores.push(valor);
    sets.push(`${columna} = $${valores.length}`);
  };

  if (cambios.nombre !== undefined) agregar("nombre", cambios.nombre.trim());
  if (cambios.agentId !== undefined) agregar("agent_id", cambios.agentId);
  if (cambios.rol !== undefined) agregar("rol", cambios.rol);
  if (cambios.oficinaId !== undefined) agregar("oficina_id", cambios.oficinaId);
  if (cambios.activo !== undefined) agregar("activo", cambios.activo);
  // clave === null borra la contraseña propia y devuelve a la persona a la
  // contraseña común; undefined es "no tocar".
  if (cambios.clave !== undefined) {
    agregar("password_hash", cambios.clave === null ? null : await hashearClave(cambios.clave));
  }
  if (sets.length === 0) return null;

  valores.push(id);
  const { rows } = await getPool().query<Fila>(
    `update usuarios set ${sets.join(", ")} where id = $${valores.length} returning ${COLUMNAS}`,
    valores
  );
  return rows.length === 0 ? null : aUsuario(rows[0]);
}

export async function eliminarUsuario(id: number): Promise<boolean> {
  await asegurarTabla();
  const { rowCount } = await getPool().query(`delete from usuarios where id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
