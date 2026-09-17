"use client";

import { useEffect, useState } from "react";
import { BotonWhatsApp } from "@/components/ContactoRapido";
import { BotonLlamar, BotonCrm, ReporteLlamada, BotonAnotar } from "@/components/Llamada";
import { pedirSeguimiento, olvidarSeguimiento } from "@/components/Seguimiento";
import { EnviarWhatsApp } from "@/components/EnviarWhatsApp";
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

/** El día de hoy en Bogotá, en el mismo formato que manda el paso 2. */
function hoyBogota(): string {
  return new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
}

/** «12 de septiembre», para que el encabezado no muestre un 2026-09-12. */
function nombreDeDia(fecha: string): string {
  return new Date(`${fecha}T12:00:00-05:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
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

/**
 * Por qué este lead llegó sin número.
 *
 * Lo verifiqué contra GHL sobre los doce sin teléfono de la semana: los de
 * Messenger e Instagram nunca traen celular, y los de anuncio de clic a
 * WhatsApp llegan firmados con una identidad tapada de Meta —«CO.287658…»— en
 * lugar del número. No está ni en el contacto ni en la conversación, así que
 * no es que el tablero se lo haya perdido: no existe de este lado.
 *
 * Decirlo con todas las letras es la diferencia entre un agente que cree que
 * el panel falla y uno que sabe que tiene que pedirlo en el chat.
 */
const SIN_NUMERO: Record<string, string> = {
  whatsapp: "Entró por anuncio de WhatsApp · Meta tapa su número",
  facebook: "Entró por Messenger · no trae número",
  instagram: "Entró por Instagram · no trae número",
};

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
  // El número que el cliente le pase por chat, para que no se quede ahí.
  const [telefono, setTelefono] = useState(lead.telefono);
  const [pidiendo, setPidiendo] = useState(false);
  const [escrito, setEscrito] = useState("");
  const [guardando, setGuardando] = useState(false);

  function guardarTelefono() {
    setGuardando(true);
    setError(null);
    fetch("/api/contacts/telefono", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: lead.id, telefono: escrito, nombre: lead.nombre }),
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "No se pudo guardar");
        setTelefono(j.telefono);
        setPidiendo(false);
        setEscrito("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setGuardando(false));
  }

  /**
   * Bajar es un solo gesto: copia y marca.
   *
   * Si fueran dos botones —copiar por un lado, marcar por otro— el agente
   * copia y sigue, y la marca no se pone nunca. La marca es lo que hace que el
   * lead aparezca mañana en el paso 2.
   */
  function bajar() {
    const ficha = `${lead.nombre}\n${bonito(telefono)}`;
    navigator.clipboard?.writeText(ficha).catch(() => undefined);
    setCopiado(true);
    setBajando(true);
    setError(null);
    fetch("/api/contacts/bajar-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: lead.id, nombre: lead.nombre, telefono }),
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
        {telefono ? (
          <span className="block text-[12px] tabular-nums mt-0.5" style={{ color: GRIS_2 }}>
            {bonito(telefono)}
          </span>
        ) : pidiendo ? (
          <span className="flex items-center gap-1.5 mt-1">
            <input
              autoFocus
              inputMode="tel"
              value={escrito}
              onChange={(e) => setEscrito(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && escrito.trim() && guardarTelefono()}
              placeholder="3213456789"
              className="w-[130px] rounded-lg px-2 py-1 text-[12.5px] tabular-nums bg-page border border-gridline"
            />
            <button
              onClick={guardarTelefono}
              disabled={guardando || !escrito.trim()}
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
              style={{ background: VERDE }}
            >
              {guardando ? "…" : "Guardar"}
            </button>
            <button
              onClick={() => { setPidiendo(false); setError(null); }}
              className="text-[11px]"
              style={{ color: GRIS }}
            >
              Cancelar
            </button>
          </span>
        ) : (
          <span className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-[11.5px]" style={{ color: GRIS_2 }}>
              {(lead.medio && SIN_NUMERO[lead.medio]) ?? "Llegó sin número"}
            </span>
            <button
              onClick={() => setPidiendo(true)}
              title="Cuando te pase el número por el chat, guardalo acá y queda para llamarlo"
              className="rounded-full px-2 py-[2px] text-[11px] font-semibold"
              style={{ background: CELESTE, color: AZUL, border: "1px solid rgba(23,69,127,.18)" }}
            >
              + Agregar número
            </button>
          </span>
        )}
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
        {/* Al volver de la llamada, acá lo espera la pregunta. Es lo que
            convierte la lista en un seguimiento: sin esto la llamada se hace y
            no queda nada de lo que el cliente dijo. */}
        {modo === "llamar" && (
          <span className="flex flex-wrap items-center gap-2 mt-1.5 empty:hidden">
            <ReporteLlamada contactId={lead.id} />
            <BotonAnotar contactId={lead.id} nombre={lead.nombre} telefono={telefono} />
            <EnviarWhatsApp lead={lead} dia={1} onEnviado={olvidarSeguimiento} />
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
            disabled={bajando || !telefono}
            title={telefono ? "Copia el nombre y el número, y lo marca como bajado" : "Guardá primero su número"}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40 hover:opacity-90 whitespace-nowrap"
            style={{ background: VERDE_WA }}
          >
            {bajando ? "Bajando…" : "Bajar manualmente"}
          </button>
        ) : (
          <BotonWhatsApp telefono={telefono} nombre={lead.nombre} tamano={28} />
        )}
        <BotonLlamar telefono={telefono} nombre={lead.nombre} contactId={lead.id} tamano={28} />
        {modo === "llamar" && (
          <BotonCrm
            crmUrl={lead.crmUrl}
            nombre={lead.nombre}
            contactId={lead.id}
            telefono={telefono}
          />
        )}
        <a
          href={lead.crmUrl}
          target="_blank"
          rel="noopener noreferrer"
          hidden={modo === "llamar" && !!telefono}
          title="Abrir la ficha en el CRM"
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11px] font-semibold whitespace-nowrap"
          style={{ background: CELESTE, color: AZUL, border: "1px solid rgba(23,69,127,.18)" }}
        >
          ↗ CRM
        </a>
      </span>
    </article>
  );
}

export function LeadsDelDia({
  modo,
  dia,
}: {
  modo: "bajar" | "llamar";
  /**
   * El día que el agente eligió arriba, en el paso 2 («2026-09-12»).
   *
   * Sin esto la pantalla se contradecía sola: consultaba el 12 arriba y abajo
   * le seguían saliendo los leads de hoy. Los cinco pasos son un solo día.
   */
  dia?: string | null;
}) {
  const [leads, setLeads] = useState<LeadDeSeguimiento[] | null>(null);
  const [listos, setListos] = useState<string[]>([]);

  useEffect(() => {
    setLeads(null);
    pedirSeguimiento()
      // Todos los del día, no la pestaña del día 1: esa saca a los confirmados
      // —que están en su propia lista— y el confirmado es justo al que hay que
      // llamar. La lista de llamadas del día los quiere a todos.
      .then((d) => setLeads(dia ? d.porDia[dia] ?? [] : d.hoy))
      .catch(() => setLeads([]));
  }, [dia]);

  const esOtroDia = !!dia && dia !== hoyBogota();

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
          {esOtroDia
            ? `los que entraron el ${nombreDeDia(dia!)}`
            : modo === "bajar"
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
            ? esOtroDia
              ? `No entró ningún lead el ${nombreDeDia(dia!)}.`
              : "Todavía no entró ningún lead hoy."
            : "Ya te llevaste a todos. Están en el paso 3."}
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
