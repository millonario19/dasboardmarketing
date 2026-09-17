import { NextRequest, NextResponse } from "next/server";
import { pendientesDe, registrarLlamada } from "@/lib/llamadas";
import { sesionActual } from "@/lib/sesion";
import { usuarioQueActua } from "@/lib/verComo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  try {
    return NextResponse.json({ pendientes: await pendientesDe(await usuarioQueActua(req)) });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al leer las llamadas";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}

// Se llama cuando el agente toca el botón de llamar. Registra el intento, no
// la llamada: el celular es una caja cerrada y desde acá no hay forma de
// saber si marcó de verdad.
export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const cuerpo = await req.json().catch(() => null);
  const contactId = typeof cuerpo?.contactId === "string" ? cuerpo.contactId.trim() : "";
  if (!contactId) return NextResponse.json({ error: "Falta el contacto" }, { status: 400 });

  try {
    const llamada = await registrarLlamada({
      contactId,
      nombre: typeof cuerpo.nombre === "string" ? cuerpo.nombre : null,
      telefono: typeof cuerpo.telefono === "string" ? cuerpo.telefono : null,
      agentId: sesion.agentId ?? null,
      usuario: await usuarioQueActua(req),
    });
    return NextResponse.json(llamada);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al registrar la llamada";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
