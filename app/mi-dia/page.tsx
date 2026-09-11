"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CerrarSesion } from "@/components/CerrarSesion";
import { useSesion } from "@/components/useSesion";
import { TablaLeads } from "@/components/TablaLeads";
import { ArcoTemperatura, LeyendaTemperatura } from "@/components/ArcoTemperatura";
import { conteoVacio } from "@/lib/leadStates";
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
    <div
      className="min-h-screen"
      style={{ background: FONDO_DEGRADADO, backgroundRepeat: "no-repeat", color: NEGRO }}
    >
      <div className="max-w-6xl mx-auto px-5 py-5">
        {/* Cabecera: saludo, las dos pantallas, y el reparto del día en un
            arco. Antes eran cinco cosas sueltas —cápsula, tira de
            movimientos, título gigante, contadores, botones— repartidas por
            la pantalla sin alineación entre sí. */}
        <section
          className="relative rounded-[30px] px-6 pt-6 pb-7 mb-5 text-center overflow-hidden"
          style={{
            background: [
              "radial-gradient(700px 420px at 6% 0%, rgba(120,180,235,.55), transparent 62%)",
              "radial-gradient(760px 480px at 96% 34%, rgba(198,242,78,.50), transparent 64%)",
              "radial-gradient(620px 420px at 52% 108%, rgba(255,255,255,.85), transparent 62%)",
              "#EFF3F0",
            ].join(", "),
            backgroundRepeat: "no-repeat",
            boxShadow: "0 1px 2px rgba(13,13,13,.03), 0 20px 44px -26px rgba(13,13,13,.30)",
          }}
        >
          {/* Cuenta y salida, discretos: se usan una vez al día. */}
          <div className="absolute top-4 right-4 flex gap-1.5">
            {esAgente && (
              <Link
                href="/mi-cuenta"
                className="rounded-full px-3.5 py-1.5 text-[12.5px] hover:bg-white"
                style={{ background: "rgba(255,255,255,.66)", color: "#52514e" }}
              >
                Mi cuenta
              </Link>
            )}
            <CerrarSesion
              className="rounded-full px-3.5 py-1.5 text-[12.5px] hover:bg-white disabled:opacity-60"
              style={{ background: "rgba(255,255,255,.66)", color: "#52514e" }}
            />
          </div>

          <p className="text-[22px] sm:text-[27px] font-bold tracking-[-0.03em] pt-8 sm:pt-0">
            Hola, {sesion?.nombre?.split(" ")[0] ?? "de nuevo"}
          </p>
          <p className="text-[19px] sm:text-[24px] tracking-[-0.02em] mt-0.5">Así viene tu día 🙂</p>

          <div className="inline-flex gap-2 mt-4 mb-1">
            <span
              className="rounded-full px-6 py-2 text-sm font-semibold bg-white"
              style={{ boxShadow: "0 1px 3px rgba(13,13,13,.10)" }}
            >
              Mi día
            </span>
            <Link
              href="/"
              className="rounded-full px-6 py-2 text-sm"
              style={{ border: "1px solid rgba(13,13,13,.10)", color: "#52514e" }}
            >
              Dirección
            </Link>
          </div>

          {/* La dirección entra a Mi día para mirar el de cada agente: acá
              elige de quién. El agente no lo ve porque solo tiene el suyo. */}
          {!esAgente && (
            <div className="mt-3">
              <select
                value={agente}
                onChange={(e) => elegirAgente(e.target.value)}
                className="rounded-full px-4 py-2 text-[13px] bg-white outline-none"
                style={{ border: "1px solid rgba(13,13,13,.10)" }}
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

          <ArcoTemperatura
            conteos={conteosPorEstado}
            total={conteos.pendientes}
            calientes={conteosPorEstado.caliente}
          />
          <LeyendaTemperatura conteos={conteosPorEstado} />

          <button
            onClick={() => elegirFiltro(conteos.calientes > 0 ? "caliente" : "todos")}
            className="mt-4 rounded-full px-8 py-3.5 text-[14.5px] font-semibold text-white hover:opacity-90 w-full sm:w-auto"
            style={{ background: NEGRO }}
          >
            {conteos.calientes > 0 ? `Ir a Calientes (${conteos.calientes}) →` : "Ver toda la lista →"}
          </button>
        </section>

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
          <button
            onClick={() => cargar(agente)}
            disabled={cargando}
            className="rounded-full px-4 py-2 text-[13px] font-semibold ml-auto disabled:opacity-60"
            style={{ background: LIMA, color: NEGRO }}
          >
            {cargando ? "Actualizando…" : "↻ Actualizar"}
          </button>
        </div>

        {error && (
          <div className="rounded-2xl bg-white p-4 mb-4 text-sm" style={{ color: "#C0432A" }}>
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
      </div>
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
