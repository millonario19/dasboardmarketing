"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ESTADOS, ESTADO_META, type EstadoLead } from "@/lib/leadStates";
import { ConfirmarBajada, guardarConfirmacion } from "@/components/ConfirmarBajada";
import { ContactoRapido } from "@/components/ContactoRapido";
import type { ContactDetail } from "@/lib/metrics";

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

// Un icono por temperatura: copo, sol y llama. Ayudan a distinguir las filas
// sin depender solo del color.
function IconoEstado({ estado, tamano = 20 }: { estado: EstadoLead; tamano?: number }) {
  const comun = {
    width: tamano,
    height: tamano,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (estado === "frio") {
    return (
      <svg {...comun}>
        <path d="M12 2v20M4.9 6l14.2 12M19.1 6L4.9 18M9 3.5l3 3 3-3M9 20.5l3-3 3 3" />
      </svg>
    );
  }
  if (estado === "tibio") {
    return (
      <svg {...comun}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  return (
    <svg {...comun}>
      <path d="M12 22c4 0 7-2.8 7-7 0-4-3-6.5-4-10-2 1.5-3 3.5-3 6-1.5-1-2-2.5-2-4-2.5 2-5 5-5 8 0 4.2 3 7 7 7z" />
    </svg>
  );
}

function IconoTelefono() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink-muted">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

function IconoReloj() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink-muted">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function Confirmacion({
  c,
  onResponder,
}: {
  c: ContactDetail;
  onResponder: (contactId: string, confirmado: boolean) => void;
}) {
  return (
    <ConfirmarBajada
      marcado={c.marcadoBajada}
      confirmacion={c.confirmacion}
      onResponder={(valor) => onResponder(c.id, valor)}
    />
  );
}

function Etiquetas({ c }: { c: ContactDetail }) {
  return (
    <div className="flex flex-wrap gap-1">
      {c.ftdEventDate && (
        <span className="text-[11px] font-medium rounded-full px-2 py-0.5 whitespace-nowrap bg-[#E2F1EA] text-[#157F52]">
          Depositó {fecha(c.ftdEventDate)}
        </span>
      )}
      {c.tags.length === 0 && !c.ftdEventDate && <span className="text-ink-muted text-[11px]">—</span>}
      {c.tags.map((tag) => (
        <span
          key={tag}
          className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${estiloTag(tag)}`}
        >
          {tag}
        </span>
      ))}
    </div>
  );
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

  // Se actualiza el contacto en memoria en vez de recargar toda la lista: la
  // recarga vuelve a pegarle a GHL y el agente vería un parpadeo por cada
  // respuesta.
  const responder = useCallback(async (contactId: string, confirmado: boolean) => {
    const fallo = await guardarConfirmacion(contactId, confirmado);
    if (fallo) {
      setError(fallo);
      return;
    }
    setContacts((prev) =>
      prev
        ? prev.map((c) =>
            c.id === contactId
              ? { ...c, confirmacion: confirmado ? "si" : "no", estado: confirmado ? c.estado : "tibio" }
              : c
          )
        : prev
    );
  }, []);

  const marco = (contenido: ReactNode) => <div className="px-4 pb-4 bg-page">{contenido}</div>;

  if (!agentId) {
    return marco(
      <p className="text-[13px] text-ink-secondary py-2">
        Sin agente asignado — no se puede filtrar el detalle
      </p>
    );
  }
  if (error) return marco(<p className="text-[13px] text-series2 py-2">{error}</p>);
  if (!contacts) return marco(<p className="text-[13px] text-ink-secondary py-2">Cargando…</p>);
  if (contacts.length === 0) {
    return marco(<p className="text-[13px] text-ink-secondary py-2">Sin contactos en este rango</p>);
  }

  const porEstado = (e: EstadoLead) => contacts.filter((c) => c.estado === e).length;

  return marco(
    <>
      <div className="flex items-center gap-2.5 flex-wrap mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Contactos del día
        </span>
        <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-ink-primary text-white tabular-nums">
          {contacts.length}
        </span>
        {/* Resumen de temperaturas: cuántos hay de cada una, antes de leer la lista. */}
        <div className="flex gap-1.5 flex-wrap">
          {ESTADOS.map((e) => (
            <span
              key={e}
              className="flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 bg-surface border border-gridline"
            >
              <i className="w-2.5 h-2.5 rounded-full" style={{ background: ESTADO_META[e].color }} />
              {ESTADO_META[e].nombre}
              <b className="text-ink-muted">{porEstado(e)}</b>
            </span>
          ))}
        </div>
      </div>

      {/* Escritorio: tabla con la temperatura como bloque de color y la fila
          teñida. Móvil: tarjetas con franja lateral, porque cinco columnas en
          un teléfono obligan a scrollear de lado. */}
      <div className="hidden sm:block rounded-xl border border-gridline bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]" style={{ minWidth: 720 }}>
            <thead>
              <tr className="bg-header text-left border-b border-gridline">
                {["Temperatura", "Nombre", "Teléfono", "Creado", "Etiquetas"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 font-semibold text-[10.5px] uppercase tracking-wider text-ink-primary whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const meta = ESTADO_META[c.estado];
                return (
                  <tr
                    key={c.id}
                    className="border-b border-gridline last:border-0 hover:brightness-[0.97] transition-[filter]"
                    style={{ background: `${meta.color}0D` }}
                  >
                    <td className="py-2 pl-2.5 pr-2 w-[150px]">
                      <div
                        className="flex items-center gap-2 rounded-xl px-3 py-2 font-bold text-[13px]"
                        style={{ background: meta.color, color: meta.sobre }}
                      >
                        <IconoEstado estado={c.estado} tamano={17} />
                        {meta.nombre}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-ink-primary">{c.name}</td>
                    <td className="px-4 py-2.5 text-ink-secondary tabular-nums whitespace-nowrap">
                      <ContactoRapido telefono={c.phone} nombre={c.name} tamano={28} />
                    </td>
                    <td className="px-4 py-2.5 text-ink-secondary tabular-nums whitespace-nowrap">
                      {fecha(c.dateAdded)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Etiquetas c={c} />
                      {c.marcadoBajada && (
                        <div className="mt-1.5">
                          <Confirmacion c={c} onResponder={responder} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sm:hidden flex flex-col gap-2.5">
        {contacts.map((c) => {
          const meta = ESTADO_META[c.estado];
          return (
            <article
              key={c.id}
              className="grid rounded-2xl overflow-hidden"
              style={{
                gridTemplateColumns: "84px minmax(0,1fr)",
                background: `${meta.color}0F`,
                border: `2px solid ${meta.color}`,
              }}
            >
              <div
                className="flex flex-col items-center justify-center gap-1.5 py-4 px-1 text-[12px] font-extrabold"
                style={{ background: meta.color, color: meta.sobre }}
              >
                <IconoEstado estado={c.estado} tamano={22} />
                {meta.nombre}
              </div>
              <div className="p-3 min-w-0">
                <p className="text-[15px] font-extrabold text-ink-primary truncate">{c.name}</p>
                <div className="flex items-center gap-2 text-[13px] text-ink-secondary mt-1.5">
                  <IconoTelefono />
                  <ContactoRapido telefono={c.phone} nombre={c.name} tamano={28} />
                </div>
                <div className="flex items-center gap-2 text-[13px] text-ink-secondary mt-1">
                  <IconoReloj />
                  {fecha(c.dateAdded)}
                </div>
                <div className="mt-2.5">
                  <Etiquetas c={c} />
                </div>
                {c.marcadoBajada && (
                  <div className="mt-2.5">
                    <Confirmacion c={c} onResponder={responder} />
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
