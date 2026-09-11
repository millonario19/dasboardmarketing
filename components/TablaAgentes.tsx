"use client";

import { Fragment, useCallback, useState } from "react";
import { AgentDetail } from "@/components/AgentDetail";
import { FunnelStepChart } from "@/components/FunnelStepChart";
import type { AgentProduction, AgentRangeRow } from "@/lib/metrics";

// La franja del encabezado iba en celeste con letra azul y casi no se leía.
// Pasa a azul oscuro con letra blanca. Solo la franja: el resto de la tabla
// queda igual.
const CAB = "#17457F";

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

function hoyBogota(): string {
  return new Date(Date.now() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

function primeroDelMes(): string {
  return `${hoyBogota().slice(0, 7)}-01`;
}

function enEspanol(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

// El rango del formulario es inclusivo en el día final; la API espera un tope
// exclusivo, así que se manda la medianoche del día siguiente en hora de Bogotá.
function aIsoUtc(desde: string, hasta: string): { from: string; to: string } {
  const tope = new Date(`${hasta}T00:00:00-05:00`);
  tope.setDate(tope.getDate() + 1);
  return { from: new Date(`${desde}T00:00:00-05:00`).toISOString(), to: tope.toISOString() };
}

type Consulta = { desde: string; hasta: string; iso: { from: string; to: string } };

/**
 * Una sola tabla para los dos casos.
 *
 * Antes había dos: la de producción por agente y otra aparte para consultar un
 * rango, que además arrancaba mostrando "hoy" —dato que ya estaba en la
 * primera—. Ahora el rango cambia lo que muestra ESTA tabla y se vuelve al
 * período por defecto con un botón, sin agregar bloques a la página.
 */
export function TablaAgentes({ data }: { data: AgentProduction }) {
  const [desde, setDesde] = useState(primeroDelMes);
  const [hasta, setHasta] = useState(hoyBogota);
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [filas, setFilas] = useState<AgentRangeRow[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  const consultar = useCallback(() => {
    const iso = aIsoUtc(desde, hasta);
    setCargando(true);
    setError(null);
    fetch(`/api/metrics/range?from=${encodeURIComponent(iso.from)}&to=${encodeURIComponent(iso.to)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Error al consultar");
        return res.json();
      })
      .then((d) => {
        setFilas(d.rows);
        setConsulta({ desde, hasta, iso });
        setAbierto(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [desde, hasta]);

  function volver() {
    setConsulta(null);
    setFilas(null);
    setError(null);
    setAbierto(null);
    setDesde(primeroDelMes());
    setHasta(hoyBogota());
  }

  const enRango = consulta !== null && filas !== null;
  const columnas = enRango ? 4 : 7;

  const totalesRango = filas?.reduce(
    (a, r) => ({ leads: a.leads + r.leads, registros: a.registros + r.registros, ftd: a.ftd + r.ftd }),
    { leads: 0, registros: 0, ftd: 0 }
  );

  return (
    <div className="bg-surface border border-gridline rounded-lg overflow-hidden">
      {/* Control de fechas en la misma línea del título: no agrega una caja ni
          una sección, solo una fila. */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-gridline">
        <h2 className="text-[15px] font-semibold text-ink-primary">Producción por agente</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={desde}
            max={hasta}
            onChange={(e) => setDesde(e.target.value)}
            className="border border-gridline rounded-lg px-2.5 py-1.5 text-[13.5px] bg-surface text-ink-secondary"
          />
          <span className="text-ink-muted text-[13.5px]">a</span>
          <input
            type="date"
            value={hasta}
            min={desde}
            onChange={(e) => setHasta(e.target.value)}
            className="border border-gridline rounded-lg px-2.5 py-1.5 text-[13.5px] bg-surface text-ink-secondary"
          />
          <button
            onClick={consultar}
            disabled={cargando}
            className="bg-series1 text-white rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium hover:opacity-90 disabled:opacity-50"
          >
            {cargando ? "Consultando…" : "Consultar"}
          </button>
        </div>
      </div>

      {/* Aviso en naranja: si quedás en un rango viejo y te olvidás, esta franja
          te lo recuerda. Es el mismo criterio del "no es hoy" que ya existía. */}
      {enRango && (
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 border-b border-gridline bg-[#fdeee7]">
          <span className="text-[13.5px] font-medium text-[#b5501f]">
            📅 Mostrando {enEspanol(consulta.desde)} — {enEspanol(consulta.hasta)}, no es el período por defecto
          </span>
          <button
            onClick={volver}
            className="border border-gridline bg-surface text-header-ink rounded-lg px-3 py-1.5 text-[13px] font-medium hover:bg-page"
          >
            × Volver a hoy y este mes
          </button>
        </div>
      )}

      {error && <div className="px-4 py-3 text-sm text-series2">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: 680 }}>
          {/* Anchos fijos: sin esto las columnas se reparten según el texto y
              los grupos Hoy y Este mes terminan de anchos distintos, aunque
              tengan las mismas tres columnas. */}
          <colgroup>
            <col style={{ width: enRango ? "40%" : "28%" }} />
            {Array.from({ length: enRango ? 3 : 6 }).map((_, i) => (
              <col key={i} style={{ width: enRango ? "20%" : "12%" }} />
            ))}
          </colgroup>
          <thead>
            {/* Encabezado de dos niveles: con seis columnas sueltas cuesta saber
                cuál es de hoy y cuál del mes. */}
            <tr>
              <th style={{ background: CAB }} />
              {enRango ? (
                <th
                  colSpan={3}
                  className="text-white text-center text-[10.5px] font-semibold uppercase tracking-wider px-4 pt-2 pb-0.5 whitespace-nowrap"
                  style={{ background: CAB }}
                >
                  Del {enEspanol(consulta.desde)} al {enEspanol(consulta.hasta)}
                </th>
              ) : (
                <>
                  <th
                    colSpan={3}
                    className="text-white text-center text-[10.5px] font-semibold uppercase tracking-wider px-4 pt-2 pb-0.5"
                    style={{ background: CAB }}
                  >
                    Hoy
                  </th>
                  <th
                    colSpan={3}
                    className="text-white text-center text-[10.5px] font-semibold uppercase tracking-wider px-4 pt-2 pb-0.5"
                    style={{ background: CAB, borderLeft: "1px solid rgba(255,255,255,0.25)" }}
                  >
                    Este mes
                  </th>
                </>
              )}
            </tr>
            <tr className="border-b border-gridline">
              <th
                className="text-left text-[11px] font-medium uppercase tracking-wide text-white px-4 pt-1 pb-2.5"
                style={{ background: CAB }}
              >
                Agente
              </th>
              {(enRango ? ["Leads", "Registros", "FTD"] : ["Leads", "Registros", "FTD", "Leads", "Registros", "FTD"]).map(
                (c, i) => (
                  <th
                    key={i}
                    className="text-white text-right text-[11px] font-medium uppercase tracking-wide px-4 pt-1 pb-2.5 whitespace-nowrap"
                    style={{
                      background: CAB,
                      borderLeft: !enRango && i === 3 ? "1px solid rgba(255,255,255,0.25)" : undefined,
                    }}
                  >
                    {c}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {enRango
              ? filas!.map((r) => {
                  const esteAbierto = abierto === r.agent;
                  return (
                    <Fragment key={r.agentId ?? r.agent}>
                      <tr
                        onClick={() => setAbierto(esteAbierto ? null : r.agent)}
                        className="border-b border-gridline last:border-0 cursor-pointer hover:bg-page"
                      >
                        <td className="px-4 py-3 truncate" title={r.agent}>
                          <span className="text-ink-muted mr-1">{esteAbierto ? "▾" : "▸"}</span>
                          {r.agent}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{r.leads}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{r.registros}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{r.ftd}</td>
                      </tr>
                      {esteAbierto && (
                        <tr className="border-b border-gridline last:border-0">
                          <td colSpan={4} className="p-0">
                            <div className="px-4 pt-4 bg-page">
                              <FunnelStepChart
                                title={`${r.agent} — ${enEspanol(consulta.desde)} al ${enEspanol(consulta.hasta)}`}
                                stages={[
                                  { label: "Leads", value: r.leads },
                                  { label: "Registros", value: r.registros },
                                  { label: "FTD", value: r.ftd },
                                ]}
                              />
                            </div>
                            {/* En modo rango el detalle usa el rango consultado y
                                no "hoy": antes, con la tabla aparte, siempre
                                mostraba los contactos del día. */}
                            <AgentDetail agentId={r.agentId} from={consulta.iso.from} to={consulta.iso.to} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              : data.rows.map((r) => {
                  const esteAbierto = abierto === r.agent;
                  return (
                    <Fragment key={r.agentId ?? r.agent}>
                      <tr
                        onClick={() => setAbierto(esteAbierto ? null : r.agent)}
                        className="border-b border-gridline last:border-0 cursor-pointer hover:bg-page"
                      >
                        <td className="px-4 py-3 truncate" title={r.agent}>
                          <span className="text-ink-muted mr-1">{esteAbierto ? "▾" : "▸"}</span>
                          {r.agent}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.leadsHoy}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.registrosHoy}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.ftdHoy}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium border-l border-gridline">
                          {r.leadsMes}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{r.registrosMes}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{r.ftdMes}</td>
                      </tr>
                      {esteAbierto && (
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

            {((enRango && filas!.length === 0) || (!enRango && data.rows.length === 0)) && (
              <tr>
                <td colSpan={columnas} className="px-4 py-6 text-center text-ink-secondary">
                  {enRango ? "Sin datos en este rango" : "Sin datos todavía hoy"}
                </td>
              </tr>
            )}
          </tbody>

          <tfoot>
            {/* Celeste para que la fila de totales no se confunda con una fila más
                de la tabla. Cierra en el mismo azul con el que abre el encabezado,
                pero claro, porque acá el texto va oscuro. */}
            <tr className="border-t border-gridline font-medium bg-header">
              <td className="px-4 py-3">Total</td>
              {enRango && totalesRango ? (
                <>
                  <td className="px-4 py-3 text-right tabular-nums">{totalesRango.leads}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{totalesRango.registros}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{totalesRango.ftd}</td>
                </>
              ) : (
                <>
                  <td className="px-4 py-3 text-right tabular-nums">{data.totals.leadsHoy}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{data.totals.registrosHoy}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{data.totals.ftdHoy}</td>
                  <td className="px-4 py-3 text-right tabular-nums border-l border-gridline">{data.totals.leadsMes}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{data.totals.registrosMes}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{data.totals.ftdMes}</td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
