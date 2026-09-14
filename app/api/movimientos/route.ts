import { NextResponse } from "next/server";
import { movimientosDeHoy } from "@/lib/movimientos";
import { alcanceDeAgente, sesionActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await sesionActual())) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }
  try {
    // El agente ve solo los suyos; la dirección, los de toda la oficina.
    return NextResponse.json({ movimientos: await movimientosDeHoy(await alcanceDeAgente()) });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al leer los movimientos";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
