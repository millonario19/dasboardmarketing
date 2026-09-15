import { NextRequest, NextResponse } from "next/server";
import { hiloDe, registrarAccion, programarTarea } from "@/lib/acciones";
import { esTipo } from "@/lib/tiposAccion";
import { sesionActual } from "@/lib/sesion";
import { invalidarSeguimiento } from "@/lib/seguimiento";

export const dynamic = "force-dynamic";

/** Todo lo que pasó con este cliente, y lo que queda por hacer. */
export async function GET(_req: NextRequest, { params }: { params: { contactId: string } }) {
  return NextResponse.json({ hilo: await hiloDe(params.contactId) });
}

/**
 * Guardar lo que acaba de pasar y, si la hay, la tarea que sigue.
 *
 * Las dos en la misma llamada a propósito. Si fueran dos pantallas el agente
 * hace la primera y se olvida de la segunda, y un cliente sin próxima tarea es
 * un cliente que se muere solo.
 */
export async function POST(req: NextRequest, { params }: { params: { contactId: string } }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  let body: {
    tipo?: string;
    detalle?: string | null;
    resultado?: string | null;
    nombre?: string | null;
    telefono?: string | null;
    siguiente?: { tipo?: string; cuando?: string; detalle?: string | null } | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const quien = {
    contactId: params.contactId,
    nombre: body.nombre ?? null,
    telefono: body.telefono ?? null,
    usuario: sesion.usuario,
  };

  try {
    if (body.tipo) {
      if (!esTipo(body.tipo)) return NextResponse.json({ error: "Tipo desconocido" }, { status: 400 });
      await registrarAccion(quien, body.tipo, body.detalle ?? null, body.resultado ?? null);
    }

    const sig = body.siguiente;
    if (sig?.tipo && sig.cuando) {
      if (!esTipo(sig.tipo)) return NextResponse.json({ error: "Tipo desconocido" }, { status: 400 });
      const cuando = new Date(sig.cuando);
      if (Number.isNaN(cuando.getTime())) {
        return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
      }
      await programarTarea(quien, sig.tipo, sig.detalle ?? null, cuando.toISOString());
    }

    if (!body.tipo && !sig?.tipo) {
      return NextResponse.json({ error: "No mandaste nada que guardar" }, { status: 400 });
    }

    invalidarSeguimiento();
    return NextResponse.json({ hilo: await hiloDe(params.contactId) });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al guardar";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
