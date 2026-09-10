"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ContactDetail } from "@/lib/metrics";

const COLUMNAS = ["Nombre", "Teléfono", "Creado", "FTD el", "Etiquetas"];

// Píldoras con fondo suave en vez de solo borde: con muchas etiquetas por
// contacto, los bordes de colores hacían ruido y se leía como un amontonamiento.
function estiloTag(tag: string): string {
  const t = tag.toLowerCase();
  if (t === "ftd-efectuado") return "bg-[#fdeee7] text-[#b5501f]";
  if (t.includes("registrado")) return "bg-header text-header-ink";
  return "bg-[#f2f1ea] text-ink-secondary";
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgentDetail({ agentId, from, to }: { agentId: string | null; from: string; to: string }) {
  const [contacts, setContacts] = useState<ContactDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) {
      setContacts([]);
      return;
    }
    let cancelled = false;
    setContacts(null);
    setError(null);
    fetch(`/api/contacts?agentId=${encodeURIComponent(agentId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Error al cargar el detalle");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setContacts(data.contacts);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, from, to]);

  const marco = (contenido: ReactNode) => <div className="px-4 pb-4 bg-page">{contenido}</div>;

  if (!agentId) {
    return marco(
      <p className="text-[13px] text-ink-secondary py-2">
        Sin agente asignado — no se puede filtrar el detalle
      </p>
    );
  }

  if (error) {
    return marco(<p className="text-[13px] text-series2 py-2">{error}</p>);
  }

  if (!contacts) {
    return marco(<p className="text-[13px] text-ink-secondary py-2">Cargando…</p>);
  }

  if (contacts.length === 0) {
    return marco(<p className="text-[13px] text-ink-secondary py-2">Sin contactos en este rango</p>);
  }

  return marco(
    <>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Contactos del día
        </span>
        <span className="text-[11px] text-ink-muted tabular-nums">({contacts.length})</span>
      </div>

      <div className="rounded-xl border border-gridline bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              {/* Franja celeste: separa visualmente los títulos de las filas de datos. */}
              <tr className="bg-header text-left">
                {COLUMNAS.map((c) => (
                  <th
                    key={c}
                    className="px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider text-header-ink whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-t border-gridline hover:bg-page transition-colors">
                  <td className="px-4 py-2.5 font-medium text-ink-primary">{c.name}</td>
                  <td className="px-4 py-2.5 text-ink-secondary tabular-nums whitespace-nowrap">
                    {c.phone ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-ink-secondary tabular-nums whitespace-nowrap">
                    {fecha(c.dateAdded)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">
                    {c.ftdEventDate ? (
                      <span className="text-series2 font-medium">{fecha(c.ftdEventDate)}</span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.length === 0 && <span className="text-ink-muted">—</span>}
                      {c.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${estiloTag(tag)}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
