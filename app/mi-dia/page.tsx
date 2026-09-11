"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CambiarVista } from "@/components/CambiarVista";
import { EscalaEmbudo, Inicial } from "@/components/EscalaEmbudo";
import { ESTADO_META } from "@/lib/leadStates";
import type { Bloque, LeadItem, MiDia } from "@/lib/miDia";

const TONOS: Record<string, { fondo: string; texto: string; color: string }> = {
  movimiento: { fondo: "#FBE8E1", texto: "#A63312", color: "#D9481F" },
  caliente: { fondo: "#FBE8E1", texto: "#A63312", color: "#D9481F" },
  tibio: { fondo: "#FDF3DA", texto: "#8A6100", color: "#E0A800" },
  frio: { fondo: "#EDF1F7", texto: "#3C536F", color: "#7C8AA5" },
  rescate: { fondo: "#EAF1FA", texto: "#2A6FB8", color: "#2A78D6" },
};

// El agente se elige a sí mismo una vez y el navegador lo recuerda: mientras
// el dashboard tenga una sola contraseña compartida no puede saber quién entró.
const CLAVE_AGENTE = "op_agente";

export default function MiDiaPage() {
  const [agente, setAgente] = useState("todos");
  const [filtro, setFiltro] = useState("todos");
  const [data, setData] = useState<MiDia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setAgente(localStorage.getItem(CLAVE_AGENTE) ?? "todos");
    } catch {
      /* modo privado */
    }
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

  function elegirAgente(id: string) {
    setAgente(id);
    try {
      localStorage.setItem(CLAVE_AGENTE, id);
    } catch {
      /* modo privado */
    }
  }

  const bloques = data?.bloques ?? [];
  const conteos = useMemo(() => {
    const por = (id: string) => bloques.find((b) => b.id === id)?.total ?? 0;
    return {
      pendientes: bloques.reduce((s, b) => s + b.total, 0),
      calientes: por("caliente"),
      movimientos: por("movimiento"),
    };
  }, [bloques]);

  const visibles = filtro === "todos" ? bloques : bloques.filter((b) => b.id === filtro);
  const nombreAgente = data?.agentes.find((a) => a.id === agente)?.nombre ?? "Toda la oficina";

  return (
    <main className="max-w-5xl mx-auto px-5 py-6">
      {/* Barra superior: una sola cápsula oscura, como en la referencia */}
      <div className="flex items-center gap-3 mb-7 flex-wrap">
        <div className="flex items-center gap-3 bg-ink-primary text-white rounded-full pl-5 pr-2 py-2 flex-1 min-w-[260px]">
          <span className="text-sm font-medium">Mi día</span>
          {/* first-letter y no capitalize: en español "capitalize" deja
              "Jueves, 11 De Septiembre", con el "de" en mayúscula. */}
          <span className="text-[13px] bg-white/15 rounded-full px-3 py-1 first-letter:uppercase">
            {new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          <span className="flex-1" />
          <select
            value={agente}
            onChange={(e) => elegirAgente(e.target.value)}
            className="text-[13px] bg-white/15 rounded-full px-3 py-1.5 text-white outline-none max-w-[180px]"
          >
            <option value="todos" className="text-ink-primary">Toda la oficina</option>
            {data?.agentes.map((a) => (
              <option key={a.id} value={a.id} className="text-ink-primary">
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
        <CambiarVista actual="mi-dia" />
      </div>

      {/* Encabezado con los tres contadores */}
      <div className="flex items-end justify-between gap-6 flex-wrap mb-7">
        <div>
          <h1 className="text-4xl md:text-5xl font-semibold text-ink-primary tracking-tight leading-none">
            MI DÍA
          </h1>
          <p className="text-sm text-ink-secondary mt-2">
            {nombreAgente} · a quién escribirle ahora, de arriba hacia abajo
          </p>
        </div>
        <div className="flex items-end gap-7">
          <Contador valor={conteos.pendientes} etiqueta="Pendientes" />
          <Contador valor={conteos.calientes} etiqueta="Calientes" color={TONOS.caliente.color} />
          <Contador valor={conteos.movimientos} etiqueta="Se movieron" color={TONOS.rescate.color} />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <Pildora activa={filtro === "todos"} onClick={() => setFiltro("todos")}>
          Todos
        </Pildora>
        {bloques
          .filter((b) => b.total > 0)
          .map((b) => (
            <Pildora key={b.id} activa={filtro === b.id} onClick={() => setFiltro(b.id)}>
              {b.id === "caliente" && "🔥 "}
              {b.titulo} <span className="tabular-nums opacity-60">{b.total}</span>
            </Pildora>
          ))}
        <button
          onClick={() => cargar(agente)}
          disabled={cargando}
          className="ml-auto rounded-full px-4 py-2 text-sm font-medium bg-ink-primary text-white hover:opacity-90 disabled:opacity-50"
        >
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className="bg-surface border border-series2 text-series2 rounded-2xl p-4 mb-4 text-sm">{error}</div>
      )}
      {cargando && !data && <p className="text-sm text-ink-secondary">Cargando tu lista…</p>}

      <div className="flex flex-col gap-5">
        {visibles.map((b) =>
          b.id === "movimiento" ? (
            <TiraMovimientos key={b.id} bloque={b} locationId={data!.locationId} />
          ) : (
            <BloqueLista key={b.id} bloque={b} locationId={data!.locationId} />
          )
        )}
        {data && conteos.pendientes === 0 && !cargando && (
          <p className="text-sm text-ink-secondary">No hay nada pendiente. Cambiá de agente o volvé más tarde.</p>
        )}
      </div>
    </main>
  );
}

function Contador({ valor, etiqueta, color }: { valor: number; etiqueta: string; color?: string }) {
  return (
    <div className="text-right">
      <div
        className="text-3xl md:text-4xl font-semibold tabular-nums leading-none"
        style={{ color: color ?? "var(--text-primary)" }}
      >
        {valor}
      </div>
      <div className="text-[12px] text-ink-secondary mt-1">{etiqueta}</div>
    </div>
  );
}

function Pildora({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-[13px] whitespace-nowrap transition-colors ${
        activa
          ? "bg-surface text-ink-primary font-medium shadow-sm border border-gridline"
          : "text-ink-secondary border border-transparent hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

/** Los movimientos van en tarjetas: son pocos y son los más urgentes. */
function TiraMovimientos({ bloque, locationId }: { bloque: Bloque; locationId: string }) {
  if (bloque.total === 0) return null;
  return (
    <section>
      <Encabezado bloque={bloque} />
      <div className="flex gap-3 overflow-x-auto pb-1">
        {bloque.items.map((l) => (
          <Tarjeta key={l.id} lead={l} locationId={locationId} />
        ))}
      </div>
    </section>
  );
}

/** Las listas largas van en filas densas: con 40 por bloque, tarjetas serían scroll infinito. */
function BloqueLista({ bloque, locationId }: { bloque: Bloque; locationId: string }) {
  if (bloque.total === 0) return null;
  return (
    <section>
      <Encabezado bloque={bloque} />
      <div className="rounded-2xl bg-surface shadow-sm overflow-hidden">
        <ul>
          {bloque.items.map((l) => (
            <Fila key={l.id} lead={l} locationId={locationId} />
          ))}
        </ul>
        {bloque.total > bloque.items.length && (
          <p className="px-5 py-3 text-[13px] text-ink-muted border-t border-gridline">
            Se muestran {bloque.items.length} de {bloque.total}. Atendé estos primero.
          </p>
        )}
      </div>
    </section>
  );
}

function Encabezado({ bloque }: { bloque: Bloque }) {
  const t = TONOS[bloque.tono] ?? TONOS.frio;
  return (
    <div className="flex items-baseline gap-2.5 flex-wrap mb-2.5 px-1">
      <span
        className="rounded-full px-3.5 py-1 text-[12px] font-semibold uppercase tracking-wider"
        style={{ background: t.fondo, color: t.texto }}
      >
        {bloque.titulo}
      </span>
      <span className="text-[15px] font-semibold tabular-nums text-ink-primary">{bloque.total}</span>
      <span className="text-[13px] text-ink-secondary">{bloque.subtitulo}</span>
    </div>
  );
}

function datosLead(lead: LeadItem, locationId: string) {
  return {
    digitos: lead.telefono?.replace(/\D/g, "") ?? "",
    crm: `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${lead.id}`,
    color: TONOS[lead.estado]?.color ?? TONOS.frio.color,
    edad: lead.dias === 0 ? "entró hoy" : lead.dias === 1 ? "hace 1 día" : `hace ${lead.dias} días`,
  };
}

function Tarjeta({ lead, locationId }: { lead: LeadItem; locationId: string }) {
  const { digitos, crm, color, edad } = datosLead(lead, locationId);
  return (
    <article className="rounded-2xl bg-surface shadow-sm p-4 w-[272px] shrink-0 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <Inicial nombre={lead.nombre} color={color} />
        <a
          href={crm}
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir en el CRM"
          className="w-8 h-8 rounded-full border border-gridline flex items-center justify-center text-ink-muted hover:bg-page shrink-0"
        >
          ↗
        </a>
      </div>
      <div>
        <p className="font-semibold text-ink-primary leading-tight truncate">{lead.nombre}</p>
        <p className="text-[13px] text-ink-secondary mt-0.5">
          <strong className="font-semibold text-ink-primary">{lead.movimiento?.que}</strong>{" "}
          {lead.movimiento?.cuando}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <EscalaEmbudo acciones={lead.acciones} />
        {lead.movimiento?.esRescate ? (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-header text-header-ink">rescate</span>
        ) : (
          <span className="text-[11px] text-ink-muted">{edad}</span>
        )}
      </div>
      <BotonWhatsApp digitos={digitos} ancho />
    </article>
  );
}

function Fila({ lead, locationId }: { lead: LeadItem; locationId: string }) {
  const { digitos, crm, color, edad } = datosLead(lead, locationId);
  const meta = ESTADO_META[lead.estado];

  return (
    <li className="flex items-center gap-3 flex-wrap px-5 py-3 border-t border-gridline first:border-t-0 hover:bg-page">
      <Inicial nombre={lead.nombre} color={color} />

      <div className="flex-1 min-w-[170px]">
        <p className="font-medium text-ink-primary truncate">{lead.nombre}</p>
        <p className="text-[13px] text-ink-secondary truncate">
          {lead.movimiento ? (
            <>
              <strong className="font-semibold text-ink-primary">{lead.movimiento.que}</strong>{" "}
              {lead.movimiento.cuando}
            </>
          ) : (
            lead.recorrido
          )}
        </p>
      </div>

      <EscalaEmbudo acciones={lead.acciones} />

      <div className="text-[12px] text-ink-muted tabular-nums whitespace-nowrap w-[74px] text-right">
        {edad}
      </div>

      <div className="flex gap-1.5 shrink-0 items-center">
        <BotonWhatsApp digitos={digitos} />
        <a
          href={crm}
          target="_blank"
          rel="noreferrer"
          aria-label={`Abrir ${lead.nombre} en el CRM`}
          title={`${meta.nombre} · abrir en el CRM`}
          className="w-8 h-8 rounded-full border border-gridline flex items-center justify-center text-ink-muted hover:bg-page"
        >
          ↗
        </a>
      </div>
    </li>
  );
}

function BotonWhatsApp({ digitos, ancho }: { digitos: string; ancho?: boolean }) {
  const base = `rounded-full px-4 py-2 text-[13px] font-medium text-center ${ancho ? "block w-full" : ""}`;
  if (!digitos) {
    return <span className={`${base} bg-page text-ink-muted`}>Sin teléfono</span>;
  }
  return (
    <a
      href={`https://wa.me/${digitos}`}
      target="_blank"
      rel="noreferrer"
      className={`${base} bg-ink-primary text-white hover:opacity-90`}
    >
      WhatsApp
    </a>
  );
}
