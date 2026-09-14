"use client";

import { useState } from "react";
import { ESTADO_META } from "@/lib/leadStates";
import { BotonWhatsApp } from "@/components/ContactoRapido";
import { BotonLlamar } from "@/components/Llamada";
import { ConversacionLead } from "@/components/ConversacionLead";
import type { LeadDeSeguimiento } from "@/lib/seguimiento";

/**
 * Una fila por cliente, y se escribe encima.
 *
 * Los agentes ya documentan: lo hacen todos los días en un Excel. El problema
 * nunca fue que no escriban, sino que escriben donde el sistema no puede leer.
 * Por eso esta fila copia lo que una planilla hace bien —texto libre sin menú,
 * todo a la vista, sin botón de guardar— y le agrega lo único que un Excel no
 * puede: la conversación al lado y la fecha que después vuelve sola.
 */

const AZUL = "#17457F";
const CELESTE = "#EAF1FA";
const VERDE = "#157F52";
const GRIS = "#9A998F";

export const ACCIONES = [
  "Llamar",
  "Escribir",
  "Enviar audio",
  "Reenviar el link",
  "Video testimonio",
  "Video de la operativa",
  "Invitar a la sesión",
  "Cerrar seguimiento",
];

function paraInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - 5 * 3600e3);
  return d.toISOString().slice(0, 16);
}

export function FilaSeguimiento({ lead }: { lead: LeadDeSeguimiento }) {
  const meta = ESTADO_META[lead.estado];
  const [nota, setNota] = useState(lead.nota?.nota ?? "");
  const [accion, setAccion] = useState(lead.nota?.proximaAccion ?? "");
  const [cuando, setCuando] = useState(paraInput(lead.nota?.proximaEn ?? null));
  const [guardado, setGuardado] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [abierta, setAbierta] = useState(false);

  function guardar(campo: Record<string, string | null>) {
    fetch(`/api/notas/${encodeURIComponent(lead.id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campo),
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        setFallo(false);
        setGuardado(true);
        setTimeout(() => setGuardado(false), 1600);
      })
      .catch(() => setFallo(true));
  }

  const contexto =
    lead.acciones.length > 0 ? lead.acciones.join(" · ") : "Todavía no hizo nada";

  return (
    <>
      <article className="grid grid-cols-1 sm:grid-cols-[minmax(140px,1.1fr)_minmax(170px,1.6fr)_minmax(150px,1fr)_auto] gap-2 sm:gap-2.5 px-4 sm:px-5 py-2.5 border-t border-gridline items-start">
        <span className="flex gap-2">
          <i className="w-[3px] rounded-full shrink-0 self-stretch" style={{ background: meta.color }} />
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold leading-tight">{lead.nombre}</span>
            <span className="block text-[11.5px] mt-0.5" style={{ color: GRIS }}>
              {contexto}
            </span>
            {/* En este grupo hay dos cosas distintas: los que el agente
                confirmó en el paso 3 y los que el flujo de GHL marcó y nadie
                verificó. Sobre el primero se hace seguimiento; al segundo
                todavía hay que ir a buscarlo. */}
            {lead.via === "llego" && lead.confirmado !== "si" && (
              <span
                className="inline-block text-[10px] font-bold rounded-full px-1.5 py-[1px] mt-1"
                style={{ background: "#FDF3E6", color: "#A56A11" }}
              >
                falta confirmar
              </span>
            )}
          </span>
        </span>

        {/* El campo libre. Sin menú y sin límite a propósito: si el agente no
            puede escribir «el man cobra el 15», vuelve a la planilla. */}
        <span>
          <textarea
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onBlur={() => guardar({ nota })}
            placeholder="¿Qué pasó con este cliente?"
            className="w-full resize-none rounded-lg border border-transparent bg-page px-2 py-1.5 text-[12.5px] leading-snug outline-none hover:border-gridline focus:border-[#2A6FB8] focus:bg-surface"
          />
          <span
            className="block text-[10.5px] h-3.5"
            style={{ color: fallo ? "#C0392B" : VERDE, opacity: guardado || fallo ? 1 : 0 }}
          >
            {fallo ? "no se pudo guardar" : "guardado"}
          </span>
        </span>

        <span className="flex gap-1.5 flex-wrap">
          <select
            value={accion}
            onChange={(e) => {
              setAccion(e.target.value);
              guardar({ proximaAccion: e.target.value });
            }}
            className="rounded-lg border border-gridline bg-surface px-1.5 py-1 text-[12px] outline-none focus:border-[#2A6FB8]"
          >
            <option value="">Qué sigue…</option>
            {ACCIONES.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={cuando}
            onChange={(e) => setCuando(e.target.value)}
            onBlur={() => cuando && guardar({ proximaEn: new Date(cuando).toISOString() })}
            className="rounded-lg border border-gridline bg-surface px-1.5 py-1 text-[12px] outline-none focus:border-[#2A6FB8]"
          />
        </span>

        <span className="flex items-center gap-1.5">
          <button
            onClick={() => setAbierta((v) => !v)}
            className="rounded-full px-2 py-1 text-[11px] font-semibold"
            style={{ background: CELESTE, color: AZUL }}
          >
            {abierta ? "Cerrar" : "Ver"}
          </button>
          <BotonLlamar telefono={lead.telefono} nombre={lead.nombre} contactId={lead.id} tamano={26} />
          <BotonWhatsApp telefono={lead.telefono} nombre={lead.nombre} tamano={26} />
        </span>
      </article>
      {abierta && <ConversacionLead contactId={lead.id} />}
    </>
  );
}
