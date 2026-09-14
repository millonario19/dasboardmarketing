"use client";

import { useCallback, useEffect, useState } from "react";
import { ESTADO_META } from "@/lib/leadStates";
import { BotonWhatsApp } from "@/components/ContactoRapido";
import { BotonLlamar, ReporteLlamada } from "@/components/Llamada";
import type { DiaDeSeguimiento, LeadDeSeguimiento, Promesa, Seguimiento as Datos } from "@/lib/seguimiento";

/**
 * El seguimiento de los días anteriores y la agenda de promesas.
 *
 * El trabajo de la mañana no es el mes: es a quién de ayer le quedó algo
 * pendiente, después antier, después hace tres días. Por eso son pestañas y no
 * una lista larga — obligan a cerrar un día antes de pasar al siguiente.
 */

const AZUL = "#17457F";
const CELESTE = "#EAF1FA";
const ROJO = "#C0392B";
const AMBAR = "#B5701F";
const GRIS = "#9A998F";

function hora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

const RESULTADO: Record<string, string> = {
  registro: "se registró",
  deposita: "va a depositar",
  volver: "volver a llamar",
  "no-interesa": "no le interesa",
};

function FilaLead({ lead }: { lead: LeadDeSeguimiento }) {
  const meta = ESTADO_META[lead.estado];
  return (
    <article className="flex items-center gap-2.5 px-4 sm:px-5 py-2 border-t border-gridline">
      <i className="w-1.5 h-8 rounded-full shrink-0" style={{ background: meta.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <b className="text-[13.5px] font-semibold tracking-[-0.015em]">{lead.nombre}</b>
          <span
            className="text-[10px] font-bold rounded-full px-2 py-[1px]"
            style={{ background: `color-mix(in srgb, ${meta.color} 16%, var(--surface-1))`, color: meta.color }}
          >
            {meta.nombre}
          </span>
        </div>
        <p className="text-[11.5px] mt-0.5 truncate" style={{ color: GRIS }}>
          {lead.acciones.length > 0 ? lead.acciones.join(" · ") : "No hizo nada todavía"}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <ReporteLlamada contactId={lead.id} />
        <BotonLlamar telefono={lead.telefono} nombre={lead.nombre} contactId={lead.id} tamano={26} />
        <BotonWhatsApp telefono={lead.telefono} nombre={lead.nombre} tamano={26} />
      </div>
    </article>
  );
}

function Agenda({ promesas }: { promesas: Promesa[] }) {
  if (promesas.length === 0) return null;
  const vencidas = promesas.filter((p) => p.vencida);

  return (
    <section className="rounded-[22px] overflow-hidden bg-surface border border-gridline mb-5">
      <div
        className="flex items-center gap-x-3 gap-y-1 flex-wrap px-4 sm:px-5 py-2.5"
        style={{ background: AMBAR, color: "#fff" }}
      >
        <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Prometieron y falta cumplir</h2>
        {vencidas.length > 0 && (
          <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: ROJO }}>
            {vencidas.length} ya vencidas
          </span>
        )}
      </div>

      {promesas.map((p) => (
        <article
          key={p.llamadaId}
          className="flex items-center gap-2.5 px-4 sm:px-5 py-2 border-t border-gridline"
          style={{ background: p.vencida ? "#FDF2F0" : undefined }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <b className="text-[13.5px] font-semibold">{p.nombre || "Sin nombre"}</b>
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: p.vencida ? ROJO : AMBAR }}
              >
                {p.vencida ? "⏰ " : ""}
                {hora(p.cuando)}
              </span>
            </div>
            <p className="text-[11.5px] mt-0.5 truncate" style={{ color: GRIS }}>
              {RESULTADO[p.resultado ?? ""] ?? "quedó en algo"}
              {p.nota && ` · «${p.nota}»`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <ReporteLlamada contactId={p.contactId} />
            <BotonLlamar telefono={p.telefono} nombre={p.nombre ?? ""} contactId={p.contactId} tamano={26} />
            <BotonWhatsApp telefono={p.telefono} nombre={p.nombre ?? ""} tamano={26} />
          </div>
        </article>
      ))}
    </section>
  );
}

