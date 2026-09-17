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
 *   null  -> ve más de un agente (dirección o admin)
 *   "id"  -> solo los leads de ese agente
 *
 * Se lee de la cookie firmada, nunca de un parámetro de la URL: si el agente
 * pudiera mandar ?agente=otro, el filtro no filtraría nada.
 *
 * El director cae en el `null` aunque tenga su propio `agentId`: su pantalla
 * es la de su oficina. Quién es «su oficina» lo resuelve `alcanceDeOficina`.
 */
export async function alcanceDeAgente(): Promise<string | null> {
  const sesion = await sesionActual();
  return sesion?.rol === "agente" ? sesion.agentId : null;
}

/**
 * Qué oficina puede ver quien hizo el request.
 *
 *   null    -> las cuatro (admin)
 *   número  -> solo esa (director y agente)
 *
 * Es el filtro que impide que un director de Apex vea a la gente de Prime.
 * Mientras Prime sea la única conectada no cambia nada en pantalla, pero la
 * regla tiene que existir antes de que entren las otras tres: agregarla
 * después es revisar cada consulta de nuevo.
 */
export async function alcanceDeOficina(): Promise<number | null> {
  const sesion = await sesionActual();
  return sesion?.rol === "admin" ? null : sesion?.oficinaId ?? null;
}

/** Puede ver a más de una persona: dirección de oficina o admin. */
export async function esDireccion(): Promise<boolean> {
  const sesion = await sesionActual();
  return sesion?.rol === "admin" || sesion?.rol === "director";
}

// Para las rutas que solo puede tocar el admin —crear oficinas, mover gente de
// una a otra—. Un director manda en la suya, pero no en la organización.
export async function exigirAdmin(): Promise<NextResponse | null> {
  const sesion = await sesionActual();
  if (sesion?.rol !== "admin") {
    return NextResponse.json({ error: "Solo el admin puede hacer esto" }, { status: 403 });
  }
  return null;
}

// Para lo que un director sí puede: mirar a su equipo.
export async function exigirDireccion(): Promise<NextResponse | null> {
  if (await esDireccion()) return null;
  return NextResponse.json({ error: "Solo la dirección puede ver esto" }, { status: 403 });
}
