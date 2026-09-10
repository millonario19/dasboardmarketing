"use client";

import { useEffect, useRef, useState } from "react";

export type WaterfallStage = {
  label: string;
  value: number;
};

// Escala global de la tarjeta. Todas las medidas (geometría, tipografía,
// espaciados) se derivan de esta constante, así que para agrandarla o
// achicarla alcanza con tocar este número.
const S = 0.8;
const px = (n: number) => n * S;

// Lienzo de tamaño fijo: en pantallas angostas el contenedor scrollea en
// horizontal en vez de escalar el SVG, para que el gráfico no se deforme.
const WIDTH = px(980);
const HEIGHT = px(384);
const M_LEFT = px(52);
const M_RIGHT = px(14);
const PLOT_TOP = px(104);
const PLOT_H = px(268);
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
  title = "Métricas",
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
  const [tipW, setTipW] = useState(px(200));

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
  let tipLeft = laneX + laneW / 2 + px(8);
  if (tipLeft + tipW > WIDTH - px(4)) tipLeft = laneX + laneW / 2 - tipW - px(8);
  if (tipLeft < px(4)) tipLeft = px(4);
  const tipTop = barTop - px(54) >= PLOT_TOP - px(8) ? barTop - px(54) : barTop + px(14);

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${BORDER}`,
        borderRadius: px(20),
        boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
        padding: `${px(22)}px ${px(24)}px ${px(18)}px`,
        fontFamily:
          'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: px(26), fontWeight: 700, letterSpacing: "-0.02em", color: INK, margin: 0 }}>
          {title}
        </h2>
        <button
          type="button"
          aria-label="Opciones"
          style={{
            width: px(44),
            height: px(44),
            borderRadius: "50%",
            border: `1px solid ${BORDER}`,
            background: "#FFFFFF",
            color: GRAY_AXIS,
            fontSize: px(18),
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
                width={px(7)}
                height={px(7)}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2={px(7)} stroke={BLUE_STRIPE} strokeWidth={px(3)} />
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
                <text x={M_LEFT - px(12)} y={yFor(t) + px(4)} textAnchor="end" fontSize={px(13)} fill={GRAY_AXIS}>
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
                    x={x + laneW / 2 - px(9)}
                    y={top - px(2.5)}
                    width={px(18)}
                    height={px(5)}
                    rx={px(2.5)}
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
                top: px(12),
                width: laneW,
                paddingRight: px(12),
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  fontSize: px(13),
                  lineHeight: `${px(17)}px`,
                  marginBottom: px(6),
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
                  fontSize: px(30),
                  lineHeight: `${px(36)}px`,
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
                gap: px(8),
                whiteSpace: "nowrap",
                background: "#FFFFFF",
                borderRadius: 999,
                padding: `${px(11)}px ${px(20)}px`,
                boxShadow: "0 6px 20px rgba(16,24,40,0.13), 0 1px 3px rgba(16,24,40,0.08)",
                pointerEvents: "none",
                transition: "left 200ms ease, top 200ms ease",
              }}
            >
              <span style={{ position: "absolute", left: px(-7), top: px(-9) }}>
                <svg width={px(18)} height={px(21)} viewBox="0 0 12 19" fill="none">
                  <path
                    d="M1 1L1 15.4L4.6 12.1L7 17.9L9.7 16.7L7.3 11.2L11.5 11.2Z"
                    fill="#000000"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span style={{ fontSize: px(13), fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {formatValue(current.value)}
              </span>
              {conversion !== null && (
                <span style={{ fontSize: px(13), color: GRAY_TIP }}>Conversion: {conversion}%</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
