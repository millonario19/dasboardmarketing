import { NextRequest, NextResponse } from "next/server";
import { agregarTag, quitarTag } from "@/lib/ghl";
import { TAG_BAJADA_SI, TAG_BAJADA_NO } from "@/lib/leadStates";
import { anotarConfirmacion } from "@/lib/confirmados";
import { sesionActual } from "@/lib/sesion";
import { invalidarSeguimiento } from "@/lib/seguimiento";

export const dynamic = "force-dynamic";

/**
 * El agente responde si la bajada a WhatsApp ocurrió de verdad.
 *
 * La respuesta se guarda como etiqueta en GHL, no en nuestra base: es el mismo
 * lugar de donde sale todo lo demás, así que queda visible en la ficha del
 * contacto y para cualquier flujo que quiera usarla.
 */
export async function POST(req: NextRequest) {
  let body: { contactId?: string; confirmado?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { contactId, confirmado } = body;
  if (!contactId || typeof confirmado !== "boolean") {
    return NextResponse.json({ error: "Faltan contactId o confirmado" }, { status: 400 });
  }

  const poner = confirmado ? TAG_BAJADA_SI : TAG_BAJADA_NO;
  const sacar = confirmado ? TAG_BAJADA_NO : TAG_BAJADA_SI;

  try {
    await agregarTag(contactId, poner);
    // Si el agente cambia de opinión, la etiqueta contraria no puede quedar:
    // el contacto terminaría con las dos y el estado sería ambiguo.
    await quitarTag(contactId, sacar).catch(() => {
      /* no estaba puesta, no hay nada que sacar */
    });
    // La etiqueta dice si está confirmado; la fila dice cuándo. La lista de
    // «en mi WhatsApp Business» se ordena por esa hora, así que sin ella un
    // confirmado de hoy quedaría mezclado con uno de la semana pasada.
    const sesion = await sesionActual();
    await anotarConfirmacion(contactId, sesion?.usuario ?? null, confirmado).catch(() => {
      /* la confirmación ya quedó en GHL: la hora es un extra, no un requisito */
    });

    invalidarSeguimiento();
    return NextResponse.json({ ok: true, confirmacion: confirmado ? "si" : "no" });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al guardar la confirmación";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
