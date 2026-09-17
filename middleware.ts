import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verificarSesion } from "@/lib/auth";

export const config = {
  // /api/cron queda fuera de la cookie de sesión: lo llama el cron del server,
  // no una persona, y se autentica con su propio token (CRON_SECRET).
  matcher: ["/((?!login|api/login|api/cron|_next/static|_next/image|favicon.ico).*)"],
};

// Rutas que solo puede abrir el admin: mover gente entre oficinas y dar de
// alta usuarios es de la organización, no de una oficina.
const SOLO_ADMIN = ["/admin", "/api/usuarios"];

// Rutas de dirección: el admin y los directores. El director manda en su
// oficina, y el recorte a su gente lo hace cada consulta del lado del
// servidor —acá solo se decide quién puede abrir la puerta.
const SOLO_DIRECCION = ["/equipo", "/api/oficinas"];

export async function middleware(req: NextRequest) {
  const sesion = await verificarSesion(req.cookies.get(SESSION_COOKIE)?.value);

  if (!sesion) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const ruta = req.nextUrl.pathname;
  const cubre = (rutas: string[]) =>
    rutas.some((p) => ruta === p || ruta.startsWith(`${p}/`));
  const rebotar = (mensaje: string) =>
    ruta.startsWith("/api/")
      ? NextResponse.json({ error: mensaje }, { status: 403 })
      : NextResponse.redirect(new URL("/", req.url));

  if (sesion.rol !== "admin" && cubre(SOLO_ADMIN)) {
    return rebotar("Solo el admin puede hacer esto");
  }
  if (sesion.rol !== "admin" && sesion.rol !== "director" && cubre(SOLO_DIRECCION)) {
    return rebotar("Solo la dirección puede ver esto");
  }

  return NextResponse.next();
}
