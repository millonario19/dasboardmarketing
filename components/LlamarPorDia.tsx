"use client";

import { useEffect, useState } from "react";
import { BotonLlamar } from "@/components/Llamada";
import { pedirSeguimiento } from "@/components/Seguimiento";
import type { DiaDeSeguimiento, LeadDeSeguimiento } from "@/lib/seguimiento";

/**
 * A quién llamar hoy, del día 2 y del día 3.
 *
 * No son las tareas que el agente se puso: es la cola de llamadas del embudo —
 * todo el que entró anteayer o antier y sigue sin registrarse. Se trabaja de
 * arriba hacia abajo, caliente primero.
 *
 * El formulario es corto a propósito: qué pasó, una observación y cuándo
 * volver a llamar. Nada más. Todo lo demás —el material, el hilo completo— vive
 * en la ficha del paso 3; acá el agente tiene el teléfono en la mano.
 */

const AZUL = "#17457F";
const CELESTE = "#EAF1FA";
const VERDE = "#157F52";
const ROJO = "#C0392B";
const GRIS = "#9A998F";
const GRIS_2 = "#5E5C56";

const TEMPERATURAS = [
  { id: "caliente" as const, titulo: "Calientes", color: ROJO, fondo: "#FDF2F0" },
  { id: "tibio" as const, titulo: "Tibios", color: "#B5701F", fondo: "#FDF3E6" },
  { id: "frio" as const, titulo: "Fríos", color: "#2A78D6", fondo: "#EEF3FA" },
];

/** Lo que pudo pasar en una llamada, en el orden en que pasa. */
const RESULTADOS = [
  { id: "no-contesto", texto: "No contestó", vuelve: true },
  { id: "contesto", texto: "Contestó, lo piensa", vuelve: true },
  { id: "va-registrar", texto: "Va a registrarse", vuelve: true },
  { id: "registro", texto: "Se registró", vuelve: false },
  { id: "no-interesa", texto: "No le interesa", vuelve: false },
];

function fechaLarga(fecha: string): string {
  return new Date(`${fecha}T12:00:00-05:00`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  });
}

/** Mañana a las 10, que es la hora a la que la gente contesta. */
function manana(): string {
  const d = new Date(Date.now() - 5 * 3600e3 + 864e5);
  return `${d.toISOString().slice(0, 10)}T10:00`;
}

