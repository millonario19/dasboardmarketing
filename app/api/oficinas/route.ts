import { NextResponse } from "next/server";
import { listarOficinas, agentesDeOficina } from "@/lib/oficinas";
import { exigirDireccion, sesionActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

/**
 * Las oficinas que puede ver quien pregunta.
 *
 * El admin ve las cuatro; un director, solo la suya. El recorte va acá y no en
 * la pantalla: una pantalla se puede abrir con otra URL, esta consulta no.
 */
export async function GET() {
  const rechazo = await exigirDireccion();
  if (rechazo) return rechazo;

  const sesion = await sesionActual();
  try {
    const todas = await listarOficinas();
    const mias =
      sesion?.rol === "admin" ? todas : todas.filter((o) => o.id === sesion?.oficinaId);

    const conEquipo = await Promise.all(
      mias.map(async (o) => ({ ...o, agentes: (await agentesDeOficina(o.id)).length }))
    );
    return NextResponse.json({ oficinas: conEquipo, rol: sesion?.rol ?? null });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al leer las oficinas";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
