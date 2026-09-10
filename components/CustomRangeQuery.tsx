"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgentRangeRow } from "@/lib/metrics";

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

function bogotaTodayIso(): string {
  return new Date(Date.now() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

function formatDateEs(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function CustomRangeQuery() {
  const [from, setFrom] = useState(bogotaTodayIso());
  const [to, setTo] = useState(bogotaTodayIso());
  const [queried, setQueried] = useState<{ from: string; to: string } | null>(null);
  const [rows, setRows] = useState<AgentRangeRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consultar = useCallback((qFrom: string, qTo: string) => {
    setLoading(true);
    setError(null);
    // "to" incluye todo ese día — mandamos la medianoche del día siguiente (Bogotá).
    const toExclusive = new Date(`${qTo}T00:00:00-05:00`);
    toExclusive.setDate(toExclusive.getDate() + 1);
    const fromIso = new Date(`${qFrom}T00:00:00-05:00`).toISOString();

    fetch(`/api/metrics/range?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toExclusive.toISOString())}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Error al consultar");
        return res.json();
      })
      .then((data) => {
        setRows(data.rows);
        setQueried({ from: qFrom, to: qTo });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Carga "hoy" automáticamente al entrar, para que nunca quede una fecha
  // vieja mostrada sin que sea obvio.
  useEffect(() => {
    consultar(bogotaTodayIso(), bogotaTodayIso());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function irAHoy() {
    const hoy = bogotaTodayIso();
    setFrom(hoy);
    setTo(hoy);
    consultar(hoy, hoy);
  }

  const totals = rows?.reduce(
    (acc, r) => ({ leads: acc.leads + r.leads, registros: acc.registros + r.registros, ftd: acc.ftd + r.ftd }),
    { leads: 0, registros: 0, ftd: 0 }
  );

  const isToday = queried && queried.from === bogotaTodayIso() && queried.to === bogotaTodayIso();

  return (
    <div className="bg-surface border border-gridline rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gridline">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-2">
          <h2 className="text-sm font-medium">Rango personalizado</h2>
          <button onClick={irAHoy} className="text-xs text-series1 font-medium hover:opacity-80">
            Volver a hoy
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-gridline rounded-md px-2 py-1.5 text-sm bg-surface"
          />
          <span className="text-ink-muted text-sm">a</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="border border-gridline rounded-md px-2 py-1.5 text-sm bg-surface"
          />
          <button
            onClick={() => consultar(from, to)}
            disabled={loading}
            className="bg-series1 text-white rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Consultando…" : "Consultar"}
          </button>
        </div>
        {queried && (
          <p className={`text-sm mt-2 font-medium ${isToday ? "text-ink-secondary" : "text-series2"}`}>
            {isToday ? "📅" : "⚠️"} Mostrando datos de: {formatDateEs(queried.from)} — {formatDateEs(queried.to)}
            {!isToday && " (no es hoy)"}
          </p>
        )}
      </div>

      {error && <div className="px-4 py-3 text-sm text-series2">{error}</div>}

      {!error && rows && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gridline text-left text-ink-secondary">
              <th className="px-4 py-3 font-medium">Agente</th>
              <th className="px-4 py-3 font-medium text-right">Leads</th>
              <th className="px-4 py-3 font-medium text-right">Registros</th>
              <th className="px-4 py-3 font-medium text-right">FTD</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.agentId ?? r.agent} className="border-b border-gridline last:border-0">
                <td className="px-4 py-3">{r.agent}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.leads}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.registros}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.ftd}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-secondary">
                  Sin datos en este rango
                </td>
              </tr>
            )}
          </tbody>
          {totals && rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-gridline font-medium bg-page">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.leads}</td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.registros}</td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.ftd}</td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </div>
  );
}
