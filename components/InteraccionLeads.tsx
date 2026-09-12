"use client";

import { useCallback, useEffect, useState } from "react";
import type { Interaccion, LeadInteraccion, Turno } from "@/lib/interaccion";

const AZUL = "#17457F";
const AZUL_CLARO = "#EEF3FA";
const ROJO = "#C0392B";
const ROJO_SUAVE = "#FDF2F0";
const AMBAR = "#B5701F";
const AMBAR_SUAVE = "#FDF6EB";
const VERDE = "#157F52";
const VERDE_SUAVE = "#EEF7F2";
const GRIS = "#9A998F";
const GRIS_2 = "#5E5C56";

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
          {turno.texto ?? (
            <span className="inline-flex flex-col gap-1">
              <span className="inline-flex items-center gap-2 text-[13.5px]">
                <Onda /> nota de voz
              </span>
              <span className="text-[11px] italic opacity-70">no se puede leer desde acá</span>
            </span>
          )}
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

function Conversacion({ lead, onCerrar }: { lead: LeadInteraccion; onCerrar: () => void }) {
  return (
    <section className="bg-surface border border-gridline rounded-[22px] overflow-hidden mb-4">
      <div className="flex items-center gap-3.5 px-5 sm:px-7 py-5 border-b border-gridline flex-wrap">
        <Inicial nombre={lead.nombre} tamano={44} />
        <div>
          <div className="text-[17px] font-semibold tracking-[-0.02em]">{lead.nombre}</div>
          <div className="text-[12.5px]" style={{ color: GRIS }}>
            {lead.agente}
          </div>
        </div>
        <button
          onClick={onCerrar}
          className="ml-auto text-[12.5px] border border-gridline rounded-full px-3.5 py-1.5 hover:bg-page"
          style={{ color: GRIS_2 }}
        >
          Cerrar ✕
        </button>
      </div>

      <div className="flex flex-wrap border-b border-gridline">
        {[
          { r: "Escribió", v: hora(lead.escribio), c: undefined },
          { r: "Respondió", v: lead.respondio ? hora(lead.respondio) : "sin responder", c: lead.respondio ? undefined : ROJO },
          { r: "Esperó", v: duracion(lead.esperaMin), c: tono(lead.esperaMin).color },
          { r: "Notas de voz", v: String(lead.notasDeVoz), c: undefined },
        ].map((x) => (
          <div key={x.r} className="flex-1 min-w-[150px] px-5 sm:px-7 py-3.5 border-r border-gridline last:border-r-0">
            <span className="block text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: GRIS }}>
              {x.r}
            </span>
            <div className="text-[17px] font-semibold tracking-[-0.02em] tabular-nums mt-1" style={{ color: x.c }}>
              {x.v}
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 sm:px-7 py-6" style={{ background: "#FCFCFA" }}>
        {lead.turnos.map((t, i) => (
          <div key={i}>
            {/* El hueco de espera corta la conversación en dos: se ve, no se lee. */}
            {t.quien === "agente" && t.esperaMin != null && (
              <Corte min={t.esperaMin} texto={`${duracion(t.esperaMin)} sin respuesta`} />
            )}
            <Mensaje turno={t} agente={lead.agente} />
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
  const [abierto, setAbierto] = useState<string | null>(null);

  const cargar = useCallback((quien: string) => {
    setCargando(true);
    setError(null);
    fetch(`/api/interaccion?agente=${encodeURIComponent(quien)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Error al leer las conversaciones");
        return r.json();
      })
      .then((d: Interaccion) => {
        setDatos(d);
        setAbierto(d.leads[0]?.id ?? null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar(agente);
  }, [agente, cargar]);

  const lead = datos?.leads.find((l) => l.id === abierto) ?? null;
  const r = datos?.resumen;

  return (
    <section className="mb-8">
      <div className="bg-surface border border-gridline rounded-[22px] overflow-hidden mb-4">
        <div className="flex items-start gap-5 flex-wrap px-5 sm:px-7 pt-6 pb-5">
          <div>
            <h2 className="text-[19px] font-semibold tracking-[-0.02em]">Interacción leads</h2>
            <p className="text-[13px] mt-0.5 first-letter:uppercase" style={{ color: GRIS }}>
              {new Date().toLocaleDateString("es-CO", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "America/Bogota",
              })}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {esAdmin && (
              <select
                value={agente}
                onChange={(e) => setAgente(e.target.value)}
                className="border border-gridline rounded-full px-3.5 py-2 text-[12.5px] bg-surface outline-none"
                style={{ color: GRIS_2 }}
              >
                <option value="todos">Toda la oficina</option>
                {agentes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => cargar(agente)}
              disabled={cargando}
              className="border border-gridline rounded-full px-3.5 py-2 text-[12.5px] hover:bg-page disabled:opacity-50"
              style={{ color: GRIS_2 }}
            >
              {cargando ? "Leyendo…" : "↻ Actualizar"}
            </button>
          </div>
        </div>

        {/* Cuentas exactas. Un promedio de una hora, cuando alguien esperó
            cinco, esconde justo el caso que hay que ver. */}
        <div className="flex flex-wrap border-y border-gridline">
          {[
            { r: "Leads", v: r?.leads, n: "recibidos hoy" },
            { r: "Te escribieron", v: r?.escribieron, n: "levantaron la mano" },
            { r: "Esperaron +1 hora", v: r?.masDeUnaHora, n: "de los que escribieron", malo: true },
            { r: "Sin responder", v: r?.sinResponder, n: "ahora mismo", malo: true },
            { r: "Registros", v: r?.registros, n: `${r?.ftd ?? 0} depósitos`, malo: (r?.registros ?? 0) === 0 },
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

        {error && <p className="px-5 sm:px-7 py-5 text-[13px] text-series2">{error}</p>}
        {cargando && !datos && (
          <p className="px-5 sm:px-7 py-5 text-[13px]" style={{ color: GRIS }}>
            Leyendo las conversaciones de hoy…
          </p>
        )}

        {datos && datos.leads.length === 0 && !cargando && (
          <p className="px-5 sm:px-7 py-5 text-[13px]" style={{ color: GRIS }}>
            Todavía no hay conversaciones hoy.
          </p>
        )}

        {datos && datos.leads.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 860 }}>
              <thead>
                <tr style={{ background: AZUL }}>
                  {["Nombre", "Mensaje", "Escribió", "Respondió", "Esperó"].map((c) => (
                    <th
                      key={c}
                      className="px-4 sm:px-[18px] py-3 text-[10px] font-bold uppercase tracking-[.13em] text-white whitespace-nowrap"
                      style={{ textAlign: c === "Esperó" ? "right" : "left" }}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.leads.map((l) => {
                  const t = tono(l.esperaMin);
                  const sel = l.id === abierto;
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setAbierto(sel ? null : l.id)}
                      className="border-b border-gridline last:border-b-0 cursor-pointer hover:bg-page"
                      style={{ background: sel ? AZUL_CLARO : l.pendiente ? ROJO_SUAVE : undefined }}
                    >
                      <td className="px-4 sm:px-[18px] py-3.5" style={{ boxShadow: sel ? `inset 3px 0 0 ${AZUL}` : undefined }}>
                        <span className="flex items-center gap-3">
                          <Inicial nombre={l.nombre} />
                          <span className="min-w-0">
                            <span className="block text-[14.5px] font-semibold tracking-[-0.015em] whitespace-nowrap">
                              {l.nombre}
                            </span>
                            <span className="block text-[11.5px] mt-0.5 whitespace-nowrap" style={{ color: GRIS }}>
                              {l.agente}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-4 sm:px-[18px] py-3.5 text-[13.5px] leading-snug" style={{ color: GRIS_2, maxWidth: 340 }}>
                        {l.mensaje}
                      </td>
                      <td className="px-4 sm:px-[18px] py-3.5 text-[15px] font-semibold tabular-nums whitespace-nowrap">
                        {hora(l.escribio)}
                        <small className="block text-[10.5px] font-normal mt-0.5" style={{ color: GRIS }}>
                          el cliente
                        </small>
                      </td>
                      <td className="px-4 sm:px-[18px] py-3.5 text-[15px] font-semibold tabular-nums whitespace-nowrap">
                        {l.respondio ? (
                          <>
                            {hora(l.respondio)}
                            <small className="block text-[10.5px] font-normal mt-0.5" style={{ color: GRIS }}>
                              {l.agente.split(" ")[0]}
                            </small>
                          </>
                        ) : (
                          <span
                            className="inline-block rounded-full px-2.5 py-1 text-[10.5px] font-bold text-white"
                            style={{ background: ROJO }}
                          >
                            SIN RESPONDER
                          </span>
                        )}
                      </td>
                      <td
                        className="px-4 sm:px-[18px] py-3.5 text-right text-[16px] font-bold tabular-nums whitespace-nowrap"
                        style={{ color: t.color }}
                      >
                        {duracion(l.esperaMin)}
                        {l.pendiente && (
                          <small className="block text-[10.5px] font-normal" style={{ color: GRIS }}>
                            y contando
                          </small>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {datos?.recortado && (
          <p className="px-5 sm:px-7 py-3 text-[12px] border-t border-gridline" style={{ color: GRIS }}>
            Se revisaron las primeras 80 conversaciones del día.
          </p>
        )}
      </div>

      {lead && <Conversacion lead={lead} onCerrar={() => setAbierto(null)} />}
    </section>
  );
}