function Fila({ lead, onListo }: { lead: LeadDeSeguimiento; onListo: (id: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [resultado, setResultado] = useState("");
  const [nota, setNota] = useState("");
  const [cuando, setCuando] = useState(manana);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vuelve = RESULTADOS.find((r) => r.id === resultado)?.vuelve ?? true;

  function guardar() {
    if (!resultado) {
      setError("Elija qué pasó en la llamada.");
      return;
    }
    setGuardando(true);
    setError(null);
    const texto = RESULTADOS.find((r) => r.id === resultado)?.texto ?? resultado;
    fetch(`/api/acciones/${encodeURIComponent(lead.id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: lead.nombre,
        telefono: lead.telefono,
        tipo: "llame",
        // El resultado va aparte de la observación: metido adentro del texto no
        // se puede contar, y el marcador del día es una suma.
        resultado,
        detalle: nota.trim() ? `${texto} · ${nota.trim()}` : texto,
        // Reagendar va en la misma llamada: si fueran dos pasos, el agente
        // hace el primero y el cliente queda sin próxima llamada.
        siguiente: vuelve && cuando ? { tipo: "llame", cuando: new Date(cuando).toISOString() } : null,
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo guardar");
        onListo(lead.id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setGuardando(false));
  }

  return (
    <div className="border-t border-gridline">
      <div className="flex gap-3 items-start px-4 sm:px-5 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold leading-tight">{lead.nombre}</span>
          <span className="block text-[11.5px] mt-0.5" style={{ color: GRIS }}>
            {lead.acciones.length > 0 ? lead.acciones.join(" · ") : "Todavía no hizo nada"}
          </span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {/* Solo el teléfono: este es el módulo de llamadas. El WhatsApp
              está en el paso 3, donde el trabajo es escribir. */}
          <BotonLlamar telefono={lead.telefono} nombre={lead.nombre} contactId={lead.id} tamano={28} />
          <button
            onClick={() => setAbierto((v) => !v)}
            className="rounded-full px-2.5 py-[3px] text-[11px] font-semibold"
            style={{ background: CELESTE, color: AZUL }}
          >
            {abierto ? "Cerrar" : "Reportar"}
          </button>
        </span>
      </div>

      {abierto && (
        <div className="px-4 sm:px-5 pb-3 flex flex-wrap items-center gap-2">
          <select
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            className="rounded-lg border border-gridline bg-surface px-2 py-1.5 text-[12.5px] outline-none focus:border-[#2A6FB8]"
          >
            <option value="">¿Qué pasó?</option>
            {RESULTADOS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.texto}
              </option>
            ))}
          </select>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Observación"
            className="flex-1 min-w-[160px] rounded-lg border border-gridline bg-page px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#2A6FB8] focus:bg-surface"
          />
          {vuelve && (
            <label className="flex items-center gap-1.5 text-[11.5px]" style={{ color: GRIS_2 }}>
              volver a llamar
              <input
                type="datetime-local"
                value={cuando}
                onChange={(e) => setCuando(e.target.value)}
                className="rounded-lg border border-gridline bg-surface px-2 py-1.5 text-[12.5px] outline-none focus:border-[#2A6FB8]"
              />
            </label>
          )}
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
            style={{ background: VERDE }}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          {error && (
            <span className="text-[11.5px]" style={{ color: ROJO }}>
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function LlamarPorDia() {
  const [dias, setDias] = useState<DiaDeSeguimiento[] | null>(null);
  const [ftd, setFtd] = useState<LeadDeSeguimiento[]>([]);
  const [listos, setListos] = useState<string[]>([]);

  useEffect(() => {
    pedirSeguimiento()
      .then((d) => {
        setDias(d.dias.filter((x) => x.etiqueta === "Día 2" || x.etiqueta === "Día 3"));
        // Los que se registraron en el broker y todavía no depositaron, de
        // cualquier día. Son la llamada que más plata tiene cerca: ya dijeron
        // que sí, les falta poner el dinero.
        const vistos = new Set<string>();
        const pendientes: LeadDeSeguimiento[] = [];
        for (const dia of d.dias) {
          for (const l of dia.leads) {
            if (!l.acciones.includes("Se registró") || vistos.has(l.id)) continue;
            vistos.add(l.id);
            pendientes.push(l);
          }
        }
        for (const l of d.enBusiness) {
          if (!l.acciones.includes("Se registró") || vistos.has(l.id)) continue;
          vistos.add(l.id);
          pendientes.push(l);
        }
        setFtd(pendientes);
      })
      .catch(() => setDias([]));
  }, []);

  if (!dias) {
    return (
      <section className="rounded-[22px] bg-surface border border-gridline mb-4 px-4 sm:px-5 py-4">
        <p className="text-[13px]" style={{ color: GRIS }}>
          Armando la cola de llamadas…
        </p>
      </section>
    );
  }

  const ftdVivos = ftd.filter((l) => !listos.includes(l.id));
  const total =
    ftdVivos.length + dias.reduce((s, d) => s + d.leads.filter((l) => !listos.includes(l.id)).length, 0);

  return (
    <section className="rounded-[22px] overflow-hidden bg-surface border border-gridline mb-4">
      <div
        className="flex items-center gap-x-3 gap-y-1 flex-wrap px-4 sm:px-5 py-2.5"
        style={{ background: AZUL, color: "#fff" }}
      >
        <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Llamadas para hoy</h2>
        <span className="text-[12px]" style={{ color: "rgba(255,255,255,.7)" }}>
          los que se registraron y no depositaron, y los del día 2 y el día 3
        </span>
        <span
          className="ml-auto text-[12px] font-bold rounded-full px-2.5 py-0.5 tabular-nums"
          style={{ background: "rgba(255,255,255,.18)" }}
        >
          {total}
        </span>
      </div>

      {total === 0 && (
        <p className="px-4 sm:px-5 py-4 text-[13px]" style={{ color: GRIS }}>
          No queda nadie por llamar del día 2 ni del día 3.
        </p>
      )}

      {/* Primero los que ya se registraron y les falta depositar: es la
          llamada con la plata más cerca, y no espera a ningún día del embudo. */}
      {ftdVivos.length > 0 && (
        <div>
          <div
            className="flex items-center gap-2 px-4 sm:px-5 py-[7px] border-t border-gridline"
            style={{ background: "#EEF7F2" }}
          >
            <span className="w-[6px] h-[6px] rounded-full" style={{ background: VERDE }} />
            <span className="text-[10px] font-bold uppercase tracking-[.16em]" style={{ color: VERDE }}>
              Pendientes de FTD
            </span>
            <span className="text-[11px] tabular-nums font-bold" style={{ color: VERDE, opacity: 0.55 }}>
              {ftdVivos.length}
            </span>
            <span className="ml-auto text-[11px] hidden sm:inline" style={{ color: VERDE, opacity: 0.7 }}>
              se registraron y falta el depósito
            </span>
          </div>
          {ftdVivos.map((l) => (
            <Fila key={l.id} lead={l} onListo={(id) => setListos((r) => [...r, id])} />
          ))}
        </div>
      )}

      {dias.map((d) => {
        const suyos = d.leads.filter((l) => !listos.includes(l.id));
        if (suyos.length === 0) return null;
        return (
          <div key={d.fecha}>
            <p
              className="px-4 sm:px-5 py-1.5 text-[11.5px] font-semibold border-t border-gridline first-letter:uppercase"
              style={{ background: "var(--page-plane)", color: GRIS_2 }}
            >
              {d.etiqueta} · {fechaLarga(d.fecha)} · {suyos.length}
            </p>
            {TEMPERATURAS.map((t) => {
              const suyosT = suyos.filter((l) => l.estado === t.id);
              if (suyosT.length === 0) return null;
              return (
                <div key={t.id}>
                  <div
                    className="flex items-center gap-2 px-4 sm:px-5 py-[6px] border-t border-gridline"
                    style={{ background: t.fondo }}
                  >
                    <span className="w-[6px] h-[6px] rounded-full" style={{ background: t.color }} />
                    <span
                      className="text-[10px] font-bold uppercase tracking-[.16em]"
                      style={{ color: t.color }}
                    >
                      {t.titulo}
                    </span>
                    <span
                      className="text-[11px] tabular-nums font-bold"
                      style={{ color: t.color, opacity: 0.55 }}
                    >
                      {suyosT.length}
                    </span>
                  </div>
                  {suyosT.map((l) => (
                    <Fila key={l.id} lead={l} onListo={(id) => setListos((r) => [...r, id])} />
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
