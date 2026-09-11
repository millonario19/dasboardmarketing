import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionToken, pantallaInicial, type Sesion } from "@/lib/auth";
import { buscarPorUsuario, claveCoincide, normalizarUsuario, textoCoincide } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

// La dirección entra con un usuario que vive en app.env, no en la base: es la
// llave maestra, y tiene que funcionar aunque la base esté vacía o caída.
const ADMIN_USUARIO = () => normalizarUsuario(process.env.ADMIN_USER ?? "admin");
const ADMIN_CLAVE = () => process.env.ADMIN_PASSWORD ?? process.env.DASHBOARD_PASSWORD ?? "";

// Contraseña común del equipo. Vale para todo agente que no tenga una propia.
const CLAVE_EQUIPO = () => process.env.AGENT_PASSWORD ?? "";

// Función y no constante: una Response solo se puede devolver una vez, y
// reusar el mismo objeto entre requests deja el cuerpo vacío a partir del
// segundo intento fallido.
const rechazo = () =>
  NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });

export async function POST(req: NextRequest) {
  let body: { usuario?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const usuario = normalizarUsuario(body.usuario ?? "");
  const password = body.password ?? "";
  if (!usuario || !password) {
    return NextResponse.json({ error: "Faltan usuario y contraseña" }, { status: 400 });
  }

  let sesion: Sesion | null = null;

  if (usuario === ADMIN_USUARIO()) {
    const clave = ADMIN_CLAVE();
    if (!clave || !textoCoincide(password, clave)) return rechazo();
    sesion = { usuario, nombre: "Dirección", rol: "admin", agentId: null };
  } else {
    let fila;
    try {
      fila = await buscarPorUsuario(usuario);
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "No se pudo verificar el usuario" }, { status: 500 });
    }
    if (!fila || !fila.activo) return rechazo();

    const ok = fila.hash
      ? await claveCoincide(password, fila.hash)
      : CLAVE_EQUIPO().length > 0 && textoCoincide(password, CLAVE_EQUIPO());
    if (!ok) return rechazo();

    sesion = {
      usuario: fila.usuario,
      nombre: fila.nombre,
      rol: fila.rol,
      agentId: fila.rol === "admin" ? null : fila.agentId,
    };
  }

  const res = NextResponse.json({ ok: true, destino: pantallaInicial(sesion.rol), sesion });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(sesion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
