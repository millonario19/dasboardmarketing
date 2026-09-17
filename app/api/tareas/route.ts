import { NextRequest, NextResponse } from "next/server";
import { tareasDeHoy, resumenDeHoy } from "@/lib/acciones";
import { sesionActual } from "@/lib/sesion";
import { alcanceMirando } from "@/lib/verComo";

export const dynamic = "force-dynamic";

/**
 * Lo primero de la mañana: lo que el agente mismo se programó.
 *
 * La dirección ve las de todos; el agente, solo las suyas. El recorte va por
 * `usuario` y no por un parámetro de la URL: si el agente pudiera pedir las de
 * otro, el filtro no filtraría nada.
 */
export async function GET(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  // Con `?agente=` la dirección mira las tareas de esa persona; sin él, cada
  // quien las suyas y el admin las de todos.
  const mirada = await alcanceMirando(req);
  const usuario = mirada.prestado
    ? mirada.usuario
    : sesion.rol === "admin"
      ? null
      : sesion.usuario;

  const [tareas, resumen] = await Promise.all([tareasDeHoy(usuario), resumenDeHoy(usuario)]);
  return NextResponse.json({ ...tareas, resumen });
}
