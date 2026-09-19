import { NextRequest, NextResponse } from "next/server";
import { pulsoDe } from "@/lib/pulso";
import { sesionActual } from "@/lib/sesion";
import { alcanceMirando } from "@/lib/verComo";

export const dynamic = "force-dynamic";

/**
 * Cómo viene el agente en los últimos días.
 *
 * Lleva el mismo recorte que el resto: el agente ve el suyo, y la dirección
 * adentro del panel de alguien ve el de esa persona.
 */
export async function GET(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  try {
    const mirada = await alcanceMirando(req);
    return NextResponse.json(await pulsoDe(mirada.agentId));
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al leer el pulso";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
