import { NextRequest, NextResponse } from "next/server";
import { reportarLlamada } from "@/lib/llamadas";
import { registrarAccion, programarTarea } from "@/lib/acciones";
import { esResultado, metaResultado } from "@/lib/cuando";
import { invalidarSeguimiento } from "@/lib/seguimiento";
import { sesionActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

/**
 * Colgó: qué pasó y cuándo lo vuelve a llamar.
 *
 * Es la única ruta del tablero que cierra el círculo sola. Con un solo envío:
 *
 *   1. marca la llamada como reportada, para que deje de preguntar
 *   2. la escribe en el hilo del cliente, con la observación y el resultado
 *   3. deja programada la próxima, que es lo que le va a salir mañana
 *
 * Las tres van juntas a propósito. Cuando estaban separadas —la llamada en su
 * tabla, la tarea en otra— el agente reportaba y la promesa del cliente no
 * aparecía en ninguna lista: se perdía justo el dato por el que llamó.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Llamada inválida" }, { status: 400 });
  }

  const cuerpo = await req.json().catch(() => null);
  const resultado = cuerpo?.resultado;
  if (!esResultado(resultado)) {
    return NextResponse.json({ error: "Falta decir cómo salió la llamada" }, { status: 400 });
  }
  const nota = typeof cuerpo?.nota === "string" ? cuerpo.nota.trim() : "";
  // Vacío es una respuesta válida: «no lo llamo más».
  const proxima =
    typeof cuerpo?.proximaEn === "string" && cuerpo.proximaEn ? cuerpo.proximaEn : null;
  if (proxima && Number.isNaN(Date.parse(proxima))) {
    return NextResponse.json({ error: "Esa fecha no se entiende" }, { status: 400 });
  }

  const meta = metaResultado(resultado);
  const contesto = resultado !== "no-contesto";

  try {
    const llamada = await reportarLlamada(id, sesion.usuario, {
      contesto,
      resultado,
      promesaEn: proxima,
      nota: nota || null,
    });
    // No es de este agente, o no existe: la misma respuesta para los dos, para
    // no confirmar que existe una llamada de otro.
    if (!llamada) return NextResponse.json({ error: "Esa llamada no es tuya" }, { status: 404 });

    const quien = {
      contactId: llamada.contactId,
      nombre: llamada.nombre,
      telefono: llamada.telefono,
      usuario: sesion.usuario,
    };

    // Al hilo. `registrarAccion` cierra de paso la tarea que estaba abierta:
    // acaba de llamarlo, la tarea de llamarlo ya no existe.
    await registrarAccion(
      quien,
      "llame",
      nota || meta?.texto || null,
      resultado
    ).catch(() => undefined);

    // Y la de mañana, después de haber cerrado la vieja para que no se cierre
    // ella misma.
    if (proxima) {
      await programarTarea(quien, "llame", nota || null, proxima).catch(() => undefined);
    }

    invalidarSeguimiento();
    return NextResponse.json({ ...llamada, proximaEn: proxima });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error al guardar el reporte";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
