"use client";

import { useCallback, useEffect, useState } from "react";
import { EditarNombre } from "@/components/EditarNombre";
import { formatearTelefono } from "@/components/ContactoRapido";
import type { Interaccion, LeadInteraccion, Turno } from "@/lib/interaccion";
import type { Hito } from "@/lib/hitos";

const AZUL = "#17457F";
const AZUL_CLARO = "#EEF3FA";
// El celeste que ya usa el resto del tablero para las franjas de encabezado.
const CELESTE = "#EAF1FA";
const ROJO = "#C0392B";
const ROJO_SUAVE = "#FDF2F0";
const AMBAR = "#B5701F";
const AMBAR_SUAVE = "#FDF6EB";
const VERDE = "#157F52";
const VERDE_SUAVE = "#EEF7F2";
const GRIS = "#9A998F";
const GRIS_2 = "#5E5C56";

// Un azul más claro que el del encabezado: sobre el azul oscuro, el mismo
// tono desaparecería.
const AZUL_BOTON = "#2A6FB8";

const CLAVE_LISTA = "op_interaccion_abierta";

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

function hoyBogota(): string {
  return new Date(Date.now() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Verde hasta 5 minutos, ámbar hasta una hora, rojo de ahí en adelante. */
function tono(min: number | null | undefined): { color: string; fondo: string } {
  if (min == null) return { color: GRIS_2, fondo: "#F3F2ED" };
  if (min <= 5) return { color: VERDE, fondo: VERDE_SUAVE };
  if (min <= 60) return { color: AMBAR, fondo: AMBAR_SUAVE };
  return { color: ROJO, fondo: ROJO_SUAVE };
}

// "1 h 22 min" se entiende de un vistazo; "82 min" hay que dividirlo.
function duracion(min: number | null | undefined): string {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

// Zona fija: sin esto, un agente que abra el tablero desde otro país vería
// horas distintas a las que ve la dirección, y ninguna sería la del cliente.
function hora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

// «10 sept» debajo de la hora. Sin esto, «10:05 a.m.» de un lead que entró
// anteayer se lee como si fuera de hoy, que es justo el error que hace perder
// gente: se ve una espera de un minuto y en realidad pasaron dos días.
function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    timeZone: "America/Bogota",
  });
}

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  });
}

/** El día calendario en Bogotá, para saber cuándo cambia dentro del hilo. */
function diaDe(iso: string): string {
  return new Date(new Date(iso).getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const t = partes.map((p) => p[0]).join("");
  return (/\p{L}/u.test(t) ? t : [...nombre.trim()][0] ?? "?").toUpperCase();
}

function Inicial({ nombre, tamano = 40 }: { nombre: string; tamano?: number }) {
  return (
    <span
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{ width: tamano, height: tamano, fontSize: tamano * 0.31, background: "#F1F0EA", color: GRIS_2 }}
      aria-hidden
    >
      {iniciales(nombre)}
    </span>
  );
}

/**
 * Salto a la ficha en GHL.
 *
 * Lo que se ve acá es una foto del momento en que se leyó la conversación. Si
 * el agente está respondiendo ahora mismo, el CRM lo muestra y este tablero
 * no, hasta el próximo Actualizar. El enlace evita que alguien tome una
 * decisión sobre un lead mirando datos de hace cinco minutos.
 */
