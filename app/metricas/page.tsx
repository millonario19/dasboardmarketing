"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FunnelWaterfall } from "@/components/FunnelWaterfall";
import { TablaAgentes } from "@/components/TablaAgentes";
import { CambiarVista } from "@/components/CambiarVista";
import { CerrarSesion } from "@/components/CerrarSesion";
import { useSesion } from "@/components/useSesion";
import { nombreCorto } from "@/lib/nombre";
import type { AgentProduction } from "@/lib/metrics";

/**
 * Los números del mes, en su propia pantalla.
 *
 * Vivían al pie de Dirección, debajo de los tres pasos. Se miran una vez al
 * día y no cambian nada de lo que hay que hacer ahora, así que ahí abajo solo
 * lograban que la pantalla de trabajo terminara en un informe.
 */
export default function MetricasPage() {
  const [data, setData] = useState<AgentProduction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sesion = useSesion();
  const esAdmin = sesion?.rol === "admin";

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
      <div className="flex flex-col items-center text-center gap-3 mb-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:text-left sm:gap-4">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
          <h1 className="text-[21px] sm:text-[25px] font-semibold text-ink-primary tracking-tight leading-[1.15]">
            Métricas
          </h1>
          {sesion && !esAdmin && (
            <span className="text-sm text-ink-secondary bg-surface border border-gridline rounded-full px-3 py-1.5">
              {nombreCorto(sesion.nombre)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
          <CambiarVista actual="metricas" />
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-surface border border-gridline rounded-full px-4 py-2.5 text-sm font-medium text-ink-primary hover:bg-page disabled:opacity-50 shrink-0"
          >
            {loading ? "Actualizando…" : "↻ Actualizar"}
          </button>
          {esAdmin && (
            <Link
              href="/admin/usuarios"
              className="bg-surface border border-gridline rounded-full px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-page hover:text-ink-primary shrink-0"
            >
              Usuarios
            </Link>
          )}
          <CerrarSesion className="bg-surface border border-gridline rounded-full px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-page hover:text-ink-primary disabled:opacity-50 shrink-0" />
        </div>
      </div>

      {error && (
        <div className="bg-surface border border-series2 text-series2 rounded-lg p-4 mb-6 text-sm">{error}</div>
      )}
      {loading && !error && !data && <p className="text-ink-secondary text-sm">Cargando métricas…</p>}

      {!error && data && (
        <>
          <TablaAgentes data={data} />
          <div className="mt-8">
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
        </>
      )}
    </main>
  );
}
