import { NextRequest, NextResponse } from "next/server";
import { sesionActual } from "@/lib/sesion";
import { actualizarUsuario, buscarPorUsuario, claveCoincide, textoCoincide } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

const MINIMO = 6;

/**
 * La persona cambia su propia contraseña.
 *
 * Pide la actual aunque ya tenga la sesión abierta: si alguien se sienta en una
 * computadora con la sesión puesta, no debería poder dejar afuera al dueño.
 */
export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (sesion.rol === "admin") {
    return NextResponse.json(
      { error: "La contraseña de la dirección se cambia en el archivo de configuración del servidor." },
      { status: 400 }
    );
  }

  let body: { actual?: string; nueva?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const actual = body.actual ?? "";
  const nueva = body.nueva ?? "";
  if (nueva.length < MINIMO) {
    return NextResponse.json(
      { error: `La contraseña nueva necesita al menos ${MINIMO} caracteres` },
      { status: 400 }
    );
  }
  if (nueva === actual) {
    return NextResponse.json({ error: "La contraseña nueva es igual a la actual" }, { status: 400 });
  }

  try {
    const fila = await buscarPorUsuario(sesion.usuario);
    if (!fila || !fila.activo) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

    const comun = process.env.AGENT_PASSWORD ?? "";
    const ok = fila.hash
      ? await claveCoincide(actual, fila.hash)
      : comun.length > 0 && textoCoincide(actual, comun);
    if (!ok) {
      return NextResponse.json({ error: "La contraseña actual no es correcta" }, { status: 403 });
    }

    await actualizarUsuario(fila.id, { clave: nueva });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "No se pudo cambiar la contraseña";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
