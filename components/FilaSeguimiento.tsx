"use client";

import { useState } from "react";
import { ESTADO_META } from "@/lib/leadStates";
import { BotonWhatsApp } from "@/components/ContactoRapido";
import { BotonLlamar } from "@/components/Llamada";
import { FichaCliente } from "@/components/FichaCliente";
import { metaTipo } from "@/lib/tiposAccion";
import type { LeadDeSeguimiento } from "@/lib/seguimiento";

/**
 * Una fila por cliente: quién es, qué le toca, y a un toque todo lo que pasó.
 *
 * Antes la fila traía el formulario entero —un texto, una acción, una fecha—
 * y los tres se pisaban entre sí. Ahora la fila solo muestra la próxima tarea,
 * que es lo único que hay que saber para decidir a quién atender; escribir se
 * hace adentro, en la ficha, donde el historial está a la vista.
 *
 * Y cuando no hay tarea la fila lo dice en rojo. No es un hueco cosmético: un
 * cliente sin próxima tarea es un cliente que se muere solo.
 */

const AZUL = "#17457F";
const CELESTE = "#EAF1FA";
const VERDE = "#157F52";
const ROJO = "#C0392B";
const ROJO_CLARO = "#FDF2F0";
const GRIS = "#9A998F";

function cuando(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
  const suyo = new Date(d.getTime() - 5 * 3600e3).toISOString().slice(0, 10);
  const hora = d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
  if (suyo === hoy) return `hoy ${hora}`;
  return `${d.toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" })} ${hora}`;
}

export function FilaSeguimiento({
  lead,
  pie,
  onCerrado,
}: {
  lead: LeadDeSeguimiento;
  pie?: string;
  /** Al cerrar el seguimiento la fila se va de la lista de arriba. */
  onCerrado?: (id: string) => void;
}) {
  const meta = ESTADO_META[lead.estado];
  const [abierta, setAbierta] = useState(false);
  const [tarea, setTarea] = useState(lead.tarea);

  const contexto = lead.acciones.length > 0 ? lead.acciones.join(" · ") : "Todavía no hizo nada";
  const vencida = tarea?.venceEn ? new Date(tarea.venceEn) < new Date() : false;

  return (
    <>
      <article className="flex gap-3 px-4 sm:px-5 py-2.5 border-t border-gridline items-start">
        <i className="w-[3px] rounded-full shrink-0 self-stretch" style={{ background: meta.color }} />

        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold leading-tight">{lead.nombre}</span>
          <span className="block text-[11.5px] mt-0.5" style={{ color: GRIS }}>
            {contexto}
          </span>
          {/* En la lista de «en mi WhatsApp Business» acá va desde cuándo lo
              tiene: es el reloj que manda la cadencia del seguimiento. */}
          {pie && (
            <span className="block text-[11px] font-semibold mt-0.5" style={{ color: VERDE }}>
              {pie}
            </span>
          )}

          {tarea ? (
            <span
              className="block text-[12.5px] mt-1.5 px-2.5 py-1.5 rounded-lg"
              style={{
                borderLeft: `3px solid ${vencida ? ROJO : AZUL}`,
                background: vencida ? ROJO_CLARO : CELESTE,
              }}
            >
              {vencida && "⏰ "}
              <b className="font-semibold">{metaTipo(tarea.tipo).tarea}</b>
              {" — "}
              <b className="tabular-nums font-semibold">
                {vencida ? "era " : ""}
                {cuando(tarea.venceEn!)}
              </b>
              {tarea.detalle && <> · «{tarea.detalle}»</>}
            </span>
          ) : (
            <button
              onClick={() => setAbierta(true)}
              className="block text-[12.5px] mt-1.5 px-2.5 py-1.5 rounded-lg text-left w-full"
              style={{ borderLeft: `3px solid ${ROJO}`, background: ROJO_CLARO, color: ROJO }}
            >
              Sin próximo paso. <b className="font-semibold underline">Ponele una tarea.</b>
            </button>
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
          <BotonLlamar telefono={lead.telefono} nombre={lead.nombre} contactId={lead.id} tamano={26} />
          <BotonWhatsApp telefono={lead.telefono} nombre={lead.nombre} tamano={26} />
        </span>
      </article>

      {abierta && (
        <FichaCliente
          contactId={lead.id}
          nombre={lead.nombre}
          telefono={lead.telefono}
          onCambio={(cerrado) => {
            if (cerrado) {
              onCerrado?.(lead.id);
              return;
            }
            // La tarea de la fila se refresca sola: el seguimiento se guarda en
            // caché un minuto en el servidor y recargarlo devolvería la vieja.
            fetch(`/api/acciones/${encodeURIComponent(lead.id)}`)
              .then((r) => (r.ok ? r.json() : { hilo: [] }))
              .then((d: { hilo: LeadDeSeguimiento["tarea"][] }) => {
                const abierta = (d.hilo as NonNullable<LeadDeSeguimiento["tarea"]>[])
                  .filter((a) => a.venceEn && !a.hechaEn && !a.cerradaEn)
                  .sort((a, b) => a.venceEn!.localeCompare(b.venceEn!))[0];
                setTarea(abierta ?? null);
              })
              .catch(() => undefined);
          }}
        />
      )}
    </>
  );
}
