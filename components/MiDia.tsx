"use client";

import { useCallback, useEffect, useState } from "react";
import { PanelEstados } from "@/components/PanelEstados";
import { InteraccionLeads } from "@/components/InteraccionLeads";
import { ConfirmarBajadas } from "@/components/ConfirmarBajadas";
import { PasoSistema } from "@/components/PasoSistema";
import { LeadsDelDia } from "@/components/LeadsDelDia";
import { MetaDelMes } from "@/components/MetaDelMes";
import { pedirSeguimiento } from "@/components/Seguimiento";
import type { AgentProduction } from "@/lib/metrics";

/**
 * El día de trabajo: la meta y los cuatro pasos.
 *
 * Vive aparte de la página porque hay dos puertas a lo mismo. El agente entra
 * por «Mi día» y ve el suyo; la dirección entra desde su equipo y ve el de esa
 * persona, completo y funcionando. Es el mismo componente en los dos casos: si
 * fueran dos, el que mira la dirección se quedaría viejo sin que nadie lo note.
 *
 * Lo que cambia entre una puerta y la otra no está acá: está en que las
 * consultas salen firmadas con el agente que se mira (ver `MirandoA`).
 */
export function MiDia({
  esAdmin = false,
  recargar,
}: {
  esAdmin?: boolean;
  /** Para que la cabecera de la página pueda disparar la recarga. */
  recargar?: (fn: () => void) => void;
}) {
  const [data, setData] = useState<AgentProduction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sinResponder, setSinResponder] = useState<number | null>(null);
  // El día que se está mirando en el paso 2. Los pasos 3 y 4 lo siguen: la
  // pregunta «¿llegó a su WhatsApp?» tiene que ser del mismo día que la
  // temperatura que la produjo.
  const [diaMirado, setDiaMirado] = useState<string | null>(null);

  /**
   * Los pasos 3 y 4 se piden apenas abre la pantalla, no al hacer clic.
   *
   * Los dos salen de la misma consulta, y como están plegados el pedido
   * arrancaba recién cuando el agente tocaba el título: quedaba mirando un
   * «Buscando…» varios segundos, con el tablero ya cargado al lado.
   */
  useEffect(() => {
    if (esAdmin) return;
    pedirSeguimiento().catch(() => undefined);
  }, [esAdmin]);

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
    recargar?.(load);
  }, [load, recargar]);

  return (
    <>
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
        {!esAdmin && (
            <MetaDelMes
              ftdMes={data.totals.ftdMes}
              ftdHoy={data.totals.ftdHoy}
              registrosMes={data.totals.registrosMes}
            />
          )}

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

        {/* Los pasos 3 y 4 eran uno solo mal partido: los dos contestan la
            misma pregunta —¿este lead ya está en mi WhatsApp?— por los dos
            caminos que existen. El cliente toca el botón y el agente
            confirma si llegó, o el agente se lo lleva él. Separados obligaban
            a recorrer dos listas del mismo día para saber lo mismo.

            Es del agente, no de la dirección: nadie más puede saber si el
            cliente apareció en el WhatsApp de otro. */}
        {!esAdmin && (
          <PasoSistema
            numero={3}
            titulo="WhatsApp Business"
            detalle={
              diaMirado
                ? "Bajar manual o bajar por LeadConnector · del día que eligió arriba"
                : "Bajar manual o bajar por LeadConnector"
            }
            abiertoPorDefecto
          >
            <ConfirmarBajadas dentroDePaso dia={diaMirado} />
            {/* En un div y no suelto: el paso le quita el borde de arriba a
                las secciones que son hijas directas, y la segunda quedaría
                pegada a la primera sin nada que las separe. */}
            <div className="mt-4 [&>section]:mb-0">
              <LeadsDelDia modo="bajar" dia={diaMirado} />
            </div>
          </PasoSistema>
        )}

        {/* Llamar va acá y no en Mis leads porque habla de los que entraron
            hoy; Mis leads es el seguimiento de los días que siguen. */}
        {!esAdmin && (
          <PasoSistema
            numero={4}
            titulo="Llamar inmediatamente a mis leads nuevos"
            detalle="Hay mayor conversión si llama de inmediato · lo que programe aparece mañana en Mis leads"
          >
            <LeadsDelDia modo="llamar" dia={diaMirado} />
          </PasoSistema>
        )}

      </>
    )}
    </>
  );
}
