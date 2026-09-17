"use client";

import { useCallback, useEffect, useState } from "react";
import { CUANDO, RESULTADOS, leerCuando, metaResultado, opcionCuando } from "@/lib/cuando";

const AZUL = "#17457F";
const AZUL_CLARO = "#EAF1FA";
const VERDE = "#157F52";
const AMBAR = "#B5701F";
const ROJO = "#C0392B";
const GRIS_2 = "#5E5C56";

export type Pendiente = {
  id: number;
  contactId: string;
  nombre: string | null;
  telefono: string | null;
  llamadaEn: string;
};

/**
 * Las llamadas sin reportar, compartidas por toda la pantalla.
 *
 * El botón de llamar y el aviso de «¿qué pasó?» viven en filas distintas de
 * tablas distintas, y todas necesitan la misma lista. Pedirla una vez por fila
 * serían cuarenta consultas iguales; por eso vive acá afuera, se carga una
 * sola vez y cada fila se suscribe.
 */
let cache: Map<string, Pendiente> | null = null;
let cargando: Promise<void> | null = null;
const suscriptores = new Set<() => void>();

function avisar() {
  suscriptores.forEach((f) => f());
}

function cargar(): Promise<void> {
  if (!cargando) {
    cargando = fetch("/api/llamadas")
      .then((r) => (r.ok ? r.json() : { pendientes: [] }))
      .then((d: { pendientes?: Pendiente[] }) => {
        cache = new Map((d.pendientes ?? []).map((p) => [p.contactId, p]));
        avisar();
      })
      .catch(() => {
        cache = new Map();
      });
  }
  return cargando;
}

function guardarEnCache(p: Pendiente) {
  if (!cache) cache = new Map();
  cache.set(p.contactId, p);
  avisar();
}

function sacarDeCache(contactId: string) {
  cache?.delete(contactId);
  avisar();
}

function usePendiente(contactId: string): Pendiente | null {
  const [, refrescar] = useState(0);
  useEffect(() => {
    const f = () => refrescar((n) => n + 1);
    suscriptores.add(f);
    cargar();
    return () => {
      suscriptores.delete(f);
    };
  }, []);
  return cache?.get(contactId) ?? null;
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

function IconoTelefono({ tamano }: { tamano: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.4 21 3 12.6 3 4c0-.6.4-1 1-1h3.6c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.4 2.2Z" />
    </svg>
  );
}

/**
 * Botón de llamar que además deja constancia.
 *
 * Registra que el agente tocó el botón, no que haya hablado: el registro de
 * llamadas de un celular no lo expone ningún sistema operativo. Por eso lo
 * que vale de verdad viene después, en el reporte.
 *
 * El registro se manda con keepalive porque el navegador empieza a abrir el
 * marcador en el mismo clic; sin eso, la petición se cancela a la mitad en el
 * celular, que es justo donde se usa.
 */
export function BotonLlamar({
  telefono,
  nombre,
  contactId,
  tamano = 30,
}: {
  telefono: string | null;
  nombre?: string;
  contactId?: string;
  tamano?: number;
}) {
  if (!telefono) return null;

  const registrar = () => {
    if (!contactId) return;
    fetch("/api/llamadas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, nombre, telefono }),
      keepalive: true,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: Pendiente | null) => p && guardarEnCache(p))
      .catch(() => {
        /* que no se pierda la llamada por no poder anotarla */
      });
  };

  return (
    <a
      href={`tel:${telefono.replace(/\s/g, "")}`}
      onClick={registrar}
      aria-label={nombre ? `Llamar a ${nombre}` : "Llamar"}
      title="Llamar"
      className="inline-flex items-center justify-center rounded-full text-white shrink-0 transition-transform hover:scale-110"
      style={{ background: AZUL, width: tamano, height: tamano }}
    >
      <IconoTelefono tamano={Math.round(tamano * 0.56)} />
    </a>
  );
}

