import { NextRequest, NextResponse } from "next/server";
import { computeInteraccion } from "@/lib/interaccion";
import { sesionActual } from "@/lib/sesion";
import { alcanceMirando } from "@/lib/verComo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // El agente solo ve sus conversaciones; la dirección elige de quién.
  const propio = (await alcanceMirando(req)).agentId;
  const pedido = req.nextUrl.searchParams.get("agente");
  const agente = propio ?? (pedido && pedido !== "todos" ? pedido : null);

  const dia = req.nextUrl.searchParams.get("dia");

  try {
    const datos = await computeInteraccion(agente, dia);
    const sesion = await sesionActual();
    return NextResponse.json({ ...datos, nombre: sesion?.nombre ?? null });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al leer las conversaciones";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
