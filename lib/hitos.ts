import { getPool } from "./db";

/**
 * Lo que le pasó al lead fuera de la conversación, con su hora.
 *
 * Las tres acciones que más valen —bajar al WhatsApp del agente, registrarse
 * en el broker, depositar— ocurren afuera del hilo de GHL. Por eso un lead
 * podía figurar como «2 horas sin respuesta» en Interacción y como Caliente en
 * Temperatura al mismo tiempo: las dos cosas eran ciertas, pero se miraban en
 * pantallas distintas y parecían contradecirse.
 *
 * Acá se juntan. La hora sale del cuaderno de etiquetas —GHL no guarda cuándo
 * se puso un tag, así que el sondeo de cada 5 minutos anota la primera vez que
 * la ve— y de las llamadas que registra el propio tablero.
 */

export type Hito = {
  hora: string;
  texto: string;
  detalle: string | null;
  tipo: "tag" | "llamada";
  /**
   * Si la hora es de verdad.
   *
   * Las etiquetas marcadas 'backfill' ya existían cuando el sondeo vio a ese
   * contacto por primera vez: pueden ser de hace semanas. Meterlas en la línea
   * de tiempo como si fueran exactas inventaría un recorrido que nunca pasó.
   */
  exacto: boolean;
};

function etiquetaDeTag(tag: string): string | null {
  const t = tag.toLowerCase();
  const registro = (process.env.GHL_REGISTRO_TAG ?? "tag-julian-registrado").toLowerCase();
  const ftd = (process.env.GHL_FTD_TAG ?? "ftd-efectuado").toLowerCase();

  if (t === registro || t === "registrado") return "Se registró en el broker";
  if (t === ftd) return "Depositó (FTD)";
  if (t === "cliente interactuo" || t === "interactuó") return "Cliente interactuó";
  if (t === "ingresó al canal free") return "Ingresó al canal";
  if (t === "clic comunidad") return "Clic en la comunidad";
  if (t === "bajado a business") return "Bajó a WhatsApp Business";
  if (t === "bajada confirmada") return "El agente confirmó la bajada";
  if (t === "bajada no confirmada") return "El agente dijo que NO bajó";
  // El resto —país, equipo, link-###, la etiqueta de la pauta— no son pasos
  // del recorrido: son cómo está clasificado el contacto.
  return null;
}

const RESULTADO_EN_PALABRAS: Record<string, string> = {
  registro: "se registró",
  deposita: "va a depositar",
  volver: "lo piensa, volver a llamar",
  "no-interesa": "no le interesa",
};

function textoDeLlamada(f: {
  contesto: boolean | null;
  resultado: string | null;
  promesa_en: Date | null;
  nota: string | null;
  reportado_en: Date | null;
}): { texto: string; detalle: string | null } {
  if (!f.reportado_en) return { texto: "Llamó", detalle: "sin reportar todavía" };
  if (f.contesto === false) return { texto: "Llamó", detalle: "no contestó" };

  const partes: string[] = [];
  if (f.resultado) partes.push(RESULTADO_EN_PALABRAS[f.resultado] ?? f.resultado);
  if (f.promesa_en) {
    partes.push(
      `para el ${f.promesa_en.toLocaleString("es-CO", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Bogota",
      })}`
    );
  }
  if (f.nota) partes.push(`«${f.nota}»`);
  return { texto: "Llamó y contestó", detalle: partes.join(" · ") || null };
}

/**
 * Los hitos de varios leads de una sola vez.
 *
 * De a uno serían dos consultas por lead y hasta sesenta leads por pantalla.
 */
export async function hitosDeContactos(ids: string[]): Promise<Map<string, Hito[]>> {
  const salida = new Map<string, Hito[]>();
  if (ids.length === 0) return salida;

  const agregar = (contactId: string, hito: Hito) => {
    const lista = salida.get(contactId);
    if (lista) lista.push(hito);
    else salida.set(contactId, [hito]);
  };

  const pool = getPool();

  const tags = await pool
    .query<{ contact_id: string; tag: string; occurred_at: Date; source: string }>(
      `select contact_id, tag, occurred_at, source
         from tag_history
        where contact_id = any($1::text[])
        order by occurred_at`,
      [ids]
    )
    .catch(() => ({ rows: [] as { contact_id: string; tag: string; occurred_at: Date; source: string }[] }));

  // Los dos tags de interacción son el mismo hecho visto por el flujo y por el
  // agente. Mostrarlos dos veces haría creer que el cliente escribió dos veces.
  const yaVisto = new Set<string>();
  for (const f of tags.rows) {
    const texto = etiquetaDeTag(f.tag);
    if (!texto) continue;
    const llave = `${f.contact_id}|${texto}`;
    if (yaVisto.has(llave)) continue;
    yaVisto.add(llave);
    agregar(f.contact_id, {
      hora: f.occurred_at.toISOString(),
      texto,
      detalle: null,
      tipo: "tag",
      exacto: f.source === "poll",
    });
  }

  const llamadas = await pool
    .query<{
      contact_id: string;
      llamada_en: Date;
      contesto: boolean | null;
      resultado: string | null;
      promesa_en: Date | null;
      nota: string | null;
      reportado_en: Date | null;
    }>(
      `select contact_id, llamada_en, contesto, resultado, promesa_en, nota, reportado_en
         from llamadas
        where contact_id = any($1::text[])
        order by llamada_en`,
      [ids]
    )
    .catch(() => ({ rows: [] as never[] }));

  for (const f of llamadas.rows) {
    const { texto, detalle } = textoDeLlamada(f);
    agregar(f.contact_id, {
      hora: f.llamada_en.toISOString(),
      texto,
      detalle,
      tipo: "llamada",
      exacto: true,
    });
  }

  for (const lista of salida.values()) lista.sort((a, b) => a.hora.localeCompare(b.hora));
  return salida;
}
