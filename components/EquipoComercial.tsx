"use client";

import { useEffect, useState } from "react";
import { PanelDeAgente } from "@/components/PanelDeAgente";
import type { AgentProduction, AgentProductionRow } from "@/lib/metrics";
import type { Oficina } from "@/lib/oficinas";

/**
 * El equipo, como lo ve la dirección.
 *
 * Tres niveles en una sola pantalla, porque son la misma pregunta hecha a
 * distinta distancia: el admin mira sus cuatro oficinas, el director mira a su
 * gente, y cualquiera de los dos abre a una persona para ver qué está pasando
 * ahí adentro.
 *
 * El orden es por FTD del mes y no por leads. Los leads los reparte la pauta:
 * premiar a quien recibió más es premiar al azar. Lo que cada uno hace con los
 * suyos es lo que se ordena acá.
 */

const AZUL = "#17457F";
const CELESTE = "#EAF1FA";
const VERDE = "#157F52";
const ORO = "#C79A2E";
const GRIS = "#9A998F";
const GRIS_2 = "#5E5C56";

type OficinaConEquipo = Oficina & { agentes: number };

const MEDALLAS = ["🥇", "🥈", "🥉"];

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "··";
}

function Numero({ valor, verde }: { valor: number; verde?: boolean }) {
  return (
    <span
      className="w-[54px] sm:w-[62px] shrink-0 text-right tabular-nums text-[14px] font-semibold"
      style={{ color: valor === 0 ? GRIS : verde ? VERDE : undefined, fontWeight: valor === 0 ? 400 : 600 }}
    >
      {valor}
    </span>
  );
}

function Cabecera({ etiquetas }: { etiquetas: string[] }) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 py-1.5 border-t border-gridline bg-page">
      <span className="flex-1" />
      {etiquetas.map((e) => (
        <span
          key={e}
          className="w-[54px] sm:w-[62px] shrink-0 text-right text-[9px] font-bold uppercase tracking-[.12em]"
          style={{ color: GRIS }}
        >
          {e}
        </span>
      ))}
    </div>
  );
}

