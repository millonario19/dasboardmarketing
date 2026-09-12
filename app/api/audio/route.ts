import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { sesionActual } from "@/lib/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Convierte las notas de voz de WhatsApp a un formato que Safari pueda tocar.
 *
 * GHL las guarda como Ogg Opus, que es lo que manda WhatsApp. Chrome las
 * reproduce; Safari —en Mac y en iPhone— no trae ese códec y el reproductor
 * queda en «Error». Como la dirección trabaja en Safari, servir el archivo tal
 * cual dejaba la función inservible justo para quien la pidió.
 *
 * Acá se pasa a AAC dentro de un MP4, que tocan todos. El resultado se guarda
 * en disco: el reproductor vuelve a pedir el archivo al mover la barra, y
 * convertirlo de nuevo cada vez sería pagar dos veces por el mismo audio.
 */

// Sin esta lista esto sería un proxy abierto: cualquiera con sesión podría
// hacer que el servidor busque una URL interna y le devuelva el contenido.
const HOSTS = [/\.usercontent\.site$/i, /\.leadconnectorhq\.com$/i, /\.msgsndr\.com$/i];

/**
 * Los audios que manda el flujo no viven donde los de las personas: están en
 * un bucket de Google, y por eso quedaban afuera y el reproductor daba error
 * justo en los mensajes automáticos.
 *
 * «storage.googleapis.com» a secas sería la puerta a cualquier bucket de
 * Google, así que además se exige que la ruta sea la de las automatizaciones
 * de esta subcuenta.
 */
function esBucketDelFlujo(url: URL): boolean {
  if (url.hostname.toLowerCase() !== "storage.googleapis.com") return false;
  const loc = process.env.GHL_LOCATION_ID;
  return !!loc && url.pathname.startsWith(`/automation-workflows-production/location/${loc}/`);
}

const TOPE_BYTES = 25 * 1024 * 1024;
const CARPETA = join(tmpdir(), "op-audio");

function permitido(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  return HOSTS.some((h) => h.test(url.hostname)) || esBucketDelFlujo(url);
}

async function convertir(entrada: Buffer, destino: string): Promise<void> {
  // El archivo temporal termina en .m4a y además se le dice «-f mp4»: ffmpeg
  // deduce el formato de la extensión, y con un nombre terminado en
  // «.parcial» se negaba a escribir («Unable to choose an output format»).
  const parcial = `${destino}.${process.pid}.parcial.m4a`;
  await new Promise<void>((resolver, rechazar) => {
    const ff = spawn("ffmpeg", [
      "-hide_banner", "-loglevel", "error",
      "-i", "pipe:0",
      "-vn",
      "-c:a", "aac",
      "-b:a", "64k",
      "-movflags", "+faststart",
      "-f", "mp4",
      "-y", parcial,
    ]);
    let error = "";
    ff.stderr.on("data", (d) => (error += d.toString().slice(0, 500)));
    ff.on("error", rechazar);
    ff.on("close", (codigo) =>
      codigo === 0 ? resolver() : rechazar(new Error(error || `ffmpeg salió con ${codigo}`))
    );
    ff.stdin.on("error", () => {
      /* si ffmpeg muere antes de leer todo, el close de arriba da el motivo */
    });
    ff.stdin.end(entrada);
  });
  // Mover al final: si dos pestañas piden el mismo audio a la vez, ninguna
  // llega a leer un archivo a medio escribir.
  await rename(parcial, destino);
}

export async function GET(req: NextRequest) {
  if (!(await sesionActual())) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const crudo = req.nextUrl.searchParams.get("u") ?? "";
  let origen: URL;
  try {
    origen = new URL(crudo);
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }
  if (!permitido(origen)) {
    return NextResponse.json({ error: "Ese origen no está permitido" }, { status: 400 });
  }

  const destino = join(CARPETA, `${createHash("sha1").update(origen.toString()).digest("hex")}.m4a`);

  try {
    await mkdir(CARPETA, { recursive: true });

    if (!(await stat(destino).catch(() => null))) {
      const res = await fetch(origen.toString(), { cache: "no-store" });
      if (!res.ok) {
        return NextResponse.json({ error: `El archivo no está disponible (${res.status})` }, { status: 502 });
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.byteLength > TOPE_BYTES) {
        return NextResponse.json({ error: "El audio es demasiado grande" }, { status: 413 });
      }
      await convertir(bytes, destino);
    }

    const datos = await readFile(destino);

    // Safari pide el audio por tramos («Range: bytes=0-1» primero) y, si le
    // contestan 200 con el archivo entero, se planta. Por eso el rango se
    // atiende de verdad en vez de anunciar Accept-Ranges: none.
    const cabeceras: Record<string, string> = {
      "Content-Type": "audio/mp4",
      "Accept-Ranges": "bytes",
      // Privado: es la conversación de un cliente, no puede quedar en una
      // caché compartida.
      "Cache-Control": "private, max-age=86400",
    };

    const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
    if (rango) {
      const desde = rango[1] ? Number(rango[1]) : 0;
      const hasta = rango[2] ? Math.min(Number(rango[2]), datos.byteLength - 1) : datos.byteLength - 1;
      if (desde >= datos.byteLength || desde > hasta) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${datos.byteLength}`, "Accept-Ranges": "bytes" },
        });
      }
      const trozo = datos.subarray(desde, hasta + 1);
      return new Response(new Uint8Array(trozo), {
        status: 206,
        headers: {
          ...cabeceras,
          "Content-Length": String(trozo.byteLength),
          "Content-Range": `bytes ${desde}-${hasta}/${datos.byteLength}`,
        },
      });
    }

    return new Response(new Uint8Array(datos), {
      headers: { ...cabeceras, "Content-Length": String(datos.byteLength) },
    });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "No se pudo preparar el audio";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
