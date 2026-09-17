import { getPool } from "./db";
import { crearUsuario, listarUsuarios } from "./usuarios";

/**
 * Las oficinas de la red.
 *
 * Son cuatro —Prime, Apex, Elite y Legendary—, cada una con sus directores y
 * su propio equipo. Hasta ahora el tablero asumía que había una sola, y por
 * eso el alcance de todo era binario: o veías tus leads, o los veías todos.
 * Con cuatro oficinas eso ya no alcanza: un director de Apex no puede ver a la
 * gente de Prime.
 *
 * Cada oficina es una subcuenta distinta de GoHighLevel, con su propio
 * `location_id` y su propio token. Por eso `locationId` puede venir vacío: la
 * oficina existe en la organización, tiene su gente y sus directores, pero el
 * tablero todavía no sabe leerle los datos. Mejor eso que esconderla — el
 * admin tiene que ver las cuatro y saber cuáles faltan.
 */

export type Oficina = {
  id: number;
  slug: string;
  nombre: string;
  /** Subcuenta de GHL. Vacío mientras no esté conectada. */
  locationId: string | null;
  activa: boolean;
};

type Fila = {
  id: number;
  slug: string;
  nombre: string;
  location_id: string | null;
  activa: boolean;
};

const aOficina = (f: Fila): Oficina => ({
  id: f.id,
  slug: f.slug,
  nombre: f.nombre,
  locationId: f.location_id,
  activa: f.activa,
});

/** Las cuatro, como están hoy. Prime es la única con subcuenta conectada. */
const SEMILLA: { slug: string; nombre: string; conectada: boolean }[] = [
  { slug: "prime", nombre: "Oficina Prime", conectada: true },
  { slug: "apex", nombre: "Oficina Apex", conectada: false },
  { slug: "elite", nombre: "Oficina Elite", conectada: false },
  { slug: "legendary", nombre: "Oficina Legendary", conectada: false },
];

let tablaLista: Promise<void> | undefined;

function asegurarTabla(): Promise<void> {
  if (!tablaLista) {
    tablaLista = getPool()
      .query(
        `create table if not exists oficinas (
           id          serial      primary key,
           slug        text        not null unique,
           nombre      text        not null,
           location_id text,
           activa      boolean     not null default true,
           creada_en   timestamptz not null default now()
         )`
      )
      // Las cuatro se siembran solas. El deploy no tiene paso de migraciones
      // —es copiar archivos y levantar el contenedor— así que una tabla que
      // hay que llenar a mano es una tabla que algún día se olvida.
      .then(async () => {
        for (const o of SEMILLA) {
          await getPool().query(
            `insert into oficinas (slug, nombre, location_id)
             values ($1, $2, $3)
             on conflict (slug) do nothing`,
            [o.slug, o.nombre, o.conectada ? process.env.GHL_LOCATION_ID ?? null : null]
          );
        }
      })
      .then(() => ordenarPrime())
      .then(() => undefined)
      .catch((e) => {
        tablaLista = undefined;
        throw e;
      });
  }
  return tablaLista;
}

export async function listarOficinas(): Promise<Oficina[]> {
  await asegurarTabla();
  const { rows } = await getPool().query<Fila>(
    `select id, slug, nombre, location_id, activa from oficinas order by id`
  );
  return rows.map(aOficina);
}

export async function oficinaPorSlug(slug: string): Promise<Oficina | null> {
  await asegurarTabla();
  const { rows } = await getPool().query<Fila>(
    `select id, slug, nombre, location_id, activa from oficinas where slug = $1`,
    [slug]
  );
  return rows[0] ? aOficina(rows[0]) : null;
}

export async function oficinaPorId(id: number): Promise<Oficina | null> {
  await asegurarTabla();
  const { rows } = await getPool().query<Fila>(
    `select id, slug, nombre, location_id, activa from oficinas where id = $1`,
    [id]
  );
  return rows[0] ? aOficina(rows[0]) : null;
}

/** La oficina piloto: a ella pertenece todo el que no tenga otra asignada. */
export async function oficinaPorDefecto(): Promise<Oficina | null> {
  return oficinaPorSlug("prime");
}

/**
 * Los agentes de una oficina, por su id de GHL.
 *
 * Es el filtro que hace que un director vea a los suyos y solo a los suyos.
 * Devuelve los `agent_id` porque es con eso con lo que se filtran los
 * contactos: el `assignedTo` de cada lead.
 */
export async function agentesDeOficina(oficinaId: number): Promise<string[]> {
  await asegurarTabla();
  const { rows } = await getPool().query<{ agent_id: string }>(
    `select agent_id from usuarios
      where oficina_id = $1 and activo and agent_id <> ''`,
    [oficinaId]
  );
  return rows.map((r) => r.agent_id);
}

/**
 * Poner Prime en orden, una sola vez.
 *
 * Prime es la oficina piloto: los doce usuarios que ya existían son suyos, y
 * estaban todos guardados como «agente» porque hasta ahora no había otra cosa
 * que se pudiera ser. Acá se les pone la oficina, se asciende a Julián —que ya
 * tenía usuario— y se crea el de Diana, que dirige pero nunca había entrado.
 *
 * Los dos entran con la contraseña común del equipo, como todos los demás: no
 * se les inventa una acá. Cuando quieran una propia se la ponen en Mi cuenta.
 *
 * Corre una sola vez; la marca queda en `migraciones`.
 */
const DIRECTORES_PRIME: { usuario: string; nombre: string; agentId: string }[] = [
  { usuario: "diana", nombre: "Diana Córdoba", agentId: "IGgS4TFaFOKBeA8Qlwow" },
  { usuario: "julian", nombre: "Julián Alfredo López Muñoz", agentId: "WL0bTSVg0SHGdMXNZ3YH" },
];

async function ordenarPrime(): Promise<void> {
  const pool = getPool();
  await pool.query(
    `create table if not exists migraciones (
       nombre     text primary key,
       corrida_en timestamptz not null default now()
     )`
  );
  const { rowCount } = await pool.query(
    `insert into migraciones (nombre) values ('oficinas_prime_piloto')
     on conflict (nombre) do nothing`
  );
  if (!rowCount) return;

  const { rows } = await pool.query<{ id: number }>(
    `select id from oficinas where slug = 'prime'`
  );
  const prime = rows[0]?.id;
  if (!prime) return;

  // Primero leer, y recién después escribir: `listarUsuarios` es lo que crea
  // la tabla y le agrega la columna `oficina_id`. Al revés, el update de abajo
  // se cae en una base nueva por una columna que todavía no existe.
  const existentes = await listarUsuarios();

  // Todo el que ya existía es de Prime: era la única oficina que había.
  await pool.query(`update usuarios set oficina_id = $1 where oficina_id is null`, [prime]);
  for (const d of DIRECTORES_PRIME) {
    const suyo = existentes.find((u) => u.usuario === d.usuario);
    if (suyo) {
      await pool.query(`update usuarios set rol = 'director', oficina_id = $2 where id = $1`, [
        suyo.id,
        prime,
      ]);
    } else {
      await crearUsuario({
        usuario: d.usuario,
        nombre: d.nombre,
        agentId: d.agentId,
        rol: "director",
        oficinaId: prime,
      }).catch(() => undefined);
    }
  }
}
