"use client";

import { useState } from "react";

export type FunnelStage = {
  label: string;
  value: number;
};

// Un solo hue (azul), pasos claro -> oscuro para las 3 etapas del embudo.
const STAGE_HATCH = ["#bcd8f8", "#8fb9ef", "#5f97e6"];
const STAGE_SOLID_TOP = ["#eaf2fd", "#dbe9fb", "#cfe1fa"];
const STAGE_SOLID_BOTTOM = ["#4f8ee8", "#3a78d9", "#215fc4"];

function formatValue(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function niceTicks(max: number, count = 5): number[] {
  if (max <= 0) return [0, 1];
  const rawStep = max / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const niceResidual = residual >= 5 ? 10 : residual >= 2 ? 5 : residual >= 1 ? 2 : 1;
  const step = niceResidual * magnitude;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v));
  return ticks;
}

const WIDTH = 1200;
const HEIGHT = 460;
const MARGIN = { top: 128, right: 12, bottom: 8, left: 56 };

export function FunnelStepChart({
  title,
  unitLabel = "contactos",
  stages,
}: {
  title: string;
  unitLabel?: string;
  stages: FunnelStage[];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const uid = title.replace(/[^a-zA-Z0-9]/g, "");

  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const maxValue = Math.max(...stages.map((s) => s.value), 1);
  const ticks = niceTicks(maxValue);
  const scaleMax = ticks[ticks.length - 1] || maxValue;

  const laneWidth = plotWidth / stages.length;
  const barWidth = laneWidth * 0.66;

  const yFor = (value: number) => MARGIN.top + plotHeight - (value / scaleMax) * plotHeight;

  const active = hovered;
  const base = stages[0]?.value ?? 0;

  return (
    <div className="bg-surface border border-gridline rounded-2xl shadow-sm p-8 w-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold text-ink-primary">{title}</h2>
        <button
          type="button"
          aria-label="Opciones"
          className="w-9 h-9 rounded-full border border-gridline flex items-center justify-center text-ink-muted hover:bg-page"
        >
          ⋯
        </button>
      </div>

      <div className="relative select-none">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto overflow-visible">
          <defs>
            {stages.map((_, i) => (
              <pattern
                key={i}
                id={`hatch-${uid}-${i}`}
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="6" fill={STAGE_HATCH[i % STAGE_HATCH.length]} />
                <line x1="0" y1="0" x2="0" y2="6" stroke="#fcfcfb" strokeWidth="2.2" />
              </pattern>
            ))}
            {stages.map((_, i) => (
              <linearGradient key={i} id={`grad-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={STAGE_SOLID_TOP[i % STAGE_SOLID_TOP.length]} />
                <stop offset="100%" stopColor={STAGE_SOLID_BOTTOM[i % STAGE_SOLID_BOTTOM.length]} />
              </linearGradient>
            ))}
            <linearGradient id={`spotlight-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a78d6" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#2a78d6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Banda vertical que ilumina toda la columna activa */}
          {active !== null && (
            <rect
              x={MARGIN.left + laneWidth * active}
              y={0}
              width={laneWidth}
              height={MARGIN.top + plotHeight}
              fill={`url(#spotlight-${uid})`}
            />
          )}

          {/* Grilla horizontal + ticks del eje Y */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={yFor(t)}
                y2={yFor(t)}
                stroke="#eceae2"
                strokeWidth="1"
              />
              <text x={MARGIN.left - 12} y={yFor(t) + 5} textAnchor="end" fontSize="14" fill="#a3a199">
                {formatValue(t)}
              </text>
            </g>
          ))}

          {/* Divisores verticales entre columnas */}
          {stages.map((_, i) => (
            <line
              key={i}
              x1={MARGIN.left + laneWidth * i}
              x2={MARGIN.left + laneWidth * i}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
              stroke="#eceae2"
              strokeWidth="1"
            />
          ))}
          <line
            x1={WIDTH - MARGIN.right}
            x2={WIDTH - MARGIN.right}
            y1={MARGIN.top}
            y2={MARGIN.top + plotHeight}
            stroke="#eceae2"
            strokeWidth="1"
          />

          {/* Barras */}
          {stages.map((s, i) => {
            const laneX = MARGIN.left + laneWidth * i;
            const barX = laneX + (laneWidth - barWidth) / 2;
            const top = yFor(s.value);
            const h = MARGIN.top + plotHeight - top;
            const isActive = i === active;
            return (
              <g
                key={s.label}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                <rect x={laneX} y={0} width={laneWidth} height={MARGIN.top + plotHeight} fill="transparent" />
                {h > 0 && (
                  <rect
                    x={barX}
                    y={top}
                    width={barWidth}
                    height={h}
                    fill={isActive ? `url(#grad-${uid}-${i})` : `url(#hatch-${uid}-${i})`}
                  />
                )}
                {/* pill en el borde superior de la barra */}
                {h > 0 && (
                  <rect
                    x={barX + barWidth * 0.32}
                    y={top - 2.5}
                    width={barWidth * 0.36}
                    height="5"
                    rx="2.5"
                    fill="#fcfcfb"
                    opacity={isActive ? 1 : 0.9}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Etiquetas de cada columna (encima del área del gráfico) */}
        <div
          className="absolute left-0 flex"
          style={{
            top: 0,
            width: "100%",
            paddingLeft: `${(MARGIN.left / WIDTH) * 100}%`,
            paddingRight: `${(MARGIN.right / WIDTH) * 100}%`,
          }}
        >
          {stages.map((s, i) => (
            <button
              key={s.label}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className="text-left px-2 py-1"
              style={{ width: `${100 / stages.length}%` }}
            >
              <p className={`text-base mb-2 ${i === active ? "text-ink-primary font-medium" : "text-ink-muted"}`}>
                {s.label}
              </p>
              <p className="text-4xl md:text-5xl font-semibold text-ink-primary tabular-nums leading-none">
                {formatValue(s.value)}
              </p>
            </button>
          ))}
        </div>

        {/* Tooltip flotante */}
        {active !== null && (
          <div
            className="absolute -translate-x-1/2 -translate-y-full bg-ink-primary text-white text-xs rounded-full pl-3 pr-3 py-2 whitespace-nowrap shadow-lg pointer-events-none flex items-center gap-2"
            style={{
              left: `${((MARGIN.left + laneWidth * (active + 0.5)) / WIDTH) * 100}%`,
              top: `${(Math.max(yFor(stages[active].value) - 10, MARGIN.top + 10) / HEIGHT) * 100}%`,
            }}
          >
            <span className="font-semibold">
              {formatValue(stages[active].value)} {unitLabel}
            </span>
            {base > 0 && (
              <>
                <span className="text-white/30">|</span>
                <span>
                  Conversión: <strong>{Math.round((stages[active].value / base) * 100)}%</strong>
                </span>
              </>
            )}
            {active > 0 && stages[active - 1].value > 0 && (
              <>
                <span className="text-white/30">|</span>
                <span
                  className={
                    stages[active].value >= stages[active - 1].value ? "text-good" : "text-[#ff9b8a]"
                  }
                >
                  Caída: {Math.round((stages[active].value / stages[active - 1].value - 1) * 100)}%
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