/**
 * Llamar por el número de la oficina, desde LeadConnector.
 *
 * Son dos llamadas distintas y conviene que se vean distintas. Esta sale del
 * número de Estados Unidos: queda grabada, con su hora y su duración, y el
 * tablero la lee sola. La del celular del agente contesta más —el cliente ve
 * un número colombiano— pero no deja rastro en ningún lado, y por eso esa es
 * la que hay que anotar a mano.
 *
 * Abre la ficha en el CRM, que en el celular la toma la app de LeadConnector y
 * marca desde ahí.
 */
export function BotonCrm({
  crmUrl,
  nombre,
  contactId,
  telefono,
}: {
  crmUrl?: string | null;
  nombre?: string;
  contactId?: string;
  telefono?: string | null;
}) {
  if (!crmUrl) return null;

  // Igual que el botón del celular: deja el «¿qué pasó?» esperando. Sin esto,
  // llamar por el CRM no preguntaba nada y lo que el cliente dijo —«mañana
  // pago», «llamame a las 8»— se perdía justo en la llamada que sí queda
  // grabada.
  const registrar = () => {
    if (!contactId) return;
    fetch("/api/llamadas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, nombre, telefono }),
      keepalive: true,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: Pendiente | null) => p && guardarEnCache(p))
      .catch(() => undefined);
  };

  return (
    <a
      href={crmUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={registrar}
      title={`Llamar a ${nombre ?? "este lead"} por el número de la oficina · queda grabada`}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-[5px] text-[11.5px] font-bold whitespace-nowrap text-white hover:opacity-90"
      style={{ background: AZUL }}
    >
      ✆ CRM
    </a>
  );
}


/**
 * La hoja de «¿qué pasó?», una sola para los dos casos.
 *
 * Se abre de dos maneras y guarda en dos lados, pero por dentro es la misma
 * pregunta: qué pasó, qué dijo, cuándo lo vuelvo a llamar. Tenerla dos veces
 * escrita era la forma segura de que una de las dos se quedara vieja.
 *
 * Es una sola pregunta, no un formulario. El agente acaba de colgar y tiene
 * otro número esperando; si esto le cuesta más de tres toques, deja de
 * llenarlo a la tercera llamada y el sistema se queda ciego.
 *
 * El truco está en que el resultado ya elige el «cuándo». Toca «no contestó» y
 * queda marcado «en 3 horas», que es lo que iba a poner igual. Toca «va a
 * depositar» y queda «mañana 8:00». Si el cliente dijo otra cosa —«esta noche
 * a las 8 cuando salga del trabajo»— lo corrige con un toque.
 */
