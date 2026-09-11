"use client";

import { useState } from "react";

// Verde de "confirmado". En línea y no como clase de Tailwind: con valor
// arbitrario el escáner no siempre genera la regla y el botón queda sin fondo.
const VERDE = "#157F52";

/**
 * La pregunta al agente sobre la bajada a WhatsApp.
 *
 * Existe porque hasta ahora el sistema confiaba ciegamente en la etiqueta del
 * flujo: GHL marcaba "bajado a business" sin que nadie verificara que la
 * conversación hubiera existido. Cuando el agente responde que no, la bajada
 * deja de contar y el lead baja de temperatura — la respuesta corrige el dato,
 * no queda como un comentario al margen.
 *
 * Vive acá, suelto de cualquier pantalla, porque se pregunta en dos lugares:
 * el detalle de cada agente y la lista de leads calientes del panel. Dos
 * copias del mismo control terminan respondiendo distinto.
 */
export function ConfirmarBajada({
  marcado,
  confirmacion,
  onResponder,
  // En una tabla la pregunta ya está en el encabezado de la columna;
  // repetirla en cada fila empuja los botones a una segunda línea.
  conPregunta = true,
}: {
  marcado: boolean;
  confirmacion: "si" | "no" | null;
  onResponder: (confirmado: boolean) => Promise<void> | void;
  conPregunta?: boolean;
}) {
  const [enviando, setEnviando] = useState(false);

  // Sin la etiqueta del flujo no hay nada que confirmar.
  if (!marcado) return null;

  if (confirmacion === "si") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 bg-[#E2F1EA] text-[#157F52] whitespace-nowrap">
        ✓ Bajada confirmada
      </span>
    );
  }
  if (confirmacion === "no") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 bg-[#f2f1ea] text-ink-secondary whitespace-nowrap">
        Pendiente — no bajó
      </span>
    );
  }

  async function responder(valor: boolean) {
    setEnviando(true);
    try {
      await onResponder(valor);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {conPregunta && <span className="text-[11px] text-ink-secondary">¿Bajó a WhatsApp?</span>}
      <button
        onClick={() => responder(true)}
        disabled={enviando}
        className="text-[11px] font-semibold rounded-full px-2.5 py-1 text-white hover:opacity-90 disabled:opacity-50"
        style={{ background: VERDE }}
      >
        Sí
      </button>
      <button
        onClick={() => responder(false)}
        disabled={enviando}
        className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-surface border border-gridline text-ink-secondary hover:bg-page disabled:opacity-50"
      >
        No
      </button>
    </div>
  );
}

/** Guarda la respuesta en GHL. Devuelve el error si algo falló, o null. */
export async function guardarConfirmacion(
  contactId: string,
  confirmado: boolean
): Promise<string | null> {
  try {
    const res = await fetch("/api/contacts/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, confirmado }),
    });
    if (!res.ok) return (await res.json()).error ?? "No se pudo guardar la confirmación";
    return null;
  } catch {
    return "No se pudo guardar la confirmación";
  }
}
