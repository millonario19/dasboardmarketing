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
  const tramos: { estado: EstadoLead | null; desde: number; hasta: number }[] = [];
  if (suma === 0) {
    tramos.push({ estado: null, desde: INICIO, hasta: INICIO + BARRIDO });
  } else {
    let g = INICIO;
    for (const estado of ESTADOS) {
      if (conteos[estado] === 0) continue;
      const ancho = (conteos[estado] / suma) * utiles;
      tramos.push({ estado, desde: g, hasta: g + ancho });
      g += ancho + HUECO;
    }
  }

  return (
    <div className="relative w-[300px] sm:w-[320px] max-w-full mx-auto">
      {/* El recuadro empieza en 15 y llega a 250: arriba sobraba aire y
          abajo las puntas redondeadas de los tramos quedaban cortadas. */}
      <svg viewBox="0 15 340 235" className="w-full">
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

/**
 * Las tres temperaturas en una fila, debajo del arco.
 *
 * Antes cada una flotaba al lado de su tramo. Se veía desordenado —cada
 * etiqueta a una altura distinta— y la del medio subía tanto que chocaba con
 * las pestañas del título. En fila se leen las tres de un golpe y siempre
 * quedan en el mismo lugar, no importa cómo venga el reparto del día.
 */
export function LeyendaTemperatura({ conteos }: { conteos: Record<EstadoLead, number> }) {
  return (
    <div className="flex justify-center gap-4 sm:gap-6 flex-wrap -mt-1">
      {ESTADOS.map((estado) => (
        <span key={estado} className="inline-flex items-center gap-1.5 text-[13px] text-ink-secondary">
          <i className="w-2.5 h-2.5 rounded-full" style={{ background: ESTADO_META[estado].color }} />
          {ESTADO_META[estado].nombre}s <b className="font-bold tabular-nums text-ink-primary">{conteos[estado]}</b>
        </span>
      ))}
    </div>
  );
}
