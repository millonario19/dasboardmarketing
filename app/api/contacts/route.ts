import { NextRequest, NextResponse } from "next/server";
import { listContactsForAgent } from "@/lib/metrics";
import { alcanceDeAgente } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const pedido = searchParams.get("agentId");

  if (!from || !to || !pedido) {
    return NextResponse.json({ error: "Faltan parámetros from/to/agentId" }, { status: 400 });
  }

  // Un agente solo puede pedir su propia lista, aunque cambie el agentId de la
  // URL a mano.
  const propio = await alcanceDeAgente();
  if (propio && propio !== pedido) {
    return NextResponse.json({ error: "Solo podés ver tus propios contactos" }, { status: 403 });
  }

  try {
    const contacts = await listContactsForAgent(from, to, pedido);
    return NextResponse.json({ contacts });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
