"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PanelEstados } from "@/components/PanelEstados";
import { CambiarVista } from "@/components/CambiarVista";
import { InteraccionLeads } from "@/components/InteraccionLeads";
import { ConfirmarBajadas } from "@/components/ConfirmarBajadas";
import { PasoSistema } from "@/components/PasoSistema";
import { MetaDelMes } from "@/components/MetaDelMes";
import { CerrarSesion } from "@/components/CerrarSesion";
import { useSesion } from "@/components/useSesion";
import { nombreCorto } from "@/lib/nombre";
import type { AgentProduction } from "@/lib/metrics";

export default function DashboardPage() {
  const [data, setData] = useState<AgentProduction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  // Lo informa el módulo de conversaciones cuando termina de cargar.
  const [sinResponder, setSinResponder] = useState<number | null>(null);
  // El día que el agente está mirando en el paso 2. El paso 3 lo sigue: la
  // pregunta «¿llegó a tu WhatsApp?» tiene que ser del mismo día que la
  // temperatura que la produjo.
  const [diaMirado, setDiaMirado] = useState<string | null>(null);
  const sesion = useSesion();
  const esAdmin = sesion?.rol === "admin";

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/metrics/production")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Error al cargar métricas");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // px-4 en el teléfono: los 24 px de margen a cada lado se comían 16 px de
  // las tarjetas, que es justo lo que le falta a un nombre largo para no
  // cortarse.
  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* En móvil la cabecera se apila y se centra: el título en un renglón, el
          nombre debajo y los botones al pie. En una sola fila, «Marketing y
          Ventas» más el nombre completo no caben en 375 px y empujaban el
          ancho del documento. */}
      <div className="flex flex-col items-center text-center gap-3 mb-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:text-left sm:gap-4">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
          <h1 className="text-[21px] sm:text-[25px] font-semibold text-ink-primary tracking-tight leading-[1.15]">
            CRM - Marketing
          </h1>
          <div className="flex items-center gap-2">
            {sesion && !esAdmin && (
              <span className="text-sm text-ink-secondary bg-surface border border-gridline rounded-full px-3 py-1.5">
                {nombreCorto(sesion.nombre)}
              </span>
            )}
            <span className="w-10 h-10 rounded-full border border-gridline bg-surface flex items-center justify-center text-ink-muted text-lg shrink-0">
              🔗
            </span>
          </div>
        </div>
        {/* Sin shrink-0 y con salto de línea: los cinco botones sumaban 535 px
            y, al no poder encogerse ni bajar de renglón, estiraban el
            documento a 559 px en una pantalla de 375. Todo el contenido
            quedaba corrido a la izquierda con una franja vacía a la derecha. */}
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
          <CambiarVista actual="direccion" />
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-surface border border-gridline rounded-full px-4 py-2.5 text-sm font-medium text-ink-primary hover:bg-page disabled:opacity-50 shrink-0"
          >
            📅 {loading ? "Actualizando…" : "Actualizar"} ⌄
          </button>
          {esAdmin && (
            <Link
              href="/admin/usuarios"
              className="bg-surface border border-gridline rounded-full px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-page hover:text-ink-primary shrink-0"
            >
              Usuarios
            </Link>
          )}
          {sesion && !esAdmin && (
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

      {error && (
        <div className="bg-surface border border-series2 text-series2 rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {loading && !error && !data && (
        <p className="text-ink-secondary text-sm mb-6">Cargando métricas…</p>
      )}

      {!error && data && (
        <>
          {/* Arriba de todo, antes que los pasos: es lo único de la pantalla
              que habla de la plata del agente, y es el motivo por el que abre
              el tablero. Para la dirección no va — la meta es personal. */}
          {!esAdmin && <MetaDelMes ftdMes={data.totals.ftdMes} />}

          {/* Los tres pasos, plegables y pegados: con los módulos abiertos uno
              nunca ve los tres títulos juntos y parecen tres cosas sueltas. */}
          <PasoSistema
            numero={1}
            titulo="Quién escribió hoy"
            detalle="Y si alguien le respondió"
            abiertoPorDefecto
            resumen={
              sinResponder === null
                ? null
                : sinResponder > 0
                  ? { texto: `${sinResponder} sin responder`, fondo: "#FBE9E7", color: "#C0392B" }
                  : { texto: "todos respondidos", fondo: "#E4F1EA", color: "#157F52" }
            }
          >
            <InteraccionLeads
              esAdmin={esAdmin}
              agentes={data.rows
                .filter((r) => r.agentId)
                .map((r) => ({ id: r.agentId as string, nombre: r.agent }))}
              onResumen={setSinResponder}
            />
          </PasoSistema>

          <PasoSistema
            numero={2}
            titulo="Está interesado"
            detalle="Frío, tibio o caliente, según lo que hizo"
            resumen={{
              texto: `${data.panel.hoy.caliente} caliente${data.panel.hoy.caliente === 1 ? "" : "s"}`,
              fondo: "#FBE9E7",
              color: "#C0392B",
            }}
          >
            <PanelEstados datos={data.panel} propio={!esAdmin} onDia={setDiaMirado} />
          </PasoSistema>

          {/* El paso 3 es del agente: la dirección no puede saber si el cliente
              llegó al WhatsApp de otro. */}
          {!esAdmin && (
            <PasoSistema
              numero={3}
              titulo="Ya está en mi Business"
              detalle={
                diaMirado
                  ? "Los clics del día que estás mirando en el paso 2"
                  : "Hasta que respondas, el paso 2 puede estar mal"
              }
              abiertoPorDefecto
            >
              <ConfirmarBajadas dentroDePaso dia={diaMirado} />
            </PasoSistema>
          )}

        </>
      )}
    </main>
  );
}
