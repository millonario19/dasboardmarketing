"use client";

import { useCallback, useEffect, useState } from "react";
import { CambiarVista } from "@/components/CambiarVista";
import { ESTADO_META } from "@/lib/leadStates";
import type { Bloque, LeadItem, MiDia } from "@/lib/miDia";

const TONOS: Record<string, { fondo: string; texto: string; barra: string }> = {
  movimiento: { fondo: "#FBE8E1", texto: "#A63312", barra: "#D9481F" },
  caliente: { fondo: "#FBE8E1", texto: "#A63312", barra: "#D9481F" },
  tibio: { fondo: "#FDF3DA", texto: "#8A6100", barra: "#E0A800" },
  frio: { fondo: "#EDF1F7", texto: "#3C536F", barra: "#7C8AA5" },
  rescate: { fondo: "#EAF1FA", texto: "#2A6FB8", barra: "#2A78D6" },
};

// El agente elige su nombre una vez y el navegador lo recuerda. Es la solución
// práctica mientras el dashboard tenga una sola contraseña compartida y no
// pueda saber quién está mirando.
const CLAVE_AGENTE = "op_agente";

function leerAgenteGuardado(): string {
  try {
    return localStorage.getItem(CLAVE_AGENTE) ?? "todos";
  } catch {
    return "todos";
  }
}

export default function MiDiaPage() {
  const [agente, setAgente] = useState<string>("todos");
  const [data, setData] = useState<MiDia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAgente(leerAgenteGuardado());
  }, []);

  const cargar = useCallback((quien: string) => {
    setCargando(true);
    setError(null);
    fetch(`/api/mi-dia?agente=${encodeURIComponent(quien)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Error al cargar la lista");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar(agente);
  }, [agente, cargar]);

  function cambiarAgente(id: string) {
    setAgente(id);
    try {
      localStorage.setItem(CLAVE_AGENTE, id);
    } catch {
      /* modo privado: se pierde al cerrar, no rompe nada */
    }
  }

  const pendientes = data?.bloques.reduce((s, b) => s + b.total, 0) ?? 0;

  return (
    <main className="max-w-4xl mx-auto px-5 py-7">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <h1 className="text-3xl md:text-4xl font-semibold text-ink-primary tracking-tight">
          Mi día
        </h1>
        <CambiarVista actual="mi-dia" />
      </div>

      <p className="text-sm text-ink-secondary mb-5">
        A quién escribirle ahora, de arriba hacia abajo.
        {data && !cargando && ` ${pendientes} por atender.`}
      </p>

      <div className="flex items-center gap-2 flex-wrap mb-6">
        <select
          value={agente}
          onChange={(e) => cambiarAgente(e.target.value)}
          className="border border-gridline rounded-full px-4 py-2 text-sm bg-surface text-ink-primary"
        >
          <option value="todos">Toda la oficina</option>
          {data?.agentes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
        <button
          onClick={() => cargar(agente)}
          disabled={cargando}
          className="border border-gridline rounded-full px-4 py-2 text-sm bg-surface text-ink-primary hover:bg-page disabled:opacity-50"
        >
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className="bg-surface border border-series2 text-series2 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {cargando && !data && <p className="text-sm text-ink-secondary">Cargando tu lista…</p>}

      {data && (
        <div className="flex flex-col gap-5">
          {data.bloques.map((b) => (
            <BloqueLista key={b.id} bloque={b} locationId={data.locationId} />
          ))}
          {pendientes === 0 && !cargando && (
            <p className="text-sm text-ink-secondary">
              No hay nada pendiente en esta lista. Cambiá de agente o volvé más tarde.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

function BloqueLista({ bloque, locationId }: { bloque: Bloque; locationId: string }) {
  if (bloque.total === 0) return null;
  const tono = TONOS[bloque.tono] ?? TONOS.frio;

  return (
    <section className="rounded-xl border border-gridline bg-surface overflow-hidden">
      <header
        className="px-4 py-2.5 flex items-baseline gap-2 flex-wrap border-l-4"
        style={{ background: tono.fondo, borderLeftColor: tono.barra }}
      >
        <h2 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: tono.texto }}>
          {bloque.titulo}
        </h2>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: tono.texto }}>
          {bloque.total}
        </span>
        <span className="text-[13px] text-ink-secondary">— {bloque.subtitulo}</span>
      </header>

      <ul>
        {bloque.items.map((l) => (
          <Fila key={l.id} lead={l} locationId={locationId} />
        ))}
      </ul>

      {bloque.total > bloque.items.length && (
        <p className="px-4 py-2.5 text-[13px] text-ink-muted border-t border-gridline">
          Se muestran {bloque.items.length} de {bloque.total}. Atendé estos primero.
        </p>
      )}
    </section>
  );
}

function Fila({ lead, locationId }: { lead: LeadItem; locationId: string }) {
  // wa.me necesita solo dígitos; el teléfono de GHL viene como "+573107295654".
  const digitos = lead.telefono?.replace(/\D/g, "") ?? "";
  const crm = `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${lead.id}`;
  const meta = ESTADO_META[lead.estado];

  return (
    <li className="flex items-center gap-3 flex-wrap px-4 py-3 border-t border-gridline first:border-t-0 hover:bg-page">
      <div className="flex-1 min-w-[200px]">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-ink-primary">{lead.nombre}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: TONOS[lead.estado]?.fondo, color: TONOS[lead.estado]?.texto }}>
            {meta.nombre}
          </span>
        </div>
        <div className="text-[13px] text-ink-secondary">
          {lead.movimiento ? (
            <>
              <strong className="font-semibold text-ink-primary">{lead.movimiento.que}</strong>{" "}
              {lead.movimiento.cuando}
              {lead.movimiento.esRescate && (
                <span className="text-[11px] ml-1.5 px-1.5 py-0.5 rounded-full bg-header text-header-ink">
                  rescate
                </span>
              )}
            </>
          ) : (
            lead.recorrido
          )}
        </div>
      </div>

      <div className="text-[12px] text-ink-muted tabular-nums whitespace-nowrap">
        {lead.dias === 0 ? "entró hoy" : lead.dias === 1 ? "hace 1 día" : `hace ${lead.dias} días`}
      </div>

      <div className="flex gap-1.5 shrink-0">
        {digitos ? (
          <a
            href={`https://wa.me/${digitos}`}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-series3 text-white hover:opacity-90"
          >
            WhatsApp
          </a>
        ) : (
          <span className="text-[12px] px-3 py-1.5 rounded-md border border-gridline text-ink-muted">
            Sin teléfono
          </span>
        )}
        <a
          href={crm}
          target="_blank"
          rel="noreferrer"
          className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-gridline text-ink-secondary hover:bg-page"
        >
          CRM
        </a>
      </div>
    </li>
  );
}
