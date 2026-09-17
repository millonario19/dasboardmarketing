import { getPool } from "./db";
import { esResultado } from "./cuando";

/**
 * Las llamadas que hace el agente, y qué pasó en ellas.
 *
 * El celular del agente es una caja cerrada: nadie puede ver su registro de
 * llamadas. Lo único que el tablero sabe es que tocó el botón de llamar. Eso
 * es una señal, no una verdad —puede tocarlo y no llamar, o llamar sin
 * tocarlo— y así se muestra en pantalla.
 *
 * Lo que sí es verdad es el reporte: qué pasó en la llamada. Ese dato no
 * existe en ningún otro lado del sistema, porque pasó por el oído de una
 * persona. Y de todos los campos, el que más vale es `promesa_en`: es el
 * único dato de todo el tablero que crea trabajo para mañana.
 */

/**
 * Los resultados los define lib/cuando: ahí cada uno trae puesto cuándo se
 * vuelve a llamar, que es lo que el agente elige de verdad. Acá solo se
 * guardan.
 */
export type Resultado = string;

export type Llamada = {
  id: number;
  contactId: string;
  nombre: string | null;
  telefono: string | null;
  usuario: string;
  llamadaEn: string;
  contesto: boolean | null;
  resultado: Resultado | null;
  promesaEn: string | null;
  nota: string | null;
  reportadoEn: string | null;
};

export { esResultado };

let tablaLista: Promise<void> | undefined;

function asegurarTabla(): Promise<void> {
  if (!tablaLista) {
    tablaLista = getPool()
      .query(
        `create table if not exists llamadas (
           id           bigserial   primary key,
           contact_id   text        not null,
           nombre       text,
           telefono     text,
           agent_id     text,
           usuario      text        not null,
           llamada_en   timestamptz not null default now(),
           contesto     boolean,
           resultado    text,
           promesa_en   timestamptz,
           nota         text,
           reportado_en timestamptz
         )`
      )
      .then(() =>
        getPool().query(
          `create index if not exists llamadas_pendientes_idx
             on llamadas (usuario, reportado_en)`
        )
      )
      .then(() =>
        getPool().query(`create index if not exists llamadas_contacto_idx on llamadas (contact_id)`)
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
  id: string | number;
  contact_id: string;
  nombre: string | null;
  telefono: string | null;
  usuario: string;
  llamada_en: Date;
  contesto: boolean | null;
  resultado: string | null;
  promesa_en: Date | null;
  nota: string | null;
  reportado_en: Date | null;
};

const COLUMNAS =
  "id, contact_id, nombre, telefono, usuario, llamada_en, contesto, resultado, promesa_en, nota, reportado_en";

function aLlamada(f: Fila): Llamada {
  return {
    id: Number(f.id),
    contactId: f.contact_id,
    nombre: f.nombre,
    telefono: f.telefono,
    usuario: f.usuario,
    llamadaEn: f.llamada_en.toISOString(),
    contesto: f.contesto,
    resultado: esResultado(f.resultado) ? f.resultado : null,
    promesaEn: f.promesa_en?.toISOString() ?? null,
    nota: f.nota,
    reportadoEn: f.reportado_en?.toISOString() ?? null,
  };
}

export async function registrarLlamada(datos: {
  contactId: string;
  nombre?: string | null;
  telefono?: string | null;
  agentId?: string | null;
  usuario: string;
}): Promise<Llamada> {
  await asegurarTabla();
  const { rows } = await getPool().query<Fila>(
    `insert into llamadas (contact_id, nombre, telefono, agent_id, usuario)
     values ($1, $2, $3, $4, $5)
     returning ${COLUMNAS}`,
    [datos.contactId, datos.nombre ?? null, datos.telefono ?? null, datos.agentId ?? null, datos.usuario]
  );
  return aLlamada(rows[0]);
}

export async function reportarLlamada(
  id: number,
  usuario: string,
  reporte: { contesto: boolean; resultado?: Resultado | null; promesaEn?: string | null; nota?: string | null }
): Promise<Llamada | null> {
  await asegurarTabla();
  // El `usuario` va en el where, no solo por seguridad: sin eso, dos agentes
  // que llamaron al mismo lead se pisarían el reporte.
  const { rows } = await getPool().query<Fila>(
    `update llamadas
        set contesto = $3, resultado = $4, promesa_en = $5, nota = $6, reportado_en = now()
      where id = $1 and usuario = $2
      returning ${COLUMNAS}`,
    [
      id,
      usuario,
      reporte.contesto,
      reporte.contesto ? reporte.resultado ?? null : null,
      reporte.contesto && reporte.promesaEn ? reporte.promesaEn : null,
      reporte.nota?.trim() || null,
    ]
  );
  return rows.length > 0 ? aLlamada(rows[0]) : null;
}

/** Las llamadas que este agente hizo y todavía no contó cómo salieron. */
export async function pendientesDe(usuario: string): Promise<Llamada[]> {
  await asegurarTabla();
  const { rows } = await getPool().query<Fila>(
    `select ${COLUMNAS} from llamadas
      where usuario = $1 and reportado_en is null
      order by llamada_en desc
      limit 50`,
    [usuario]
  );
  return rows.map(aLlamada);
}

/** Todas las llamadas de un lead, para la línea de tiempo. */
export async function llamadasDeContacto(contactId: string): Promise<Llamada[]> {
  await asegurarTabla();
  const { rows } = await getPool().query<Fila>(
    `select ${COLUMNAS} from llamadas where contact_id = $1 order by llamada_en`,
    [contactId]
  );
  return rows.map(aLlamada);
}
