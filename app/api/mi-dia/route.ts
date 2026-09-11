import { NextRequest, NextResponse } from "next/server";
import { computeMiDia } from "@/lib/miDia";
import { alcanceDeAgente } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // El agente no elige a quién mira: su sesión manda sobre el parámetro. El
  // selector de la pantalla solo existe para la dirección.
  const propio = await alcanceDeAgente();
  const agente = propio ?? req.nextUrl.searchParams.get("agente");

  const desde = req.nextUrl.searchParams.get("desde");
  const hasta = req.nextUrl.searchParams.get("hasta");

  try {
    return NextResponse.json(await computeMiDia(agente, { desde, hasta }));
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al armar la lista";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
