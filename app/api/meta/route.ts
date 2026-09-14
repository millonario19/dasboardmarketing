import { NextRequest, NextResponse } from "next/server";
import { guardarMeta, leerMeta } from "@/lib/metas";
import { sesionActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  return NextResponse.json({ meta: await leerMeta(sesion.usuario) });
}

export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const cuerpo = await req.json().catch(() => null);
  const ftd = Number(cuerpo?.ftd);
  const usd = Number(cuerpo?.usd);
  if (!Number.isFinite(ftd) || !Number.isFinite(usd)) {
    return NextResponse.json({ error: "La meta tiene que ser un número" }, { status: 400 });
  }

  try {
    return NextResponse.json({ meta: await guardarMeta(sesion.usuario, ftd, usd) });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "No se pudo guardar la meta";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
