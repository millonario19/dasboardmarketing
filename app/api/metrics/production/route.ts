import { NextResponse } from "next/server";
import { computeAgentProduction } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await computeAgentProduction();
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
