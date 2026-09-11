import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verificarSesion, type Sesion } from "./auth";

// Separado de lib/auth.ts porque esto usa next/headers, que no existe en el
// middleware. auth.ts tiene que poder importarse desde los dos lados.

export async function sesionActual(): Promise<Sesion | null> {
  return verificarSesion(cookies().get(SESSION_COOKIE)?.value);
}

/**
 * Qué agente puede ver quien hizo el request.
 *
 *   null  -> ve todo (dirección)
 *   "id"  -> solo los leads de ese agente
 *
 * Se lee de la cookie firmada, nunca de un parámetro de la URL: si el agente
 * pudiera mandar ?agente=otro, el filtro no filtraría nada.
 */
export async function alcanceDeAgente(): Promise<string | null> {
  const sesion = await sesionActual();
  return sesion?.rol === "agente" ? sesion.agentId : null;
}

// Para las rutas que solo puede tocar la dirección. Devuelve la respuesta de
// rechazo, o null si puede seguir.
export async function exigirAdmin(): Promise<NextResponse | null> {
  const sesion = await sesionActual();
  if (sesion?.rol !== "admin") {
    return NextResponse.json({ error: "Solo la dirección puede hacer esto" }, { status: 403 });
  }
  return null;
}
