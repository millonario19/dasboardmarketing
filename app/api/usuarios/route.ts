import { NextRequest, NextResponse } from "next/server";
import { crearUsuario, listarUsuarios, normalizarUsuario } from "@/lib/usuarios";
import { listarUsuariosGhl } from "@/lib/ghl";
import { exigirAdmin } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// El middleware ya bloquea esta ruta para quien no es admin. El chequeo se
// repite acá a propósito: si mañana alguien toca el matcher, la ruta no queda
// abierta sin que nadie se entere.

export async function GET() {
  const no = await exigirAdmin();
  if (no) return no;

  try {
    const [usuarios, agentes] = await Promise.all([
      listarUsuarios(),
      listarUsuariosGhl().catch(() => []),
    ]);
    return NextResponse.json({ usuarios, agentes });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al cargar los usuarios";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const no = await exigirAdmin();
  if (no) return no;

  let body: { usuario?: string; nombre?: string; agentId?: string; rol?: string; clave?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const usuario = normalizarUsuario(body.usuario ?? "");
  const nombre = (body.nombre ?? "").trim();
  const agentId = (body.agentId ?? "").trim();
  const rol = body.rol === "admin" ? "admin" : "agente";

  if (!usuario || !nombre || !agentId) {
    return NextResponse.json({ error: "Faltan usuario, nombre o agente" }, { status: 400 });
  }
  if (!/^[a-z0-9._-]{3,32}$/.test(usuario)) {
    return NextResponse.json(
      { error: "El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo" },
      { status: 400 }
    );
  }

  try {
    const creado = await crearUsuario({ usuario, nombre, agentId, rol, clave: body.clave || null });
    return NextResponse.json(creado, { status: 201 });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al crear el usuario";
    const repetido = mensaje.includes("usuarios_usuario_key") || mensaje.includes("duplicate key");
    return NextResponse.json(
      { error: repetido ? `El usuario "${usuario}" ya existe` : mensaje },
      { status: repetido ? 409 : 500 }
    );
  }
}
