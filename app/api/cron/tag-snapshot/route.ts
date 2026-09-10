import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runTagSnapshot } from "@/lib/tagHistory";

export const dynamic = "force-dynamic";

function tokenValido(header: string | null): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || !header?.startsWith("Bearer ")) return false;
  const recibido = Buffer.from(header.slice(7));
  const esperado = Buffer.from(secreto);
  // Comparar longitudes primero: timingSafeEqual tira si difieren.
  if (recibido.length !== esperado.length) return false;
  return timingSafeEqual(recibido, esperado);
}

// Lo llama el cron del server cada 5 minutos. Va por POST y con token propio
// en vez de la cookie de sesión, porque no hay una persona detrás.
export async function POST(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Falta CRON_SECRET" }, { status: 500 });
  }
  if (!tokenValido(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const resultado = await runTagSnapshot();
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error en el sondeo";
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
