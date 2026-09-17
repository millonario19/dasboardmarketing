import { NextRequest, NextResponse } from "next/server";
import { computeMiDia, computeMovimientosDeHoy } from "@/lib/miDia";
import { alcanceMirando } from "@/lib/verComo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // El agente no elige a quién mira: su sesión manda sobre el parámetro. El
  // selector de la pantalla solo existe para la dirección.
  const propio = (await alcanceMirando(req)).agentId;
  const agente = propio ?? req.nextUrl.searchParams.get("agente");

  // Arranque rápido: solo los movimientos del día, que salen de Postgres.
  const soloMovimientos = req.nextUrl.searchParams.get("solo") === "movimiento";

  const desde = req.nextUrl.searchParams.get("desde");
  const hasta = req.nextUrl.searchParams.get("hasta");

  try {
    const datos = soloMovimientos
      ? await computeMovimientosDeHoy(agente)
      : await computeMiDia(agente, { desde, hasta });
    return NextResponse.json(datos);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al armar la lista";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
