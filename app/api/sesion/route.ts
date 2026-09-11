import { NextResponse } from "next/server";
import { sesionActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Quién está adentro. Las pantallas lo usan para saber qué mostrar (el nombre,
// el enlace de usuarios, el selector de agente). No es una barrera de
// seguridad: los datos ya vienen filtrados del servidor.
export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  return NextResponse.json(sesion);
}
