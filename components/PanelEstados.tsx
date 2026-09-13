"use client";

import { Fragment, useCallback, useState } from "react";
import { ESTADOS, ESTADO_META, type EstadoLead } from "@/lib/leadStates";
import { ConfirmarBajada, guardarConfirmacion } from "@/components/ConfirmarBajada";
import { FilaDePaso, PASOS_DEL_ESTADO } from "@/components/IconosEmbudo";
import { ContactoRapido } from "@/components/ContactoRapido";
import { EditarNombre } from "@/components/EditarNombre";
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

  // Igual que la confirmación: el nombre se corrige en memoria en vez de
  // recargar la lista entera desde GHL.
  const renombrado = useCallback((contactId: string, nombre: string) => {
    setLeads((prev) =>
      prev ? { ...prev, leads: prev.leads.map((l) => (l.id === contactId ? { ...l, nombre } : l)) } : prev
    );
  }, []);

  // La respuesta se guarda en GHL y el lead se actualiza en memoria. Recargar
  // la lista entera volvería a pegarle a GHL y haría parpadear la tabla en
  // cada respuesta.
  const responder = useCallback(async (contactId: string, confirmado: boolean) => {
    const fallo = await guardarConfirmacion(contactId, confirmado);
    if (fallo) {
      setErrorLeads(fallo);
      return;
    }
    setLeads((prev) =>
      prev
        ? {
            ...prev,
            leads: prev.leads.map((l) =>
              l.id === contactId ? { ...l, confirmacion: confirmado ? "si" : "no" } : l
            ),
          }
        : prev
    );
  }, []);

  const conteos = dia ? dia.conteos : datos[ventana];
  const total = ESTADOS.reduce((s, e) => s + conteos[e], 0);

  const { tasaHoy, madurosHoy, baseline, diasValidos } = datos.interaccion;

  return (
    <section className="mb-8">
      <div className="flex flex-col items-center text-center gap-3 mb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:text-left">
        <div>
          <div className="flex items-baseline justify-center gap-3 sm:justify-start">
            <h2 className="text-lg font-semibold text-ink-primary">Temperatura del lead</h2>
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
        <div className="flex items-center justify-center gap-2 flex-wrap sm:justify-end">
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
            {cargando ? (
              "…"
            ) : (
              <>
                <span className="sm:hidden">Ver</span>
                <span className="hidden sm:inline">Consultar</span>
              </>
            )}
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

      {/* La lista vive dentro de la grilla, justo detrás de su tarjeta, y se
          acomoda sola a cada pantalla:

          - En celular las tarjetas van apiladas, así que la lista aparece
            pegada a la que tocaste, sin hacer bajar tres tarjetas para verla.
          - En escritorio, `sm:order-last` la manda al final de la grilla y
            `sm:col-span-3` la deja a lo ancho, debajo de las tres. En una
            columna de un tercio los nombres y teléfonos salían cortados. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-3 mb-4">
        {ESTADOS.map((estado) => (
          <Fragment key={estado}>
            <Tarjeta
              estado={estado}
              valor={conteos[estado]}
              total={total}
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
                  onResponder={responder}
                  onRenombrado={renombrado}
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
  abierto,
  onVerLeads,
}: {
  estado: EstadoLead;
  valor: number;
  total: number;
  abierto: boolean;
  onVerLeads: () => void;
}) {
  const meta = ESTADO_META[estado];
  const pct = total > 0 ? (valor / total) * 100 : 0;

  return (
    <article className="rounded-[18px] overflow-hidden flex flex-col bg-surface border border-gridline">
      {/* Franja delgada: alcanza para saber de qué tarjeta se trata. Antes era
          un bloque macizo con el número gigante adentro, y el color pesaba más
          que el dato. */}
      <div
        className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 text-[13px] font-bold tracking-tight"
        style={{ background: meta.color, color: meta.sobre }}
      >
        {meta.plural}
        {/* En móvil el porcentaje viaja pegado al título, centrado con él; en
            pantallas anchas se va al borde derecho. */}
        <span className="sm:ml-auto text-[12px] font-semibold tabular-nums" style={{ opacity: 0.85 }}>
          {pct.toFixed(0)}%
        </span>
      </div>

      {/* En móvil las tarjetas ocupan el ancho entero y el contenido pegado
          a la izquierda deja una franja muerta a la derecha. Centrado, la
          tarjeta se lee como una unidad. */}
      <div className="px-4 pt-4 pb-3.5 flex-1 text-center sm:text-left">
        <div className="flex items-baseline gap-1.5 justify-center sm:justify-start">
          <strong
            className="text-[34px] font-extrabold leading-none tracking-[-0.045em] tabular-nums"
            style={{ color: valor > 0 ? meta.color : undefined }}
          >
            {valor}
          </strong>
          <span className="text-[13px] font-semibold text-ink-muted">de {total}</span>
        </div>

        {/* Lo que define esta temperatura, un paso por renglón. No son las
            acciones de estos leads: son la regla por la que están acá, y por
            eso siguen estando cuando la tarjeta marca cero. */}
        <div className="flex flex-col gap-[7px] mt-3.5 items-center sm:items-start">
          {PASOS_DEL_ESTADO[estado].map((paso) => (
            <FilaDePaso key={paso} paso={paso} />
          ))}
        </div>
      </div>

      {/* De número a lista: sin esto, "Frío: 47" no se puede trabajar. */}
      <button
        onClick={onVerLeads}
        disabled={valor === 0}
        aria-expanded={abierto}
        className="flex items-center justify-center sm:justify-between gap-2 w-full px-4 py-3 border-t border-gridline text-[13px] font-bold disabled:cursor-default enabled:hover:bg-page"
        style={valor === 0 ? { color: "var(--text-muted)", fontWeight: 500 } : { color: meta.color }}
      >
        {valor === 0 ? "Sin leads" : abierto ? "Ocultar la lista" : `Ver los ${valor} leads`}
        <span className="text-[10px] opacity-50">{valor === 0 ? "" : abierto ? "▲" : "▼"}</span>
      </button>
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

function ListaDeLeads({
  estado,
  datos,
  cargando,
  error,
  conAgente,
  onCerrar,
  onResponder,
  onRenombrado,
}: {
  estado: EstadoLead;
  datos: { leads: LeadDeEstado[]; total: number } | null;
  cargando: boolean;
  error: string | null;
  conAgente: boolean;
  onCerrar: () => void;
  onResponder: (contactId: string, confirmado: boolean) => void;
  onRenombrado: (contactId: string, nombre: string) => void;
}) {
  const meta = ESTADO_META[estado];
  const leads = datos?.leads ?? [];
  const recortada = datos ? datos.total > leads.length : false;
  // La columna aparece sola cuando hay algo que confirmar: siempre en
  // Caliente, y en los otros estados solo si algún lead arrastra la etiqueta.
  const conBajada = leads.some((l) => l.marcadoBajada);
  const degradados = leads.filter((l) => bajaDeTemperatura(estado, l)).length;

  return (
    <section
      className="rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${meta.color}` }}
    >
      {/* La cabecera iba en dos renglones y el siguiente paso ya está en la
          tarjeta, a dos centímetros: acá solo repetía. */}
      {/* Una cinta, no una barra: el botón dejó de ser una pastilla con fondo
          propio, que era lo que le daba el alto y el peso. */}
      <header
        className="flex items-center justify-between gap-3 px-3 py-[1px]"
        style={{ background: meta.color, color: meta.sobre }}
      >
        <strong className="text-[10px] font-bold uppercase tracking-[.1em] leading-[15px] truncate">
          {meta.plural}
          <span className="font-semibold ml-1.5 tracking-normal" style={{ opacity: 0.85 }}>
            {datos ? `${datos.total}` : "…"}
          </span>
        </strong>
        <button
          onClick={onCerrar}
          className="shrink-0 text-[10.5px] font-semibold leading-[15px] hover:underline underline-offset-2"
          style={{ color: meta.sobre, opacity: 0.9 }}
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
                  {[
                    "Nombre",
                    "Teléfono",
                    "Creado",
                    ...(conAgente ? ["Agente"] : []),
                    "Qué hizo",
                    ...(conBajada ? ["¿Bajó de verdad?"] : []),
                  ].map((c) => (
                    <th
                      key={c}
                      className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr
                    key={l.id}
                    style={{ background: `${meta.color}0D`, opacity: bajaDeTemperatura(estado, l) ? 0.6 : 1 }}
                    className="border-t border-gridline"
                  >
                    <td className="px-3.5 py-1.5 text-[13px] font-bold text-ink-primary">
                      <span className="inline-flex items-center gap-1.5">
                        {l.nombre}
                        <EditarNombre contactId={l.id} nombre={l.nombre} onCambiado={(n) => onRenombrado(l.id, n)} />
                      </span>
                      <Degradado estado={estado} lead={l} />
                    </td>
                    <td className="px-3.5 py-1.5 text-[13px]">
                      <ContactoRapido telefono={l.telefono} nombre={l.nombre} contactId={l.id} tamano={26} />
                    </td>
                    <td className="px-3.5 py-1.5 text-[12.5px] text-ink-secondary tabular-nums whitespace-nowrap">
                      {fechaCorta(l.creado)}
                    </td>
                    {conAgente && (
                      <td className="px-3.5 py-1.5 text-[12.5px] text-ink-secondary whitespace-nowrap">{l.agente}</td>
                    )}
                    <td className="px-3.5 py-1.5">
                      <Acciones acciones={l.acciones} />
                    </td>
                    {conBajada && (
                      <td className="px-3.5 py-1.5">
                        <ConfirmarBajada
                          marcado={l.marcadoBajada}
                          confirmacion={l.confirmacion}
                          onResponder={(valor) => onResponder(l.id, valor)}
                          conPregunta={false}
                        />
                      </td>
                    )}
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
                <div
                  className="flex-1 min-w-0 px-3.5 py-3"
                  style={{ background: `${meta.color}0D`, opacity: bajaDeTemperatura(estado, l) ? 0.6 : 1 }}
                >
                  <p className="text-[14.5px] font-bold text-ink-primary flex items-center gap-1.5 flex-wrap">
                    {l.nombre}
                    <EditarNombre contactId={l.id} nombre={l.nombre} onCambiado={(n) => onRenombrado(l.id, n)} />
                    <Degradado estado={estado} lead={l} />
                  </p>
                  <p className="text-[12.5px] text-ink-secondary mt-1 flex items-center gap-2 flex-wrap">
                    <ContactoRapido telefono={l.telefono} nombre={l.nombre} contactId={l.id} tamano={30} />
                    <span className="tabular-nums">· {fechaCorta(l.creado)}</span>
                  </p>
                  {conAgente && <p className="text-[12px] text-ink-muted mt-0.5">{l.agente}</p>}
                  <div className="mt-1.5">
                    <Acciones acciones={l.acciones} />
                  </div>
                  {l.marcadoBajada && (
                    <div className="mt-2">
                      <ConfirmarBajada
                        marcado={l.marcadoBajada}
                        confirmacion={l.confirmacion}
                        onResponder={(valor) => onResponder(l.id, valor)}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {degradados > 0 && (
        <p className="px-4 py-2.5 text-[12px] font-medium bg-surface border-t border-gridline text-ink-secondary">
          {degradados === 1 ? "Un lead dejó" : `${degradados} leads dejaron`} de ser {meta.nombre} con tu
          respuesta. Actualizá el tablero para ver los números al día.
        </p>
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
          className="text-[11px] font-semibold rounded-full px-2 py-[1px] bg-page text-ink-secondary whitespace-nowrap"
        >
          {a}
        </span>
      ))}
    </span>
  );
}

/**
 * Si un "No" del agente saca al lead del estado en el que está listado.
 *
 * Aplica la misma regla que el servidor: Caliente se gana bajando a WhatsApp
 * o registrándose. Si el lead está en Caliente y nunca se registró, negar la
 * bajada lo deja sin motivo para estar ahí. Un lead que sí se registró se
 * queda Caliente por su cuenta, responda lo que responda el agente.
 */
function bajaDeTemperatura(estado: EstadoLead, lead: LeadDeEstado): boolean {
  return estado === "caliente" && lead.confirmacion === "no" && !lead.acciones.includes("Se registró");
}

// A dónde cae después: las mismas dos señales que definen Tibio.
function estadoTrasElNo(lead: LeadDeEstado): EstadoLead {
  const tibio = lead.acciones.includes("Respondió") || lead.acciones.includes("Entró al canal");
  return tibio ? "tibio" : "frio";
}

function Degradado({ estado, lead }: { estado: EstadoLead; lead: LeadDeEstado }) {
  if (!bajaDeTemperatura(estado, lead)) return null;
  const destino = ESTADO_META[estadoTrasElNo(lead)];
  return (
    <span
      className="ml-2 align-middle text-[10.5px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap"
      style={{ background: destino.color, color: destino.sobre }}
    >
      Pasó a {destino.nombre}
    </span>
  );
}
