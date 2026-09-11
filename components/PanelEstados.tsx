"use client";

import { useState } from "react";
import { ESTADOS, ESTADO_META, accionSugerida, type EstadoLead } from "@/lib/leadStates";
import type { PanelEstados as Datos } from "@/lib/metrics";

const SEVERIDAD = {
  alta: { borde: "#D93A2B", fondo: "#FDF0EE", texto: "#A32A1E" },
  media: { borde: "#E0A800", fondo: "#FDF8E7", texto: "#8A6800" },
} as const;

export function PanelEstados({ datos }: { datos: Datos }) {
  const [ventana, setVentana] = useState<"hoy" | "mes">("hoy");
  const conteos = datos[ventana];
  const desglose = ventana === "hoy" ? datos.desgloseHoy : datos.desgloseMes;
  const total = ESTADOS.reduce((s, e) => s + conteos[e], 0);

  const { tasaHoy, madurosHoy, baseline, diasValidos } = datos.interaccion;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-ink-primary">Estado de los leads</h2>
            <span className="text-[13px] text-ink-secondary">
              {total} {ventana === "hoy" ? "hoy" : "este mes"}
            </span>
          </div>
          {/* Sin esta aclaración el panel parece contradecir a Métricas: acá
              Fuego y Venta salen más bajos porque solo cuentan lo que nació de
              la pauta, mientras que los totales de arriba suman todas las
              fuentes. */}
          <p className="text-[12px] text-ink-muted mt-0.5">
            Solo leads con tag de pauta. Los registros y FTD de otras fuentes no entran acá.
          </p>
        </div>
        <div className="flex rounded-full border border-gridline overflow-hidden text-[13px]">
          {(["hoy", "mes"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVentana(v)}
              className={`px-4 py-1.5 ${
                ventana === v ? "bg-header text-header-ink font-medium" : "bg-surface text-ink-secondary hover:bg-page"
              }`}
            >
              {v === "hoy" ? "Hoy" : "Este mes"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
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
    <div
      className="rounded-xl border border-gridline bg-surface p-4 border-t-4 flex flex-col"
      style={{ borderTopColor: meta.color }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span aria-hidden>{meta.emoji}</span>
        <span className="text-[13px] font-medium text-ink-primary">{meta.nombre}</span>
      </div>
      <p className="text-3xl font-semibold text-ink-primary tabular-nums leading-none mb-1">{valor}</p>
      <p className="text-[12px] text-ink-muted tabular-nums mb-3">
        {pct.toFixed(1)}% · {meta.que}
      </p>

      {/* Qué hizo cada uno. Sin esto el estado es una caja negra: dos leads
          Tibios pueden ser uno que respondió y otro que solo entró al canal. */}
      {desglose.length > 0 && (
        <ul className="flex flex-col gap-1 mb-3">
          {desglose.map((d) => (
            <li key={d.etiqueta} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="text-ink-secondary leading-snug">{d.etiqueta}</span>
              <span className="text-ink-primary font-medium tabular-nums shrink-0">{d.valor}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-ink-muted leading-snug mt-auto pt-2 border-t border-gridline">
        {accionSugerida(estado)}
      </p>
    </div>
  );
}
