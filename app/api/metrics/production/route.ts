import { NextResponse } from "next/server";
import { computeAgentProduction } from "@/lib/metrics";
import { alcanceDeAgente } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await computeAgentProduction(await alcanceDeAgente());
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
