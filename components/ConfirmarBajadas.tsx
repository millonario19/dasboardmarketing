"use client";

import { useCallback, useEffect, useState } from "react";
import type { PorConfirmar } from "@/lib/seguimiento";

/**
 * ¿Llegaron a tu WhatsApp Business?
 *
 * El CRM sabe que el cliente tocó el botón; solo el agente sabe si del otro
 * lado apareció alguien. Hasta que conteste, ese lead figura como caliente sin
 * que nadie lo haya visto: hay 29 clics registrados y 3 respondidos.
 *
 * Va arriba de todo y, si hay pendientes, se abre como aviso al entrar. Pero
 * una sola vez al día: un aviso que salta en cada navegación se aprende a
 * cerrar sin leerlo en menos de una semana, y entonces deja de servir para
 * siempre.
 */

const AZUL = "#17457F";
const VERDE = "#157F52";
const ROJO = "#C0392B";
const GRIS = "#9A998F";
const GRIS_2 = "#5E5C56";

const CLAVE_AVISO = "op_confirmar_avisos";

// Dos veces por sesión: la primera al entrar y la segunda un rato después, si
// todavía quedan pendientes. Más que eso se aprende a cerrar sin leer; menos,
// y el que entró apurado no vuelve nunca.
const AVISOS_POR_SESION = 2;
const ESPERA_SEGUNDO_AVISO_MS = 20 * 60 * 1000;

function avisosDados(): number {
  try {
    return Number(sessionStorage.getItem(CLAVE_AVISO) ?? "0");
  } catch {
    return AVISOS_POR_SESION; // modo privado: el bloque igual se ve en pantalla
  }
}

function anotarAviso() {
  try {
    sessionStorage.setItem(CLAVE_AVISO, String(avisosDados() + 1));
  } catch {
    /* modo privado */
  }
}

function Pregunta({
  persona,
  onResponder,
  compacto = false,
}: {
  persona: PorConfirmar;
  onResponder: (id: string, llego: boolean) => void;
  compacto?: boolean;
}) {
  const [respondido, setRespondido] = useState<boolean | null>(null);
  const [guardando, setGuardando] = useState(false);

  function responder(llego: boolean) {
    setGuardando(true);
    setRespondido(llego);
    fetch("/api/contacts/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: persona.id, confirmado: llego }),
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        onResponder(persona.id, llego);
      })
      .catch(() => setRespondido(null))
      .finally(() => setGuardando(false));
  }

  if (respondido !== null) {
    return (
      <p
        className={`text-[12.5px] font-semibold border-t border-gridline ${compacto ? "px-4 py-2" : "px-4 sm:px-5 py-2.5"}`}
        style={{ color: respondido ? VERDE : ROJO }}
      >
        {respondido ? `✓ ${persona.nombre} sigue caliente` : `→ ${persona.nombre} vuelve a tibio`}
      </p>
    );
  }

  return (
    <div
      className={`flex items-center gap-2.5 flex-wrap border-t border-gridline ${compacto ? "px-4 py-2" : "px-4 sm:px-5 py-2.5"}`}
    >
      <span className="flex-1 min-w-[170px]">
        <b className="text-[13.5px] font-semibold">¿{persona.nombre} llegó a tu WhatsApp Business?</b>
        <span className="block text-[11.5px] mt-0.5" style={{ color: GRIS }}>
          {persona.agente}
          {/* A qué hora tocó el botón. La lista solo trae los clics de hoy, y
              sin la hora eso es una promesa que nadie puede comprobar. */}
          {persona.clicEn && (
            <>
              {" · tocó a las "}
              <b className="font-semibold tabular-nums">
                {new Date(persona.clicEn).toLocaleTimeString("es-CO", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Bogota",
                })}
              </b>
            </>
          )}
        </span>
      </span>
      <button
        onClick={() => responder(true)}
        disabled={guardando}
        className="rounded-full px-4 py-1 text-[12.5px] font-bold text-white disabled:opacity-50"
        style={{ background: VERDE }}
      >
        Sí
      </button>
      <button
        onClick={() => responder(false)}
        disabled={guardando}
        className="rounded-full px-4 py-1 text-[12.5px] font-bold border border-gridline hover:border-[#C0392B] hover:text-[#C0392B] disabled:opacity-50"
        style={{ color: GRIS_2 }}
      >
        No
      </button>
    </div>
  );
}

