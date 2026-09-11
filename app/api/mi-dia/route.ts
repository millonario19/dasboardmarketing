import { NextRequest, NextResponse } from "next/server";
import { computeMiDia } from "@/lib/miDia";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const agente = req.nextUrl.searchParams.get("agente");
  try {
    return NextResponse.json(await computeMiDia(agente));
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al armar la lista";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
