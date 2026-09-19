import { NextRequest, NextResponse } from "next/server";
import { computeAgentProduction } from "@/lib/metrics";
import { agentesDeOficina } from "@/lib/oficinas";
import { alcanceDeOficina } from "@/lib/sesion";
import { alcanceMirando } from "@/lib/verComo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Dos recortes que se aplican juntos: el agente ve lo suyo, el director su
    // oficina, el admin la red. El de oficina se resuelve acá porque las
    // oficinas viven en nuestra base y GHL no sabe nada de ellas.
    //
    // Con `?agente=` la dirección se para en los zapatos de esa persona, y
    // entonces el recorte de oficina sobra: ya está mirando a uno solo.
    const mirada = await alcanceMirando(req);
    const oficina = mirada.prestado ? null : await alcanceDeOficina();
    // El día que eligió el agente arriba de «Mi día». Sin `?dia=`, hoy. Lo que
    // cambia no es el mes —ese sigue siendo el mes— sino las columnas del día:
    // leads, registros y FTD de esa fecha, y la temperatura de esos leads.
    const dia = /^\d{4}-\d{2}-\d{2}$/.test(req.nextUrl.searchParams.get("dia") ?? "")
      ? req.nextUrl.searchParams.get("dia")
      : null;
    const data = await computeAgentProduction(
      mirada.agentId,
      oficina ? await agentesDeOficina(oficina) : null,
      dia
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
