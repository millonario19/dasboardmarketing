import { NextRequest, NextResponse } from "next/server";
import { computeEstadosDeUnRango } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "Faltan las fechas from y to" }, { status: 400 });
  }
  try {
    return NextResponse.json(await computeEstadosDeUnRango(from, to));
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al consultar los estados";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
