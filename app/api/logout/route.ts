import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

// Cierra la sesión borrando la cookie. Va por POST a propósito: con GET,
// cualquier prefetch del navegador o una imagen incrustada apuntando a esta
// ruta desloguearía al usuario sin que lo pida.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
