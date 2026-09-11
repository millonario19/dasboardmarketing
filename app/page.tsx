"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AgentDetail } from "@/components/AgentDetail";
import { FunnelStepChart } from "@/components/FunnelStepChart";
import { FunnelWaterfall } from "@/components/FunnelWaterfall";
import { PanelEstados } from "@/components/PanelEstados";
import { CambiarVista } from "@/components/CambiarVista";
import { CustomRangeQuery } from "@/components/CustomRangeQuery";
import type { AgentProduction } from "@/lib/metrics";

export default function DashboardPage() {
  const [data, setData] = useState<AgentProduction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/metrics/production")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Error al cargar métricas");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl md:text-5xl font-semibold text-ink-primary tracking-tight">
            Marketing y Ventas
          </h1>
          <span className="w-10 h-10 rounded-full border border-gridline bg-surface flex items-center justify-center text-ink-muted text-lg shrink-0">
            🔗
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CambiarVista actual="direccion" />
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-surface border border-gridline rounded-full px-4 py-2.5 text-sm font-medium text-ink-primary hover:bg-page disabled:opacity-50 shrink-0"
          >
            📅 {loading ? "Actualizando…" : "Actualizar"} ⌄
          </button>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 bg-surface border border-gridline rounded-full px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-page hover:text-ink-primary disabled:opacity-50 shrink-0"
          >
            {loggingOut ? "Saliendo…" : "Cerrar sesión"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-surface border border-series2 text-series2 rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {loading && !error && !data && (
        <p className="text-ink-secondary text-sm mb-6">Cargando métricas…</p>
      )}

      {!error && data && (
        <>
          <div className="mb-8">
            <FunnelWaterfall
              stages={[
                { label: "Total leads mes", value: data.totals.leadsMes },
                { label: "Total registros mes", value: data.totals.registrosMes },
                { label: "Total ftds del mes", value: data.totals.ftdMes },
                { label: "Nuevo leads", value: data.totals.leadsHoy },
                { label: "Registros Hoy", value: data.totals.registrosHoy },
                { label: "FTDS de hoy", value: data.totals.ftdHoy },
              ]}
            />
          </div>

          <PanelEstados datos={data.panel} />

          <div className="bg-surface border border-gridline rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gridline text-left text-ink-secondary">
                  <th className="px-4 py-3 font-medium">Agente</th>
                  <th className="px-4 py-3 font-medium text-right">Leads hoy</th>
                  <th className="px-4 py-3 font-medium text-right">Registros hoy</th>
                  <th className="px-4 py-3 font-medium text-right">FTD hoy</th>
                  <th className="px-4 py-3 font-medium text-right">Leads mes</th>
                  <th className="px-4 py-3 font-medium text-right">Registros mes</th>
                  <th className="px-4 py-3 font-medium text-right">FTD mes</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const isOpen = expandedAgent === r.agent;
                  return (
                    <Fragment key={r.agentId ?? r.agent}>
                      <tr
                        onClick={() => setExpandedAgent(isOpen ? null : r.agent)}
                        className="border-b border-gridline last:border-0 cursor-pointer hover:bg-page"
                      >
                        <td className="px-4 py-3">
                          <span className="text-ink-muted mr-1">{isOpen ? "▾" : "▸"}</span>
                          {r.agent}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.leadsHoy}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.registrosHoy}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.ftdHoy}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{r.leadsMes}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{r.registrosMes}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{r.ftdMes}</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-gridline last:border-0">
                          <td colSpan={7} className="p-0">
                            <div className="px-4 pt-4 bg-page">
                              <FunnelStepChart
                                title={`${r.agent} — este mes`}
                                stages={[
                                  { label: "Leads", value: r.leadsMes },
                                  { label: "Registros", value: r.registrosMes },
                                  { label: "FTD", value: r.ftdMes },
                                ]}
                              />
                            </div>
                            <AgentDetail agentId={r.agentId} from={data.range.today.from} to={data.range.today.to} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-ink-secondary">
                      Sin datos todavía hoy
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-gridline font-medium bg-page">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{data.totals.leadsHoy}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{data.totals.registrosHoy}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{data.totals.ftdHoy}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{data.totals.leadsMes}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{data.totals.registrosMes}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{data.totals.ftdMes}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-8">
            <CustomRangeQuery />
          </div>
        </>
      )}
    </main>
  );
}
