"use client";

import { useCallback, useState } from "react";
import { ESTADOS, ESTADO_META, accionSugerida, type EstadoLead } from "@/lib/leadStates";
import type { PanelEstados as Datos } from "@/lib/metrics";

const SEVERIDAD = {
  alta: { borde: "#D93A2B", fondo: "#FDF0EE", texto: "#A32A1E" },
  media: { borde: "#E0A800", fondo: "#FDF8E7", texto: "#8A6800" },
} as const;

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

function hoyBogota(): string {
  return new Date(Date.now() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

function ayerBogota(): string {
  return new Date(Date.now() - BOGOTA_OFFSET_MS - 864e5).toISOString().slice(0, 10);
}

function enEspanol(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

type Dia = {
  fecha: string;
  conteos: Record<EstadoLead, number>;
  desglose: Record<EstadoLead, { etiqueta: string; valor: number }[]>;
  total: number;
  depositaron: number;
};

export function PanelEstados({ datos }: { datos: Datos }) {
  const [ventana, setVentana] = useState<"hoy" | "mes">("hoy");
  const [fecha, setFecha] = useState(ayerBogota);
  const [dia, setDia] = useState<Dia | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorDia, setErrorDia] = useState<string | null>(null);

  // El día elegido se pide aparte: el panel por defecto solo trae hoy y el mes.
  const verDia = useCallback(() => {
    const desde = new Date(`${fecha}T00:00:00-05:00`);
    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + 1);
    setCargando(true);
    setErrorDia(null);
    fetch(`/api/metrics/estados?from=${encodeURIComponent(desde.toISOString())}&to=${encodeURIComponent(hasta.toISOString())}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Error al consultar el día");
        return r.json();
      })
      .then((d) => setDia({ fecha, ...d }))
      .catch((e) => setErrorDia(e.message))
      .finally(() => setCargando(false));
  }, [fecha]);

  const conteos = dia ? dia.conteos : datos[ventana];
  const desglose = dia ? dia.desglose : ventana === "hoy" ? datos.desgloseHoy : datos.desgloseMes;
  const total = ESTADOS.reduce((s, e) => s + conteos[e], 0);

  const { tasaHoy, madurosHoy, baseline, diasValidos } = datos.interaccion;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-ink-primary">Estado de los leads</h2>
            <span className="text-[13px] text-ink-secondary">
              {total} {dia ? `del ${enEspanol(dia.fecha)}` : ventana === "hoy" ? "hoy" : "este mes"}
            </span>
          </div>
          {/* Sin esta aclaración el panel parece contradecir a Métricas: acá
              Caliente sale más bajo porque solo cuenta lo que nació de la
              pauta, mientras que los totales de arriba suman todas las
              fuentes. */}
          <p className="text-[12px] text-ink-muted mt-0.5">
            Solo leads de la pauta que todavía no depositaron — los que ya depositaron están en FTD, arriba.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-full border border-gridline overflow-hidden text-[13px]">
            {(["hoy", "mes"] as const).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setVentana(v);
                  setDia(null);
                }}
                className={`px-4 py-1.5 ${
                  !dia && ventana === v
                    ? "bg-header text-header-ink font-medium"
                    : "bg-surface text-ink-secondary hover:bg-page"
                }`}
              >
                {v === "hoy" ? "Hoy" : "Este mes"}
              </button>
            ))}
          </div>

          {/* Un día puntual: "¿cómo estuvo la pauta del 9?" */}
          <input
            type="date"
            value={fecha}
            max={hoyBogota()}
            onChange={(e) => setFecha(e.target.value)}
            className="border border-gridline rounded-full px-3 py-1.5 text-[13px] bg-surface text-ink-secondary"
          />
          <button
            onClick={verDia}
            disabled={cargando}
            className="rounded-full px-4 py-1.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ background: "#17457F" }}
          >
            {cargando ? "Consultando…" : "Consultar"}
          </button>
        </div>
      </div>

      {errorDia && (
        <div className="rounded-xl bg-surface border border-series2 text-series2 px-4 py-3 mb-3 text-[13px]">
          {errorDia}
        </div>
      )}

      {dia && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl px-4 py-2.5 mb-3 bg-[#fdeee7]">
          <span className="text-[13px] font-medium text-[#b5501f]">
            📅 Leads que entraron el {enEspanol(dia.fecha)} — {dia.total} en total
            {dia.depositaron > 0 && `, de los cuales ${dia.depositaron} ya depositaron`}
          </span>
          <button
            onClick={() => setDia(null)}
            className="border border-gridline bg-surface text-header-ink rounded-lg px-3 py-1 text-[12.5px] font-medium hover:bg-page"
          >
            × Volver
          </button>
        </div>
      )}

      {/* Barra de distribución: la proporción de los tres estados en una sola
          línea, antes de entrar a los números. */}
      {total > 0 && (
        <div className="rounded-2xl bg-surface border border-gridline p-4 mb-3">
          <div className="flex gap-1 h-3">
            {ESTADOS.filter((e) => conteos[e] > 0).map((e) => (
              <span
                key={e}
                className="rounded-full"
                style={{ flex: conteos[e], background: ESTADO_META[e].color }}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {ESTADOS.map((e) => (
              <div key={e} className="flex items-center gap-2 text-[13px] font-semibold text-ink-secondary">
                <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ESTADO_META[e].color }} />
                {ESTADO_META[e].nombre}
                <b className="text-ink-primary tabular-nums">{conteos[e]}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {ESTADOS.map((estado) => (
          <Tarjeta
            key={estado}
            estado={estado}
            valor={conteos[estado]}
            total={total}
            desglose={desglose[estado] ?? []}
          />
        ))}
      </div>

      {!dia && (
      <div className="rounded-xl border border-gridline bg-surface px-4 py-3 mb-4">
        <p className="text-[13px] text-ink-secondary">
          <span className="font-medium text-ink-primary">Interacción real de hoy: </span>
          {tasaHoy === null ? (
            <>todavía no hay leads con tiempo suficiente para responder.</>
          ) : (
            <>
              <span className="font-semibold text-ink-primary tabular-nums">{tasaHoy.toFixed(0)}%</span> sobre{" "}
              {madurosHoy} leads con más de una hora de entrados
              {baseline !== null ? (
                <> — lo habitual de la oficina es <span className="tabular-nums">{baseline.toFixed(0)}%</span>.</>
              ) : (
                <> — todavía sin referencia: hacen falta 3 días de datos y van {diasValidos}.</>
              )}
            </>
          )}
        </p>
      </div>
      )}

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
          Alertas {datos.alertas.length > 0 && `(${datos.alertas.length})`}
        </h3>
        {datos.alertas.length === 0 ? (
          <div className="rounded-xl border border-gridline bg-surface px-4 py-3 text-[13px] text-ink-secondary">
            Sin alertas. La interacción de la oficina y de cada agente está dentro de lo normal.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {datos.alertas.map((a) => {
              const c = SEVERIDAD[a.severidad];
              return (
                <div
                  key={a.id}
                  className="rounded-xl px-4 py-3 border-l-4"
                  style={{ borderLeftColor: c.borde, background: c.fondo }}
                >
                  <p className="text-[13px] font-semibold mb-0.5" style={{ color: c.texto }}>
                    {a.titulo}
                  </p>
                  <p className="text-[13px] text-ink-secondary">{a.detalle}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function Tarjeta({
  estado,
  valor,
  total,
  desglose,
}: {
  estado: EstadoLead;
  valor: number;
  total: number;
  desglose: { etiqueta: string; valor: number }[];
}) {
  const meta = ESTADO_META[estado];
  const pct = total > 0 ? (valor / total) * 100 : 0;

  return (
    <article
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: `color-mix(in srgb, ${meta.color} 14%, var(--surface-1))`,
        border: `2px solid ${meta.color}`,
      }}
    >
      {/* Bloque de color macizo: el número y el estado se leen de lejos. */}
      <div className="p-4 pb-4" style={{ background: meta.color, color: meta.sobre }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[17px] font-extrabold tracking-tight">{meta.nombre}</span>
          <span
            className="text-[13px] font-extrabold rounded-full px-2.5 py-1 tabular-nums"
            style={{ background: `color-mix(in srgb, ${meta.sobre} 20%, transparent)` }}
          >
            {pct.toFixed(1)}%
          </span>
        </div>

        <div className="flex items-baseline gap-2 mt-2.5">
          <strong className="text-[44px] font-extrabold leading-none tracking-tighter tabular-nums">{valor}</strong>
          <span className="text-[14px] font-semibold" style={{ opacity: 0.75 }}>
            de {total}
          </span>
        </div>
        <p className="text-[14px] font-semibold mt-1">{meta.que}</p>

        <div
          className="h-1.5 rounded-full mt-3 overflow-hidden"
          style={{ background: `color-mix(in srgb, ${meta.sobre} 25%, transparent)` }}
        >
          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: meta.sobre }} />
        </div>
      </div>

      {/* Checklist: cuántos de estos leads hicieron cada paso del embudo. Los
          pasos en cero quedan apagados a propósito: son los que faltan. */}
      <div className="p-3 flex flex-col gap-3 flex-1">
        <div
          className="rounded-xl px-3"
          style={{ background: `color-mix(in srgb, ${meta.color} 24%, var(--surface-1))` }}
        >
          {desglose.map((d, i) => {
            const hecho = d.valor > 0;
            const ancho = valor > 0 ? Math.round((d.valor / valor) * 100) : 0;
            return (
              <div
                key={d.etiqueta}
                className="flex items-center gap-2.5 py-2.5"
                style={{
                  borderTop: i === 0 ? undefined : `1px solid color-mix(in srgb, ${meta.color} 32%, var(--surface-1))`,
                  opacity: hecho ? 1 : 0.55,
                }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0"
                  style={
                    hecho
                      ? { background: meta.fuerte, color: meta.sobreFuerte }
                      : { background: "var(--surface-1)", color: "var(--text-muted)", boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.12)" }
                  }
                >
                  {hecho ? "✓" : i + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-bold leading-tight text-ink-primary truncate">{d.etiqueta}</p>
                  <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.6)" }}>
                    <span className="block h-full rounded-full" style={{ width: `${ancho}%`, background: meta.fuerte }} />
                  </div>
                </div>

                <span
                  className="min-w-[34px] h-8 px-1.5 rounded-lg flex items-center justify-center text-[15px] font-extrabold tabular-nums shrink-0"
                  style={
                    hecho
                      ? { background: meta.color, color: meta.sobre }
                      : { background: "var(--surface-1)", color: "var(--text-muted)" }
                  }
                >
                  {d.valor}
                </span>
              </div>
            );
          })}
        </div>

        {/* Lo único accionable de la tarjeta, como botón y no como nota al pie. */}
        <div
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mt-auto"
          style={{ background: meta.fuerte, color: meta.sobreFuerte }}
        >
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] shrink-0"
            style={{ background: `color-mix(in srgb, ${meta.sobreFuerte} 20%, transparent)` }}
            aria-hidden
          >
            ⚡
          </span>
          <span className="min-w-0">
            <small className="block text-[10.5px] font-semibold" style={{ opacity: 0.75 }}>
              Siguiente paso
            </small>
            <span className="block text-[12.5px] font-extrabold leading-tight">{accionSugerida(estado)}</span>
          </span>
        </div>
      </div>
    </article>
  );
}
