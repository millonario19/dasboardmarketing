"use client";

import { Fragment, useCallback, useState } from "react";
import { ESTADOS, ESTADO_META, accionSugerida, type EstadoLead } from "@/lib/leadStates";
import type { LeadDeEstado, PanelEstados as Datos } from "@/lib/metrics";

const SEVERIDAD = {
  alta: { borde: "#D93A2B", fondo: "#FDF0EE", texto: "#A32A1E" },
  media: { borde: "#E0A800", fondo: "#FDF8E7", texto: "#8A6800" },
} as const;

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

function hoyBogota(): string {
  return new Date(Date.now() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

function ayerBogota(): string {
  return new Date(Date.now() - BOGOTA_OFFSET_MS - 864e5).toISOString().slice(0, 10);
}

function enEspanol(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

type Dia = {
  fecha: string;
  conteos: Record<EstadoLead, number>;
  desglose: Record<EstadoLead, { etiqueta: string; valor: number }[]>;
  total: number;
  depositaron: number;
};

// Cuando el tablero está filtrado a un agente, todo lo que se compara sale de
// sus propios leads. Decirle "lo habitual de la oficina" a un número que es su
// propio histórico sería mentirle sobre contra qué se está midiendo.
export function PanelEstados({ datos, propio = false }: { datos: Datos; propio?: boolean }) {
  const [ventana, setVentana] = useState<"hoy" | "mes">("hoy");
  const [fecha, setFecha] = useState(ayerBogota);
  const [dia, setDia] = useState<Dia | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorDia, setErrorDia] = useState<string | null>(null);

  // La tarjeta abierta y su lista. Solo una a la vez: dos tablas largas
  // abiertas obligan a bajar hasta el final para comparar.
  const [abierto, setAbierto] = useState<EstadoLead | null>(null);
  const [leads, setLeads] = useState<{ leads: LeadDeEstado[]; total: number } | null>(null);
  const [cargandoLeads, setCargandoLeads] = useState(false);
  const [errorLeads, setErrorLeads] = useState<string | null>(null);

  // El día elegido se pide aparte: el panel por defecto solo trae hoy y el mes.
  const verDia = useCallback(() => {
    const desde = new Date(`${fecha}T00:00:00-05:00`);
    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + 1);
    setCargando(true);
    setErrorDia(null);
    fetch(`/api/metrics/estados?from=${encodeURIComponent(desde.toISOString())}&to=${encodeURIComponent(hasta.toISOString())}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Error al consultar el día");
        return r.json();
      })
      .then((d) => {
        setDia({ fecha, ...d });
        cerrarLista();
      })
      .catch((e) => setErrorDia(e.message))
      .finally(() => setCargando(false));
  }, [fecha]);

  const cerrarLista = useCallback(() => {
    setAbierto(null);
    setLeads(null);
    setErrorLeads(null);
  }, []);

  // El rango que está mirando la pantalla ahora mismo: el día consultado, o
  // la ventana de hoy / del mes que ya viene calculada desde el servidor.
  const rangoActual = useCallback(() => {
    if (dia) {
      const desde = new Date(`${dia.fecha}T00:00:00-05:00`);
      const hasta = new Date(desde);
      hasta.setDate(hasta.getDate() + 1);
      return { from: desde.toISOString(), to: hasta.toISOString() };
    }
    return ventana === "hoy" ? datos.rango.hoy : datos.rango.mes;
  }, [dia, ventana, datos.rango]);

  const verLeads = useCallback(
    (estado: EstadoLead) => {
      if (abierto === estado) {
        cerrarLista();
        return;
      }
      const { from, to } = rangoActual();
      setAbierto(estado);
      setLeads(null);
      setErrorLeads(null);
      setCargandoLeads(true);
      fetch(
        `/api/metrics/estados/leads?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&estado=${estado}`
      )
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json()).error ?? "Error al traer los leads");
          return r.json();
        })
        .then(setLeads)
        .catch((e) => setErrorLeads(e.message))
        .finally(() => setCargandoLeads(false));
    },
    [abierto, cerrarLista, rangoActual]
  );

  const conteos = dia ? dia.conteos : datos[ventana];
  const desglose = dia ? dia.desglose : ventana === "hoy" ? datos.desgloseHoy : datos.desgloseMes;
  const total = ESTADOS.reduce((s, e) => s + conteos[e], 0);

  const { tasaHoy, madurosHoy, baseline, diasValidos } = datos.interaccion;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-ink-primary">Estado de los leads</h2>
            <span className="text-[13px] text-ink-secondary">
              {total} {dia ? `del ${enEspanol(dia.fecha)}` : ventana === "hoy" ? "hoy" : "este mes"}
            </span>
          </div>
          {/* Sin esta aclaración el panel parece contradecir a Métricas: acá
              Caliente sale más bajo porque solo cuenta lo que nació de la
              pauta, mientras que los totales de arriba suman todas las
              fuentes. */}
          <p className="text-[12px] text-ink-muted mt-0.5">
            Solo leads de la pauta que todavía no depositaron — los que ya depositaron están en FTD, arriba.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-full border border-gridline overflow-hidden text-[13px]">
            {(["hoy", "mes"] as const).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setVentana(v);
                  setDia(null);
                  cerrarLista();
                }}
                className={`px-4 py-1.5 ${
                  !dia && ventana === v
                    ? "bg-header text-header-ink font-medium"
                    : "bg-surface text-ink-secondary hover:bg-page"
                }`}
              >
                {v === "hoy" ? "Hoy" : "Este mes"}
              </button>
            ))}
          </div>

          {/* Un día puntual: "¿cómo estuvo la pauta del 9?" */}
          <input
            type="date"
            value={fecha}
            max={hoyBogota()}
            onChange={(e) => setFecha(e.target.value)}
            className="border border-gridline rounded-full px-3 py-1.5 text-[13px] bg-surface text-ink-secondary"
          />
          <button
            onClick={verDia}
            disabled={cargando}
            className="rounded-full px-4 py-1.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ background: "#17457F" }}
          >
            {cargando ? "Consultando…" : "Consultar"}
          </button>
        </div>
      </div>

      {errorDia && (
        <div className="rounded-xl bg-surface border border-series2 text-series2 px-4 py-3 mb-3 text-[13px]">
          {errorDia}
        </div>
      )}

      {dia && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl px-4 py-2.5 mb-3 bg-[#fdeee7]">
          <span className="text-[13px] font-medium text-[#b5501f]">
            📅 Leads que entraron el {enEspanol(dia.fecha)} — {dia.total} en total
            {dia.depositaron > 0 && `, de los cuales ${dia.depositaron} ya depositaron`}
          </span>
          <button
            onClick={() => {
              setDia(null);
              cerrarLista();
            }}
            className="border border-gridline bg-surface text-header-ink rounded-lg px-3 py-1 text-[12.5px] font-medium hover:bg-page"
          >
            × Volver
          </button>
        </div>
      )}

      {/* Barra de distribución: la proporción de los tres estados en una sola
          línea, antes de entrar a los números. */}
      {total > 0 && (
        <div className="rounded-2xl bg-surface border border-gridline p-4 mb-3">
          <div className="flex gap-1 h-3">
            {ESTADOS.filter((e) => conteos[e] > 0).map((e) => (
              <span
                key={e}
                className="rounded-full"
                style={{ flex: conteos[e], background: ESTADO_META[e].color }}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {ESTADOS.map((e) => (
              <div key={e} className="flex items-center gap-2 text-[13px] font-semibold text-ink-secondary">
                <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ESTADO_META[e].color }} />
                {ESTADO_META[e].nombre}
                <b className="text-ink-primary tabular-nums">{conteos[e]}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* La lista vive dentro de la grilla, justo detrás de su tarjeta, y se
          acomoda sola a cada pantalla:

          - En celular las tarjetas van apiladas, así que la lista aparece
            pegada a la que tocaste, sin hacer bajar tres tarjetas para verla.
          - En escritorio, `sm:order-last` la manda al final de la grilla y
            `sm:col-span-3` la deja a lo ancho, debajo de las tres. En una
            columna de un tercio los nombres y teléfonos salían cortados. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {ESTADOS.map((estado) => (
          <Fragment key={estado}>
            <Tarjeta
              estado={estado}
              valor={conteos[estado]}
              total={total}
              desglose={desglose[estado] ?? []}
              abierto={abierto === estado}
              onVerLeads={() => verLeads(estado)}
            />
            {abierto === estado && (
              <div className="sm:col-span-3 sm:order-last">
                <ListaDeLeads
                  estado={estado}
                  datos={leads}
                  cargando={cargandoLeads}
                  error={errorLeads}
                  conAgente={!propio}
                  onCerrar={cerrarLista}
                />
              </div>
            )}
          </Fragment>
        ))}
      </div>

      {!dia && (
      <div className="rounded-xl border border-gridline bg-surface px-4 py-3 mb-4">
        <p className="text-[13px] text-ink-secondary">
          <span className="font-medium text-ink-primary">Interacción real de hoy: </span>
          {tasaHoy === null ? (
            <>todavía no hay leads con tiempo suficiente para responder.</>
          ) : (
            <>
              <span className="font-semibold text-ink-primary tabular-nums">{tasaHoy.toFixed(0)}%</span> sobre{" "}
              {madurosHoy} leads con más de una hora de entrados
              {baseline !== null ? (
                <>
                  {" "}— {propio ? "tu promedio habitual es" : "lo habitual de la oficina es"}{" "}
                  <span className="tabular-nums">{baseline.toFixed(0)}%</span>.
                </>
              ) : (
                <> — todavía sin referencia: hacen falta 3 días de datos y van {diasValidos}.</>
              )}
            </>
          )}
        </p>
      </div>
      )}

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
          Alertas {datos.alertas.length > 0 && `(${datos.alertas.length})`}
        </h3>
        {datos.alertas.length === 0 ? (
          <div className="rounded-xl border border-gridline bg-surface px-4 py-3 text-[13px] text-ink-secondary">
            Sin alertas. La interacción de la oficina y de cada agente está dentro de lo normal.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {datos.alertas.map((a) => {
              const c = SEVERIDAD[a.severidad];
              return (
                <div
                  key={a.id}
                  className="rounded-xl px-4 py-3 border-l-4"
                  style={{ borderLeftColor: c.borde, background: c.fondo }}
                >
                  <p className="text-[13px] font-semibold mb-0.5" style={{ color: c.texto }}>
                    {a.titulo}
                  </p>
                  <p className="text-[13px] text-ink-secondary">{a.detalle}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function Tarjeta({
  estado,
  valor,
  total,
  desglose,
  abierto,
  onVerLeads,
}: {
  estado: EstadoLead;
  valor: number;
  total: number;
  desglose: { etiqueta: string; valor: number }[];
  abierto: boolean;
  onVerLeads: () => void;
}) {
  const meta = ESTADO_META[estado];
  const pct = total > 0 ? (valor / total) * 100 : 0;

  return (
    <article
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: `color-mix(in srgb, ${meta.color} 14%, var(--surface-1))`,
        border: `2px solid ${meta.color}`,
      }}
    >
      {/* Bloque de color macizo: el número y el estado se leen de lejos. */}
      <div className="p-4 pb-4" style={{ background: meta.color, color: meta.sobre }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[17px] font-extrabold tracking-tight">{meta.nombre}</span>
          <span
            className="text-[13px] font-extrabold rounded-full px-2.5 py-1 tabular-nums"
            style={{ background: `color-mix(in srgb, ${meta.sobre} 20%, transparent)` }}
          >
            {pct.toFixed(1)}%
          </span>
        </div>

        <div className="flex items-baseline gap-2 mt-2.5">
          <strong className="text-[44px] font-extrabold leading-none tracking-tighter tabular-nums">{valor}</strong>
          <span className="text-[14px] font-semibold" style={{ opacity: 0.75 }}>
            de {total}
          </span>
        </div>
        <p className="text-[14px] font-semibold mt-1">{meta.que}</p>

        <div
          className="h-1.5 rounded-full mt-3 overflow-hidden"
          style={{ background: `color-mix(in srgb, ${meta.sobre} 25%, transparent)` }}
        >
          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: meta.sobre }} />
        </div>
      </div>

      {/* Checklist: cuántos de estos leads hicieron cada paso del embudo. Los
          pasos en cero quedan apagados a propósito: son los que faltan. */}
      <div className="p-3 flex flex-col gap-3 flex-1">
        <div
          className="rounded-xl px-3"
          style={{ background: `color-mix(in srgb, ${meta.color} 24%, var(--surface-1))` }}
        >
          {desglose.map((d, i) => {
            const hecho = d.valor > 0;
            const ancho = valor > 0 ? Math.round((d.valor / valor) * 100) : 0;
            return (
              <div
                key={d.etiqueta}
                className="flex items-center gap-2.5 py-2.5"
                style={{
                  borderTop: i === 0 ? undefined : `1px solid color-mix(in srgb, ${meta.color} 32%, var(--surface-1))`,
                  opacity: hecho ? 1 : 0.55,
                }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0"
                  style={
                    hecho
                      ? { background: meta.fuerte, color: meta.sobreFuerte }
                      : { background: "var(--surface-1)", color: "var(--text-muted)", boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.12)" }
                  }
                >
                  {hecho ? "✓" : i + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-bold leading-tight text-ink-primary truncate">{d.etiqueta}</p>
                  <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.6)" }}>
                    <span className="block h-full rounded-full" style={{ width: `${ancho}%`, background: meta.fuerte }} />
                  </div>
                </div>

                <span
                  className="min-w-[34px] h-8 px-1.5 rounded-lg flex items-center justify-center text-[15px] font-extrabold tabular-nums shrink-0"
                  style={
                    hecho
                      ? { background: meta.color, color: meta.sobre }
                      : { background: "var(--surface-1)", color: "var(--text-muted)" }
                  }
                >
                  {d.valor}
                </span>
              </div>
            );
          })}
        </div>

        {/* Lo único accionable de la tarjeta, como botón y no como nota al pie. */}
        <div
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mt-auto"
          style={{ background: meta.fuerte, color: meta.sobreFuerte }}
        >
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] shrink-0"
            style={{ background: `color-mix(in srgb, ${meta.sobreFuerte} 20%, transparent)` }}
            aria-hidden
          >
            ⚡
          </span>
          <span className="min-w-0">
            <small className="block text-[10.5px] font-semibold" style={{ opacity: 0.75 }}>
              Siguiente paso
            </small>
            <span className="block text-[12.5px] font-extrabold leading-tight">{accionSugerida(estado)}</span>
          </span>
        </div>

        {/* De número a lista: sin esto, "Frío: 47" no se puede trabajar. */}
        <button
          onClick={onVerLeads}
          disabled={valor === 0}
          aria-expanded={abierto}
          className="w-full rounded-xl px-3 py-2.5 text-[12.5px] font-extrabold disabled:opacity-40 disabled:cursor-default hover:opacity-90"
          style={{ background: meta.color, color: meta.sobre }}
        >
          {valor === 0 ? "Sin leads" : abierto ? "Ocultar lista ▲" : `Ver leads (${valor}) ▼`}
        </button>
      </div>
    </article>
  );
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * La lista de una tarjeta, desplegada a lo ancho.
 *
 * Muestra qué hizo cada lead y no solo su nombre: dos leads Tibios pueden ser
 * uno que respondió y otro que solo entró al canal, y el siguiente paso del
 * agente no es el mismo.
 */
function ListaDeLeads({
  estado,
  datos,
  cargando,
  error,
  conAgente,
  onCerrar,
}: {
  estado: EstadoLead;
  datos: { leads: LeadDeEstado[]; total: number } | null;
  cargando: boolean;
  error: string | null;
  conAgente: boolean;
  onCerrar: () => void;
}) {
  const meta = ESTADO_META[estado];
  const leads = datos?.leads ?? [];
  const recortada = datos ? datos.total > leads.length : false;

  return (
    <section
      className="rounded-2xl overflow-hidden"
      style={{ border: `2px solid ${meta.color}` }}
    >
      <header
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ background: meta.color, color: meta.sobre }}
      >
        <div className="min-w-0">
          <strong className="text-[15px] font-extrabold">Leads en {meta.nombre}</strong>
          <span className="text-[13px] font-semibold ml-2" style={{ opacity: 0.8 }}>
            {datos ? `${datos.total}` : "…"}
          </span>
          <p className="text-[12px] font-semibold" style={{ opacity: 0.8 }}>
            {accionSugerida(estado)}
          </p>
        </div>
        <button
          onClick={onCerrar}
          className="shrink-0 rounded-full px-4 py-2 text-[12.5px] font-extrabold hover:opacity-90"
          style={{ background: `color-mix(in srgb, ${meta.sobre} 22%, transparent)`, color: meta.sobre }}
        >
          ← Regresar
        </button>
      </header>

      {cargando && (
        <p className="px-4 py-5 text-[13px] text-ink-secondary bg-surface">Cargando la lista…</p>
      )}
      {error && <p className="px-4 py-5 text-[13px] text-series2 bg-surface">{error}</p>}

      {!cargando && !error && leads.length === 0 && (
        <p className="px-4 py-5 text-[13px] text-ink-secondary bg-surface">
          No hay leads en este estado.
        </p>
      )}

      {!cargando && !error && leads.length > 0 && (
        <>
          {/* Escritorio: tabla. */}
          <div className="hidden sm:block overflow-x-auto bg-surface">
            <table className="w-full text-left border-collapse" style={{ minWidth: 640 }}>
              <thead>
                <tr className="bg-header text-ink-primary">
                  {["Nombre", "Teléfono", "Creado", ...(conAgente ? ["Agente"] : []), "Qué hizo"].map((c) => (
                    <th
                      key={c}
                      className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} style={{ background: `${meta.color}0D` }} className="border-t border-gridline">
                    <td className="px-4 py-2.5 text-[13.5px] font-bold text-ink-primary">{l.nombre}</td>
                    <td className="px-4 py-2.5 text-[13px] text-ink-secondary tabular-nums whitespace-nowrap">
                      {l.telefono ?? <span className="text-ink-muted">Sin teléfono</span>}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-ink-secondary tabular-nums whitespace-nowrap">
                      {fechaCorta(l.creado)}
                    </td>
                    {conAgente && (
                      <td className="px-4 py-2.5 text-[13px] text-ink-secondary whitespace-nowrap">{l.agente}</td>
                    )}
                    <td className="px-4 py-2.5">
                      <Acciones acciones={l.acciones} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: tarjetas, con una franja del color del estado al costado. */}
          <div className="sm:hidden bg-surface">
            {leads.map((l) => (
              <div key={l.id} className="flex border-t border-gridline">
                <span className="w-1.5 shrink-0" style={{ background: meta.color }} />
                <div className="flex-1 min-w-0 px-3.5 py-3" style={{ background: `${meta.color}0D` }}>
                  <p className="text-[14.5px] font-bold text-ink-primary truncate">{l.nombre}</p>
                  <p className="text-[12.5px] text-ink-secondary tabular-nums mt-0.5">
                    {l.telefono ?? "Sin teléfono"} · {fechaCorta(l.creado)}
                  </p>
                  {conAgente && <p className="text-[12px] text-ink-muted mt-0.5">{l.agente}</p>}
                  <div className="mt-1.5">
                    <Acciones acciones={l.acciones} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {recortada && (
        <p className="px-4 py-2.5 text-[12px] text-ink-secondary bg-surface border-t border-gridline">
          Mostrando los {leads.length} más recientes de {datos!.total}.
        </p>
      )}
    </section>
  );
}

function Acciones({ acciones }: { acciones: string[] }) {
  if (acciones.length === 0) {
    return <span className="text-[12px] text-ink-muted">Solo entró, sin responder</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {acciones.map((a) => (
        <span
          key={a}
          className="text-[11.5px] font-semibold rounded-full px-2 py-0.5 bg-page text-ink-secondary whitespace-nowrap"
        >
          {a}
        </span>
      ))}
    </span>
  );
}