export function Seguimiento() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dia, setDia] = useState(0);
  // Si nadie lo tocó todavía, se abre en el primer día que tenga algo: caer en
  // un «Ayer» vacío hace pensar que el módulo está roto, y el domingo pasado
  // no entró un solo lead.
  const [elegido, setElegido] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    fetch("/api/seguimiento")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Error al armar el seguimiento");
        return r.json();
      })
      .then((d: Datos) => {
        setDatos(d);
        if (!elegido) {
          const conAlgo = d.dias.findIndex((x) => x.leads.length > 0);
          setDia(conAlgo >= 0 ? conAlgo : 0);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [elegido]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const actual: DiaDeSeguimiento | undefined = datos?.dias[dia];

  return (
    <>
      {datos && <Agenda promesas={datos.promesas} />}

      <section className="rounded-[22px] overflow-hidden bg-surface border border-gridline mb-5">
        <div
          className="flex items-center gap-x-3 gap-y-1 flex-wrap px-4 sm:px-5 py-2.5"
          style={{ background: AZUL, color: "#fff" }}
        >
          <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Seguimiento</h2>
          <span className="text-[12px]" style={{ color: "rgba(255,255,255,.6)" }}>
            hoy y los tres días anteriores
          </span>
          <button
            onClick={cargar}
            disabled={cargando}
            className="ml-auto rounded-full px-2.5 py-[3px] text-[11px] disabled:opacity-50 hover:opacity-80"
            style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.28)" }}
          >
            {cargando ? "Leyendo…" : "↻ Actualizar"}
          </button>
        </div>

        {/* Pestañas por día: obligan a cerrar uno antes de pasar al siguiente,
            que es como se trabaja una lista de seguimiento. */}
        {datos && (
          <div className="flex gap-1.5 px-4 sm:px-5 py-2 border-b border-gridline flex-wrap">
            {datos.dias.map((d, i) => (
              <button
                key={d.fecha}
                onClick={() => {
                  setDia(i);
                  setElegido(true);
                }}
                className="rounded-full px-3 py-1 text-[12px] font-semibold"
                style={
                  i === dia
                    ? { background: AZUL, color: "#fff" }
                    : { background: CELESTE, color: AZUL }
                }
              >
                {d.etiqueta}
                <b className="ml-1.5 tabular-nums font-bold opacity-70">{d.leads.length}</b>
              </button>
            ))}
          </div>
        )}

        {error && <p className="px-4 sm:px-5 py-4 text-[13px] text-series2">{error}</p>}

        {cargando && !datos && (
          <p className="px-4 sm:px-5 py-4 text-[13px]" style={{ color: GRIS }}>
            Armando el seguimiento…
          </p>
        )}

        {actual && actual.leads.length === 0 && !cargando && (
          <p className="px-4 sm:px-5 py-4 text-[13px]" style={{ color: GRIS }}>
            Ese día no entró ningún lead que siga pendiente.
          </p>
        )}

        {/* Agrupado por temperatura: caliente primero, que es donde está la
            plata más cerca. El encabezado dice cuántos hay sin contar filas. */}
        {actual?.leads.map((l, i, todos) => (
          <div key={l.id}>
            {(i === 0 || todos[i - 1].estado !== l.estado) && (
              <p
                className="px-4 sm:px-5 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] border-t border-gridline"
                style={{
                  background: `color-mix(in srgb, ${ESTADO_META[l.estado].color} 10%, var(--surface-1))`,
                  color: ESTADO_META[l.estado].color,
                }}
              >
                {ESTADO_META[l.estado].plural} · {actual.porEstado[l.estado]}
              </p>
            )}
            <FilaLead lead={l} />
          </div>
        ))}
      </section>
    </>
  );
}
