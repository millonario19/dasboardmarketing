import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * La grabación de una llamada, servida desde el panel.
 *
 * GHL la guarda detrás del token de la cuenta, así que el navegador no puede
 * pedirla directo: el reproductor no manda cabeceras. Esta ruta la trae con el
 * token y la devuelve tal cual.
 *
 * Con soporte de Range, que no es un lujo: Safari pide los primeros bytes para
 * saber cuánto dura antes de reproducir, y si el servidor le contesta el
 * archivo entero con un 200, no reproduce nada.
 */
export async function GET(req: NextRequest, { params }: { params: { mensajeId: string } }) {
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  const version = process.env.GHL_API_VERSION ?? "2021-07-28";
  if (!token || !locationId) {
    return NextResponse.json({ error: "Falta la configuración de GHL" }, { status: 500 });
  }

  const res = await fetch(
    `https://services.leadconnectorhq.com/conversations/messages/${encodeURIComponent(
      params.mensajeId
    )}/locations/${locationId}/recording`,
    { headers: { Authorization: `Bearer ${token}`, Version: version }, cache: "no-store" }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: res.status === 422 ? "Esa llamada no quedó grabada" : "GHL no devolvió la grabación" },
      { status: res.status === 422 ? 404 : 502 }
    );
  }

  const audio = Buffer.from(await res.arrayBuffer());
  const tipo = res.headers.get("content-type") ?? "audio/wav";
  const rango = req.headers.get("range");

  if (rango) {
    const [desde, hasta] = rango.replace(/bytes=/, "").split("-");
    const inicio = Number(desde) || 0;
    const fin = hasta ? Number(hasta) : audio.length - 1;
    const trozo = audio.subarray(inicio, fin + 1);
    return new NextResponse(trozo, {
      status: 206,
      headers: {
        "Content-Type": tipo,
        "Content-Range": `bytes ${inicio}-${fin}/${audio.length}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(trozo.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  return new NextResponse(audio, {
    headers: {
      "Content-Type": tipo,
      "Accept-Ranges": "bytes",
      "Content-Length": String(audio.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
