import { NextRequest, NextResponse } from "next/server";
import { esResultado, reportarLlamada } from "@/lib/llamadas";
import { sesionActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Llamada inválida" }, { status: 400 });
  }

  const cuerpo = await req.json().catch(() => null);
  if (typeof cuerpo?.contesto !== "boolean") {
    return NextResponse.json({ error: "Falta decir si contestó" }, { status: 400 });
  }
  if (cuerpo.resultado != null && !esResultado(cuerpo.resultado)) {
    return NextResponse.json({ error: "Resultado desconocido" }, { status: 400 });
  }

  try {
    const llamada = await reportarLlamada(id, sesion.usuario, {
      contesto: cuerpo.contesto,
      resultado: cuerpo.resultado ?? null,
      promesaEn: typeof cuerpo.promesaEn === "string" && cuerpo.promesaEn ? cuerpo.promesaEn : null,
      nota: typeof cuerpo.nota === "string" ? cuerpo.nota : null,
    });
    // No es de este agente, o no existe: la misma respuesta para los dos, para
    // no confirmar que existe una llamada de otro.
    if (!llamada) return NextResponse.json({ error: "Esa llamada no es tuya" }, { status: 404 });
    return NextResponse.json(llamada);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al guardar el reporte";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