function HojaQuePaso({
  titulo,
  subtitulo,
  guardar,
  cerrar,
}: {
  titulo: string;
  subtitulo: string;
  /** Devuelve el error, o null si salió bien. */
  guardar: (datos: {
    resultado: string;
    nota: string;
    proximaEn: string | null;
  }) => Promise<string | null>;
  cerrar: () => void;
}) {
  const [resultado, setResultado] = useState<string | null>(null);
  const [cuando, setCuando] = useState<string | null>(null);
  const [fechaSuelta, setFechaSuelta] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Elegir el resultado deja puesto el cuándo. El agente solo lo toca si el
  // cliente dijo una hora distinta.
  const elegirResultado = (id: string) => {
    setResultado(id);
    setCuando(metaResultado(id)?.cuando ?? null);
  };

  const proximaEn = (): string | null => {
    if (!cuando || cuando === "nunca") return null;
    if (cuando === "otro") return fechaSuelta ? new Date(fechaSuelta).toISOString() : null;
    return opcionCuando(cuando)?.calcular() ?? null;
  };

  const listo = resultado !== null && (cuando !== "otro" || fechaSuelta !== "");

  function enviar() {
    if (!resultado) return;
    setGuardando(true);
    setError(null);
    guardar({ resultado, nota, proximaEn: proximaEn() })
      .then((fallo) => {
        if (fallo) setError(fallo);
        else cerrar();
      })
      .finally(() => setGuardando(false));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(13,13,13,.45)" }}
      onClick={() => !guardando && cerrar()}
    >
      <div
        className="bg-surface w-full sm:max-w-[440px] rounded-t-[22px] sm:rounded-[22px] overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3.5" style={{ background: AZUL_CLARO }}>
          <div className="text-[16px] font-semibold tracking-[-0.02em]">{titulo}</div>
          <div className="text-[12.5px]" style={{ color: GRIS_2 }}>
            {subtitulo}
          </div>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[.15em] mb-2" style={{ color: GRIS_2 }}>
              ¿Qué pasó?
            </p>
            <div className="flex flex-wrap gap-1.5">
              {RESULTADOS.map((r) => {
                const puesto = resultado === r.id;
                const fondo = r.tono === "bueno" ? VERDE : r.tono === "malo" ? ROJO : AZUL;
                return (
                  <button
                    key={r.id}
                    onClick={() => elegirResultado(r.id)}
                    aria-pressed={puesto}
                    className="rounded-full px-3 py-[7px] text-[12.5px] font-semibold"
                    style={
                      puesto
                        ? { background: fondo, color: "#fff" }
                        : { background: "var(--page)", border: "1px solid var(--gridline)" }
                    }
                  >
                    {r.texto}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[.15em] mb-1.5" style={{ color: GRIS_2 }}>
              Qué te dijo
            </p>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              placeholder="Esta noche a las 8, cuando salga de trabajar"
              className="w-full rounded-xl border border-gridline bg-page px-3 py-2.5 text-[13px] outline-none resize-none"
            />
            <p className="text-[11px] mt-1" style={{ color: GRIS_2 }}>
              Con sus palabras. Te va a salir debajo del nombre el día que toque.
            </p>
          </div>

          {resultado && (
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-[.15em] mb-2" style={{ color: GRIS_2 }}>
                ¿Cuándo lo volvés a buscar?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CUANDO.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCuando(c.id)}
                    aria-pressed={cuando === c.id}
                    className="rounded-full px-3 py-[7px] text-[12.5px] font-semibold"
                    style={
                      cuando === c.id
                        ? { background: AZUL, color: "#fff" }
                        : { background: "var(--page)", border: "1px solid var(--gridline)" }
                    }
                  >
                    {c.texto}
                  </button>
                ))}
              </div>
              {cuando === "otro" && (
                <input
                  type="datetime-local"
                  value={fechaSuelta}
                  onChange={(e) => setFechaSuelta(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-gridline bg-page px-3 py-2.5 text-[13px] outline-none"
                />
              )}
            </div>
          )}

          {error && (
            <p className="text-[12.5px]" style={{ color: ROJO }}>
              {error}
            </p>
          )}

          {/* Lo que va a quedar, escrito como se lee. Es la última mirada antes
              de guardar y evita la tarea puesta en el día que no era. */}
          {resultado && (
            <p className="text-[12.5px] border-t border-gridline pt-3" style={{ color: GRIS_2 }}>
              Queda: <b style={{ color: "var(--foreground)" }}>{metaResultado(resultado)?.texto}</b>
              {cuando === "nunca" ? (
                <> · no lo buscás más</>
              ) : (
                <>
                  {" "}
                  · lo buscás <b style={{ color: "var(--foreground)" }}>{leerCuando(proximaEn())}</b>
                </>
              )}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={cerrar}
              disabled={guardando}
              className="rounded-full px-4 py-2.5 text-[13px] border border-gridline disabled:opacity-50"
              style={{ color: GRIS_2 }}
            >
              Ahora no
            </button>
            <button
              onClick={enviar}
              disabled={guardando || !listo}
              className="flex-1 rounded-full px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
              style={{ background: VERDE }}
            >
              {guardando ? "Guardando…" : "Guardar y seguir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** El aviso ámbar de la llamada sin reportar, y su hoja. */
export function ReporteLlamada({ contactId }: { contactId: string }) {
  const pendiente = usePendiente(contactId);
  const [abierto, setAbierto] = useState(false);

  const guardar = useCallback(
    async (datos: { resultado: string; nota: string; proximaEn: string | null }) => {
      if (!pendiente) return "No encontré la llamada";
      const r = await fetch(`/api/llamadas/${pendiente.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      if (!r.ok) return (await r.json()).error ?? "No se pudo guardar";
      sacarDeCache(contactId);
      return null;
    },
    [contactId, pendiente]
  );

  if (!pendiente) return null;

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold whitespace-nowrap hover:opacity-85"
        style={{ background: AMBAR, color: "#fff" }}
      >
        📞 {hora(pendiente.llamadaEn)} — ¿qué pasó?
      </button>

      {abierto && (
        <HojaQuePaso
          titulo={pendiente.nombre || "Ese lead"}
          subtitulo={`Lo llamaste a las ${hora(pendiente.llamadaEn)}`}
          guardar={guardar}
          cerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}

/**
 * Anotar sin haber llamado desde el panel.
 *
 * Porque no todo pasa por el botón. El cliente le escribe al WhatsApp
 * personal, o lo llama él, o el agente marcó desde el teléfono sin tocar nada
 * acá. En todos esos casos hay algo que el cliente dijo —«mañana pago», «esta
 * noche a las 8 cuando salga de trabajar»— y hasta ahora no había dónde
 * ponerlo: el «¿qué pasó?» solo aparecía después de una llamada registrada.
 *
 * Guarda en el mismo hilo y programa la misma tarea. Para el tablero es lo
 * mismo que un reporte de llamada; para el agente es poder anotar cuando la
 * vida no pasó por el botón.
 */
export function BotonAnotar({
  contactId,
  nombre,
  telefono,
}: {
  contactId: string;
  nombre?: string | null;
  telefono?: string | null;
}) {
  const pendiente = usePendiente(contactId);
  const [abierto, setAbierto] = useState(false);
  const [guardado, setGuardado] = useState<string | null>(null);

  const guardar = useCallback(
    async (datos: { resultado: string; nota: string; proximaEn: string | null }) => {
      const r = await fetch(`/api/acciones/${encodeURIComponent(contactId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "llame",
          detalle: datos.nota || metaResultado(datos.resultado)?.texto || null,
          resultado: datos.resultado,
          nombre,
          telefono,
          siguiente: datos.proximaEn
            ? { tipo: "llame", cuando: datos.proximaEn, detalle: datos.nota || null }
            : null,
        }),
      });
      if (!r.ok) return (await r.json()).error ?? "No se pudo guardar";
      setGuardado(datos.proximaEn);
      return null;
    },
    [contactId, nombre, telefono]
  );

  // Con una llamada sin reportar manda el aviso ámbar, que es más urgente:
  // dos botones que abren la misma hoja confunden.
  if (pendiente) return null;

  if (guardado !== null) {
    return (
      <span className="text-[11.5px] font-semibold" style={{ color: VERDE }}>
        ✓ anotado · {guardado ? `lo buscás ${leerCuando(guardado)}` : "sin próxima"}
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        title="Anotar qué te dijo y cuándo lo volvés a buscar"
        className="rounded-full px-2.5 py-[5px] text-[11.5px] font-semibold whitespace-nowrap"
        style={{ background: AZUL_CLARO, color: AZUL, border: "1px solid rgba(23,69,127,.18)" }}
      >
        ✎ Anotar
      </button>

      {abierto && (
        <HojaQuePaso
          titulo={nombre || "Ese lead"}
          subtitulo="Anotá qué te dijo, aunque no lo hayas llamado desde acá"
          guardar={guardar}
          cerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}
