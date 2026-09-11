export const SESSION_COOKIE = "op_session";

export type Rol = "admin" | "agente";

export type Sesion = {
  usuario: string;
  nombre: string;
  rol: Rol;
  // userId de GHL. En el admin va null: no está atado a ningún agente y ve todo.
  agentId: string | null;
};

const DURACION_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(signature);
}

// Comparación sin atajos: con === el tiempo de respuesta delata cuántos
// caracteres del principio acertó quien esté probando firmas.
function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

// base64url a mano porque esto corre también en el middleware (runtime Edge),
// donde no hay Buffer. El rodeo por bytes es para que un nombre con tilde no
// rompa btoa, que solo acepta Latin-1.
function aBase64Url(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(texto: string): string {
  const b64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(b64);
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Token = "<datos en base64url>.<hmac>" firmado con SESSION_SECRET.
 *
 * Los datos van dentro del token y no en una tabla de sesiones: el middleware
 * corre en Edge, donde no hay conexión a Postgres, y necesita saber el rol
 * antes de dejar pasar el request. El precio es que un cambio de rol o una
 * baja recién se sienten cuando la sesión vence o la persona vuelve a entrar.
 */
export async function createSessionToken(sesion: Sesion): Promise<string> {
  const secret = process.env.SESSION_SECRET ?? "";
  const datos = aBase64Url(JSON.stringify({ ...sesion, exp: Date.now() + DURACION_MS }));
  return `${datos}.${await sign(datos, secret)}`;
}

export async function verificarSesion(token: string | undefined): Promise<Sesion | null> {
  if (!token) return null;
  const secret = process.env.SESSION_SECRET ?? "";
  const [datos, firma] = token.split(".");
  if (!datos || !firma) return null;
  if (!igualSeguro(await sign(datos, secret), firma)) return null;

  try {
    const payload = JSON.parse(deBase64Url(datos));
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    if (payload.rol !== "admin" && payload.rol !== "agente") return null;
    return {
      usuario: String(payload.usuario ?? ""),
      nombre: String(payload.nombre ?? payload.usuario ?? ""),
      rol: payload.rol,
      agentId: payload.agentId ?? null,
    };
  } catch {
    return null;
  }
}

// Qué pantalla ve cada quien al entrar: el agente arranca en su lista de
// trabajo, la dirección en el tablero.
export function pantallaInicial(rol: Rol): string {
  return rol === "admin" ? "/" : "/mi-dia";
}
