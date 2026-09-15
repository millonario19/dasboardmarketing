import { NextRequest, NextResponse } from "next/server";
import { agregarTag } from "@/lib/ghl";
import { registrarAccion, enviadoHoy } from "@/lib/acciones";
import { etiquetaDeSeguimiento, type DiaDelEmbudo } from "@/lib/seguimientoTags";
import { esEstado } from "@/lib/leadStates";
import { sesionActual } from "@/lib/sesion";
import { invalidarSeguimiento } from "@/lib/seguimiento";

export const dynamic = "force-dynamic";

/**
 * Mandar el seguimiento del día: poner la etiqueta y anotarlo.
 *
 * El mensaje no sale de acá. Sale del flujo de GHL que escucha esa etiqueta —
 * así el texto lo cambia marketing sin tocar código, que es lo único que la API
 * de GHL no deja automatizar.
 *
 * El tope de uno por día lo pone el dashboard y no el flujo: GHL no sabe cuántas
 * veces se le mandó hoy a alguien, y dos mensajes el mismo día es exactamente
 * lo que hace que a un número lo bloqueen.
 */
export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  let body: {
    contactId?: string;
    dia?: number;
    estado?: string;
    nombre?: string | null;
    telefono?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { contactId, dia, estado } = body;
  if (!contactId || (dia !== 2 && dia !== 3) || !esEstado(estado)) {
    return NextResponse.json({ error: "Faltan contactId, día o estado" }, { status: 400 });
  }

  const tipo = dia === 2 ? "seg-d2" : "seg-d3";
  if (await enviadoHoy(contactId)) {
    return NextResponse.json(
      { error: "Ya se le mandó un seguimiento hoy. Mañana se puede de nuevo." },
      { status: 409 }
    );
  }

  const etiqueta = etiquetaDeSeguimiento(dia as DiaDelEmbudo, estado);
  try {
    await agregarTag(contactId, etiqueta);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "GHL no aceptó la etiqueta";
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }

  // La etiqueta ya está puesta: si esto falla, el mensaje igual sale. Por eso
  // no tumba la respuesta — solo se pierde la anotación en el hilo.
  await registrarAccion(
    {
      contactId,
      nombre: body.nombre ?? null,
      telefono: body.telefono ?? null,
      usuario: sesion.usuario,
    },
    tipo,
    `etiqueta ${etiqueta}`
  ).catch(() => undefined);

  invalidarSeguimiento();
  return NextResponse.json({ ok: true, etiqueta });
}
