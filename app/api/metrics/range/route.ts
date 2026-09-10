import { NextRequest, NextResponse } from "next/server";
import { computeAgentRange } from "@/lib/metrics";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Faltan parámetros from/to" }, { status: 400 });
  }

  try {
    const result = await computeAgentRange(from, to);
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
