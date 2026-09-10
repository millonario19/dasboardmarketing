export const SESSION_COOKIE = "op_session";

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

// Token = "<expiryTimestamp>.<hmac>" firmado con SESSION_SECRET.
// Suficiente para un dashboard de un solo usuario protegido por contraseña;
// si más adelante hay varios agentes con roles, esto debería migrar a
// sesiones reales (ej. NextAuth) con usuarios en base de datos.
export async function createSessionToken(): Promise<string> {
  const secret = process.env.SESSION_SECRET ?? "";
  const expiry = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 días
  const signature = await sign(String(expiry), secret);
  return `${expiry}.${signature}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.SESSION_SECRET ?? "";
  const [expiryStr, signature] = token.split(".");
  if (!expiryStr || !signature) return false;
  if (Date.now() > Number(expiryStr)) return false;
  const expected = await sign(expiryStr, secret);
  return expected === signature;
}
