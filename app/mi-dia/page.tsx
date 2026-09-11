"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Inicial } from "@/components/EscalaEmbudo";
import { CerrarSesion } from "@/components/CerrarSesion";
import { useSesion } from "@/components/useSesion";
import { TablaLeads } from "@/components/TablaLeads";
import { ESTADO_META } from "@/lib/leadStates";
import type { Bloque, LeadItem, MiDia } from "@/lib/miDia";

// Paleta tomada de la referencia: gris cálido de fondo, blanco para las
// tarjetas, negro para la barra y el título, y un verde ácido como única nota
// de color. El verde siempre lleva texto negro encima: sobre blanco no tiene
// contraste suficiente.
const FONDO = "#E6E6E2";

/**
 * Fondo del día: el gris de siempre con manchas muy suaves de la propia
 * paleta.
 *
 * No es decoración: los paneles de leads son de vidrio translúcido, y sobre un
 * gris plano una tarjeta transparente se ve idéntica a una blanca. Lo que se
 * asoma por debajo es lo que la hace flotar.
 *
 * Sin background-attachment: fixed — deja rastros al desplazar y en Safari de
 * iPhone se rompe.
 */
const FONDO_DEGRADADO = [
  "radial-gradient(820px 460px at 8% -8%, rgba(198,242,78,.62), transparent 58%)",
  "radial-gradient(680px 460px at 95% 2%, rgba(255,255,255,.95), transparent 60%)",
  "radial-gradient(760px 520px at 78% 62%, rgba(120,155,205,.34), transparent 58%)",
  "radial-gradient(820px 560px at 26% 105%, rgba(224,168,0,.24), transparent 58%)",
  FONDO,
].join(", ");
const LIMA = "#C6F24E";
const NEGRO = "#0D0D0D";
const GRIS = "#8E8E88";
const BORDE = "#D8D8D3";

// Los mismos tres colores que las tarjetas de Dirección. Antes acá eran
// naranja, ámbar y gris azulado, así que un mismo lead se veía de un color en
// una pantalla y de otro en la otra.
const COLOR_ESTADO: Record<string, string> = {
  caliente: ESTADO_META.caliente.color,
  tibio: ESTADO_META.tibio.fuerte,
  frio: ESTADO_META.frio.color,
};

// El agente se elige a sí mismo una vez y el navegador lo recuerda: mientras
// el dashboard tenga una sola contraseña compartida no puede saber quién entró.
const CLAVE_AGENTE = "op_agente";

export default function MiDiaPage() {
  const sesion = useSesion();
  // El agente no elige a quién mira: su sesión lo fija. El selector y el
  // recuerdo en el navegador quedan solo para la dirección, que sí necesita
  // pasar de un agente a otro.
  const esAgente = sesion?.rol === "agente";
  const [agente, setAgente] = useState("todos");
  const [filtro, setFiltro] = useState("todos");
  const [data, setData] = useState<MiDia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (esAgente) return;
    try {
      setAgente(localStorage.getItem(CLAVE_AGENTE) ?? "todos");
    } catch {
      /* modo privado */
    }
  }, [esAgente]);

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
  const nombreAgente = esAgente
    ? sesion?.nombre ?? "Tus leads"
    : data?.agentes.find((a) => a.id === agente)?.nombre ?? "Toda la oficina";

  return (
    <div
      className="min-h-screen"
      style={{ background: FONDO_DEGRADADO, backgroundRepeat: "no-repeat", color: NEGRO }}
    >
      <div className="max-w-6xl mx-auto px-5 py-5">

        {/* Barra superior: cápsula negra a la izquierda, tira verde con los
            movimientos del día a la derecha, igual que la referencia. */}
        {/* En móvil se apila: la tira de movimientos necesita ancho propio, y
            metida en la misma fila que la cápsula quedaba en un hilito. */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center flex-1 min-w-0 rounded-3xl sm:rounded-full p-1.5 sm:p-0" style={{ background: NEGRO }}>
            <div className="flex items-center gap-3 pl-4 sm:pl-6 pr-4 py-2 sm:py-2.5 shrink-0">
              <span className="text-white font-medium">Mi día</span>
              <span
                className="text-[13px] rounded-full px-3 py-1 first-letter:uppercase whitespace-nowrap text-white"
                style={{ background: "rgba(255,255,255,0.14)" }}
              >
                {new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long" })}
              </span>
            </div>

            <div
              className="flex-1 min-w-0 flex items-center gap-2 rounded-2xl sm:rounded-full px-3 py-1.5 sm:mr-1.5 overflow-x-auto"
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

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/"
              className="rounded-full px-5 py-2.5 text-sm font-medium bg-white text-center"
              style={{ border: `1px solid ${BORDE}` }}
            >
              Dirección
            </Link>
            {esAgente && (
              <Link
                href="/mi-cuenta"
                className="rounded-full px-5 py-2.5 text-sm font-medium bg-white text-center"
                style={{ border: `1px solid ${BORDE}`, color: GRIS }}
              >
                Mi cuenta
              </Link>
            )}
            <CerrarSesion
              className="rounded-full px-5 py-2.5 text-sm font-medium bg-white disabled:opacity-60"
              style={{ border: `1px solid ${BORDE}`, color: GRIS }}
            />
          </div>
        </div>

        {/* Título y contadores */}
        <div className="flex items-end justify-between gap-6 flex-wrap mb-8">
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tighter leading-none">
              MI D
              <span className="relative inline-block">
                {/* Círculo medido en em para que acompañe al tamaño de letra.
                    Con inset en px salía una cápsula alta y angosta en móvil. */}
                <span
                  className="absolute rounded-full"
                  style={{
                    background: LIMA,
                    width: "0.72em",
                    height: "0.72em",
                    left: "50%",
                    top: "52%",
                    transform: "translate(-50%, -50%)",
                    zIndex: 0,
                  }}
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

          <div className="flex items-end gap-6 sm:gap-8">
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

          {esAgente ? (
            <span
              className="rounded-full px-4 py-2 text-[13px] font-semibold bg-white"
              style={{ border: `1px solid ${BORDE}` }}
            >
              {sesion?.nombre}
            </span>
          ) : (
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
          )}

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

        <div className="flex flex-col gap-6">
          {visibles.map((b) => (
            <TablaLeads key={b.id} bloque={b} locationId={data!.locationId} />
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
          className="text-3xl sm:text-4xl md:text-5xl font-extrabold tabular-nums leading-none tracking-tighter"
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