function AbrirCrm({ url, texto = false }: { url: string; texto?: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Ver la conversación en el CRM"
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold hover:opacity-80 ${
        texto ? "px-3.5 py-1.5 text-[12.5px]" : "px-2.5 py-1.5 text-[11.5px]"
      }`}
      style={{ background: CELESTE, color: AZUL, border: "1px solid rgba(23,69,127,.18)" }}
    >
      <span aria-hidden>↗</span>
      {texto ? "Ver en el CRM" : "CRM"}
    </a>
  );
}

/** Onda de audio: deja claro que hubo respuesta aunque no se pueda leer. */
function Onda() {
  return (
    <span className="inline-flex items-center gap-[2px] h-4" aria-hidden>
      {Array.from({ length: 14 }, (_, i) => (
        <i
          key={i}
          className="w-[2px] rounded-sm bg-current opacity-75"
          style={{ height: 4 + Math.abs(Math.sin((i + 1) * 1.1)) * 11 }}
        />
      ))}
    </span>
  );
}

/**
 * Un hito: lo que pasó fuera del hilo, puesto en el hilo.
 *
 * Va centrado y con otra forma que los mensajes a propósito. No es algo que
 * alguien dijo —es algo que el cliente hizo, o que el agente registró— y
 * confundir las dos cosas sería peor que no mostrarlo.
 */
function MarcaHito({ hito }: { hito: Hito }) {
  const malo = /NO bajó/.test(hito.texto);
  const color = malo ? ROJO : hito.tipo === "llamada" ? AZUL : VERDE;
  const fondo = malo ? ROJO_SUAVE : hito.tipo === "llamada" ? CELESTE : VERDE_SUAVE;

  return (
    <div className="flex justify-center my-3">
      <span
        className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] max-w-full"
        style={{ background: fondo, color }}
      >
        <span aria-hidden>{hito.tipo === "llamada" ? "📞" : malo ? "⚠️" : "✓"}</span>
        <b className="font-bold">{hito.texto}</b>
        {hito.detalle && <span className="opacity-80 truncate">· {hito.detalle}</span>}
        <span className="tabular-nums opacity-70">{hora(hito.hora)}</span>
      </span>
    </div>
  );
}

function Corte({ min, texto }: { min: number | null; texto: string }) {
  const t = tono(min);
  return (
    <div className="flex items-center gap-3 my-4">
      <i className="h-px flex-1" style={{ background: t.color, opacity: 0.28 }} />
      <span
        className="text-[11.5px] font-bold rounded-full px-3 py-1 whitespace-nowrap"
        style={{ background: t.fondo, color: t.color }}
      >
        ⏱ {texto}
      </span>
      <i className="h-px flex-1" style={{ background: t.color, opacity: 0.28 }} />
    </div>
  );
}

const ES_IMAGEN = /\.(jpe?g|png|gif|webp)(\?|$)/i;

/**
 * Lo que viene colgado del mensaje cuando no hay texto.
 *
 * El flujo manda videos e imágenes además de audios, y todo eso se mostraba
 * como «nota de voz» que no se podía leer. Los audios pasan por el conversor;
 * las imágenes se ven; los videos quedan como enlace, que pesan diez megas y
 * cargarlos dentro del hilo lo volvería inusable.
 */
function Adjuntos({ turno }: { turno: Turno }) {
  if (!turno.audio && turno.adjuntos.length === 0) {
    return (
      <span className="inline-flex flex-col gap-1">
        <span className="inline-flex items-center gap-2 text-[13.5px]">
          <Onda /> nota de voz
        </span>
        <span className="text-[11px] italic opacity-70">GHL no devolvió el archivo</span>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-2">
      {turno.audio && (
        <>
          <span className="inline-flex items-center gap-2 text-[12.5px] opacity-80">
            <Onda /> nota de voz
          </span>
          <audio
            controls
            preload="none"
            src={`/api/audio?u=${encodeURIComponent(turno.audio)}`}
            className="max-w-[260px] h-9"
          />
        </>
      )}
      {turno.adjuntos.map((a) =>
        ES_IMAGEN.test(a) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={a} src={a} alt="Imagen enviada" className="max-w-[240px] rounded-xl" loading="lazy" />
        ) : (
          <a
            key={a}
            href={a}
            target="_blank"
            rel="noreferrer"
            className="text-[12.5px] underline opacity-90"
          >
            📎 abrir archivo
          </a>
        )
      )}
    </span>
  );
}

function Mensaje({ turno, agente }: { turno: Turno; agente: string }) {
  const lado =
    turno.quien === "cliente" ? "justify-start" : turno.quien === "agente" ? "justify-end" : "justify-center";
  const quien =
    turno.quien === "cliente" ? "Cliente" : turno.quien === "flujo" ? "Mensaje automático" : agente;

  const estilo: React.CSSProperties =
    turno.quien === "agente"
      ? { background: AZUL, color: "#fff", borderBottomRightRadius: 5 }
      : turno.quien === "cliente"
        ? { background: "#EEEDE7", borderBottomLeftRadius: 5 }
        : { background: "transparent", border: "1px dashed #DEDCD4", color: GRIS, borderRadius: 12 };

  return (
    <div className={`flex ${lado} mb-3`}>
      <div className="max-w-[88%] sm:max-w-[520px]">
        <div
          className={`rounded-2xl px-[15px] py-[11px] text-[14px] leading-relaxed ${
            turno.quien === "flujo" ? "text-center text-[12.5px]" : ""
          }`}
          style={estilo}
        >
          {turno.texto ?? <Adjuntos turno={turno} />}
        </div>
        <div
          className={`text-[11px] mt-1.5 flex gap-2 ${
            turno.quien === "agente" ? "justify-end" : turno.quien === "flujo" ? "justify-center" : ""
          }`}
          style={{ color: GRIS }}
        >
          <span className="tabular-nums">{hora(turno.hora)}</span> · {quien}
        </div>
      </div>
    </div>
  );
}

// Los tres pasos que cambian la lectura de una espera: si el cliente ya bajó,
// ya se registró o ya depositó, «2 horas sin responder» significa otra cosa.
const AVANCES = ["Bajó a WhatsApp Business", "Se registró en el broker", "Depositó (FTD)"];

function ultimoAvance(hitos: Hito[]): Hito | null {
  const avances = hitos.filter((h) => h.exacto && AVANCES.includes(h.texto));
  return avances.length > 0 ? avances[avances.length - 1] : null;
}

type Evento =
  | { tipo: "mensaje"; hora: string; turno: Turno }
  | { tipo: "hito"; hora: string; hito: Hito };

/**
 * Los mensajes y los hitos en una sola línea de tiempo.
 *
 * Es el punto de todo esto: leídos por separado, «2 horas sin respuesta» y
 * «bajó a WhatsApp 11:20» parecen contradecirse; en la misma columna se ve que
 * la conversación no murió, se mudó.
 */
function mezclar(turnos: Turno[], hitos: Hito[]): Evento[] {
  const eventos: Evento[] = turnos.map((t) => ({ tipo: "mensaje", hora: t.hora, turno: t }));
  for (const h of hitos) {
    if (h.exacto) eventos.push({ tipo: "hito", hora: h.hora, hito: h });
  }
  return eventos.sort((a, b) => a.hora.localeCompare(b.hora));
}

function Conversacion({
  lead,
  onCerrar,
  onRenombrado,
}: {
  lead: LeadInteraccion;
  onCerrar: () => void;
  onRenombrado: (nombre: string) => void;
}) {
  return (
    <section className="bg-surface border border-gridline rounded-[22px] overflow-hidden mb-4">
      <div
        className="flex items-center gap-3.5 px-5 sm:px-7 py-5 border-b border-gridline flex-wrap"
        style={{ background: CELESTE }}
      >
        <Inicial nombre={lead.nombre} tamano={44} />
        <div>
          <div className="text-[17px] font-semibold tracking-[-0.02em] flex items-center gap-2">
            {lead.nombre}
            <EditarNombre contactId={lead.id} nombre={lead.nombre} onCambiado={onRenombrado} />
          </div>
          <div className="text-[12.5px]" style={{ color: GRIS }}>
            {lead.agente} · entró el {fechaCorta(lead.creado)}
            {lead.telefono && <> · {lead.telefono}</>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <AbrirCrm url={lead.crmUrl} texto />
          <button
            onClick={onCerrar}
            className="text-[12.5px] rounded-full px-3.5 py-1.5 bg-surface hover:opacity-80"
            style={{ color: GRIS_2, border: "1px solid rgba(23,69,127,.18)" }}
          >
            Cerrar ✕
          </button>
        </div>
      </div>

      <div className="flex flex-wrap border-b border-gridline">
        {[
          { r: "Escribió", v: hora(lead.escribio), d: fechaCorta(lead.escribio), c: undefined },
          {
            r: "Respondió",
            v: lead.respondio ? hora(lead.respondio) : "sin responder",
            d: fechaCorta(lead.respondio),
            c: lead.respondio ? undefined : ROJO,
          },
          { r: "Esperó", v: duracion(lead.esperaMin), d: "", c: tono(lead.esperaMin).color },
          { r: "Notas de voz", v: String(lead.notasDeVoz), d: "", c: undefined },
        ].map((x) => (
          <div key={x.r} className="flex-1 min-w-[150px] px-5 sm:px-7 py-3.5 border-r border-gridline last:border-r-0">
            <span className="block text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: GRIS }}>
              {x.r}
            </span>
            <div className="text-[17px] font-semibold tracking-[-0.02em] tabular-nums mt-1" style={{ color: x.c }}>
              {x.v}
            </div>
            {x.d && (
              <div className="text-[11px] mt-0.5" style={{ color: GRIS }}>
                {x.d}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="px-5 sm:px-7 py-6" style={{ background: "#FCFCFA" }}>
        {/* Los hitos que ya existían cuando el sondeo empezó a registrar horas
            no se pueden ubicar en la línea de tiempo: su hora es apenas una
            cota superior. Van acá arriba, sin hora, en vez de inventarles un
            lugar en el hilo. */}
        {lead.hitos.some((h) => !h.exacto) && (
          <p className="text-[11.5px] text-center mb-4" style={{ color: GRIS }}>
            Ya traía estas marcas antes de que empezáramos a registrar horas:{" "}
            {lead.hitos
              .filter((h) => !h.exacto)
              .map((h) => h.texto)
              .join(" · ")}
          </p>
        )}

        {mezclar(lead.turnos, lead.hitos).map((e, i, todos) => (
          <div key={i}>
            {/* Cambio de día. Una conversación puede empezar el 9 y seguir el
                11: sin esta línea, las horas sueltas hacen creer que todo
                pasó la misma mañana. */}
            {(i === 0 || diaDe(todos[i - 1].hora) !== diaDe(e.hora)) && (
              <div className="flex items-center gap-3 my-5">
                <i className="h-px flex-1" style={{ background: "#DEDCD4" }} />
                <span
                  className="text-[11.5px] font-bold rounded-full px-3 py-1 whitespace-nowrap first-letter:uppercase"
                  style={{ background: CELESTE, color: AZUL }}
                >
                  {fechaLarga(e.hora)}
                </span>
                <i className="h-px flex-1" style={{ background: "#DEDCD4" }} />
              </div>
            )}
            {e.tipo === "hito" ? (
              <MarcaHito hito={e.hito} />
            ) : (
              <>
                {/* El hueco de espera corta la conversación en dos: se ve, no se lee. */}
                {e.turno.quien === "agente" && e.turno.esperaMin != null && (
                  <Corte min={e.turno.esperaMin} texto={`${duracion(e.turno.esperaMin)} sin respuesta`} />
                )}
                <Mensaje turno={e.turno} agente={lead.agente} />
              </>
            )}
          </div>
        ))}
        {lead.pendiente && (
          <Corte min={lead.esperaMin} texto={`esperando hace ${duracion(lead.esperaMin)} — sin respuesta`} />
        )}
      </div>
    </section>
  );
}

export function InteraccionLeads({ esAdmin, agentes }: { esAdmin: boolean; agentes: { id: string; nombre: string }[] }) {
  const [datos, setDatos] = useState<Interaccion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agente, setAgente] = useState("todos");
  // El día que se está mirando. `fecha` es lo que dice el selector; `dia` es
  // lo que ya se cargó, y es null mientras se mira hoy.
  const [fecha, setFecha] = useState(hoyBogota);
  const [dia, setDia] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  // La lista arranca plegada: arriba quedan los números, y el detalle se abre
  // cuando hace falta. La elección se recuerda para no tener que repetirla
  // cada vez que se entra al tablero.
  const [lista, setLista] = useState(false);

  useEffect(() => {
    try {
      setLista(localStorage.getItem(CLAVE_LISTA) === "1");
    } catch {
      /* modo privado */
    }
  }, []);

  function alternarLista() {
    setLista((v) => {
      const nuevo = !v;
      try {
        localStorage.setItem(CLAVE_LISTA, nuevo ? "1" : "0");
      } catch {
        /* modo privado */
      }
      return nuevo;
    });
  }

  const cargar = useCallback((quien: string, cuando: string | null) => {
    setCargando(true);
    setError(null);
    fetch(
      `/api/interaccion?agente=${encodeURIComponent(quien)}` +
        (cuando ? `&dia=${encodeURIComponent(cuando)}` : "")
    )
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Error al leer las conversaciones");
        return r.json();
      })
      .then((d: Interaccion) => {
        setDatos(d);
        setAbierto(null);
        setDia(cuando);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  // El nombre corregido se refleja en la lista sin volver a pedirla a GHL.
  const renombrado = useCallback((contactId: string, nombre: string) => {
    setDatos((prev) =>
      prev
        ? { ...prev, leads: prev.leads.map((l) => (l.id === contactId ? { ...l, nombre } : l)) }
        : prev
    );
  }, []);

  useEffect(() => {
    cargar(agente, null);
  }, [agente, cargar]);

  const enTabla = datos?.leads ?? [];
  const lead = enTabla.find((l) => l.id === abierto) ?? null;
  const r = datos?.resumen;

  return (
    <section className="mb-8">
      <div className="bg-surface border border-gridline rounded-[22px] overflow-hidden mb-4">
        <div
          className="flex items-center gap-x-3 gap-y-1.5 flex-wrap px-5 sm:px-7 py-2"
          style={{ background: AZUL, color: "#fff" }}
        >
          {/* Título y fecha en el mismo renglón: en dos, la franja medía el
              doble de lo que el contenido necesita. */}
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] leading-tight">
            Interacción leads
            <span className="font-normal text-[12px] ml-2 first-letter:uppercase" style={{ color: "rgba(255,255,255,.6)" }}>
              {(dia ? new Date(`${dia}T12:00:00-05:00`) : new Date()).toLocaleDateString("es-CO", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "America/Bogota",
              })}
            </span>
          </h2>
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            {esAdmin && (
              <select
                value={agente}
                onChange={(e) => setAgente(e.target.value)}
                className="rounded-full px-3 py-1 text-[11.5px] outline-none"
                style={{ background: "rgba(255,255,255,.14)", color: "#fff", border: "1px solid rgba(255,255,255,.28)" }}
              >
                <option value="todos" style={{ color: GRIS_2 }}>
                  Toda la oficina
                </option>
                {agentes.map((a) => (
                  <option key={a.id} value={a.id} style={{ color: GRIS_2 }}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => cargar(agente, dia)}
              disabled={cargando}
              className="rounded-full px-3 py-1 text-[11.5px] disabled:opacity-50 hover:opacity-80"
              style={{ background: "rgba(255,255,255,.14)", color: "#fff", border: "1px solid rgba(255,255,255,.28)" }}
            >
              {cargando ? "Leyendo…" : "↻ Actualizar"}
            </button>

            {/* Un día puntual. En móvil el botón dice «Ver»: «Consultar» más
                el selector de fecha no caben en el mismo renglón. */}
            <input
              type="date"
              value={fecha}
              max={hoyBogota()}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-full px-2.5 py-1 text-[11.5px] outline-none"
              style={{ background: "rgba(255,255,255,.14)", color: "#fff", border: "1px solid rgba(255,255,255,.28)" }}
            />
            <button
              onClick={() => cargar(agente, fecha === hoyBogota() ? null : fecha)}
              disabled={cargando}
              className="rounded-full px-3 py-1 text-[11.5px] font-semibold text-white disabled:opacity-50 hover:opacity-90"
              style={{ background: AZUL_BOTON }}
            >
              <span className="sm:hidden">Ver</span>
              <span className="hidden sm:inline">Consultar</span>
            </button>
          </div>
        </div>

        {/* Cuentas exactas. Un promedio de una hora, cuando alguien esperó
            cinco, esconde justo el caso que hay que ver. */}
        <div className="flex flex-wrap border-y border-gridline">
          {[
            { r: "Leads", v: r?.leads, n: "recibidos hoy" },
            { r: "Te escribieron", v: r?.escribieron, n: "levantaron la mano" },
            { r: "Esperaron +5 minutos", v: r?.masDe5Min, n: "sin ser atendidos", malo: true },
            { r: "Sin responder", v: r?.sinResponder, n: "ahora mismo", malo: true },
          ].map((k) => (
            <div key={k.r} className="flex-1 min-w-[152px] px-5 sm:px-7 py-4 border-r border-gridline last:border-r-0">
              <span className="block text-[10px] font-bold uppercase tracking-[.14em] mb-1.5" style={{ color: GRIS }}>
                {k.r}
              </span>
              <div
                className="text-[29px] font-bold tracking-[-0.035em] leading-none tabular-nums"
                style={{ color: k.malo && (k.v ?? 0) > 0 ? ROJO : undefined }}
              >
                {cargando && datos === null ? "—" : (k.v ?? 0)}
              </div>
              <div className="text-[11.5px] mt-1.5" style={{ color: GRIS }}>
                {k.n}
              </div>
            </div>
          ))}
        </div>

        {/* El botón lleva encima lo urgente: aunque la lista esté cerrada, se
            ve si hay alguien esperando sin respuesta. */}
        {enTabla.length > 0 && (
          <button
            onClick={alternarLista}
            aria-expanded={lista}
            className="w-full flex items-center gap-3 px-5 sm:px-7 py-2.5 hover:bg-page border-b border-gridline"
          >
            <span className="text-[12.5px] font-semibold">
              {lista ? "Ocultar conversaciones" : `Ver las ${enTabla.length} conversaciones`}
            </span>
            {!lista && (datos?.resumen.sinResponder ?? 0) > 0 && (
              <span
                className="text-[11px] font-bold rounded-full px-2.5 py-1"
                style={{ background: ROJO, color: "#fff" }}
              >
                {datos?.resumen.sinResponder} sin responder
              </span>
            )}
            <span className="ml-auto text-[13px]" style={{ color: GRIS }}>
              {lista ? "▲" : "▼"}
            </span>
          </button>
        )}

        {error && <p className="px-5 sm:px-7 py-5 text-[13px] text-series2">{error}</p>}
        {cargando && !datos && (
          <p className="px-5 sm:px-7 py-5 text-[13px]" style={{ color: GRIS }}>
            Leyendo las conversaciones de hoy…
          </p>
        )}

        {enTabla.length === 0 && !cargando && datos && (
          <p className="px-5 sm:px-7 py-5 text-[13px]" style={{ color: GRIS }}>
            Todavía no hay conversaciones ese día.
          </p>
        )}

        {enTabla.length > 0 && lista && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 880 }}>
              <thead>
                <tr style={{ background: CELESTE }}>
                  {["Nombre", "Mensaje lead", "Hora escribió", "Agente respondió", "Esperó", "Acciones"].map((c) => (
                    <th
                      key={c}
                      className="px-3 sm:px-4 py-2 text-[9.5px] font-bold uppercase tracking-[.12em] text-ink-secondary whitespace-nowrap"
                      style={{ textAlign: c === "Esperó" || c === "Acciones" ? "right" : "left" }}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enTabla.map((l) => {
                  const t = tono(l.esperaMin);
                  const sel = l.id === abierto;
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setAbierto(sel ? null : l.id)}
                      className="border-b border-gridline last:border-b-0 cursor-pointer hover:bg-page"
                      style={{ background: sel ? AZUL_CLARO : l.pendiente ? ROJO_SUAVE : undefined }}
                    >
                      <td className="px-3 sm:px-4 py-2" style={{ boxShadow: sel ? `inset 3px 0 0 ${AZUL}` : undefined }}>
                        <span className="flex items-center gap-2.5">
                          <Inicial nombre={l.nombre} tamano={28} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 text-[13px] font-semibold tracking-[-0.015em] whitespace-nowrap">
                              {l.nombre}
                              <EditarNombre
                                contactId={l.id}
                                nombre={l.nombre}
                                onCambiado={(n) => renombrado(l.id, n)}
                              />
                            </span>
                            {/* El teléfono al lado del agente: media base llega
                                del formulario con nombres como «.» o «mi guía»,
                                y sin el número esa fila no identifica a nadie. */}
                            <span className="block text-[10.5px] mt-px whitespace-nowrap" style={{ color: GRIS }}>
                              {l.agente}
                              {l.telefono && <> · {formatearTelefono(l.telefono)}</>}
                            </span>
                          </span>
                        </span>
                      </td>
                      {/* Una sola línea: un mensaje de tres renglones estira
                          la fila y descuadra toda la tabla. El texto completo
                          está a un clic, en la conversación. */}
                      <td
                        className="px-3 sm:px-4 py-2 text-[12.5px] truncate"
                        style={{ color: GRIS_2, maxWidth: 300 }}
                        title={l.mensaje}
                      >
                        {l.mensaje}
                      </td>
                      <td className="px-3 sm:px-4 py-2 text-[13.5px] font-semibold tabular-nums whitespace-nowrap">
                        {hora(l.escribio)}
                        <small className="block text-[10px] font-normal mt-px" style={{ color: GRIS }}>
                          {fechaCorta(l.escribio)} · el cliente
                        </small>
                      </td>
                      <td className="px-3 sm:px-4 py-2 text-[13.5px] font-semibold tabular-nums whitespace-nowrap">
                        {l.respondio ? (
                          <>
                            {hora(l.respondio)}
                            <small className="block text-[10px] font-normal mt-px" style={{ color: GRIS }}>
                              {fechaCorta(l.respondio)} · {l.agente.split(" ")[0]}
                            </small>
                          </>
                        ) : (
                          <span
                            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                            style={{ background: ROJO }}
                          >
                            SIN RESPONDER
                          </span>
                        )}
                      </td>
                      <td
                        className="px-3 sm:px-4 py-2 text-right text-[14px] font-bold tabular-nums whitespace-nowrap"
                        style={{ color: t.color }}
                      >
                        {duracion(l.esperaMin)}
                        {l.pendiente && (
                          <small className="block text-[10px] font-normal" style={{ color: GRIS }}>
                            y contando
                          </small>
                        )}
                        {/* Sin esto, la espera acusa a un agente que quizá no
                            tiene la culpa: el cliente ya se fue a su otro
                            WhatsApp y el hilo de GHL quedó muerto por eso. */}
                        {(() => {
                          const avance = ultimoAvance(l.hitos);
                          return avance ? (
                            <small
                              className="block text-[10px] font-bold mt-0.5 whitespace-nowrap"
                              style={{ color: VERDE }}
                            >
                              ✓ {avance.texto.replace("Bajó a WhatsApp Business", "bajó a WhatsApp")} {hora(avance.hora)}
                            </small>
                          ) : null;
                        })()}
                      </td>
                      <td className="px-3 sm:px-4 py-2 text-right whitespace-nowrap">
                        <AbrirCrm url={l.crmUrl} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {lista && (datos?.recortado || (datos?.noLeidas ?? 0) > 0) && (
          <p className="px-5 sm:px-7 py-3 text-[12px] border-t border-gridline" style={{ color: GRIS }}>
            {datos?.recortado && "Se revisaron las primeras 60 conversaciones del día. "}
            {(datos?.noLeidas ?? 0) > 0 &&
              `${datos!.noLeidas} conversaciones no se pudieron leer (GHL limitó las consultas). Probá Actualizar en un minuto.`}
          </p>
        )}
      </div>

      {lista && lead && (
        <Conversacion
          lead={lead}
          onCerrar={() => setAbierto(null)}
          onRenombrado={(n) => renombrado(lead.id, n)}
        />
      )}
    </section>
  );
}
