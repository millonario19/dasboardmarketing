"use client";

import { useEffect, useState } from "react";
import type { LeadInteraccion, Turno } from "@/lib/interaccion";
import type { Hito } from "@/lib/hitos";

/**
 * La conversación de un lead, abierta desde cualquier lista.
 *
 * Las listas alcanzan para elegir a quién atender; no para saber qué decirle.
 * Esto trae el hilo completo —lo que dijo, cuándo, qué contestó el agente, los
 * audios y los pasos que dio en el CRM— y se carga solo cuando alguien lo
 * abre: pedirlo de antemano para los cincuenta leads de la pantalla serían
 * cien llamadas a GHL para leer una.
 */

const AZUL = "#17457F";
const CELESTE = "#EAF1FA";
const VERDE = "#157F52";
const GRIS = "#9A998F";

function hora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

function duracion(min: number | null | undefined): string {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

function Mensaje({ turno, agente }: { turno: Turno; agente: string }) {
  const mio = turno.quien === "agente";
  const flujo = turno.quien === "flujo";
  const quien = turno.quien === "cliente" ? "Cliente" : flujo ? "Automático" : agente.split(" ")[0];

  return (
    <div className={`flex ${mio ? "justify-end" : flujo ? "justify-center" : "justify-start"} mb-2`}>
      <div className="max-w-[86%]">
        <div
          className="rounded-xl px-3 py-2 text-[12.5px] leading-relaxed"
          style={
            mio
              ? { background: AZUL, color: "#fff" }
              : flujo
                ? { background: "transparent", border: "1px dashed #DEDCD4", color: GRIS, fontSize: 11.5 }
                : { background: "#EEEDE7" }
          }
        >
          {turno.texto ??
            (turno.audio ? (
              <audio
                controls
                preload="none"
                src={`/api/audio?u=${encodeURIComponent(turno.audio)}`}
                className="max-w-[220px] h-8"
              />
            ) : (
              <i className="opacity-70">adjunto</i>
            ))}
        </div>
        <div className={`text-[10px] mt-0.5 ${mio ? "text-right" : ""}`} style={{ color: GRIS }}>
          {hora(turno.hora)} · {quien}
          {turno.esperaMin != null && mio && ` · esperó ${duracion(turno.esperaMin)}`}
        </div>
      </div>
    </div>
  );
}

function MarcaHito({ hito }: { hito: Hito }) {
  return (
    <div className="flex justify-center my-2">
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
        style={{ background: "#E4F1EA", color: VERDE }}
      >
        ✓ <b className="font-bold">{hito.texto}</b>
        <span className="opacity-70 tabular-nums">{hora(hito.hora)}</span>
      </span>
    </div>
  );
}

export function ConversacionLead({ contactId }: { contactId: string }) {
  const [lead, setLead] = useState<LeadInteraccion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/lead/${encodeURIComponent(contactId)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "No se pudo leer la conversación");
        return d;
      })
      .then((d: { lead: LeadInteraccion }) => vivo && setLead(d.lead))
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [contactId]);

  if (cargando) {
    return (
      <p className="px-4 sm:px-5 py-3 text-[12px]" style={{ background: "#FCFCFA", color: GRIS }}>
        Leyendo la conversación…
      </p>
    );
  }
  if (error || !lead) {
    return (
      <p className="px-4 sm:px-5 py-3 text-[12px]" style={{ background: "#FCFCFA", color: GRIS }}>
        {error ?? "Sin conversación"}
      </p>
    );
  }

  // Mensajes y pasos del CRM en una sola línea de tiempo: leídos por separado,
  // «no contesta hace 2 horas» y «bajó a WhatsApp 11:20» parecen contradecirse.
  const eventos = [
    ...lead.turnos.map((t) => ({ hora: t.hora, turno: t, hito: null as Hito | null })),
    ...lead.hitos.filter((h) => h.exacto).map((h) => ({ hora: h.hora, turno: null as Turno | null, hito: h })),
  ].sort((a, b) => a.hora.localeCompare(b.hora));

  return (
    <div className="px-4 sm:px-5 py-3" style={{ background: "#FCFCFA" }}>
      <div className="flex items-center gap-3 flex-wrap mb-2.5 text-[11.5px]" style={{ color: GRIS }}>
        <span>
          Escribió <b style={{ color: AZUL }}>{lead.escribio ? hora(lead.escribio) : "nunca"}</b>
        </span>
        <span>
          Respondieron{" "}
          <b style={{ color: AZUL }}>{lead.respondio ? hora(lead.respondio) : "nunca"}</b>
        </span>
        <span>
          Esperó <b style={{ color: AZUL }}>{duracion(lead.esperaMin)}</b>
        </span>
        {lead.notasDeVoz > 0 && <span>{lead.notasDeVoz} notas de voz</span>}
        <a
          href={lead.crmUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-auto rounded-full px-2.5 py-[3px] text-[11px] font-semibold"
          style={{ background: CELESTE, color: AZUL }}
        >
          ↗ Ver en el CRM
        </a>
      </div>

      <div className="max-h-[340px] overflow-y-auto pr-1">
        {eventos.map((e, i) =>
          e.hito ? (
            <MarcaHito key={i} hito={e.hito} />
          ) : (
            <Mensaje key={i} turno={e.turno!} agente={lead.agente} />
          )
        )}
      </div>
    </div>
  );
}
