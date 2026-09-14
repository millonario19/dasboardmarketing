import { NextResponse } from "next/server";
import { computeSeguimiento } from "@/lib/seguimiento";
import { alcanceDeAgente, sesionActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

/**
 * Solo los clics de WhatsApp sin responder.
 *
 * Va aparte del seguimiento completo para que el aviso de entrada cargue
 * rápido; por debajo comparte la misma consulta y la misma caché, así que no
 * le cuesta a GHL una llamada más.
 */
export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  try {
    const datos = await computeSeguimiento(
      await alcanceDeAgente(),
      sesion.rol === "agente" ? sesion.usuario : null
    );
    return NextResponse.json({ porConfirmar: datos.porConfirmar });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al leer los pendientes";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
