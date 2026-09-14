import { NextResponse } from "next/server";
import { computeSeguimiento } from "@/lib/seguimiento";
import { alcanceDeAgente, sesionActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  try {
    // Los leads se filtran por agente de GHL; la agenda de promesas, por el
    // usuario del tablero, que es quien hizo la llamada.
    return NextResponse.json(
      await computeSeguimiento(await alcanceDeAgente(), sesion.rol === "agente" ? sesion.usuario : null)
    );
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al armar el seguimiento";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
