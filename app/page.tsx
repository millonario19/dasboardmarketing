"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FunnelWaterfall } from "@/components/FunnelWaterfall";
import { PanelEstados } from "@/components/PanelEstados";
import { CambiarVista } from "@/components/CambiarVista";
import { TablaAgentes } from "@/components/TablaAgentes";
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

          <TablaAgentes data={data} />
        </>
      )}
    </main>
  );
}
