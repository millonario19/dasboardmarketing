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
  if (!Number.isFinite(ftd)) {
    return NextResponse.json({ error: "La meta de FTD tiene que ser un número" }, { status: 400 });
  }

  try {
    // El total en dólares no se recibe: lo calcula `guardarMeta` sumando el
    // escalón de FTD y las membresías. Si viniera del navegador, un cliente
    // viejo o tocado podría guardar una meta cuyas mitades no suman el total.
    return NextResponse.json({
      meta: await guardarMeta(sesion.usuario, {
        ftd,
        plan: cuerpo?.plan ?? null,
        vendidas: cuerpo?.vendidas ?? null,
      }),
    });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "No se pudo guardar la meta";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
