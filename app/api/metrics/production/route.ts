import { NextResponse } from "next/server";
import { computeAgentProduction } from "@/lib/metrics";
import { agentesDeOficina } from "@/lib/oficinas";
import { alcanceDeAgente, alcanceDeOficina } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Dos recortes que se aplican juntos: el agente ve lo suyo, el director su
    // oficina, el admin la red. El de oficina se resuelve acá porque las
    // oficinas viven en nuestra base y GHL no sabe nada de ellas.
    const oficina = await alcanceDeOficina();
    const data = await computeAgentProduction(
      await alcanceDeAgente(),
      oficina ? await agentesDeOficina(oficina) : null
    );
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
