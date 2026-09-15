"use client";

import { useEffect, useState } from "react";
import { BotonWhatsApp } from "@/components/ContactoRapido";
import { BotonLlamar } from "@/components/Llamada";
import { pedirSeguimiento } from "@/components/Seguimiento";
import type { LeadDeSeguimiento } from "@/lib/seguimiento";

/**
 * Los leads que entraron hoy, para llevárselos o para llamarlos.
 *
 * Un mismo listado sirve a dos trabajos distintos del día, y por eso el
 * componente tiene dos modos en vez de dos copias:
 *
 *   «bajar»  — el agente se copia nombre y número y se los lleva a su
 *              WhatsApp personal, que es como trabaja la mayoría. Queda
 *              marcado para que el seguimiento arranque.
 *   «llamar» — la lista del día con el teléfono al frente, en orden.
 *
 * Lo que se haga acá aparece mañana en el día 2, que es donde vive el trabajo
 * del día siguiente.
 */

const AZUL = "#17457F";
const CELESTE = "#EAF1FA";
const VERDE = "#157F52";
const VERDE_WA = "#1DA851";
const ROJO = "#C0392B";
const GRIS = "#9A998F";
const GRIS_2 = "#5E5C56";

const TEMPERATURAS = [
  { id: "caliente" as const, titulo: "Calientes", color: ROJO, fondo: "#FDF2F0" },
  { id: "tibio" as const, titulo: "Tibios", color: "#B5701F", fondo: "#FDF3E6" },
  { id: "frio" as const, titulo: "Fríos", color: "#2A78D6", fondo: "#EEF3FA" },
];

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

/** Un número legible para copiar y pegar en el teléfono. */
function bonito(tel: string | null): string {
  if (!tel) return "";
  const d = tel.replace(/\D/g, "");
  return d.length === 12 && d.startsWith("57")
    ? `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`
    : tel;
}

