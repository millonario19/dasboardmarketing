import { NextRequest, NextResponse } from "next/server";
import { actualizarUsuario, eliminarUsuario } from "@/lib/usuarios";
import { exigirAdmin } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const no = await exigirAdmin();
  if (no) return no;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  let body: { nombre?: string; agentId?: string; rol?: string; activo?: boolean; clave?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  try {
    const actualizado = await actualizarUsuario(id, {
      nombre: body.nombre,
      agentId: body.agentId,
      rol: body.rol === "admin" ? "admin" : body.rol === "agente" ? "agente" : undefined,
      activo: body.activo,
      // "" vuelve a la contraseña común del equipo; undefined no toca nada.
      clave: body.clave === undefined ? undefined : body.clave === "" ? null : body.clave,
    });
    if (!actualizado) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    return NextResponse.json(actualizado);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al actualizar el usuario";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const no = await exigirAdmin();
  if (no) return no;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  try {
    const borrado = await eliminarUsuario(id);
    if (!borrado) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al eliminar el usuario";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
