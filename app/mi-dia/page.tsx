"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CerrarSesion } from "@/components/CerrarSesion";
import { CambiarVista } from "@/components/CambiarVista";
import { useSesion } from "@/components/useSesion";
import { TablaLeads } from "@/components/TablaLeads";
import { ArcoTemperatura, LeyendaTemperatura } from "@/components/ArcoTemperatura";
import { SeMovioHoy } from "@/components/SeMovioHoy";
import { Seguimiento } from "@/components/Seguimiento";
import { TareasDeHoy } from "@/components/TareasDeHoy";
import { PasoSistema } from "@/components/PasoSistema";
import { MetaDelMes } from "@/components/MetaDelMes";
import { conteoVacio } from "@/lib/leadStates";
import { nombreCorto } from "@/lib/nombre";
import type { Bloque, LeadItem, MiDia } from "@/lib/miDia";
import type { AgentProduction } from "@/lib/metrics";

const GRIS = "#8E8E88";

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
  // Arranca en los movimientos del día: es lo que trae la carga rápida y lo
  // primero que el agente quiere ver. Si quedara en "todos", al llegar la
  // lista completa la pantalla saltaría sola de un bloque a cinco.
  const [filtro, setFiltro] = useState("movimiento");
  // Una vez que el agente toca una píldora, la pantalla no vuelve a decidir
  // por él.
  const [filtroElegido, setFiltroElegido] = useState(false);
  const [data, setData] = useState<MiDia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Lo informa el módulo de tareas cuando termina de cargar.
  const [porHacer, setPorHacer] = useState<number | null>(null);
  // La meta va en las dos pantallas: es lo único que habla de la plata del
  // agente y el motivo por el que abre el tablero, mire donde mire. Los FTD
  // salen del mismo endpoint que usa Dirección, ya recortados a su sesión.
  const [ftdMes, setFtdMes] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/metrics/production")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AgentProduction | null) => d && setFtdMes(d.totals.ftdMes))
      .catch(() => {
        /* sin este número la meta no se muestra, el resto de la pantalla sí */
      });
  }, []);


  useEffect(() => {
    if (esAgente) return;
    try {
      setAgente(localStorage.getItem(CLAVE_AGENTE) ?? "todos");
    } catch {
      /* modo privado */
    }
  }, [esAgente]);

  /**
   * La lista llega en dos tiempos.
   *
   * Primero los que se movieron hoy, que salen de Postgres y tardan un
   * segundo: es lo único que cambió desde ayer y lo primero que el agente
   * quiere ver. Después la lista completa, que tiene que barrer un mes en GHL
   * y tarda diez. Antes se esperaba lo segundo para mostrar lo primero.
   */
  const cargar = useCallback((quien: string) => {
    setCargando(true);
    setError(null);
    const url = (extra: string) => `/api/mi-dia?agente=${encodeURIComponent(quien)}${extra}`;
    const pedir = async (extra: string) => {
      const r = await fetch(url(extra));
      if (!r.ok) throw new Error((await r.json()).error ?? "Error al cargar la lista");
      return (await r.json()) as MiDia;
    };

    // El arranque no pisa datos completos que ya estén en pantalla: si la
    // respuesta lenta gana la carrera, mostrarle al agente media lista sería
    // ir para atrás.
    pedir("&solo=movimiento")
      .then((rapido) => setData((previo) => (previo && !previo.parcial ? previo : rapido)))
      .catch(() => {
        /* si falla, la carga completa igual llega */
      });

    pedir("")
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

  // El reparto por temperatura lo cuenta el servidor sobre la lista completa.
  // Contarlo acá daría otro número: la pantalla solo recibe las primeras
  // filas de cada bloque.
  const conteosPorEstado = data?.porEstado ?? conteoVacio();

  function elegirFiltro(id: string) {
    setFiltroElegido(true);
    setFiltro(id);
  }

  // Sin movimientos, quedarse en ese bloque sería mostrar una pantalla vacía
  // teniendo la lista completa al lado.
  useEffect(() => {
    if (!filtroElegido && filtro === "movimiento" && data && !data.parcial) {
      const movidos = data.bloques.find((b) => b.id === "movimiento")?.total ?? 0;
      if (movidos === 0) setFiltro("todos");
    }
  }, [data, filtro, filtroElegido]);

  const visibles = filtro === "todos" ? bloques : bloques.filter((b) => b.id === filtro);
  const nombreAgente = esAgente
    ? sesion?.nombre ?? "Tus leads"
    : data?.agentes.find((a) => a.id === agente)?.nombre ?? "Toda la oficina";

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* La misma cabecera que Dirección: eran dos pantallas del mismo tablero
          con dos identidades distintas —una gris con degradados de colores y un
          saludo gigante, la otra blanca— y al cambiar de pestaña parecía que
          uno se había ido a otro producto. */}
      <div className="flex flex-col items-center text-center gap-3 mb-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:text-left sm:gap-4">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
          <h1 className="text-[21px] sm:text-[25px] font-semibold text-ink-primary tracking-tight leading-[1.15]">
            CRM - Marketing
          </h1>
          <div className="flex items-center gap-2">
            {sesion && esAgente && (
              <span className="text-sm text-ink-secondary bg-surface border border-gridline rounded-full px-3 py-1.5">
                {nombreCorto(sesion.nombre)}
              </span>
            )}
            <span className="w-10 h-10 rounded-full border border-gridline bg-surface flex items-center justify-center text-ink-muted text-lg shrink-0">
              🔗
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
          <CambiarVista actual="mi-dia" />
          <button
            onClick={() => cargar(agente)}
            disabled={cargando}
            className="flex items-center gap-2 bg-surface border border-gridline rounded-full px-4 py-2.5 text-sm font-medium text-ink-primary hover:bg-page disabled:opacity-50 shrink-0"
          >
            📅 {cargando ? "Actualizando…" : "Actualizar"} ⌄
          </button>
          {esAgente && (
            <Link
              href="/mi-cuenta"
              className="bg-surface border border-gridline rounded-full px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-page hover:text-ink-primary shrink-0"
            >
              Mi cuenta
            </Link>
          )}
          <CerrarSesion className="bg-surface border border-gridline rounded-full px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-page hover:text-ink-primary disabled:opacity-50 shrink-0" />
        </div>
      </div>

      {/* La dirección entra a Mi día para mirar el de cada agente. */}
      {!esAgente && (
        <div className="mb-5">
          <select
            value={agente}
            onChange={(e) => elegirAgente(e.target.value)}
            className="rounded-full border border-gridline bg-surface px-4 py-2 text-[13px] outline-none"
          >
            <option value="todos">Toda la oficina</option>
            {data?.agentes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Arriba de todo, igual que en Dirección. Para la dirección no va: la
          meta es personal. */}
      {esAgente && ftdMes !== null && <MetaDelMes ftdMes={ftdMes} />}

      {/* El reparto por temperatura, en una tarjeta como las demás. */}
      <section className="rounded-[22px] bg-surface border border-gridline mb-5 px-4 sm:px-6 py-5 text-center">
        <ArcoTemperatura
          conteos={conteosPorEstado}
          total={conteos.pendientes}
          calientes={conteosPorEstado.caliente}
        />
        <LeyendaTemperatura conteos={conteosPorEstado} />
      </section>

        {/* Lo primero del día: quién se movió, sin importar cuándo entró. Un
            lead de hace dos semanas que vuelve a escribir vale más que uno
            nuevo, y antes no aparecía en ninguna parte. */}
        <SeMovioHoy />

        {/* Lo que alguien prometió y no cumplió, arriba de los pasos: es una
            alarma, no un paso. */}
        <Seguimiento parte="agenda" />

        {/* Los tres pasos del seguimiento, el mismo orden que en Dirección.
            Primero lo que vos programaste, después los que ya tenés en el
            WhatsApp, y al final los que todavía no bajaron. */}
        <PasoSistema
          numero={1}
          titulo="Hoy tenés que llamar"
          detalle="Lo que vos mismo programaste, más lo que se te pasó"
          abiertoPorDefecto
          resumen={
            porHacer === null
              ? null
              : porHacer > 0
                ? { texto: `${porHacer} por hacer`, fondo: "#FBE9E7", color: "#C0392B" }
                : { texto: "al día", fondo: "#E4F1EA", color: "#157F52" }
          }
        >
          <TareasDeHoy onResumen={setPorHacer} />
        </PasoSistema>

        <PasoSistema
          numero={2}
          titulo="En mi WhatsApp Business"
          detalle="Los que confirmaste · acá el sistema ya no ve nada, solo vos"
          abiertoPorDefecto
        >
          <Seguimiento parte="business" />
        </PasoSistema>

        <PasoSistema
          numero={3}
          titulo="Todavía no bajaron"
          detalle="Tibios y fríos de los últimos días"
        >
          <Seguimiento parte="dias" />
        </PasoSistema>

      {/* Filtros por bloque, con su cuenta. */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <Pildora activa={filtro === "todos"} onClick={() => elegirFiltro("todos")}>
            Todos <b className="tabular-nums opacity-60 ml-1">{conteos.pendientes}</b>
          </Pildora>
          {bloques
            .filter((b) => b.total > 0)
            .map((b) => (
              <Pildora key={b.id} activa={filtro === b.id} onClick={() => elegirFiltro(b.id)}>
                {b.id === "caliente" && "🔥 "}
                {b.titulo}
                <b className="tabular-nums opacity-60 ml-1">{b.total}</b>
              </Pildora>
            ))}
        </div>

        {error && (
          <div className="rounded-2xl bg-surface border border-gridline p-4 mb-4 text-sm" style={{ color: "#C0432A" }}>
            {error}
          </div>
        )}
        {cargando && data?.parcial && (
          <p className="text-sm mb-4" style={{ color: GRIS }}>
            Estos son los movimientos de hoy. Cargando el resto de la lista…
          </p>
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
    </main>
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
      className={`rounded-full px-4 py-2 text-[13px] whitespace-nowrap border ${
        activa
          ? "bg-header text-header-ink font-medium border-transparent"
          : "bg-surface text-ink-secondary border-gridline hover:bg-page"
      }`}
    >
      {children}
    </button>
  );
}
