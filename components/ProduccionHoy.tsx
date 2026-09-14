"use client";

import type { DiaDeProduccion } from "@/lib/metrics";

/**
 * Lo de hoy, en grande.
 *
 * Antes esto era una fila de una tabla de seis columnas: para un agente, que
 * solo se ve a sí mismo, eso es un formulario, no un tablero. Acá los tres
 * números que le importan ocupan la pantalla, y el mes —que ya no puede
 * cambiar— queda en una franja al pie.
 *
 * Las barritas son los últimos días. Sin ellas un «3» no dice nada: al lado de
 * una semana de ceros es una buena mañana, y al lado de una semana de cincos
 * es un mal día.
 */

const AZUL = "#2A78D6";
const DORADO = "#C08400";
const VERDE = "#157F52";
const ROJO = "#C0392B";

type Metrica = {
  rotulo: string;
  color: string;
  hoy: number;
  ayer: number | null;
  serie: number[];
};

function Barritas({ serie, color }: { serie: number[]; color: string }) {
  const ancho = 150;
  const alto = 26;
  const hueco = 3;
  const max = Math.max(...serie, 1);
  const bw = (ancho - hueco * (serie.length - 1)) / serie.length;

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      preserveAspectRatio="none"
      width="100%"
      height={alto}
      className="mt-3"
      aria-hidden
    >
      {serie.map((v, i) => {
        const h = Math.max((v / max) * alto, 2);
        return (
          <rect
            key={i}
            x={i * (bw + hueco)}
            y={alto - h}
            width={bw}
            height={h}
            rx={2}
            fill={color}
            // El día de hoy, a pleno; los anteriores, apagados. Así la barra
            // que importa se encuentra sin buscarla.
            opacity={i === serie.length - 1 ? 1 : 0.26}
          />
        );
      })}
    </svg>
  );
}

function Diferencia({ hoy, ayer }: { hoy: number; ayer: number | null }) {
  if (ayer === null) {
    return (
      <span className="block text-[11px] mt-2 text-ink-muted">sin día anterior para comparar</span>
    );
  }
  const d = hoy - ayer;
  if (d === 0) return <span className="block text-[11px] mt-2 text-ink-muted">— igual que ayer</span>;
  return (
    <span className="block text-[11px] mt-2 text-ink-muted">
      <b className="font-bold" style={{ color: d > 0 ? VERDE : ROJO }}>
        {d > 0 ? "▲" : "▼"} {Math.abs(d)}
      </b>{" "}
      vs ayer
    </span>
  );
}

export function ProduccionHoy({
  serie,
  totals,
  propio,
}: {
  serie: DiaDeProduccion[];
  totals: {
    leadsHoy: number;
    leadsMes: number;
    registrosHoy: number;
    ftdHoy: number;
    registrosMes: number;
    ftdMes: number;
  };
  propio: boolean;
}) {
  const ayer = serie.length >= 2 ? serie[serie.length - 2] : null;

  const metricas: Metrica[] = [
    {
      rotulo: "Leads",
      color: AZUL,
      hoy: totals.leadsHoy,
      ayer: ayer?.leads ?? null,
      serie: serie.map((d) => d.leads),
    },
    {
      rotulo: "Registros",
      color: DORADO,
      hoy: totals.registrosHoy,
      ayer: ayer?.registros ?? null,
      serie: serie.map((d) => d.registros),
    },
    {
      rotulo: "Depósitos",
      color: VERDE,
      hoy: totals.ftdHoy,
      ayer: ayer?.ftd ?? null,
      serie: serie.map((d) => d.ftd),
    },
  ];

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  return (
    <section className="mb-8 rounded-[22px] overflow-hidden bg-surface border border-gridline">
      <div className="px-5 sm:px-6 pt-5 pb-5">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-[26px] font-light tracking-[-0.04em]">Hoy</h2>
          <span className="text-[10px] font-semibold uppercase tracking-[.16em] text-ink-muted first-letter:uppercase">
            {new Date().toLocaleDateString("es-CO", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "America/Bogota",
            })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {metricas.map((m) => (
            <article
              key={m.rotulo}
              className="relative rounded-2xl px-4 pt-4 pb-3.5 bg-page border border-gridline overflow-hidden"
            >
              <i className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: m.color }} />
              <span className="block text-[9.5px] font-semibold uppercase tracking-[.16em] text-ink-muted">
                {m.rotulo}
              </span>
              <strong
                className="block text-[52px] font-light tracking-[-0.05em] leading-none mt-2 tabular-nums"
                style={{ color: m.color }}
              >
                {m.hoy}
              </strong>
              <Diferencia hoy={m.hoy} ayer={m.ayer} />
              {m.serie.length > 1 && <Barritas serie={m.serie} color={m.color} />}
            </article>
          ))}
        </div>
      </div>

      {/* El mes, en celeste: ya no se puede cambiar, así que no compite con lo
          de arriba, que es lo único que se puede atender hoy. */}
      <div
        className="flex items-center gap-x-4 gap-y-1.5 flex-wrap px-5 sm:px-6 py-3 text-[11.5px]"
        style={{ background: "#EAF1FA", borderTop: "1px solid #d9e6f5", color: "#4a7fb5" }}
      >
        <span className="text-[9.5px] font-bold uppercase tracking-[.16em]" style={{ color: "#2A6FB8" }}>
          {propio ? "Tu mes" : "El mes"}
        </span>
        <span>
          <b className="font-bold tabular-nums" style={{ color: "#17457F" }}>
            {totals.leadsMes}
          </b>{" "}
          leads
        </span>
        <span>
          <b className="font-bold tabular-nums" style={{ color: "#17457F" }}>
            {totals.registrosMes}
          </b>{" "}
          registros
        </span>
        <span>
          <b className="font-bold tabular-nums" style={{ color: "#17457F" }}>
            {totals.ftdMes}
          </b>{" "}
          depósitos
        </span>
        <span style={{ color: "#bcd3ea" }}>│</span>
        <span>
          <b className="font-bold tabular-nums" style={{ color: "#17457F" }}>
            {pct(totals.registrosMes, totals.leadsMes)}%
          </b>{" "}
          lead → registro
        </span>
        <span>
          <b className="font-bold tabular-nums" style={{ color: "#17457F" }}>
            {pct(totals.ftdMes, totals.registrosMes)}%
          </b>{" "}
          registro → depósito
        </span>
      </div>
    </section>
  );
}
