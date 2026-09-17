"use client";

import { useCallback, useEffect, useState } from "react";
import { RESULTADOS, leerCuando, metaResultado, opcionCuando, vuelveALlamar } from "@/lib/cuando";

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

/** Lo que entiende un <input type="datetime-local">: «2026-09-18T09:00». */
function paraElCampo(d: Date): string {
  const dd = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}T${dd(d.getHours())}:${dd(
    d.getMinutes()
  )}`;
}

/** Correr el campo desde ahora, para los atajos de una sola línea. */
function desdeAhora(horas: number): string {
  return paraElCampo(new Date(Date.now() + horas * 3600e3));
}

/** Un día adelante a una hora redonda. */
function aLasDe(diasAdelante: number, hora: number): string {
  const d = new Date(Date.now() + diasAdelante * 864e5);
  d.setHours(hora, 0, 0, 0);
  return paraElCampo(d);
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
  exigeResultado = true,
}: {
  titulo: string;
  subtitulo: string;
  /**
   * Reportar una llamada sin decir cómo salió no tiene sentido. Pero agendar
   * una sí: el cliente dijo «llamame el viernes a las 10» y no hubo llamada
   * que reportar. Ahí el resultado sobra y exigirlo obliga a inventar uno.
   */
  exigeResultado?: boolean;
  /** Devuelve el error, o null si salió bien. */
  guardar: (datos: {
    resultado: string | null;
    nota: string;
    proximaEn: string | null;
  }) => Promise<string | null>;
  cerrar: () => void;
}) {
  const [resultado, setResultado] = useState<string | null>(null);
  // El campo arranca en mañana a las 9, no en blanco: en el celular un campo
  // de fecha vacío obliga a poner año, mes, día y hora a mano.
  const [fechaSuelta, setFechaSuelta] = useState(() => {
    const manana = new Date(Date.now() + 864e5);
    manana.setHours(9, 0, 0, 0);
    return paraElCampo(manana);
  });
  const [sinProxima, setSinProxima] = useState(false);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Elegir el resultado mueve el campo de la fecha, no lo reemplaza.
   *
   * Los botones de horas fijas se fueron: obligaban a que el caso del agente
   * cayera en uno de los siete que había, y los casos reales no caen —«el
   * viernes cuando cobre», «el martes a las 6:30»—. Lo que sobrevive de esa
   * idea es el atajo bueno: tocar «no contestó» adelanta el campo tres horas
   * solo, y si el cliente dijo otra cosa se corrige ahí mismo.
   */
  const elegirResultadoConFecha = (id: string) => {
    setResultado(id);
    const meta = metaResultado(id);
    if (!meta) return;
    if (meta.cuando === "nunca") {
      setSinProxima(true);
      return;
    }
    setSinProxima(false);
    const iso = opcionCuando(meta.cuando)?.calcular();
    if (iso) setFechaSuelta(paraElCampo(new Date(iso)));
  };

  const proximaEn = (): string | null =>
    sinProxima || !fechaSuelta ? null : new Date(fechaSuelta).toISOString();

  // Con resultado se puede guardar sin fecha («no le interesa»). Sin resultado
  // —cuando solo se está agendando— hace falta la fecha, que es todo el punto.
  const listo = exigeResultado
    ? resultado !== null && (sinProxima || fechaSuelta !== "")
    : (resultado !== null && (sinProxima || fechaSuelta !== "")) || fechaSuelta !== "";

  function enviar() {
    if (exigeResultado && !resultado) return;
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
                    onClick={() => elegirResultadoConFecha(r.id)}
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

          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[.15em] mb-2" style={{ color: GRIS_2 }}>
              ¿Cuándo lo llamás?
            </p>
            <input
              type="datetime-local"
              value={fechaSuelta}
              disabled={sinProxima}
              onChange={(e) => setFechaSuelta(e.target.value)}
              className="w-full rounded-xl border border-gridline bg-page px-3 py-2.5 text-[14px] outline-none disabled:opacity-40"
            />
            {/* Atajos, no reemplazos: escriben en el campo de arriba y se
                pueden corregir. Los botones de horas fijas obligaban a que el
                caso cayera en uno de siete y los casos reales no caen. */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {[
                { t: "en 3 horas", v: () => desdeAhora(3) },
                { t: "mañana 8:00", v: () => aLasDe(1, 8) },
                { t: "mañana 2:00 p. m.", v: () => aLasDe(1, 14) },
              ].map((a) => (
                <button
                  key={a.t}
                  onClick={() => {
                    setSinProxima(false);
                    setFechaSuelta(a.v());
                  }}
                  className="text-[11.5px] underline underline-offset-2 hover:opacity-70"
                  style={{ color: AZUL }}
                >
                  {a.t}
                </button>
              ))}
              <button
                onClick={() => setSinProxima((v) => !v)}
                className="text-[11.5px] underline underline-offset-2 hover:opacity-70 ml-auto"
                style={{ color: sinProxima ? ROJO : GRIS_2 }}
              >
                {sinProxima ? "↩ sí lo llamo" : "no lo llamo más"}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[12.5px]" style={{ color: ROJO }}>
              {error}
            </p>
          )}

          {/* Lo que va a quedar, escrito como se lee. Es la última mirada antes
              de guardar y evita la tarea puesta en el día que no era. */}
          <p className="text-[12.5px] border-t border-gridline pt-3" style={{ color: GRIS_2 }}>
            Queda:{" "}
            {resultado && (
              <b style={{ color: "var(--foreground)" }}>{metaResultado(resultado)?.texto}</b>
            )}
            {sinProxima ? (
              <>{resultado ? " · " : ""}no lo llamás más</>
            ) : (
              <>
                {resultado ? " · " : ""}lo llamás{" "}
                <b style={{ color: "var(--foreground)" }}>{leerCuando(proximaEn())}</b>
              </>
            )}
          </p>

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
    async (datos: { resultado: string | null; nota: string; proximaEn: string | null }) => {
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
 * Reportar en una línea, adentro de la fila.
 *
 * Reemplaza a la hoja que se abría encima de todo. La hoja pedía lo mismo pero
 * tapaba la pantalla, y el agente que está bajando por su lista de veinte
 * llamadas no quiere abrir y cerrar una ventana veinte veces: quiere que la
 * fila se agrande, escribir y seguir.
 *
 * Es un solo renglón: qué pasó, la observación, cuándo vuelve a llamar. Si la
 * llamada salió desde el panel —del celular o del CRM— se reporta contra ella
 * y queda con su hora y su grabación. Si no salió de acá —el cliente llamó él,
 * o escribió al WhatsApp personal— se guarda igual como registro del día. Para
 * el agente es el mismo renglón; la diferencia la resuelve el panel.
 */
export function ReportarInline({
  contactId,
  nombre,
  telefono,
  onListo,
}: {
  contactId: string;
  nombre?: string | null;
  telefono?: string | null;
  onListo?: () => void;
}) {
  const pendiente = usePendiente(contactId);
  const [abierto, setAbierto] = useState(false);
  const [resultado, setResultado] = useState("");
  const [nota, setNota] = useState("");
  const [cuando, setCuando] = useState(() => {
    const d = new Date(Date.now() + 864e5);
    d.setHours(9, 0, 0, 0);
    return paraElCampo(d);
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);

  // Al elegir el resultado se corre la fecha sola: «no contestó» son tres
  // horas, «va a depositar» es mañana a las 8. De ahí se corrige escribiendo.
  function elegir(id: string) {
    setResultado(id);
    const meta = metaResultado(id);
    const iso = meta && meta.cuando !== "nunca" ? opcionCuando(meta.cuando)?.calcular() : null;
    if (iso) setCuando(paraElCampo(new Date(iso)));
  }

  function guardar() {
    if (!resultado) {
      setError("Elegí qué pasó.");
      return;
    }
    setGuardando(true);
    setError(null);
    const proximaEn = vuelveALlamar(resultado) && cuando ? new Date(cuando).toISOString() : null;

    const peticion = pendiente
      ? fetch(`/api/llamadas/${pendiente.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultado, nota, proximaEn }),
        })
      : fetch(`/api/acciones/${encodeURIComponent(contactId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "llame",
            resultado,
            detalle: nota.trim() || metaResultado(resultado)?.texto || null,
            nombre,
            telefono,
            siguiente: proximaEn
              ? { tipo: "llame", cuando: proximaEn, detalle: nota.trim() || null }
              : null,
          }),
        });

    peticion
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo guardar");
        if (pendiente) sacarDeCache(contactId);
        setListo(proximaEn);
        setAbierto(false);
        onListo?.();
      })
      .catch((e) => setError(e.message))
      .finally(() => setGuardando(false));
  }

  if (listo !== null) {
    return (
      <span className="text-[11.5px] font-semibold" style={{ color: VERDE }}>
        ✓ guardado{listo ? ` · lo llamás ${leerCuando(listo)}` : ""}
      </span>
    );
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-full px-2.5 py-[5px] text-[11.5px] font-bold whitespace-nowrap"
        style={
          pendiente
            ? { background: AMBAR, color: "#fff" }
            : { background: AZUL_CLARO, color: AZUL, border: "1px solid rgba(23,69,127,.18)" }
        }
      >
        {pendiente ? `📞 ${hora(pendiente.llamadaEn)} — ¿qué pasó?` : "✎ Reportar"}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 w-full basis-full">
      <select
        value={resultado}
        onChange={(e) => elegir(e.target.value)}
        className="rounded-lg border border-gridline bg-surface px-2 py-1.5 text-[12.5px] outline-none"
      >
        <option value="">¿Qué pasó?</option>
        {RESULTADOS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.texto}
          </option>
        ))}
      </select>

      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Observación"
        className="flex-1 min-w-[150px] rounded-lg border border-gridline bg-page px-2.5 py-1.5 text-[12.5px] outline-none focus:bg-surface"
      />

      {vuelveALlamar(resultado || null) && (
        <label className="flex items-center gap-1.5 text-[11.5px]" style={{ color: GRIS_2 }}>
          volver a llamar
          <input
            type="datetime-local"
            value={cuando}
            onChange={(e) => setCuando(e.target.value)}
            className="rounded-lg border border-gridline bg-surface px-2 py-1.5 text-[12.5px] outline-none"
          />
        </label>
      )}

      <button
        onClick={guardar}
        disabled={guardando}
        className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
        style={{ background: VERDE }}
      >
        {guardando ? "Guardando…" : "Guardar"}
      </button>
      <button
        onClick={() => setAbierto(false)}
        className="text-[11.5px]"
        style={{ color: GRIS_2 }}
      >
        Cerrar
      </button>

      {error && (
        <span className="text-[11.5px] w-full" style={{ color: ROJO }}>
          {error}
        </span>
      )}
    </span>
  );
}
