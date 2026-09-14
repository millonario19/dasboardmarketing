import { NextRequest, NextResponse } from "next/server";
import { guardarNota } from "@/lib/notas";
import { sesionActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

/**
 * Guarda lo que el agente escribió sobre un cliente.
 *
 * Se llama al salir del campo, no con un botón: cada campo viaja solo, así que
 * escribir la nota y no tocar la fecha no borra la fecha.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const cuerpo = await req.json().catch(() => null);
  if (!cuerpo) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const nota = typeof cuerpo.nota === "string" ? cuerpo.nota.slice(0, 2000) : undefined;
  const proximaAccion = typeof cuerpo.proximaAccion === "string" ? cuerpo.proximaAccion : undefined;
  const proximaEn =
    typeof cuerpo.proximaEn === "string" && cuerpo.proximaEn ? new Date(cuerpo.proximaEn).toISOString() : undefined;

  try {
    return NextResponse.json(
      await guardarNota(params.id, { nota, proximaAccion, proximaEn }, sesion.usuario)
    );
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "No se pudo guardar";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
