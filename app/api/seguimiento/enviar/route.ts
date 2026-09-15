import { NextRequest, NextResponse } from "next/server";
import { enviarWhatsApp, agregarTag, flujosPublicados } from "@/lib/ghl";
import { etiquetaDeSeguimiento, type DiaDelEmbudo } from "@/lib/seguimientoTags";
import { esEstado } from "@/lib/leadStates";
import { registrarAccion, enviadoHoy } from "@/lib/acciones";
import { invalidarSeguimiento } from "@/lib/seguimiento";
import { sesionActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

/**
 * Mandar el seguimiento del día.
 *
 * El texto viaja en la petición porque el agente lo acaba de ver y lo pudo
 * editar. Antes esto ponía una etiqueta y un flujo de GHL escribía el mensaje;
 * el problema es que la API de GHL deja listar los flujos pero no leer qué
 * dicen, así que el panel nunca podía mostrar qué iba a salir. Ahora sale de
 * acá: lo que el agente lee es lo que el cliente recibe.
 *
 * El mensaje cae igual en la conversación de GHL, así que el historial no
 * cambia. Y queda anotado en el hilo del cliente con el texto exacto.
 */
export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  let body: {
    contactId?: string;
    dia?: number;
    texto?: string;
    /** Con la ventana cerrada solo entra una plantilla, y esa la manda GHL. */
    plantilla?: boolean;
    estado?: string;
    nombre?: string | null;
    telefono?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { contactId, dia, texto, plantilla } = body;
  if (!contactId || (dia !== 2 && dia !== 3)) {
    return NextResponse.json({ error: "Faltan contactId o día" }, { status: 400 });
  }
  if (!plantilla && !texto?.trim()) {
    return NextResponse.json({ error: "Falta el texto del mensaje" }, { status: 400 });
  }
  if (plantilla && !esEstado(body.estado)) {
    return NextResponse.json({ error: "Falta la temperatura" }, { status: 400 });
  }

  // El tope de uno por día lo lleva el dashboard: GHL no sabe cuántas veces se
  // le escribió hoy a alguien, y dos mensajes el mismo día es justo lo que
  // hace que a un número lo bloqueen.
  if (await enviadoHoy(contactId)) {
    return NextResponse.json(
      { error: "Ya se le mandó un seguimiento hoy. Mañana se puede de nuevo." },
      { status: 409 }
    );
  }

  // Dos caminos, uno por cada lado de la ventana de 24 horas.
  //
  // Abierta: el texto sale de acá, escrito y revisado por el agente.
  // Cerrada: Meta solo acepta plantillas aprobadas, y esas no se pueden mandar
  // por la API de conversaciones — las manda un flujo de GHL. El panel pone la
  // etiqueta y el flujo hace el resto.
  const etiqueta = plantilla
    ? etiquetaDeSeguimiento(dia as DiaDelEmbudo, body.estado as "frio" | "tibio" | "caliente")
    : null;
  // Sin flujo publicado que la escuche, la etiqueta no manda nada y queda
  // pegada al contacto para siempre: el próximo intento tampoco dispararía.
  if (etiqueta && !(await flujosPublicados()).includes(etiqueta)) {
    return NextResponse.json(
      {
        error:
          `No existe el flujo «${etiqueta}» publicado en GHL. Sin él la etiqueta no manda nada. ` +
          "Armalo primero y volvé a intentar.",
      },
      { status: 409 }
    );
  }

  try {
    if (etiqueta) await agregarTag(contactId, etiqueta);
    else await enviarWhatsApp(contactId, texto!.trim());
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "GHL no pudo mandar el mensaje";
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }

  // El mensaje ya salió: si esto falla, solo se pierde la anotación.
  await registrarAccion(
    {
      contactId,
      nombre: body.nombre ?? null,
      telefono: body.telefono ?? null,
      usuario: sesion.usuario,
    },
    dia === 2 ? "seg-d2" : "seg-d3",
    etiqueta ? `Plantilla del día ${dia} (${etiqueta})` : texto!.trim()
  ).catch(() => undefined);

  invalidarSeguimiento();
  return NextResponse.json({ ok: true });
}
