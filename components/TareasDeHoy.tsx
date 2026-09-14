"use client";

import { useCallback, useEffect, useState } from "react";
import { BotonWhatsApp } from "@/components/ContactoRapido";
import { BotonLlamar } from "@/components/Llamada";
import { FichaCliente } from "@/components/FichaCliente";
import { metaTipo } from "@/lib/tiposAccion";
import type { Accion, ResumenDelDia } from "@/lib/acciones";

/**
 * Lo primero de la mañana: lo que el agente mismo se programó.
 *
 * No sale de ninguna etiqueta de GHL ni de ninguna automatización. Sale de lo
 * que él escribió ayer, antier y la semana pasada al cerrar cada ficha. Es la
 * única lista del tablero que el sistema no puede armar solo — y por eso es la
 * que dice quién trabaja.
 *
 * Vencidas y de hoy van separadas: son dos urgencias distintas, y mezclarlas
 * hace que lo que se pasó ayer se pierda entre lo de hoy.
 */

const AZUL = "#17457F";
const CELESTE = "#EAF1FA";
const VERDE = "#157F52";
const VERDE_CLARO = "#EEF7F2";
const ROJO = "#C0392B";
const ROJO_CLARO = "#FDF2F0";
const AMBAR = "#B5701F";
const AMBAR_CLARO = "#FDF3E6";
const GRIS = "#9A998F";

type Datos = {
  vencidas: Accion[];
  hoy: Accion[];
  masAdelante: number;
  resumen: ResumenDelDia;
};

function hora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

function Fila({ tarea, onHecha }: { tarea: Accion; onHecha: () => void }) {
  const [abierta, setAbierta] = useState(false);
  const vencida = new Date(tarea.venceEn!) < new Date();
  const m = metaTipo(tarea.tipo);

  return (
    <>
      <article
        className="flex gap-3 items-start px-4 sm:px-5 py-2.5 border-t border-gridline"
        style={{ background: vencida ? ROJO_CLARO : undefined }}
      >
        <span
          className="w-[26px] h-[26px] rounded-full shrink-0 flex items-center justify-center text-[12px] mt-px"
          style={{ background: vencida ? "#fff" : CELESTE, color: vencida ? ROJO : AZUL }}
        >
          {m.icono}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold leading-tight">
            {tarea.nombre || "Sin nombre"}
          </span>
          <span className="block text-[12.5px] mt-0.5">
            <b className="font-semibold">{m.tarea}</b>{" "}
            <b className="tabular-nums font-semibold" style={{ color: vencida ? ROJO : AMBAR }}>
              {vencida ? "⏰ era " : ""}
              {hora(tarea.venceEn!)}
            </b>
          </span>
          {tarea.detalle && (
            <span className="block text-[11.5px] mt-0.5" style={{ color: GRIS }}>
              «{tarea.detalle}»
            </span>
          )}
        </span>

        <span className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setAbierta((v) => !v)}
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: CELESTE, color: AZUL }}
          >
            {abierta ? "Cerrar" : "Ver"}
          </button>
          <BotonLlamar
            telefono={tarea.telefono}
            nombre={tarea.nombre ?? ""}
            contactId={tarea.contactId}
            tamano={26}
          />
          <BotonWhatsApp telefono={tarea.telefono} nombre={tarea.nombre ?? ""} tamano={26} />
        </span>
      </article>

      {abierta && (
        <FichaCliente
          contactId={tarea.contactId}
          nombre={tarea.nombre ?? "este cliente"}
          telefono={tarea.telefono}
          onCambio={onHecha}
        />
      )}
    </>
  );
}

export function TareasDeHoy({ onResumen }: { onResumen?: (pendientes: number) => void }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    fetch("/api/tareas")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Datos | null) => {
        setDatos(d);
        if (d) onResumen?.(d.vencidas.length + d.hoy.length);
      })
      .catch(() => setDatos(null))
      .finally(() => setCargando(false));
    // onResumen cambia en cada render del padre; incluirlo recargaría en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const r = datos?.resumen;

  return (
    <section className="rounded-[22px] overflow-hidden bg-surface border border-gridline mb-5">
      <div
        className="flex items-center gap-x-3 gap-y-1 flex-wrap px-4 sm:px-5 py-2.5"
        style={{ background: AZUL, color: "#fff" }}
      >
        <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Hoy tenés que llamar</h2>
        <span className="text-[12px]" style={{ color: "rgba(255,255,255,.7)" }}>
          lo que vos mismo programaste
        </span>
        <button
          onClick={cargar}
          disabled={cargando}
          className="ml-auto rounded-full px-2.5 py-[3px] text-[11px] disabled:opacity-50 hover:opacity-80"
          style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.28)" }}
        >
          {cargando ? "Leyendo…" : "↻ Actualizar"}
        </button>
      </div>

      {cargando && !datos && (
        <p className="px-4 sm:px-5 py-4 text-[13px]" style={{ color: GRIS }}>
          Buscando tus tareas…
        </p>
      )}

      {datos && datos.vencidas.length === 0 && datos.hoy.length === 0 && (
        <p className="px-4 sm:px-5 py-4 text-[13px]" style={{ color: GRIS }}>
          No tenés nada programado para hoy.{" "}
          {datos.masAdelante > 0
            ? `Tenés ${datos.masAdelante} para más adelante.`
            : "Cuando cierres una ficha, dejá puesto qué sigue y aparece acá el día que toca."}
        </p>
      )}

      {datos && datos.vencidas.length > 0 && (
        <>
          <p
            className="px-4 sm:px-5 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] border-t border-gridline"
            style={{ background: ROJO_CLARO, color: ROJO }}
          >
            Se te pasaron · {datos.vencidas.length}
          </p>
          {datos.vencidas.map((t) => (
            <Fila key={t.id} tarea={t} onHecha={cargar} />
          ))}
        </>
      )}

      {datos && datos.hoy.length > 0 && (
        <>
          <p
            className="px-4 sm:px-5 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] border-t border-gridline"
            style={{ background: AMBAR_CLARO, color: AMBAR }}
          >
            Para hoy · {datos.hoy.length}
          </p>
          {datos.hoy.map((t) => (
            <Fila key={t.id} tarea={t} onHecha={cargar} />
          ))}
        </>
      )}

      {/* El marcador. Sale de las mismas filas que el agente fue guardando: es
          el número que hoy lleva a mano en el Excel, sin escribirlo dos veces. */}
      {r && (
        <>
          <p
            className="px-4 sm:px-5 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] border-t border-gridline"
            style={{ background: VERDE_CLARO, color: VERDE }}
          >
            Mis acciones de hoy
          </p>
          <div className="flex flex-wrap">
            {[
              { l: "Llamadas", v: r.llamadas },
              { l: "Mensajes", v: r.mensajes },
              { l: "Material enviado", v: r.material },
              { l: "Tareas cumplidas", v: r.cumplidas },
              { l: "Se te pasaron", v: r.vencidas, malo: true },
            ].map((c) => (
              <div
                key={c.l}
                className="flex-1 min-w-[120px] px-4 sm:px-5 py-3 border-r border-gridline last:border-r-0"
              >
                <span
                  className="block text-[9.5px] font-bold uppercase tracking-[.14em]"
                  style={{ color: GRIS }}
                >
                  {c.l}
                </span>
                <div
                  className="text-[24px] font-bold tracking-[-0.035em] leading-none tabular-nums mt-1"
                  style={{ color: c.malo && c.v > 0 ? ROJO : undefined }}
                >
                  {c.v}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
