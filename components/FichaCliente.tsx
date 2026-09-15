"use client";

import { useCallback, useEffect, useState } from "react";
import { ConversacionLead } from "@/components/ConversacionLead";
import { TIPOS, TIPOS_DEL_EMBUDO, metaTipo, TIPO_CIERRE, type TipoAccion } from "@/lib/tiposAccion";
import type { Accion } from "@/lib/acciones";

/**
 * Todo lo que pasó con un cliente, y lo que sigue.
 *
 * Reemplaza al casillero único que había antes —un texto, una acción, una
 * fecha, todo pisable— porque una tarde con un cliente no cabe ahí: «lo llamé,
 * no contestó, me escribió, dijo que mañana a las 11 ya tiene la plata» son
 * cuatro hechos y una tarea.
 *
 * Registrar lo que pasó y programar lo que sigue van en el mismo botón. Si
 * fueran dos gestos, el agente hace el primero y se olvida del segundo, y un
 * cliente sin próxima tarea es un cliente que se muere solo.
 */

const AZUL = "#17457F";
const CELESTE = "#EAF1FA";
const VERDE = "#157F52";
const VERDE_CLARO = "#EEF7F2";
const AMBAR = "#B5701F";
const AMBAR_CLARO = "#FDF3E6";
const ROJO = "#C0392B";
const ROJO_CLARO = "#FDF2F0";
const GRIS = "#9A998F";
const GRIS_2 = "#5E5C56";

const COLORES: Record<string, { fondo: string; tinta: string }> = {
  azul: { fondo: CELESTE, tinta: AZUL },
  verde: { fondo: VERDE_CLARO, tinta: VERDE },
  ambar: { fondo: AMBAR_CLARO, tinta: AMBAR },
  rojo: { fondo: ROJO_CLARO, tinta: ROJO },
  gris: { fondo: "#F1F0EB", tinta: GRIS_2 },
};

