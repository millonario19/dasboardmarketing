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
  onResponder: (id: string, respuesta: "si" | "no") => void;
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
        onResponder(persona.id, llego ? "si" : "no");
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
      {persona.confirmado === "si" ? (
        <span
          className="rounded-full px-3 py-1 text-[12px] font-bold whitespace-nowrap"
          style={{ background: "#EEF7F2", color: VERDE }}
        >
          ✓ está en tu WhatsApp
        </span>
      ) : persona.confirmado === "no" ? (
        <span
          className="rounded-full px-3 py-1 text-[12px] font-bold whitespace-nowrap"
          style={{ background: "#FDF2F0", color: "#C0392B" }}
        >
          ✕ no llegó · volvió a tibio
        </span>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

export function ConfirmarBajadas({ dentroDePaso = false }: { dentroDePaso?: boolean }) {
  const [gente, setGente] = useState<PorConfirmar[] | null>(null);
  const [aviso, setAviso] = useState(false);
  // Plegado por defecto cuando va suelto: cinco preguntas abiertas ocupan media
  // pantalla. Pero dentro del paso 3 el encabezado del paso ya es el plegable,
  // y dos acordeones anidados obligaban a tres clics para llegar al dato.
  const [abierto, setAbierto] = useState(dentroDePaso);

  // Contestar marca la fila, no la borra: el agente tiene que poder ver al
  // final del día a quiénes confirmó esa mañana.
  const marcar = useCallback((id: string, respuesta: "si" | "no") => {
    setGente((prev) => (prev ? prev.map((p) => (p.id === id ? { ...p, confirmado: respuesta } : p)) : prev));
  }, []);

  useEffect(() => {
    fetch("/api/por-confirmar")
      .then((r) => (r.ok ? r.json() : { porConfirmar: [] }))
      .then((d: { porConfirmar: PorConfirmar[] }) => {
        setGente(d.porConfirmar);
        // Sin pendientes no sale nada. Nunca. Los ya contestados se quedan en
        // la lista para verlos, pero no vuelven a interrumpir.
        if (d.porConfirmar.every((p) => p.confirmado !== null)) return;
        if (avisosDados() < AVISOS_POR_SESION) {
          setAviso(true);
          anotarAviso();
        }
      })
      .catch(() => setGente([]));
  }, []);

  // El segundo aviso de la sesión: solo si quedaron pendientes sin responder.
  useEffect(() => {
    if (!gente || gente.every((p) => p.confirmado !== null)) return;
    if (avisosDados() >= AVISOS_POR_SESION) return;
    const t = setTimeout(() => {
      setAviso(true);
      anotarAviso();
    }, ESPERA_SEGUNDO_AVISO_MS);
    return () => clearTimeout(t);
  }, [gente]);

  // Suelto y sin pendientes no sale nada, nunca. Pero dentro del paso 3 hay
  // que decirlo: si no, el agente abre el paso, no ve nada y cree que está roto.
  if (!gente || gente.length === 0) {
    if (!dentroDePaso) return null;
    return (
      <section className="rounded-[22px] overflow-hidden bg-surface border border-gridline mb-5">
        <p className="px-4 sm:px-5 py-4 text-[13px]" style={{ color: GRIS }}>
          {gente === null
            ? "Buscando quién tocó tu WhatsApp…"
            : "Nadie tocó tu WhatsApp hoy. Los clics de días anteriores se preguntan en Seguimiento, en la fila del día que les toca."}
        </p>
      </section>
    );
  }

  const pendientes = gente.filter((p) => p.confirmado === null);
  const bajaron = gente.filter((p) => p.confirmado === "si").length;

  const bloque = (compacto: boolean) =>
    gente.map((p) => <Pregunta key={p.id} persona={p} onResponder={marcar} compacto={compacto} />);

  return (
    <>
      <section className="rounded-[22px] overflow-hidden bg-surface border border-gridline mb-5">
        <button
          onClick={() => !dentroDePaso && setAbierto((v) => !v)}
          aria-expanded={abierto}
          disabled={dentroDePaso}
          className={`w-full flex items-center gap-2.5 flex-wrap px-4 sm:px-5 py-3 text-left ${
            dentroDePaso ? "cursor-default" : "hover:opacity-95"
          }`}
          style={{ background: pendientes.length > 0 ? ROJO : VERDE, color: "#fff" }}
        >
          <span
            className="text-[13px] font-extrabold rounded-full w-[26px] h-[26px] flex items-center justify-center tabular-nums shrink-0"
            style={{ background: "#fff", color: pendientes.length > 0 ? ROJO : VERDE }}
          >
            {pendientes.length > 0 ? pendientes.length : bajaron}
          </span>
          <span className="text-[14px] font-semibold tracking-[-0.02em]">
            {pendientes.length > 0 ? (
              <>
                {pendientes.length === 1 ? "cliente tocó" : "clientes tocaron"} tu WhatsApp y no sabés si
                llegaron
              </>
            ) : (
              <>
                {bajaron === 1 ? "cliente bajó" : "clientes bajaron"} a tu WhatsApp hoy · todos confirmados
              </>
            )}
          </span>
          {/* Dentro del paso no hay nada que plegar: el encabezado del paso ya
              lo hace, y dos acordeones anidados son tres clics para un dato. */}
          {!dentroDePaso && (
            <span className="ml-auto flex items-center gap-2 text-[12.5px]" style={{ color: "rgba(255,255,255,.72)" }}>
              {abierto ? "Ocultar" : "Revisar ahora · 30 seg"}
              <span className="text-[10px]">{abierto ? "▲" : "▼"}</span>
            </span>
          )}
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
