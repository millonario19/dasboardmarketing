import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionToken, pantallaInicial, type Sesion } from "@/lib/auth";
import { buscarPorUsuario, claveCoincide, normalizarUsuario, textoCoincide } from "@/lib/usuarios";
import { listarOficinas } from "@/lib/oficinas";

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

  // Acá se crean las oficinas y se ordena Prime la primera vez. Va en el login
  // porque es la puerta de entrada de todos y porque la sesión necesita saber
  // de qué oficina es cada quien. Si la base está caída no se bloquea el
  // ingreso del admin, que es la llave maestra.
  await listarOficinas().catch(() => undefined);

  let sesion: Sesion | null = null;

  if (usuario === ADMIN_USUARIO()) {
    const clave = ADMIN_CLAVE();
    if (!clave || !textoCoincide(password, clave)) return rechazo();
    // El admin no es de ninguna oficina: son suyas las cuatro.
    sesion = { usuario, nombre: "Alejandro Facundo", rol: "admin", agentId: null, oficinaId: null };
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
      // El director conserva su agentId porque también vende —Diana lleva 12
      // leads este mes— y algún día va a querer su propio Mi día. Lo que
      // cambia no es el id sino el alcance, y eso lo decide el rol.
      agentId: fila.rol === "admin" ? null : fila.agentId,
      oficinaId: fila.oficinaId,
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
