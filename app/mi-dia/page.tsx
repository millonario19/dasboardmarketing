"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { EscalaEmbudo, Inicial } from "@/components/EscalaEmbudo";
import type { Bloque, LeadItem, MiDia } from "@/lib/miDia";

// Paleta tomada de la referencia: gris cálido de fondo, blanco para las
// tarjetas, negro para la barra y el título, y un verde ácido como única nota
// de color. El verde siempre lleva texto negro encima: sobre blanco no tiene
// contraste suficiente.
const FONDO = "#E8E8E5";
const LIMA = "#C6F24E";
const NEGRO = "#0D0D0D";
const GRIS = "#8E8E88";
const BORDE = "#D8D8D3";

const COLOR_ESTADO: Record<string, string> = {
  caliente: "#D9481F",
  tibio: "#E0A800",
  frio: "#7C8AA5",
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
  const movimientos = bloques.find((b) => b.id === "movimiento");
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
    <div className="min-h-screen" style={{ background: FONDO, color: NEGRO }}>
      <div className="max-w-6xl mx-auto px-5 py-5">

        {/* Barra superior: cápsula negra a la izquierda, tira verde con los
            movimientos del día a la derecha, igual que la referencia. */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center flex-1 min-w-0 rounded-full" style={{ background: NEGRO }}>
            <div className="flex items-center gap-3 pl-6 pr-4 py-2.5 shrink-0">
              <span className="text-white font-medium">Mi día</span>
              <span
                className="text-[13px] rounded-full px-3 py-1 first-letter:uppercase whitespace-nowrap text-white"
                style={{ background: "rgba(255,255,255,0.14)" }}
              >
                {new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long" })}
              </span>
            </div>

            <div
              className="flex-1 min-w-0 flex items-center gap-2 rounded-full px-3 py-1.5 mr-1.5 overflow-x-auto"
              style={{ background: LIMA }}
            >
              {movimientos && movimientos.items.length > 0 ? (
                movimientos.items.slice(0, 6).map((l) => (
                  <span
                    key={l.id}
                    className="flex items-center gap-1.5 bg-white rounded-full pl-1 pr-2.5 py-1 text-[12px] whitespace-nowrap shrink-0"
                  >
                    <Inicial nombre={l.nombre} color={COLOR_ESTADO[l.estado] ?? GRIS} tamano={20} />
                    <strong className="font-semibold">{l.movimiento?.que}</strong>
                    <span style={{ color: GRIS }}>{l.movimiento?.cuando}</span>
                  </span>
                ))
              ) : (
                <span className="text-[12.5px] font-medium px-2 py-0.5 whitespace-nowrap">
                  Todavía nadie se movió hoy
                </span>
              )}
            </div>
          </div>

          <Link
            href="/"
            className="rounded-full px-5 py-2.5 text-sm font-medium bg-white shrink-0"
            style={{ border: `1px solid ${BORDE}` }}
          >
            Dirección
          </Link>
        </div>

        {/* Título y contadores */}
        <div className="flex items-end justify-between gap-6 flex-wrap mb-8">
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter leading-none">
              MI D
              <span className="relative inline-block">
                <span
                  className="absolute rounded-full"
                  style={{ background: LIMA, inset: "-8px -5px", zIndex: 0 }}
                />
                <span className="relative">Í</span>
              </span>
              A
            </h1>
            <button
              onClick={() => cargar(agente)}
              disabled={cargando}
              className="rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
              style={{ background: LIMA, color: NEGRO }}
            >
              {cargando ? "Actualizando…" : "↻ Actualizar"}
            </button>
          </div>

          <div className="flex items-end gap-8">
            <Contador valor={conteos.pendientes} etiqueta="Pendientes" />
            <Contador valor={conteos.calientes} etiqueta="Calientes" color={COLOR_ESTADO.caliente} />
            <Contador valor={conteos.movimientos} etiqueta="Se movieron" destacado />
          </div>
        </div>

        {/* Rótulo, agente y filtros */}
        <div className="flex items-center gap-3 flex-wrap mb-5">
          <h2 className="text-2xl font-bold tracking-tight">Mis leads</h2>
          <span className="text-sm border-b-2 pb-0.5" style={{ borderColor: NEGRO }}>
            <strong className="tabular-nums">{conteos.pendientes}</strong> leads
          </span>

          <select
            value={agente}
            onChange={(e) => elegirAgente(e.target.value)}
            className="rounded-full px-4 py-2 text-[13px] bg-white outline-none"
            style={{ border: `1px solid ${BORDE}` }}
          >
            <option value="todos">Toda la oficina</option>
            {data?.agentes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>

          <Pildora activa={filtro === "todos"} onClick={() => setFiltro("todos")}>
            Todos
          </Pildora>
          {bloques
            .filter((b) => b.total > 0)
            .map((b) => (
              <Pildora key={b.id} activa={filtro === b.id} onClick={() => setFiltro(b.id)}>
                {b.id === "caliente" && "🔥 "}
                {b.titulo}
              </Pildora>
            ))}
        </div>

        {error && (
          <div className="rounded-2xl bg-white p-4 mb-4 text-sm" style={{ color: "#C0432A" }}>
            {error}
          </div>
        )}
        {cargando && !data && (
          <p className="text-sm" style={{ color: GRIS }}>
            Cargando tu lista…
          </p>
        )}

        <div className="flex flex-col gap-8">
          {visibles.map((b) => (
            <BloqueTarjetas key={b.id} bloque={b} locationId={data!.locationId} />
          ))}
          {data && conteos.pendientes === 0 && !cargando && (
            <p className="text-sm" style={{ color: GRIS }}>
              No hay nada pendiente. Cambiá de agente o volvé más tarde.
            </p>
          )}
        </div>

        <p className="text-[12px] mt-10" style={{ color: GRIS }}>
          {nombreAgente} · la lista se ordena por oportunidad, de arriba hacia abajo.
        </p>
      </div>
    </div>
  );
}

function Contador({
  valor,
  etiqueta,
  color,
  destacado,
}: {
  valor: number;
  etiqueta: string;
  color?: string;
  destacado?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <div>
        <div
          className="text-4xl md:text-5xl font-extrabold tabular-nums leading-none tracking-tighter"
          style={{ color: color ?? NEGRO }}
        >
          {valor}
        </div>
        <div className="text-[13px] mt-1.5" style={{ color: GRIS }}>
          {etiqueta}
        </div>
      </div>
      {destacado && valor > 0 && (
        <span
          className="text-[11px] font-semibold rounded-full px-2 py-0.5 mt-1"
          style={{ background: LIMA, color: NEGRO }}
        >
          hoy
        </span>
      )}
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
      className="rounded-full px-4 py-2 text-[13px] whitespace-nowrap transition-colors"
      style={
        activa
          ? { background: "#fff", color: NEGRO, fontWeight: 600, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }
          : { color: GRIS, border: `1px solid ${BORDE}` }
      }
    >
      {children}
    </button>
  );
}

function BloqueTarjetas({ bloque, locationId }: { bloque: Bloque; locationId: string }) {
  if (bloque.total === 0) return null;

  return (
    <section>
      <div className="flex items-baseline gap-3 flex-wrap mb-3">
        <h3 className="text-xl font-bold tracking-tight">{bloque.titulo}</h3>
        <span className="text-sm tabular-nums border-b-2 pb-0.5" style={{ borderColor: NEGRO }}>
          <strong>{bloque.total}</strong> leads
        </span>
        <span className="text-[13px]" style={{ color: GRIS }}>
          {bloque.subtitulo}
        </span>
      </div>

      <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {bloque.items.map((l) => (
          <Tarjeta key={l.id} lead={l} locationId={locationId} />
        ))}
      </div>

      {bloque.total > bloque.items.length && (
        <p className="text-[13px] mt-3" style={{ color: GRIS }}>
          Se muestran {bloque.items.length} de {bloque.total}. Atendé estos primero.
        </p>
      )}
    </section>
  );
}

// Teléfonos de GHL vienen como "+573104804802"; cortarlos en grupos los hace
// legibles de un vistazo cuando el agente compara con su WhatsApp.
function formatearTelefono(bruto: string): string {
  const d = bruto.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("57")) {
    return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  }
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return bruto;
}

// Qué le falta al lead para avanzar. Es lo que convierte la tarjeta en algo
// accionable: el agente lee la etiqueta y sabe qué hacer sin interpretar nada.
function etiquetaFalta(lead: LeadItem): { texto: string; fondo: string; color: string } {
  if (lead.acciones.includes("Se registró")) {
    return { texto: "Registrado", fondo: "#E2F1EA", color: "#157F52" };
  }
  if (lead.estado === "caliente") {
    return { texto: "Falta registro", fondo: "#FBE8E1", color: "#A63312" };
  }
  // "Nadie lo movió" solo si de verdad no se movió: un lead que entró hace
  // días pero reaccionó hoy no está abandonado, le falta el paso siguiente.
  if (lead.estado === "tibio" && lead.dias >= 4 && !lead.movimiento) {
    return { texto: "Nadie lo movió", fondo: "#EAF1FA", color: "#2A6FB8" };
  }
  if (lead.estado === "tibio") {
    return { texto: "Falta WhatsApp", fondo: "#FDF3DA", color: "#8A6100" };
  }
  return { texto: "Primer contacto", fondo: "#EDF1F7", color: "#3C536F" };
}

function IconoTelefono() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

function IconoRecorrido() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M3 12a9 9 0 1 0 9-9" />
      <path d="M3 12h9V3" />
    </svg>
  );
}

