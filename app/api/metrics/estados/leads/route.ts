import { NextRequest, NextResponse } from "next/server";
import { listarLeadsPorEstado } from "@/lib/metrics";
import { ESTADOS, type EstadoLead } from "@/lib/leadStates";
import { alcanceDeAgente } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Quiénes son los leads de una tarjeta del panel. El panel da el número; esto
// da la lista para poder trabajarla.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const estado = searchParams.get("estado");

  if (!from || !to) {
    return NextResponse.json({ error: "Faltan las fechas from y to" }, { status: 400 });
  }
  if (!estado || !ESTADOS.includes(estado as EstadoLead)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  try {
    const datos = await listarLeadsPorEstado(from, to, estado as EstadoLead, await alcanceDeAgente());
    return NextResponse.json(datos);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al listar los leads";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
