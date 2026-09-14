/**
 * Los tipos de acción, sin base de datos.
 *
 * Vive aparte de lib/acciones.ts porque de acá lee el navegador: ese módulo
 * importa Postgres y traérselo a un componente de cliente arrastra el driver
 * entero al paquete.
 *
 * Los nombres son provisionales a propósito. Los agentes ya documentan todos
 * los días en un Excel y tienen sus propias palabras; cuando lleguen, se
 * cambian acá y cambian en toda la pantalla.
 */

export type TipoAccion =
  | "llame"
  | "escribi"
  | "video"
  | "foto"
  | "audio"
  | "me-escribio"
  | "sesion"
  | "cerrar";

export type MetaTipo = {
  id: TipoAccion;
  /** Lo que se escribe en el hilo, en pasado: «Lo llamé». */
  hecho: string;
  /** Lo que se escribe cuando todavía es una tarea: «Llamar». */
  tarea: string;
  icono: string;
  /** Verde lo que empuja, rojo lo que falló, ámbar lo que dijo el cliente. */
  color: "azul" | "verde" | "ambar" | "rojo" | "gris";
};

export const TIPOS: MetaTipo[] = [
  { id: "llame", hecho: "Lo llamé", tarea: "Llamar", icono: "✆", color: "azul" },
  { id: "escribi", hecho: "Le escribí", tarea: "Escribir", icono: "✎", color: "azul" },
  { id: "video", hecho: "Le mandé un video", tarea: "Mandar video", icono: "▶", color: "verde" },
  { id: "foto", hecho: "Le mandé una foto", tarea: "Mandar foto", icono: "🖼", color: "verde" },
  { id: "audio", hecho: "Le mandé un audio", tarea: "Mandar audio", icono: "🎤", color: "verde" },
  { id: "me-escribio", hecho: "Me escribió", tarea: "Esperar respuesta", icono: "↩", color: "ambar" },
  { id: "sesion", hecho: "Lo invité a la sesión", tarea: "Invitar a la sesión", icono: "👥", color: "azul" },
  { id: "cerrar", hecho: "Cerré el seguimiento", tarea: "Cerrar seguimiento", icono: "✓", color: "gris" },
];

const PORID = new Map(TIPOS.map((t) => [t.id, t]));

export function metaTipo(id: string): MetaTipo {
  return (
    PORID.get(id as TipoAccion) ?? {
      id: "escribi",
      hecho: id,
      tarea: id,
      icono: "•",
      color: "gris",
    }
  );
}

export const esTipo = (x: unknown): x is TipoAccion => PORID.has(x as TipoAccion);

/** Cerrar es el único que saca al cliente de las listas en vez de agregarle trabajo. */
export const TIPO_CIERRE: TipoAccion = "cerrar";
