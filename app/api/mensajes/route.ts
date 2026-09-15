import { NextRequest, NextResponse } from "next/server";
import { todosLosMensajes, guardarMensaje } from "@/lib/mensajes";
import { sesionActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ mensajes: await todosLosMensajes() });
}

export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  let body: { clave?: string; texto?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!body.clave || !body.texto?.trim()) {
    return NextResponse.json({ error: "Faltan la clave o el texto" }, { status: 400 });
  }

  await guardarMensaje(body.clave, body.texto.trim(), sesion.usuario);
  return NextResponse.json({ ok: true });
}
