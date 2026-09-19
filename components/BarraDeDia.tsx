"use client";

import { DIAS_ATRAS_MAX, diaLargo, diaMasViejo, hoyBogota } from "@/lib/dia";

/**
 * La fecha de toda la pantalla, en un solo control.
 *
 * Antes cada paso traía su propio selector: el del paso 1 no le avisaba a
 * nadie y el del paso 2 mandaba en los pasos 3 y 4. Elegir el 18 arriba movía
 * un solo paso y los otros tres seguían mostrando hoy, así que los cuatro
 * números de la pantalla eran de días distintos.
 *
 * Va arriba de todo y a la vista incluso cuando dice «hoy»: un filtro que solo
 * aparece cuando está activo es un filtro que uno olvida que dejó puesto.
 *
 * El límite hacia atrás son 6 días porque es lo que guarda el seguimiento; más
 * atrás los pasos 3 y 4 saldrían vacíos y parecería que el agente no trabajó.
 */

const AZUL = "#17457F";

export function BarraDeDia({
  dia,
  onCambiar,
}: {
  /** Día en Bogotá, «2026-09-18». `null` es hoy. */
  dia: string | null;
  onCambiar: (dia: string | null) => void;
}) {
  const hoy = hoyBogota();
  const actual = dia ?? hoy;
  const viejo = diaMasViejo();

  /** Corre la fecha n días, sin salirse de la ventana que hay datos. */
  function correr(n: number) {
    const destino = new Date(`${actual}T12:00:00-05:00`);
    destino.setDate(destino.getDate() + n);
    const iso = destino.toISOString().slice(0, 10);
    if (iso > hoy || iso < viejo) return;
    onCambiar(iso === hoy ? null : iso);
  }

  const paso = (v: string) => (v === hoy || v === "" ? null : v);
  const esHoy = actual === hoy;

  return (
    <div
      className="flex items-center gap-2 flex-wrap rounded-[16px] md:rounded-[20px] border px-3 md:px-4 py-2 md:py-2.5 mb-3 md:mb-4"
      style={{
        borderColor: esHoy ? "var(--gridline)" : AZUL,
        background: esHoy ? "var(--surface-1)" : "#EAF1FA",
      }}
    >
      <span
        className="text-[9.5px] md:text-[11px] font-bold uppercase tracking-[.16em] shrink-0"
        style={{ color: AZUL }}
      >
        Estoy viendo
      </span>

      <span
        className="text-[14px] md:text-[17px] font-semibold tracking-[-0.02em] first-letter:uppercase min-w-0 flex-1"
        style={{ color: "var(--text-primary)" }}
      >
        {esHoy ? `Hoy · ${diaLargo(actual)}` : diaLargo(actual)}
      </span>

      <span className="flex items-center gap-1.5 shrink-0">
        <Flecha texto="‹" titulo="Un día atrás" onClick={() => correr(-1)} apagada={actual <= viejo} />
        <Flecha texto="›" titulo="Un día adelante" onClick={() => correr(1)} apagada={esHoy} />

        <input
          type="date"
          value={actual}
          min={viejo}
          max={hoy}
          onChange={(e) => onCambiar(paso(e.target.value))}
          className="border border-gridline rounded-full px-2.5 py-1 md:py-1.5 text-[12px] md:text-[13.5px] bg-surface text-ink-secondary"
        />

        {/* Solo cuando hay algo que deshacer: un botón «Hoy» que no hace nada
            enseña a ignorarlo. */}
        {!esHoy && (
          <button
            onClick={() => onCambiar(null)}
            className="rounded-full px-3 py-1 md:py-1.5 text-[12px] md:text-[13.5px] font-semibold text-white hover:opacity-90"
            style={{ background: AZUL }}
          >
            Hoy
          </button>
        )}
      </span>

      {!esHoy && (
        <span className="basis-full text-[11px] md:text-[12.5px]" style={{ color: "#5E5C56" }}>
          Los cuatro pasos están mostrando este día. Hacia atrás llega hasta{" "}
          {DIAS_ATRAS_MAX} días.
        </span>
      )}
    </div>
  );
}

function Flecha({
  texto,
  titulo,
  onClick,
  apagada,
}: {
  texto: string;
  titulo: string;
  onClick: () => void;
  apagada: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={apagada}
      title={titulo}
      aria-label={titulo}
      className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-gridline bg-surface text-[15px] leading-none text-ink-secondary hover:bg-page disabled:opacity-30"
    >
      {texto}
    </button>
  );
}
