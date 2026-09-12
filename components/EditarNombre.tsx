"use client";

import { useState } from "react";

const AZUL = "#17457F";

/**
 * Corrige el nombre del lead y lo escribe en GHL.
 *
 * Media base llega del formulario de Facebook con lo que el cliente quiso
 * poner: «mi guía», «mi hijo», «dios», un corazón, un punto. El agente que ya
 * habló con esa persona sabe cómo se llama, y es el único que lo sabe: por eso
 * la corrección va acá, en la fila donde está trabajando, y no en el CRM.
 *
 * El original queda guardado del lado del servidor. Es un dato de la pauta
 * —cuánta gente no escribe su nombre— y se perdería al pisarlo.
 */
export function EditarNombre({
  contactId,
  nombre,
  onCambiado,
}: {
  contactId: string;
  nombre: string;
  onCambiado?: (nuevo: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nombre);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function guardar() {
    const limpio = texto.trim();
    if (limpio === nombre.trim()) {
      setEditando(false);
      return;
    }
    setGuardando(true);
    setError(null);
    fetch(`/api/contactos/${encodeURIComponent(contactId)}/nombre`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: limpio }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "No se pudo guardar");
        setEditando(false);
        onCambiado?.(d.nombre);
      })
      .catch((e) => setError(e.message))
      .finally(() => setGuardando(false));
  }

  if (!editando) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setTexto(nombre);
          setEditando(true);
        }}
        title="Corregir el nombre"
        aria-label={`Corregir el nombre de ${nombre}`}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] shrink-0 hover:opacity-70"
        style={{ color: AZUL, background: "rgba(23,69,127,.08)" }}
      >
        ✎
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") guardar();
          if (e.key === "Escape") setEditando(false);
        }}
        disabled={guardando}
        className="w-[160px] rounded-lg border px-2 py-1 text-[13px] outline-none"
        style={{ borderColor: AZUL }}
      />
      <button
        onClick={guardar}
        disabled={guardando}
        className="rounded-lg px-2 py-1 text-[11.5px] font-bold text-white disabled:opacity-50"
        style={{ background: AZUL }}
      >
        {guardando ? "…" : "OK"}
      </button>
      <button
        onClick={() => setEditando(false)}
        disabled={guardando}
        className="text-[11.5px] text-ink-muted hover:text-ink-primary"
      >
        ✕
      </button>
      {error && <span className="text-[11px] text-series2">{error}</span>}
    </span>
  );
}
