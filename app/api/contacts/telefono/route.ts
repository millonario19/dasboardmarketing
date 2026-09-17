import { NextRequest, NextResponse } from "next/server";
import { actualizarTelefonoContacto } from "@/lib/ghl";
import { registrarAccion } from "@/lib/acciones";
import { invalidarSeguimiento } from "@/lib/seguimiento";
import { sesionActual } from "@/lib/sesion";
import { usuarioQueActua } from "@/lib/verComo";
import { normalizarTelefono } from "@/lib/telefono";

export const dynamic = "force-dynamic";

/**
 * Ponerle el número a un lead que llegó sin él.
 *
 * Meta no entrega el teléfono de los que entran por Messenger, por Instagram
 * ni por anuncio de clic a WhatsApp: en ese último la conversación viene
 * firmada con una identidad tapada («CO.28765874809710863») en vez del
 * celular. Lo comprobé sobre los doce leads sin número de esta semana y no hay
 * ninguno que se pueda recuperar del contacto ni de la conversación.
 *
 * O sea que el único que puede conseguirlo es el agente, preguntándolo en el
 * chat. Esta ruta es donde lo guarda cuando se lo pasan, para que deje de ser
 * un dato suelto en una conversación y el lead se pueda llamar como cualquier
 * otro.
 */

export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  let body: { contactId?: string; telefono?: string; nombre?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!body.contactId) return NextResponse.json({ error: "Falta contactId" }, { status: 400 });

  const telefono = normalizarTelefono(body.telefono ?? "");
  if (!telefono) {
    return NextResponse.json(
      { error: "Ese número no se entiende. Escribí los 10 dígitos, así: 3213456789" },
      { status: 400 }
    );
  }

  try {
    await actualizarTelefonoContacto(body.contactId, telefono);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "GHL no aceptó el número";
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }

  await registrarAccion(
    {
      contactId: body.contactId,
      nombre: body.nombre ?? null,
      telefono,
      usuario: await usuarioQueActua(req),
    },
    "escribi",
    `Me pasó su número: ${telefono}`
  ).catch(() => undefined);

  invalidarSeguimiento();
  return NextResponse.json({ ok: true, telefono });
}
