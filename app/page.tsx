"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FunnelWaterfall } from "@/components/FunnelWaterfall";
import { PanelEstados } from "@/components/PanelEstados";
import { CambiarVista } from "@/components/CambiarVista";
import { TablaAgentes } from "@/components/TablaAgentes";
import { InteraccionLeads } from "@/components/InteraccionLeads";
import { ConfirmarBajadas } from "@/components/ConfirmarBajadas";
import { PasoSistema } from "@/components/PasoSistema";
import { CerrarSesion } from "@/components/CerrarSesion";
import { useSesion } from "@/components/useSesion";
import { nombreCorto } from "@/lib/nombre";
import type { AgentProduction } from "@/lib/metrics";

export default function DashboardPage() {
  const [data, setData] = useState<AgentProduction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
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

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
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
          {/* Las conversaciones van primero: es lo único de la pantalla que
              se puede atender hoy. Las métricas del mes quedan al final,
              porque se miran una vez y no cambian nada del día. */}
          <PasoSistema
            numero={1}
            titulo="Interacción del lead"
            detalle="Quién escribió hoy y si alguien le respondió"
          />
          <InteraccionLeads
            esAdmin={esAdmin}
            agentes={data.rows
              .filter((r) => r.agentId)
              .map((r) => ({ id: r.agentId as string, nombre: r.agent }))}
          />

          <PasoSistema
            numero={2}
            titulo="Temperatura del lead"
            detalle="En qué estado quedó cada uno: frío, tibio o caliente"
          />
          <PanelEstados datos={data.panel} propio={!esAdmin} />

          {/* Debajo de la temperatura, donde el agente ya está mirando en qué
              estado quedó cada lead: la respuesta cambia justamente eso. Para
              la dirección no va — la pregunta es del agente que atendió. */}
          {!esAdmin && (
            <>
              <PasoSistema
                numero={3}
                titulo="Confirmar cliente potencial"
                detalle="¿Llegaron de verdad a tu WhatsApp Business? Hasta que respondas, el paso 2 puede estar mal"
              />
              <ConfirmarBajadas />
            </>
          )}

          <TablaAgentes data={data} />

          <div className="mt-8">
            <FunnelWaterfall
              stages={[
                { label: "Total leads mes", value: data.totals.leadsMes },
                { label: "Total registros mes", value: data.totals.registrosMes },
                { label: "Total ftds del mes", value: data.totals.ftdMes },
                { label: "Nuevo leads", value: data.totals.leadsHoy },
                { label: "Registros Hoy", value: data.totals.registrosHoy },
                { label: "FTDS de hoy", value: data.totals.ftdHoy },
              ]}
            />
          </div>
        </>
      )}
    </main>
  );
}