function Tarjeta({ lead, locationId }: { lead: LeadItem; locationId: string }) {
  const digitos = lead.telefono?.replace(/\D/g, "") ?? "";
  const crm = `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${lead.id}`;
  const color = COLOR_ESTADO[lead.estado] ?? GRIS;
  const edad = lead.dias === 0 ? "entró hoy" : lead.dias === 1 ? "hace 1 día" : `hace ${lead.dias} días`;
  const falta = etiquetaFalta(lead);
  const recorrido = lead.acciones.length > 0 ? lead.acciones.join(" · ") : "Sin responder";

  return (
    <article
      className="relative rounded-[22px] p-4 flex flex-col"
      style={{
        background: "linear-gradient(180deg, #FFFFFF 0%, #FBFBF9 100%)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.03), 0 12px 28px -16px rgba(0,0,0,0.22)",
      }}
    >
      {/* Botón principal encajado en una muesca de la esquina: el anillo del
          color del fondo es lo que simula el recorte. */}
      <a
        href={digitos ? `https://wa.me/${digitos}` : crm}
        target="_blank"
        rel="noreferrer"
        aria-label={digitos ? `Escribir a ${lead.nombre} por WhatsApp` : `Abrir ${lead.nombre} en el CRM`}
        title={digitos ? "Escribir por WhatsApp" : "Sin teléfono — abrir en el CRM"}
        className="absolute -top-1.5 -right-1.5 w-9 h-9 rounded-full flex items-center justify-center text-[14px] transition-transform hover:scale-110"
        style={{
          background: digitos ? LIMA : "#F0F0EC",
          color: digitos ? NEGRO : GRIS,
          boxShadow: `0 0 0 5px ${FONDO}`,
        }}
      >
        {digitos ? "✆" : "↗"}
      </a>

      <div className="flex items-start gap-2.5 pr-7">
        <Inicial nombre={lead.nombre} color={color} tamano={38} />
        <div className="min-w-0 pt-0.5">
          <p className="text-[14.5px] font-bold leading-tight truncate">{lead.nombre}</p>
          <p className="text-[12px] mt-0.5 truncate" style={{ color: GRIS }}>
            {lead.movimiento ? (
              <>
                <span style={{ color: NEGRO, fontWeight: 600 }}>{lead.movimiento.que}</span>{" "}
                {lead.movimiento.cuando}
              </>
            ) : (
              edad
            )}
          </p>
        </div>
      </div>

      <div className="h-px my-3" style={{ background: "#EDEDE8" }} />

      <div className="flex items-center gap-2 text-[12.5px] mb-1.5" style={{ color: lead.telefono ? "#5F5F59" : GRIS }}>
        <span style={{ color: GRIS }}>
          <IconoTelefono />
        </span>
        <span className="truncate">{lead.telefono ? formatearTelefono(lead.telefono) : "Sin teléfono"}</span>
      </div>

      <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "#5F5F59" }}>
        <span style={{ color: GRIS }}>
          <IconoRecorrido />
        </span>
        <span className="truncate" title={recorrido}>
          {recorrido}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 mt-3.5">
        <span
          className="text-[11.5px] font-medium rounded-lg px-2.5 py-1 whitespace-nowrap"
          style={{ background: falta.fondo, color: falta.color }}
        >
          {falta.texto}
        </span>
        <EscalaEmbudo acciones={lead.acciones} />
      </div>

      <a
        href={crm}
        target="_blank"
        rel="noreferrer"
        className="text-[10.5px] mt-2.5 self-start hover:underline"
        style={{ color: GRIS }}
      >
        Abrir en el CRM ↗
      </a>
    </article>
  );
}