export function EquipoComercial() {
  const [oficinas, setOficinas] = useState<OficinaConEquipo[] | null>(null);
  const [rol, setRol] = useState<string | null>(null);
  const [prod, setProd] = useState<AgentProduction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<AgentProductionRow | null>(null);

  useEffect(() => {
    fetch("/api/oficinas")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "No se pudieron leer las oficinas");
        return r.json();
      })
      .then((d: { oficinas: OficinaConEquipo[]; rol: string | null }) => {
        setOficinas(d.oficinas);
        setRol(d.rol);
      })
      .catch((e) => setError(e.message));

    fetch("/api/metrics/production")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AgentProduction | null) => setProd(d))
      .catch(() => setProd(null));
  }, []);

  if (error) {
    return (
      <p className="text-[13px] px-1 py-4" style={{ color: "#C0392B" }}>
        {error}
      </p>
    );
  }

  const filas = [...(prod?.rows ?? [])]
    .filter((r) => r.agentId !== null)
    .sort((a, b) => b.ftdMes - a.ftdMes || b.registrosMes - a.registrosMes || b.leadsMes - a.leadsMes);

  return (
    <>
      {/* ── Las oficinas. Solo tienen sentido para el admin: un director tiene
          una sola y verla en una lista de uno es ruido. ── */}
      {rol === "admin" && (
        <section className="rounded-[22px] overflow-hidden bg-surface border border-gridline mb-5">
          <div
            className="flex items-baseline gap-x-3 gap-y-1 flex-wrap px-4 sm:px-5 py-2.5"
            style={{ background: AZUL, color: "#fff" }}
          >
            <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Las oficinas</h2>
            <span className="text-[11.5px]" style={{ color: "rgba(255,255,255,.66)" }}>
              cada una con sus directores y su equipo
            </span>
            <span
              className="ml-auto text-[12px] font-bold rounded-full px-2.5 py-0.5 tabular-nums"
              style={{ background: "rgba(255,255,255,.18)" }}
            >
              {oficinas?.length ?? "…"}
            </span>
          </div>

          {(oficinas ?? []).map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-3 px-4 sm:px-5 py-2.5 border-t border-gridline"
              style={{ opacity: o.locationId ? 1 : 0.55 }}
            >
              <span
                className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold"
                style={{ background: CELESTE, color: AZUL }}
              >
                {iniciales(o.nombre.replace(/^Oficina\s+/i, ""))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold leading-tight">{o.nombre}</span>
                <span className="block text-[11px]" style={{ color: GRIS }}>
                  {o.locationId
                    ? `${o.agentes} ${o.agentes === 1 ? "persona" : "personas"} · conectada`
                    : "sin conectar — le falta su subcuenta de GoHighLevel"}
                </span>
              </span>
              {o.locationId && (
                <span
                  className="text-[10px] font-bold rounded-full px-2.5 py-1 shrink-0"
                  style={{ background: "#EEF7F2", color: VERDE }}
                >
                  activa
                </span>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── El equipo ── */}
      <section className="rounded-[22px] overflow-hidden bg-surface border border-gridline mb-5">
        <div
          className="flex items-baseline gap-x-3 gap-y-1 flex-wrap px-4 sm:px-5 py-2.5"
          style={{ background: AZUL, color: "#fff" }}
        >
          <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
            {oficinas?.length === 1 ? oficinas[0].nombre : "Equipo comercial"}
          </h2>
          <span className="text-[11.5px]" style={{ color: "rgba(255,255,255,.66)" }}>
            del mes · ordenado por FTD
          </span>
          <span
            className="ml-auto text-[12px] font-bold rounded-full px-2.5 py-0.5 tabular-nums"
            style={{ background: "rgba(255,255,255,.18)" }}
          >
            {filas.length}
          </span>
        </div>

        {prod && filas.length > 0 && (
          <div className="flex flex-wrap border-t border-gridline">
            {[
              { l: "Leads del mes", v: prod.totals.leadsMes },
              { l: "Registros", v: prod.totals.registrosMes },
              { l: "FTD del mes", v: prod.totals.ftdMes, bueno: true },
              { l: "FTD hoy", v: prod.totals.ftdHoy, bueno: true },
            ].map((c) => (
              <div
                key={c.l}
                className="flex-1 min-w-[110px] px-4 sm:px-5 py-3 border-r border-gridline last:border-r-0"
              >
                <span
                  className="block text-[9.5px] font-bold uppercase tracking-[.14em]"
                  style={{ color: GRIS }}
                >
                  {c.l}
                </span>
                <div
                  className="text-[26px] font-bold tracking-[-0.04em] leading-none tabular-nums mt-1"
                  style={{ color: c.bueno && c.v > 0 ? VERDE : undefined }}
                >
                  {c.v}
                </div>
              </div>
            ))}
          </div>
        )}

        <Cabecera etiquetas={["Leads", "Registros", "FTD"]} />

        {prod === null && (
          <p className="px-4 sm:px-5 py-4 text-[13px]" style={{ color: GRIS }}>
            Buscando la producción del equipo…
          </p>
        )}

        {prod !== null && filas.length === 0 && (
          <p className="px-4 sm:px-5 py-4 text-[13px]" style={{ color: GRIS }}>
            Todavía no hay producción este mes.
          </p>
        )}

        {filas.map((r, i) => {
          const suyo = abierto?.agentId === r.agentId;
          return (
            <div key={r.agentId ?? r.agent}>
              <button
                onClick={() => setAbierto(suyo ? null : r)}
                aria-expanded={suyo}
                className="w-full flex items-center gap-3 px-4 sm:px-5 py-2.5 border-t border-gridline text-left hover:bg-page"
              >
                <span
                  className="w-[22px] shrink-0 text-center text-[13px] font-bold tabular-nums"
                  style={{ color: i < 3 ? ORO : GRIS }}
                >
                  {MEDALLAS[i] ?? i + 1}
                </span>
                <span
                  className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ background: CELESTE, color: AZUL }}
                >
                  {iniciales(r.agent)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold leading-tight">{r.agent}</span>
                  <span className="block text-[11px]" style={{ color: GRIS }}>
                    {r.leadsHoy > 0 ? `${r.leadsHoy} leads hoy` : "sin leads hoy"}
                    {r.ftdHoy > 0 ? ` · ${r.ftdHoy} FTD hoy` : ""}
                  </span>
                </span>
                <Numero valor={r.leadsMes} />
                <Numero valor={r.registrosMes} />
                <Numero valor={r.ftdMes} verde />
              </button>

              {suyo && r.agentId && (
                <div className="px-3 sm:px-4 py-3 border-t border-gridline bg-page">
                  <PanelDeAgente agentId={r.agentId} nombre={r.agent} />
                </div>
              )}
            </div>
          );
        })}

      </section>
    </>
  );
}
