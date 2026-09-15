import { NextRequest, NextResponse } from "next/server";
import { hiloDe, registrarAccion, programarTarea } from "@/lib/acciones";
import { buscarConversacion, mensajesDeConversacion } from "@/lib/ghl";
import { esTipo } from "@/lib/tiposAccion";
import { sesionActual } from "@/lib/sesion";
import { invalidarSeguimiento } from "@/lib/seguimiento";

export const dynamic = "force-dynamic";

/**
 * Todo lo que pasó con este cliente, y lo que queda por hacer.
 *
 * Las plantillas se anotan sin texto: el panel no sabe qué dicen —GHL no deja
 * leer las plantillas por API— y el mensaje lo arma el flujo. Pero una vez que
 * salió, el texto real está en la conversación. Acá se busca y se pega al
 * hilo, para que el agente vea qué le mandó y no un nombre de etiqueta.
 */
async function conTextoReal(hilo: Awaited<ReturnType<typeof hiloDe>>, contactId: string) {
  const aBuscar = hilo.filter(
    (a) => a.hechaEn && a.detalle?.startsWith("Plantilla del día ")
  );
  if (aBuscar.length === 0) return hilo;

  try {
    const conversacion = await buscarConversacion(contactId);
    if (!conversacion) return hilo;
    const salientes = (await mensajesDeConversacion(conversacion))
      .filter((m) => m.direction === "outbound" && m.body?.trim())
      .map((m) => ({ en: new Date(m.dateAdded).getTime(), texto: m.body!.trim() }));

    return hilo.map((a) => {
      if (!aBuscar.includes(a)) return a;
      const anotado = new Date(a.hechaEn!).getTime();
      // El flujo tarda unos segundos: la ventana de tres minutos es holgada sin
      // llegar a confundirse con otro mensaje del día.
      const cerca = salientes
        .filter((m) => m.en >= anotado - 60_000 && m.en <= anotado + 180_000)
        .sort((x, y) => Math.abs(x.en - anotado) - Math.abs(y.en - anotado))[0];
      return cerca ? { ...a, detalle: cerca.texto } : a;
    });
  } catch {
    return hilo;
  }
}

export async function GET(_req: NextRequest, { params }: { params: { contactId: string } }) {
  return NextResponse.json({ hilo: await conTextoReal(await hiloDe(params.contactId), params.contactId) });
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
