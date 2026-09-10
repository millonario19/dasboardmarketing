"use client";

import { useEffect, useState } from "react";
import type { ContactDetail } from "@/lib/metrics";

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

  if (!agentId) {
    return <div className="px-4 py-3 text-sm text-ink-secondary">Sin agente asignado — no se puede filtrar el detalle</div>;
  }

  if (error) {
    return <div className="px-4 py-3 text-sm text-series2">{error}</div>;
  }

  if (!contacts) {
    return <div className="px-4 py-3 text-sm text-ink-secondary">Cargando…</div>;
  }

  if (contacts.length === 0) {
    return <div className="px-4 py-3 text-sm text-ink-secondary">Sin contactos en este rango</div>;
  }

  return (
    <div className="px-4 py-3 bg-page">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-muted">
            <th className="py-1.5 font-medium">Nombre</th>
            <th className="py-1.5 font-medium">Teléfono</th>
            <th className="py-1.5 font-medium">Creado</th>
            <th className="py-1.5 font-medium">FTD el</th>
            <th className="py-1.5 font-medium">Etiquetas</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id} className="border-t border-gridline">
              <td className="py-1.5">{c.name}</td>
              <td className="py-1.5 text-ink-secondary">{c.phone ?? "—"}</td>
              <td className="py-1.5 text-ink-secondary tabular-nums whitespace-nowrap">
                {new Date(c.dateAdded).toLocaleString("es-CO", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="py-1.5 text-ink-secondary tabular-nums whitespace-nowrap">
                {c.ftdEventDate
                  ? new Date(c.ftdEventDate).toLocaleString("es-CO", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </td>
              <td className="py-1.5">
                <div className="flex flex-wrap gap-1">
                  {c.tags.length === 0 && <span className="text-ink-muted">—</span>}
                  {c.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`px-2 py-0.5 rounded-full text-xs border bg-surface ${
                        tag.toLowerCase() === "ftd-efectuado"
                          ? "border-series2 text-series2"
                          : tag.toLowerCase().includes("registrado")
                          ? "border-series1 text-series1"
                          : "border-gridline text-ink-secondary"
                      }`}
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
  );
}
