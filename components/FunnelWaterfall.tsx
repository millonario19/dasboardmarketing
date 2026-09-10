"use client";

import { useEffect, useRef, useState } from "react";

export type WaterfallStage = {
  label: string;
  value: number;
};

// Lienzo de tamaño fijo: en pantallas angostas el contenedor scrollea en
// horizontal en vez de escalar el SVG, para que el gráfico no se deforme.
const WIDTH = 980;
const HEIGHT = 384;
const M_LEFT = 52;
const M_RIGHT = 14;
const PLOT_TOP = 104;
const PLOT_H = 268;
const PLOT_BOTTOM = PLOT_TOP + PLOT_H;

const BLUE_STRIPE = "#2F5BFF";
const BLUE_DEEP = "#1B4BFF";
const INK = "#0A0A0A";
const GRAY_AXIS = "#B0B4BD";
const GRAY_IDLE = "#C3C7CF";
const GRAY_TIP = "#8A9099";
const BORDER = "#EDEDED";
const GRID = "#F4F5F7";

function formatValue(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

// Escala redondeada a valores "lindos" a partir del máximo real de la serie.
function niceTicks(max: number, count = 5): number[] {
  if (!isFinite(max) || max <= 0) return [0, 1];
  const rawStep = max / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const nice = residual >= 5 ? 10 : residual >= 2 ? 5 : residual >= 1 ? 2 : 1;
  const step = nice * magnitude;
  // El tope se redondea hacia ARRIBA al siguiente múltiplo del paso: si se
  // cortara en el último tick <= max, el valor más alto quedaría fuera de
  // escala y su barra se desbordaría por encima del área del gráfico.
  const top = Math.ceil(max / step) * step;
  const steps = Math.max(Math.round(top / step), 1);
  const ticks: number[] = [];
  for (let i = 0; i <= steps; i += 1) ticks.push(Math.round(i * step));
  return ticks;
}

export function FunnelWaterfall({
  title = "Payments",
  stages,
  initialActive = 2,
}: {
  title?: string;
  stages: WaterfallStage[];
  initialActive?: number;
}) {
  const defaultActive = Math.min(Math.max(initialActive, 0), Math.max(stages.length - 1, 0));
  const [active, setActive] = useState(defaultActive);

  const tipRef = useRef<HTMLDivElement>(null);
  const [tipW, setTipW] = useState(200);

  const laneW = (WIDTH - M_LEFT - M_RIGHT) / Math.max(stages.length, 1);
  const maxValue = Math.max(...stages.map((s) => s.value), 0);
  const ticks = niceTicks(maxValue);
  const scaleMax = ticks[ticks.length - 1] || 1;
  const yFor = (value: number) => PLOT_BOTTOM - (Math.max(value, 0) / scaleMax) * PLOT_H;

  const current = stages[active];
  const prev = active > 0 ? stages[active - 1] : null;
  const conversion = prev && prev.value > 0 ? Math.round((current.value / prev.value) * 100) : null;

  // Medimos el tooltip real para poder voltearlo cuando no entra a la derecha.
  useEffect(() => {
    if (tipRef.current) setTipW(tipRef.current.offsetWidth);
  }, [active, current?.value, conversion]);

  const laneX = M_LEFT + laneW * active;
  const barTop = yFor(current?.value ?? 0);
  let tipLeft = laneX + laneW / 2 + 8;
  if (tipLeft + tipW > WIDTH - 4) tipLeft = laneX + laneW / 2 - tipW - 8;
  if (tipLeft < 4) tipLeft = 4;
  const tipTop = barTop - 54 >= PLOT_TOP - 8 ? barTop - 54 : barTop + 14;

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
        padding: "22px 24px 18px",
        fontFamily:
          'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: INK, margin: 0 }}>
          {title}
        </h2>
        <button
          type="button"
          aria-label="Opciones"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: `1px solid ${BORDER}`,
            background: "#FFFFFF",
            color: GRAY_AXIS,
            fontSize: 18,
            lineHeight: 1,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          &#8943;
        </button>
      </div>

      <div style={{ overflowX: "auto", overflowY: "hidden" }}>
        <div style={{ position: "relative", width: WIDTH, height: HEIGHT, userSelect: "none" }}>
          <svg
            width={WIDTH}
            height={HEIGHT}
            style={{ position: "absolute", inset: 0, display: "block" }}
            onMouseLeave={() => setActive(defaultActive)}
          >
            <defs>
              {/* Rayas diagonales a 45° para las columnas inactivas. */}
              <pattern
                id="fw-hatch"
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="7" stroke={BLUE_STRIPE} strokeWidth="3" />
              </pattern>
              {/* Velo blanco: deja las rayas casi transparentes arriba y saturadas abajo.
                  Sin gradientUnits, el gradiente se ajusta al alto de cada barra. */}
              <linearGradient id="fw-scrim" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.04" />
              </linearGradient>
              {/* Barra activa: degradado sólido, muy claro arriba y azul intenso abajo. */}
              <linearGradient id="fw-active" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FAFBFF" />
                <stop offset="100%" stopColor={BLUE_DEEP} />
              </linearGradient>
            </defs>

            {/* Guías horizontales + eje Y */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M_LEFT} x2={WIDTH - M_RIGHT} y1={yFor(t)} y2={yFor(t)} stroke={GRID} strokeWidth="1" />
                <text x={M_LEFT - 12} y={yFor(t) + 4} textAnchor="end" fontSize="13" fill={GRAY_AXIS}>
                  {formatValue(t)}
                </text>
              </g>
            ))}

            {/* Separadores verticales entre columnas */}
            {stages.map((_, i) => (
              <line
                key={`div-${i}`}
                x1={M_LEFT + laneW * i}
                x2={M_LEFT + laneW * i}
                y1={PLOT_TOP}
                y2={PLOT_BOTTOM}
                stroke="#F1F2F4"
                strokeWidth="1"
              />
            ))}
            <line
              x1={WIDTH - M_RIGHT}
              x2={WIDTH - M_RIGHT}
              y1={PLOT_TOP}
              y2={PLOT_BOTTOM}
              stroke="#F1F2F4"
              strokeWidth="1"
            />

            {/* Barras: cada una ocupa todo el ancho de su columna, sin separación.
                Las tres capas se cruzan por opacidad para poder animar el cambio. */}
            {stages.map((s, i) => {
              const x = M_LEFT + laneW * i;
              const top = yFor(s.value);
              const h = PLOT_BOTTOM - top;
              if (h <= 0) return null;
              const isActive = i === active;
              const fade = { transition: "opacity 200ms ease" } as const;
              return (
                <g key={`bar-${s.label}`}>
                  <rect x={x} y={top} width={laneW} height={h} fill="url(#fw-hatch)" style={{ ...fade, opacity: isActive ? 0 : 1 }} />
                  <rect x={x} y={top} width={laneW} height={h} fill="url(#fw-scrim)" style={{ ...fade, opacity: isActive ? 0 : 1 }} />
                  <rect x={x} y={top} width={laneW} height={h} fill="url(#fw-active)" style={{ ...fade, opacity: isActive ? 1 : 0 }} />
                  <rect
                    x={x + laneW / 2 - 9}
                    y={top - 2.5}
                    width={18}
                    height={5}
                    rx={2.5}
                    fill={isActive ? BLUE_DEEP : BLUE_STRIPE}
                    style={{ transition: "fill 200ms ease" }}
                  />
                </g>
              );
            })}

            {/* Zonas de hover: toda la columna, encabezado incluido. */}
            {stages.map((s, i) => (
              <rect
                key={`hit-${s.label}`}
                x={M_LEFT + laneW * i}
                y={0}
                width={laneW}
                height={PLOT_BOTTOM}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setActive(i)}
              />
            ))}
          </svg>

          {/* Encabezados de columna: etiqueta chica + valor grande */}
          {stages.map((s, i) => (
            <div
              key={`head-${s.label}`}
              style={{
                position: "absolute",
                left: M_LEFT + laneW * i,
                top: 12,
                width: laneW,
                paddingRight: 12,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  lineHeight: "17px",
                  marginBottom: 6,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: i === active ? INK : GRAY_IDLE,
                  transition: "color 200ms ease",
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 30,
                  lineHeight: "36px",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                  color: i === active ? INK : GRAY_IDLE,
                  transition: "color 200ms ease",
                }}
              >
                {formatValue(s.value)}
              </div>
            </div>
          ))}

          {/* Tooltip flotante sobre la barra activa */}
          {current && (
            <div
              ref={tipRef}
              style={{
                position: "absolute",
                left: tipLeft,
                top: tipTop,
                display: "flex",
                alignItems: "center",
                gap: 8,
                whiteSpace: "nowrap",
                background: "#FFFFFF",
                borderRadius: 999,
                padding: "11px 20px",
                boxShadow: "0 6px 20px rgba(16,24,40,0.13), 0 1px 3px rgba(16,24,40,0.08)",
                pointerEvents: "none",
                transition: "left 200ms ease, top 200ms ease",
              }}
            >
              <span style={{ position: "absolute", left: -7, top: -9 }}>
                <svg width="18" height="21" viewBox="0 0 12 19" fill="none">
                  <path
                    d="M1 1L1 15.4L4.6 12.1L7 17.9L9.7 16.7L7.3 11.2L11.5 11.2Z"
                    fill="#000000"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {formatValue(current.value)}
              </span>
              {conversion !== null && (
                <span style={{ fontSize: 13, color: GRAY_TIP }}>Conversion: {conversion}%</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