function Fila({
  lead,
  modo,
  onBajado,
}: {
  lead: LeadDeSeguimiento;
  modo: "bajar" | "llamar";
  onBajado: (id: string) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Bajar es un solo gesto: copia y marca.
   *
   * Si fueran dos botones —copiar por un lado, marcar por otro— el agente
   * copia y sigue, y la marca no se pone nunca. La marca es lo que hace que el
   * lead aparezca mañana en el paso 2.
   */
  function bajar() {
    const ficha = `${lead.nombre}\n${bonito(lead.telefono)}`;
    navigator.clipboard?.writeText(ficha).catch(() => undefined);
    setCopiado(true);
    setBajando(true);
    setError(null);
    fetch("/api/contacts/bajar-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: lead.id, nombre: lead.nombre, telefono: lead.telefono }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo marcar");
        onBajado(lead.id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setBajando(false));
  }

  return (
    <article className="flex gap-3 items-start px-4 sm:px-5 py-2.5 border-t border-gridline">
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold leading-tight">{lead.nombre}</span>
        <span className="block text-[12px] tabular-nums mt-0.5" style={{ color: GRIS_2 }}>
          {lead.telefono ? bonito(lead.telefono) : "sin teléfono"}
        </span>
        <span className="block text-[11px] mt-0.5" style={{ color: GRIS }}>
          entró {hora(lead.creado)} ·{" "}
          {lead.acciones.length > 0 ? lead.acciones.join(" · ") : "Solicitó información"}
        </span>
        {copiado && !error && (
          <span className="block text-[11px] font-semibold mt-1" style={{ color: VERDE }}>
            ✓ copiado — pegalo en tu WhatsApp
          </span>
        )}
        {error && (
          <span className="block text-[11px] mt-1" style={{ color: ROJO }}>
            {error}
          </span>
        )}
      </span>

      <span className="flex items-center gap-1.5 shrink-0">
        {modo === "bajar" && lead.enMiWhatsApp ? (
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
            style={{ background: "#EEF7F2", color: VERDE }}
          >
            ✓ ya lo tenés
          </span>
        ) : modo === "bajar" ? (
          <button
            onClick={bajar}
            disabled={bajando || !lead.telefono}
            title={lead.telefono ? "Copia el nombre y el número, y lo marca como bajado" : "Este lead no tiene teléfono"}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40 hover:opacity-90 whitespace-nowrap"
            style={{ background: VERDE_WA }}
          >
            {bajando ? "Bajando…" : "Bajar manualmente"}
          </button>
        ) : (
          <BotonWhatsApp telefono={lead.telefono} nombre={lead.nombre} tamano={28} />
        )}
        <BotonLlamar telefono={lead.telefono} nombre={lead.nombre} contactId={lead.id} tamano={28} />
        <a
          href={lead.crmUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir en el CRM para llamar desde el número de la oficina"
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11px] font-semibold whitespace-nowrap"
          style={{ background: CELESTE, color: AZUL, border: "1px solid rgba(23,69,127,.18)" }}
        >
          ↗ CRM
        </a>
      </span>
    </article>
  );
}

export function LeadsDelDia({ modo }: { modo: "bajar" | "llamar" }) {
  const [leads, setLeads] = useState<LeadDeSeguimiento[] | null>(null);
  const [listos, setListos] = useState<string[]>([]);

  useEffect(() => {
    pedirSeguimiento()
      // Todos los de hoy, no la pestaña del día 1: esa saca a los confirmados
      // —que están en su propia lista— y el confirmado es justo al que hay que
      // llamar. La lista de llamadas del día los quiere a todos.
      .then((d) => setLeads(d.hoy))
      .catch(() => setLeads([]));
  }, []);

  if (!leads) {
    return (
      <section className="rounded-[22px] bg-surface border border-gridline mb-5 px-4 sm:px-5 py-4">
        <p className="text-[13px]" style={{ color: GRIS }}>
          Buscando los leads de hoy…
        </p>
      </section>
    );
  }

  const vivos = leads.filter((l) => !listos.includes(l.id));

  return (
    <section className="rounded-[22px] overflow-hidden bg-surface border border-gridline mb-5">
      <div
        className="flex items-center gap-x-3 gap-y-1 flex-wrap px-4 sm:px-5 py-2.5"
        style={{ background: AZUL, color: "#fff" }}
      >
        <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
          {modo === "bajar"
            ? "Bajar a mi WhatsApp Business manualmente"
            : "Llamar inmediatamente a mis leads nuevos"}
        </h2>
        <span className="text-[11.5px]" style={{ color: "rgba(255,255,255,.66)" }}>
          {modo === "bajar"
            ? "lo copiás vos · no es el que baja solo por el CRM"
            : "mientras más rápido llamás, más convierten"}
        </span>
        <span
          className="ml-auto text-[12px] font-bold rounded-full px-2.5 py-0.5 tabular-nums"
          style={{ background: "rgba(255,255,255,.18)" }}
        >
          {vivos.length}
        </span>
      </div>

      {vivos.length === 0 ? (
        <p className="px-4 sm:px-5 py-4 text-[13px]" style={{ color: GRIS }}>
          {leads.length === 0
            ? "Todavía no entró ningún lead hoy."
            : "Ya te llevaste a todos los de hoy. Están en el paso 3."}
        </p>
      ) : (
        TEMPERATURAS.map((t) => {
          const suyos = vivos.filter((l) => l.estado === t.id);
          if (suyos.length === 0) return null;
          return (
            <div key={t.id}>
              <div
                className="flex items-center gap-2 px-4 sm:px-5 py-[7px] border-t border-gridline"
                style={{ background: t.fondo }}
              >
                <span className="w-[6px] h-[6px] rounded-full" style={{ background: t.color }} />
                <span className="text-[10px] font-bold uppercase tracking-[.16em]" style={{ color: t.color }}>
                  {t.titulo}
                </span>
                <span className="text-[11px] tabular-nums font-bold" style={{ color: t.color, opacity: 0.55 }}>
                  {suyos.length}
                </span>
              </div>
              {suyos.map((l) => (
                <Fila key={l.id} lead={l} modo={modo} onBajado={(id) => setListos((r) => [...r, id])} />
              ))}
            </div>
          );
        })
      )}
    </section>
  );
}
