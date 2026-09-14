import { NextResponse } from "next/server";
import { conversacionDeUnLead } from "@/lib/interaccion";
import { sesionActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await sesionActual())) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }
  try {
    const lead = await conversacionDeUnLead(params.id);
    if (!lead) return NextResponse.json({ error: "Ese lead no tiene conversación" }, { status: 404 });
    return NextResponse.json({ lead });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al leer la conversación";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
