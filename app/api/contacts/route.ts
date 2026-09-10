import { NextRequest, NextResponse } from "next/server";
import { listContactsForAgent } from "@/lib/metrics";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const agentId = searchParams.get("agentId");

  if (!from || !to || !agentId) {
    return NextResponse.json({ error: "Faltan parámetros from/to/agentId" }, { status: 400 });
  }

  try {
    const contacts = await listContactsForAgent(from, to, agentId);
    return NextResponse.json({ contacts });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
