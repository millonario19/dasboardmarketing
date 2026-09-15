import { NextRequest, NextResponse } from "next/server";
import { agregarTag } from "@/lib/ghl";
import { TAG_BAJADA_MANUAL } from "@/lib/leadStates";
import { registrarAccion } from "@/lib/acciones";
import { invalidarSeguimiento } from "@/lib/seguimiento";
import { sesionActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

/**
 * El agente se lleva el contacto a su WhatsApp personal.
 *
 * Es como trabaja la mayoría: no espera a que el cliente toque el botón, se
 * copia el número y lo llama él. Eso antes no dejaba rastro —el lead seguía
 * figurando como tibio mientras ya lo estaban trabajando— y el seguimiento
 * arrancaba tarde o no arrancaba.
 *
 * La marca va como etiqueta en GHL, igual que la confirmación: es el mismo
 * lugar de donde sale todo lo demás y queda visible en la ficha del contacto.
 */
export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  let body: { contactId?: string; nombre?: string | null; telefono?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!body.contactId) {
    return NextResponse.json({ error: "Falta contactId" }, { status: 400 });
  }

  try {
    await agregarTag(body.contactId, TAG_BAJADA_MANUAL);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "GHL no aceptó la etiqueta";
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }

  await registrarAccion(
    {
      contactId: body.contactId,
      nombre: body.nombre ?? null,
      telefono: body.telefono ?? null,
      usuario: sesion.usuario,
    },
    "escribi",
    "Me lo llevé a mi WhatsApp personal"
  ).catch(() => undefined);

  invalidarSeguimiento();
  return NextResponse.json({ ok: true });
}