function cuando(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

/** El valor que pide un input datetime-local, en hora de Bogotá. */
function paraInput(ms: number): string {
  return new Date(ms - 5 * 3600e3).toISOString().slice(0, 16);
}

export function FichaCliente({
  contactId,
  nombre,
  telefono,
  onCambio,
  soloHistorial = false,
}: {
  contactId: string;
  nombre: string;
  telefono: string | null;
  /**
   * Solo el historial, sin el formulario.
   *
   * En el módulo de mensajes el agente viene a ver qué se le mandó a este
   * cliente y cuándo, no a registrar una llamada. El formulario vive donde se
   * usa: en el paso 1, con el teléfono en la mano.
   */
  soloHistorial?: boolean;
  /** La fila de arriba muestra la tarea abierta: hay que avisarle que cambió. */
  onCambio?: (cerrado: boolean) => void;
}) {
  const [hilo, setHilo] = useState<Accion[] | null>(null);
  const [tipo, setTipo] = useState<TipoAccion | null>(null);
  const [detalle, setDetalle] = useState("");
  const [sigue, setSigue] = useState("");
  const [fecha, setFecha] = useState(() => paraInput(Date.now() + 864e5));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // La conversación de GHL se pide aparte y tarda: se abre solo si la piden.
  const [verChat, setVerChat] = useState(false);

  const traer = useCallback(() => {
    fetch(`/api/acciones/${encodeURIComponent(contactId)}`)
      .then((r) => (r.ok ? r.json() : { hilo: [] }))
      .then((d: { hilo: Accion[] }) => setHilo(d.hilo))
      .catch(() => setHilo([]));
  }, [contactId]);

  useEffect(() => {
    traer();
  }, [traer]);

  function guardar() {
    if (!tipo && !sigue) {
      setError("Elegí qué hiciste, o qué sigue.");
      return;
    }
    setGuardando(true);
    setError(null);
    fetch(`/api/acciones/${encodeURIComponent(contactId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        telefono,
        tipo,
        detalle: detalle.trim() || null,
        siguiente: sigue ? { tipo: sigue, cuando: new Date(fecha).toISOString() } : null,
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo guardar");
        return r.json();
      })
      .then((d: { hilo: Accion[] }) => {
        setHilo(d.hilo);
        setTipo(null);
        setDetalle("");
        setSigue("");
        onCambio?.(tipo === TIPO_CIERRE || sigue === TIPO_CIERRE);
      })
      .catch((e) => setError(e.message))
      .finally(() => setGuardando(false));
  }

  return (
    <div className="px-4 sm:px-5 py-4 border-t border-gridline" style={{ background: "#FCFCFA" }}>
      <div className="flex items-center gap-2 flex-wrap mb-2.5">
        <h4 className="text-[10px] font-bold uppercase tracking-[.18em]" style={{ color: GRIS }}>
          Todo lo que pasó con {nombre}
        </h4>
        {/* El hilo son las acciones del agente; la conversación es lo que se
            dijeron. Son dos cosas distintas y antes solo se veía la segunda. */}
        <button
          onClick={() => setVerChat((v) => !v)}
          className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: CELESTE, color: AZUL }}
        >
          {verChat ? "Ocultar la conversación" : "Ver la conversación"}
        </button>
      </div>

      {verChat && (
        <div className="mb-4 -mx-4 sm:-mx-5">
          <ConversacionLead contactId={contactId} />
        </div>
      )}

      {hilo === null && (
        <p className="text-[12.5px] mb-4" style={{ color: GRIS }}>
          Buscando el historial…
        </p>
      )}

      {hilo?.length === 0 && (
        <p className="text-[12.5px] mb-4" style={{ color: GRIS }}>
          {soloHistorial
          ? "Todavía no se le mandó nada. Lo que se mande queda acá, día por día."
          : "Todavía no registraste nada. Lo que escribas acá queda para siempre."}
        </p>
      )}

      {hilo && hilo.length > 0 && (
        <ol className="mb-4">
          {hilo.map((a) => {
            const m = metaTipo(a.tipo);
            const c = COLORES[m.color] ?? COLORES.gris;
            const pendiente = !a.hechaEn && !a.cerradaEn;
            const vencida = pendiente && a.venceEn !== null && new Date(a.venceEn) < new Date();
            return (
              <li key={a.id} className="flex gap-2.5 pb-2.5 last:pb-0">
                <span
                  className="w-[18px] h-[18px] rounded-full shrink-0 mt-px flex items-center justify-center text-[9px]"
                  style={
                    pendiente
                      ? { background: vencida ? ROJO_CLARO : "#F1F0EB", color: vencida ? ROJO : GRIS }
                      : { background: c.fondo, color: c.tinta }
                  }
                >
                  {pendiente ? "○" : m.icono}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] leading-snug">
                    <b className="font-semibold">{pendiente ? m.tarea : m.hecho}</b>
                    {a.detalle && <> — {a.detalle}</>}
                    {a.cerradaEn && !a.hechaEn && (
                      <span style={{ color: GRIS }}> · quedó cumplida</span>
                    )}
                  </span>
                  <span className="block text-[10.5px] tabular-nums mt-px" style={{ color: vencida ? ROJO : GRIS }}>
                    {vencida && "⏰ era "}
                    {cuando(a.hechaEn ?? a.venceEn ?? a.creadaEn)}
                    {pendiente && " · lo programaste vos"}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* El compositor. Un toque para el tipo, el texto libre para lo que dijo
          el cliente, y lo que sigue en el mismo botón. */}
      <div className="rounded-xl border border-gridline bg-surface p-3" hidden={soloHistorial}>
        <span className="block text-[11px] font-bold mb-1.5" style={{ color: GRIS_2 }}>
          ¿Qué acabás de hacer?
        </span>
        <div className="flex gap-1.5 flex-wrap mb-2.5">
          {TIPOS.filter((t) => t.id !== TIPO_CIERRE && !TIPOS_DEL_EMBUDO.includes(t.id)).map((t) => (
            <button
              key={t.id}
              onClick={() => setTipo(tipo === t.id ? null : t.id)}
              className="rounded-full px-2.5 py-1 text-[12px] border"
              style={
                tipo === t.id
                  ? { background: AZUL, color: "#fff", borderColor: "transparent", fontWeight: 600 }
                  : { background: "var(--page-plane)", color: GRIS_2, borderColor: "var(--gridline)" }
              }
            >
              {t.icono} {t.hecho}
            </button>
          ))}
        </div>

        <textarea
          rows={2}
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          placeholder="¿Qué dijo el cliente?"
          className="w-full resize-none rounded-lg border border-gridline bg-page px-2.5 py-2 text-[13px] leading-snug outline-none focus:border-[#2A6FB8] focus:bg-surface"
        />

        <div className="flex gap-2 flex-wrap items-center mt-3 pt-3 border-t border-gridline">
          <span className="text-[11px] font-bold" style={{ color: GRIS_2 }}>
            Y ahora sigue…
          </span>
          <select
            value={sigue}
            onChange={(e) => setSigue(e.target.value)}
            className="rounded-lg border border-gridline bg-surface px-2 py-1.5 text-[12.5px] outline-none focus:border-[#2A6FB8]"
          >
            <option value="">nada por ahora</option>
            {TIPOS.filter((t) => !TIPOS_DEL_EMBUDO.includes(t.id)).map((t) => (
              <option key={t.id} value={t.id}>
                {t.tarea}
              </option>
            ))}
          </select>
          {sigue && sigue !== TIPO_CIERRE && (
            <input
              type="datetime-local"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-lg border border-gridline bg-surface px-2 py-1.5 text-[12.5px] outline-none focus:border-[#2A6FB8]"
            />
          )}
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50 hover:opacity-90"
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
      </div>
    </div>
  );
}
