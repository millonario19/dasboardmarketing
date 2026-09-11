import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verificarSesion } from "@/lib/auth";

export const config = {
  // /api/cron queda fuera de la cookie de sesión: lo llama el cron del server,
  // no una persona, y se autentica con su propio token (CRON_SECRET).
  matcher: ["/((?!login|api/login|api/cron|_next/static|_next/image|favicon.ico).*)"],
};

// Rutas que solo puede abrir la dirección. La administración de usuarios es la
// única: el resto de las pantallas las ve todo el mundo, pero filtradas a sus
// propios leads del lado del servidor.
const SOLO_DIRECCION = ["/admin", "/api/usuarios"];

export async function middleware(req: NextRequest) {
  const sesion = await verificarSesion(req.cookies.get(SESSION_COOKIE)?.value);

  if (!sesion) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const ruta = req.nextUrl.pathname;
  if (sesion.rol !== "admin" && SOLO_DIRECCION.some((p) => ruta === p || ruta.startsWith(`${p}/`))) {
    return ruta.startsWith("/api/")
      ? NextResponse.json({ error: "Solo la dirección puede hacer esto" }, { status: 403 })
      : NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}