export function ConfirmarBajadas() {
  const [gente, setGente] = useState<PorConfirmar[] | null>(null);
  const [aviso, setAviso] = useState(false);
  // Plegado por defecto: cinco preguntas abiertas ocupan media pantalla y
  // empujan hacia abajo el trabajo del día. Una línea que llama y se abre de
  // un toque ocupa lo que ocupa una notificación.
  const [abierto, setAbierto] = useState(false);

  const quitar = useCallback((id: string) => {
    setGente((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
  }, []);

  useEffect(() => {
    fetch("/api/por-confirmar")
      .then((r) => (r.ok ? r.json() : { porConfirmar: [] }))
      .then((d: { porConfirmar: PorConfirmar[] }) => {
        setGente(d.porConfirmar);
        // Sin pendientes no sale nada. Nunca.
        if (d.porConfirmar.length === 0) return;
        if (avisosDados() < AVISOS_POR_SESION) {
          setAviso(true);
          anotarAviso();
        }
      })
      .catch(() => setGente([]));
  }, []);

  // El segundo aviso de la sesión: solo si quedaron pendientes sin responder.
  useEffect(() => {
    if (!gente || gente.length === 0) return;
    if (avisosDados() >= AVISOS_POR_SESION) return;
    const t = setTimeout(() => {
      setAviso(true);
      anotarAviso();
    }, ESPERA_SEGUNDO_AVISO_MS);
    return () => clearTimeout(t);
  }, [gente]);

  if (!gente || gente.length === 0) return null;

  const bloque = (compacto: boolean) =>
    gente.map((p) => <Pregunta key={p.id} persona={p} onResponder={quitar} compacto={compacto} />);

  return (
    <>
      <section className="rounded-[22px] overflow-hidden bg-surface border border-gridline mb-5">
        <button
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="w-full flex items-center gap-2.5 flex-wrap px-4 sm:px-5 py-3 text-left hover:opacity-95"
          style={{ background: ROJO, color: "#fff" }}
        >
          <span
            className="text-[13px] font-extrabold rounded-full w-[26px] h-[26px] flex items-center justify-center tabular-nums shrink-0"
            style={{ background: "#fff", color: ROJO }}
          >
            {gente.length}
          </span>
          <span className="text-[14px] font-semibold tracking-[-0.02em]">
            {gente.length === 1 ? "cliente tocó" : "clientes tocaron"} tu WhatsApp y no sabés si llegaron
          </span>
          <span className="ml-auto flex items-center gap-2 text-[12.5px]" style={{ color: "rgba(255,255,255,.72)" }}>
            {abierto ? "Ocultar" : "Revisar ahora · 30 seg"}
            <span className="text-[10px]">{abierto ? "▲" : "▼"}</span>
          </span>
        </button>

        {abierto && (
          <>
            {bloque(false)}
            <p className="px-4 sm:px-5 py-2.5 text-[11.5px] border-t border-gridline" style={{ color: GRIS }}>
              Un «no» lo devuelve a tibio y lo manda a «Hizo clic y no llegó», que se trabaja distinto:
              ese ya levantó la mano y se cayó en el último paso.
            </p>
          </>
        )}
      </section>

      {aviso && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(13,13,13,.45)" }}
          onClick={() => setAviso(false)}
        >
          <div
            className="bg-surface w-full sm:max-w-[460px] rounded-t-[22px] sm:rounded-[22px] overflow-hidden max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4" style={{ background: ROJO, color: "#fff" }}>
              <div className="text-[16px] font-semibold">Antes de empezar</div>
              <div className="text-[12.5px] mt-0.5" style={{ color: "rgba(255,255,255,.68)" }}>
                {gente.length} {gente.length === 1 ? "cliente tocó" : "clientes tocaron"} tu botón de
                WhatsApp. Solo vos sabés si llegaron.
              </div>
            </div>
            {bloque(true)}
            <div className="px-4 py-3 border-t border-gridline">
              <button
                onClick={() => setAviso(false)}
                className="w-full rounded-full py-2.5 text-[13px] font-semibold border border-gridline hover:bg-page"
                style={{ color: GRIS_2 }}
              >
                Responder después
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
