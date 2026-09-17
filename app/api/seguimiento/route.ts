import { NextRequest, NextResponse } from "next/server";
import { computeSeguimiento } from "@/lib/seguimiento";
import { sesionActual } from "@/lib/sesion";
import { alcanceMirando } from "@/lib/verComo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  try {
    // Los leads se filtran por agente de GHL; la agenda de promesas, por el
    // usuario del tablero, que es quien hizo la llamada. Con `?agente=` la
    // dirección mira el día de alguien de su oficina, y las dos llaves cambian
    // juntas: mezclarlas mostraría los leads de uno con las tareas de otro.
    const mirada = await alcanceMirando(req);
    return NextResponse.json(await computeSeguimiento(mirada.agentId, mirada.usuario));
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al armar el seguimiento";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
