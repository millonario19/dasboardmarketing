import { NextRequest, NextResponse } from "next/server";
import { renombrarContacto } from "@/lib/nombres";
import { sesionActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const cuerpo = await req.json().catch(() => null);
  const nombre = typeof cuerpo?.nombre === "string" ? cuerpo.nombre : "";

  try {
    return NextResponse.json(await renombrarContacto(params.id, nombre, sesion.usuario));
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al guardar el nombre";
    return NextResponse.json({ error: mensaje }, { status: 400 });
  }
}
