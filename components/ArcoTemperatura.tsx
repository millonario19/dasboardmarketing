"use client";

import { ESTADOS, ESTADO_META, type EstadoLead } from "@/lib/leadStates";

// Arco de 240°, abierto abajo. Va de frío a caliente de izquierda a derecha.
const CX = 170;
const CY = 168;
const R = 124;
const GROSOR = 30;
const HUECO = 5; // separación entre tramos, en grados
const INICIO = 150;
const BARRIDO = 240;

const rad = (grados: number) => (grados * Math.PI) / 180;
const punto = (grados: number, radio: number): [number, number] => [
  CX + radio * Math.cos(rad(grados)),
  CY + radio * Math.sin(rad(grados)),
];

function arco(desde: number, hasta: number, radio: number): string {
  const [x1, y1] = punto(desde, radio);
  const [x2, y2] = punto(hasta, radio);
  const largo = hasta - desde > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${radio} ${radio} 0 ${largo} 1 ${x2} ${y2}`;
}

/**
 * El reparto del día por temperatura, en un arco.
 *
 * No es un puntaje: cada tramo mide exactamente la porción que le toca según
 * cuántos leads tenga. Se lee el equilibrio del día sin leer un solo número —
 * un arco casi todo azul dice "nadie respondió" de un vistazo.
 */
export function ArcoTemperatura({
  conteos,
  total,
  calientes,
}: {
  conteos: Record<EstadoLead, number>;
  total: number;
  calientes: number;
}) {
  const suma = ESTADOS.reduce((s, e) => s + conteos[e], 0);
  const utiles = BARRIDO - HUECO * (ESTADOS.length - 1);

  // Sin leads no hay reparto: un arco gris entero es más honesto que tres
  // tramos iguales, que sugerirían un empate que no existe.
  const tramos: { estado: EstadoLead | null; desde: number; hasta: number; medio: number }[] = [];
  if (suma === 0) {
    tramos.push({ estado: null, desde: INICIO, hasta: INICIO + BARRIDO, medio: INICIO + BARRIDO / 2 });
  } else {
    let g = INICIO;
    for (const estado of ESTADOS) {
      if (conteos[estado] === 0) continue;
      const ancho = (conteos[estado] / suma) * utiles;
      tramos.push({ estado, desde: g, hasta: g + ancho, medio: g + ancho / 2 });
      g += ancho + HUECO;
    }
  }

  return (
    <div className="relative w-[340px] max-w-full mx-auto">
      <svg viewBox="0 0 340 230" className="w-full">
        {tramos.map((t, i) => (
          <path
            key={i}
            d={arco(t.desde, t.hasta, R)}
            stroke={t.estado ? ESTADO_META[t.estado].color : "rgba(13,13,13,.10)"}
            strokeWidth={GROSOR}
            strokeLinecap="round"
            fill="none"
            opacity={0.92}
          />
        ))}
      </svg>

      {/* Etiquetas alrededor del arco. Se esconden en pantallas angostas,
          donde no entran sin salirse del borde; ahí las reemplaza la leyenda. */}
      <div className="absolute inset-0 pointer-events-none hidden sm:block">
        {tramos.map((t, i) => {
          if (!t.estado) return null;
          const meta = ESTADO_META[t.estado];
          const [x, y] = punto(t.medio, R + 44);
          const cos = Math.cos(rad(t.medio));
          const mover = cos < -0.2 ? "translate(-100%, -50%)" : cos > 0.2 ? "translate(0, -50%)" : "translate(-50%, -50%)";
          return (
            <span
              key={i}
              className="absolute flex items-center gap-1.5 text-[12px] whitespace-nowrap text-ink-secondary"
              style={{ left: `${(x / 340) * 100}%`, top: `${(y / 230) * 100}%`, transform: mover }}
            >
              <i className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
              {meta.nombre}s <b className="font-bold tabular-nums">{conteos[t.estado]}</b>
            </span>
          );
        })}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center pt-[18px]">
        {calientes > 0 && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold whitespace-nowrap"
            style={{ background: "#C6F24E", color: "#0D0D0D" }}
          >
            🔥 {calientes} caliente{calientes === 1 ? "" : "s"}
          </span>
        )}
        <span className="text-[52px] sm:text-[62px] font-light tracking-[-0.04em] leading-[1.05] tabular-nums">
          {total}
        </span>
        <span className="text-[12.5px] text-ink-secondary -mt-0.5">pendientes</span>
      </div>
    </div>
  );
}

/** La misma información en fila, para cuando el arco no tiene lugar al lado. */
export function LeyendaTemperatura({ conteos }: { conteos: Record<EstadoLead, number> }) {
  return (
    <div className="flex sm:hidden justify-center gap-3.5 flex-wrap mt-2.5">
      {ESTADOS.map((estado) => (
        <span key={estado} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-secondary">
          <i className="w-2.5 h-2.5 rounded-full" style={{ background: ESTADO_META[estado].color }} />
          {ESTADO_META[estado].nombre}s <b className="font-bold tabular-nums">{conteos[estado]}</b>
        </span>
      ))}
    </div>
  );
}
