import { getPool } from "./db";

/**
 * Los mensajes de seguimiento, escritos por la oficina.
 *
 * Antes el texto vivía adentro de un flujo de GHL y el panel no podía leerlo:
 * la API deja listar los flujos pero no ver qué dicen. El agente tocaba
 * «enviar» sin saber qué salía, y si marketing cambiaba el texto en GHL nadie
 * se enteraba.
 *
 * Ahora vive acá, se ve antes de mandar y se puede editar en el momento. Lo
 * guardado es el punto de partida, no una camisa de fuerza.
 */

export type ClaveMensaje = string; // «d2-tibio», «d3-frio», …

export type Mensaje = {
  clave: ClaveMensaje;
  texto: string;
  actualizadoEn: string;
  actualizadoPor: string;
};

/** Lo que se manda si nadie escribió nada todavía. */
export const POR_DEFECTO: Record<string, string> = {
  "d2-caliente":
    "Hola {nombre}, te quedó el paso a medias 🙌 Diste clic para escribirme pero no me llegó tu mensaje. " +
    "Escribime por acá y lo resolvemos ya.",
  "d2-tibio":
    "Hola {nombre}, vi que entraste al canal 👋 Si querés que te explique cómo arranca la beca sin vueltas, " +
    "respondeme por acá y te cuento.",
  "d2-frio":
    "Hola {nombre}, ayer pediste información sobre la beca de trading. ¿Seguís interesado? " +
    "Respondeme por acá y te cuento sin compromiso.",
  "d3-caliente":
    "{nombre}, te marco hoy para cerrar esto en cinco minutos 📞 ¿A qué hora te queda bien?",
  "d3-tibio":
    "{nombre}, el jueves hay sesión abierta donde se ve la operativa en vivo, sin costo. " +
    "Respondeme «sí» y te anoto.",
  "d3-frio":
    "Hola {nombre}, última vez que te escribo por acá 🙂 El jueves hay sesión abierta de la beca, sin costo. " +
    "Si te interesa respondeme «sí» y te anoto.",
};

let tablaLista: Promise<void> | undefined;

function asegurarTabla(): Promise<void> {
  if (!tablaLista) {
    tablaLista = getPool()
      .query(
        `create table if not exists mensajes_seguimiento (
           clave           text primary key,
           texto           text not null,
           actualizado_en  timestamptz not null default now(),
           actualizado_por text not null
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

/** Todos los mensajes, con el texto por defecto donde nadie escribió aún. */
export async function todosLosMensajes(): Promise<Record<string, string>> {
  const salida = { ...POR_DEFECTO };
  try {
    await asegurarTabla();
    const { rows } = await getPool().query<{ clave: string; texto: string }>(
      `select clave, texto from mensajes_seguimiento`
    );
    for (const f of rows) salida[f.clave] = f.texto;
  } catch {
    /* sin base quedan los de fábrica */
  }
  return salida;
}

export async function guardarMensaje(
  clave: ClaveMensaje,
  texto: string,
  usuario: string
): Promise<void> {
  await asegurarTabla();
  await getPool().query(
    `insert into mensajes_seguimiento (clave, texto, actualizado_por)
     values ($1, $2, $3)
     on conflict (clave) do update
       set texto = excluded.texto, actualizado_en = now(), actualizado_por = excluded.actualizado_por`,
    [clave, texto, usuario]
  );
}

/**
 * El texto listo para mandar.
 *
 * Solo una marca, `{nombre}`, y a propósito: cada hueco más es una forma nueva
 * de que salga «Hola {apellido}» a un cliente real.
 */
export function armarTexto(plantilla: string, nombre: string): string {
  const primero = nombre.trim().split(/\s+/)[0] ?? "";
  return plantilla.replace(/\{nombre\}/g, primero);
}
