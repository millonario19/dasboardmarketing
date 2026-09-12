"use client";

import { useCallback, useEffect, useState } from "react";

const AZUL = "#17457F";
const AZUL_CLARO = "#EAF1FA";
const VERDE = "#157F52";
const AMBAR = "#B5701F";
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

const RESULTADOS = [
  { id: "registro", texto: "Se registró", fecha: false },
  { id: "deposita", texto: "Va a depositar", fecha: true },
  { id: "volver", texto: "Lo piensa, volver a llamar", fecha: true },
  { id: "no-interesa", texto: "No le interesa", fecha: false },
] as const;

/**
 * El aviso de «llamaste, ¿qué pasó?» y su formulario.
 *
 * Aparece al lado del lead, después de la llamada y no durante: en el momento
 * del clic el agente está por hablar por teléfono, no es momento de un
 * formulario.
 *
 * Son toques, no escritura. La nota es opcional a propósito: si fuera
 * obligatoria escribirían «ok» y el campo dejaría de servir.
 */
export function ReporteLlamada({ contactId }: { contactId: string }) {
  const pendiente = usePendiente(contactId);
  const [abierto, setAbierto] = useState(false);
  const [contesto, setContesto] = useState<boolean | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [cuando, setCuando] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = useCallback(
    (datos: { contesto: boolean; resultado?: string | null; promesaEn?: string | null; nota?: string }) => {
      if (!pendiente) return;
      setGuardando(true);
      setError(null);
      fetch(`/api/llamadas/${pendiente.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo guardar");
          sacarDeCache(contactId);
          setAbierto(false);
          setContesto(null);
          setResultado(null);
          setCuando("");
          setNota("");
        })
        .catch((e) => setError(e.message))
        .finally(() => setGuardando(false));
    },
    [contactId, pendiente]
  );

  if (!pendiente) return null;

  const pideFecha = RESULTADOS.find((r) => r.id === resultado)?.fecha ?? false;

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
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(13,13,13,.45)" }}
          onClick={() => !guardando && setAbierto(false)}
        >
          <div
            className="bg-surface w-full sm:max-w-[420px] rounded-t-[22px] sm:rounded-[22px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4" style={{ background: AZUL_CLARO }}>
              <div className="text-[15px] font-semibold">{pendiente.nombre || "Ese lead"}</div>
              <div className="text-[12.5px]" style={{ color: GRIS_2 }}>
                Llamaste a las {hora(pendiente.llamadaEn)}
              </div>
            </div>

            <div className="px-5 py-4 flex flex-col gap-4">
              <div>
                <p className="text-[12.5px] font-semibold mb-2">¿Contestó?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setContesto(true)}
                    className="flex-1 rounded-xl py-2.5 text-[13.5px] font-bold"
                    style={
                      contesto === true
                        ? { background: VERDE, color: "#fff" }
                        : { background: "var(--page)", color: GRIS_2, border: "1px solid var(--gridline)" }
                    }
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => enviar({ contesto: false, nota })}
                    disabled={guardando}
                    className="flex-1 rounded-xl py-2.5 text-[13.5px] font-bold disabled:opacity-50"
                    style={{ background: "var(--page)", color: GRIS_2, border: "1px solid var(--gridline)" }}
                  >
                    No contestó
                  </button>
                </div>
              </div>

              {contesto === true && (
                <>
                  <div>
                    <p className="text-[12.5px] font-semibold mb-2">¿En qué quedaron?</p>
                    <div className="flex flex-col gap-1.5">
                      {RESULTADOS.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setResultado(r.id)}
                          className="text-left rounded-xl px-3 py-2.5 text-[13.5px]"
                          style={
                            resultado === r.id
                              ? { background: AZUL, color: "#fff", fontWeight: 700 }
                              : { background: "var(--page)", border: "1px solid var(--gridline)" }
                          }
                        >
                          {r.texto}
                        </button>
                      ))}
                    </div>
                  </div>

                  {pideFecha && (
                    <div>
                      <p className="text-[12.5px] font-semibold mb-1.5">¿Cuándo?</p>
                      <input
                        type="datetime-local"
                        value={cuando}
                        onChange={(e) => setCuando(e.target.value)}
                        className="w-full rounded-xl border border-gridline bg-page px-3 py-2.5 text-[13.5px] outline-none"
                      />
                      <p className="text-[11px] mt-1" style={{ color: GRIS_2 }}>
                        Esto es lo que te va a recordar mañana.
                      </p>
                    </div>
                  )}

                  <textarea
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    rows={2}
                    placeholder="Nota (opcional)"
                    className="w-full rounded-xl border border-gridline bg-page px-3 py-2.5 text-[13.5px] outline-none resize-none"
                  />
                </>
              )}

              {error && <p className="text-[12.5px] text-series2">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={() => setAbierto(false)}
                  disabled={guardando}
                  className="rounded-full px-4 py-2.5 text-[13px] border border-gridline disabled:opacity-50"
                  style={{ color: GRIS_2 }}
                >
                  Ahora no
                </button>
                {contesto === true && (
                  <button
                    onClick={() =>
                      enviar({
                        contesto: true,
                        resultado,
                        promesaEn: pideFecha && cuando ? new Date(cuando).toISOString() : null,
                        nota,
                      })
                    }
                    disabled={guardando || !resultado}
                    className="flex-1 rounded-full px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
                    style={{ background: AZUL }}
                  >
                    {guardando ? "Guardando…" : "Guardar"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
