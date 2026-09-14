"use client";

import { useCallback, useEffect, useState } from "react";
import { ESTADO_META } from "@/lib/leadStates";
import { BotonWhatsApp } from "@/components/ContactoRapido";
import { BotonLlamar, ReporteLlamada } from "@/components/Llamada";
import type { Movimiento } from "@/lib/movimientos";

/**
 * Lo que se movió hoy, sin importar cuándo entró el lead.
 *
 * El tablero miraba solo los leads del día, y un lead del 1 de septiembre que
 * vuelve a escribir hoy es la mejor oportunidad de la pantalla: ya conoce la
 * oferta y volvió solo. Acá aparece arriba de todo, con la hora a la que se
 * movió y qué hacer con él.
 */

const AZUL = "#17457F";
const CELESTE = "#EAF1FA";
const ROJO = "#C0392B";
const GRIS = "#9A998F";

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

function llegada(iso: string): string {
  const d = new Date(iso);
  const dias = Math.floor((Date.now() - d.getTime()) / 864e5);
  const fecha = d.toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" });
  if (dias <= 0) return "llegó hoy";
  if (dias === 1) return "llegó ayer";
  return `llegó el ${fecha} · hace ${dias} días`;
}

export function SeMovioHoy() {
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    fetch("/api/movimientos")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Error al leer los movimientos");
        return r.json();
      })
      .then((d: { movimientos: Movimiento[] }) => setMovimientos(d.movimientos))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const esperando = movimientos?.filter((m) => m.esperando).length ?? 0;
  const deHoy = movimientos?.filter((m) => m.dia === "hoy").length ?? 0;

  return (
    <section className="rounded-[22px] overflow-hidden bg-surface border border-gridline mb-5">
      <div
        className="flex items-center gap-x-3 gap-y-1 flex-wrap px-4 sm:px-5 py-2.5"
        style={{ background: AZUL, color: "#fff" }}
      >
        <h2 className="text-[16px] font-semibold tracking-[-0.02em]">Se movió hoy</h2>
        {movimientos && (
          <span className="text-[12px]" style={{ color: "rgba(255,255,255,.6)" }}>
            {deHoy} hoy · {movimientos.length - deHoy} ayer
          </span>
        )}
        {esperando > 0 && (
          <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: ROJO }}>
            {esperando} esperando respuesta
          </span>
        )}
        <button
          onClick={cargar}
          disabled={cargando}
          className="ml-auto rounded-full px-2.5 py-[3px] text-[11px] disabled:opacity-50 hover:opacity-80"
          style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.28)" }}
        >
          {cargando ? "Leyendo…" : "↻ Actualizar"}
        </button>
      </div>

      {error && <p className="px-4 sm:px-5 py-4 text-[13px] text-series2">{error}</p>}

      {cargando && !movimientos && (
        <p className="px-4 sm:px-5 py-4 text-[13px]" style={{ color: GRIS }}>
          Buscando quién se movió…
        </p>
      )}

      {movimientos && movimientos.length === 0 && !cargando && (
        <p className="px-4 sm:px-5 py-4 text-[13px]" style={{ color: GRIS }}>
          No se movió nadie ni hoy ni ayer.
        </p>
      )}

      <div>
        {(movimientos ?? []).map((m, i, todos) => {
          const meta = ESTADO_META[m.estado];
          // El corte entre hoy y ayer: a las 7 de la mañana «hoy» está casi
          // vacío, y lo que el agente necesita ver es lo que se movió mientras
          // no estaba.
          const corte = i === 0 || todos[i - 1].dia !== m.dia;
          return (
            <div key={`${m.contactId}-${m.hora}`}>
              {corte && (
                <p
                  className="px-4 sm:px-5 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] border-t border-gridline"
                  style={{ background: CELESTE, color: AZUL }}
                >
                  {m.dia === "hoy" ? "Hoy" : "Ayer"}
                </p>
              )}
            <article
              className="flex gap-3 px-4 sm:px-5 py-3 border-t border-gridline"
              style={{ background: m.esperando ? "#FDF2F0" : undefined }}
            >
              <span className="text-[13px] font-bold tabular-nums pt-0.5 shrink-0" style={{ color: AZUL }}>
                {hora(m.hora)}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <b className="text-[14px] font-semibold tracking-[-0.015em]">{m.nombre}</b>
                  <span
                    className="text-[10px] font-bold rounded-full px-2 py-[1px]"
                    style={{ background: `color-mix(in srgb, ${meta.color} 16%, var(--surface-1))`, color: meta.color }}
                  >
                    {meta.nombre}
                  </span>
                  <span className="text-[11.5px]" style={{ color: GRIS }}>
                    {llegada(m.llegado)}
                  </span>
                </div>

                {/* Lo que dijo o lo que hizo, en una línea. */}
                <p className="text-[12.5px] mt-1 truncate" style={{ color: "#5E5C56" }}>
                  {m.tipo === "mensaje" ? `«${m.detalle}»` : `✓ ${m.detalle}`}
                </p>

                {/* Y lo único que convierte esto en trabajo. */}
                <p
                  className="text-[12px] font-semibold mt-1 inline-block rounded-lg px-2 py-[2px]"
                  style={{
                    background: m.esperando ? "#FBE3DF" : CELESTE,
                    color: m.esperando ? ROJO : AZUL,
                  }}
                >
                  {m.siguiente}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <ReporteLlamada contactId={m.contactId} />
                <BotonLlamar telefono={m.telefono} nombre={m.nombre} contactId={m.contactId} tamano={28} />
                <BotonWhatsApp telefono={m.telefono} nombre={m.nombre} tamano={28} />
              </div>
            </article>
            </div>
          );
        })}
      </div>
    </section>
  );
}
