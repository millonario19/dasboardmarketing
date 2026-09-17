import { NextRequest, NextResponse } from "next/server";
import { computeSeguimiento } from "@/lib/seguimiento";
import { sesionActual } from "@/lib/sesion";
import { alcanceMirando } from "@/lib/verComo";

export const dynamic = "force-dynamic";

/**
 * Solo los clics de WhatsApp sin responder.
 *
 * Va aparte del seguimiento completo para que el aviso de entrada cargue
 * rápido; por debajo comparte la misma consulta y la misma caché, así que no
 * le cuesta a GHL una llamada más.
 */
export async function GET(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  try {
    const mirada = await alcanceMirando(req);
    const datos = await computeSeguimiento(mirada.agentId, mirada.usuario);
    return NextResponse.json({ porConfirmar: datos.porConfirmar });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al leer los pendientes";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
