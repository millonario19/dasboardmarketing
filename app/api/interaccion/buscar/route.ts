import { NextRequest, NextResponse } from "next/server";
import { buscarLeads } from "@/lib/interaccion";
import { alcanceDeAgente } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const texto = (req.nextUrl.searchParams.get("q") ?? "").trim();
  // Dos letras no buscan, traen media pauta y gastan el límite de GHL en nada.
  if (texto.length < 3) {
    return NextResponse.json({ error: "Escribí al menos 3 letras o dígitos" }, { status: 400 });
  }

  // El agente solo encuentra a los suyos; la dirección busca en toda la oficina.
  const propio = await alcanceDeAgente();
  const pedido = req.nextUrl.searchParams.get("agente");
  const agente = propio ?? (pedido && pedido !== "todos" ? pedido : null);

  try {
    return NextResponse.json(await buscarLeads(agente, texto));
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al buscar";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
