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
import type { Seguimiento } from "@/lib/seguimiento";
import { BarraDeDia } from "@/components/BarraDeDia";
import { diaBogota, hoyBogota } from "@/lib/dia";

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
  parte = "todo",
  recargar,
}: {
  esAdmin?: boolean;
  /**
   * Qué mitad se dibuja.
   *
   * Son dos pantallas y un solo componente porque las dos salen de la misma
   * consulta: partirlo en dos archivos haría que el Home y Mi día pidieran los
   * mismos números por separado, y que un cambio en uno se olvidara en el otro.
   */
  parte?: "todo" | "meta" | "pasos";
  /** Para que la cabecera de la página pueda disparar la recarga. */
  recargar?: (fn: () => void) => void;
}) {
  const [data, setData] = useState<AgentProduction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sinResponder, setSinResponder] = useState<number | null>(null);
  /**
   * El día que manda en toda la pantalla. `null` es hoy.
   *
   * Antes había dos selectores —uno en el paso 1 y otro en el paso 2— y los
   * pasos 3 y 4 seguían al del paso 2. Elegir el 18 en el primero movía el
   * primero y nada más: los cuatro pasos hablaban de días distintos y la
   * pantalla se contradecía a sí misma. Ahora la fecha vive acá arriba, sola,
   * y los cuatro leen de ella.
   */
  const [dia, setDia] = useState<string | null>(null);
  const diaVer = dia ?? hoyBogota();
  /** Qué paso está abierto. 0 = ninguno, cuando ya no queda nada pendiente. */
  const [abierto, setAbierto] = useState<number | null>(null);
  const [seg, setSeg] = useState<Seguimiento | null>(null);

  /**
   * Los pasos 3 y 4 se piden apenas abre la pantalla, no al hacer clic.
   *
   * Los dos salen de la misma consulta, y como están plegados el pedido
   * arrancaba recién cuando el agente tocaba el título: quedaba mirando un
   * «Buscando…» varios segundos, con el tablero ya cargado al lado.
   */
  useEffect(() => {
    if (esAdmin) return;
    pedirSeguimiento()
      .then(setSeg)
      .catch(() => undefined);
  }, [esAdmin]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    // El seguimiento va en el mismo viaje: es de donde salen los pasos 3 y 4,
    // y actualizar solo la mitad de la pantalla no es actualizar.
    if (!esAdmin) pedirSeguimiento(true).then(setSeg).catch(() => undefined);
    fetch("/api/metrics/production" + (dia ? `?dia=${encodeURIComponent(dia)}` : ""))
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Error al cargar métricas");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dia, esAdmin]);

  useEffect(() => {
    load();
    recargar?.(load);
  }, [load, recargar]);

  // Al cambiar el día, la cuenta del paso 1 es del día anterior. Se borra hasta
  // que el paso la vuelva a pedir: una píldora vieja miente peor que ninguna.
  useEffect(() => {
    setSinResponder(null);
  }, [dia]);

  /**
   * Cuánto queda pendiente en cada paso.
   *
   * Los cuatro lo muestran sin abrirse. Antes el 3 y el 4 no decían nada y
   * había que abrirlos a ciegas para saber si había gente esperando.
   */
  const pendientes: Record<number, number> = {
    1: sinResponder ?? 0,
    // `panel.hoy` ya viene del día elegido: la consulta sale firmada con él.
    2: data?.panel.hoy.caliente ?? 0,
    // Los clics de WhatsApp vienen de toda la ventana y se recortan acá, igual
    // que adentro del paso 3, para que la píldora y la lista digan lo mismo.
    3: (seg?.porConfirmar ?? []).filter(
      (p) => p.clicEn && diaBogota(p.clicEn) === diaVer && p.confirmado === null
    ).length,
    4: (dia ? (seg?.porDia[dia] ?? []) : (seg?.hoy ?? [])).length,
  };

  /**
   * Cuál abre: el primero con trabajo, mirando de atrás para adelante.
   *
   * No el 1 por ser el 1. El orden es 4, 3, 1, 2 porque la plata está al final
   * del embudo: un agente puede registrar bien todo el mes y no cobrar un peso
   * si no llama. Si el 4 está limpio, abre el que sí tenga gente esperando; si
   * no queda nada, no abre ninguno y los cuatro se ven de un vistazo.
   */
  const ORDEN = [4, 3, 1, 2];
  const sugerido = ORDEN.find((n) => pendientes[n] > 0) ?? 0;
  const actual = abierto ?? sugerido;

  /** Del abierto al siguiente que todavía tenga algo. */
  function siguienteDe(n: number) {
    const resto = ORDEN.filter((x) => x !== n && pendientes[x] > 0);
    setAbierto(resto[0] ?? 0);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const paso = (n: number) => ({
    abierto: actual === n,
    hecho: pendientes[n] === 0,
    onAlternar: () => setAbierto(actual === n ? 0 : n),
    onSiguiente: () => siguienteDe(n),
  });

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
        {!esAdmin && parte !== "pasos" && (
            <MetaDelMes
              ftdMes={data.totals.ftdMes}
              ftdHoy={data.totals.ftdHoy}
              registrosMes={data.totals.registrosMes}
              registrosHoy={data.totals.registrosHoy}
              leadsMes={data.totals.leadsMes}
            leadsHoy={data.totals.leadsHoy}
            />
          )}

        {/* La fecha de toda la pantalla, antes que nada: lo primero es saber
            de qué día se está hablando. */}
        {parte !== "meta" && <BarraDeDia dia={dia} onCambiar={setDia} onRecargar={load} />}

        {/* Sus números, arriba de los pasos.
            En Mi día van sin el reloj: trabaja con las cifras a la vista sin
            tener que volver al Home, y el reloj ocuparía media pantalla de
            teléfono para repetir lo que ya vio al entrar. */}
        {!esAdmin && parte === "pasos" && (
          <MetaDelMes
            compacto
            dia={dia}
            ftdMes={data.totals.ftdMes}
            ftdHoy={data.totals.ftdHoy}
            registrosMes={data.totals.registrosMes}
            registrosHoy={data.totals.registrosHoy}
            leadsMes={data.totals.leadsMes}
              leadsHoy={data.totals.leadsHoy}
          />
        )}

        {/* Los cuatro pasos como un recorrido: uno abierto, los otros tres
            enteros debajo, y un botón que lleva al siguiente. */}
        {parte !== "meta" && (
        <>
        <PasoSistema
          numero={1}
          titulo="Quién escribió hoy"
          detalle="Y si alguien le respondió"
          {...paso(1)}
          resumen={
            sinResponder === null
              ? null
              : sinResponder > 0
                ? { texto: `${sinResponder} sin responder`, fondo: "#FBE9E7", color: "#C0392B" }
                : { texto: "todos respondidos", fondo: "#E4F1EA", color: "#157F52" }
          }
        >
          <InteraccionLeads
            dia={dia}
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
          {...paso(2)}
          resumen={
            data.panel.hoy.caliente > 0
              ? {
                  texto: `${data.panel.hoy.caliente} caliente${data.panel.hoy.caliente === 1 ? "" : "s"}`,
                  fondo: "#FBE9E7",
                  color: "#C0392B",
                }
              : { texto: "ninguno caliente", fondo: "#F2F3F6", color: "#8E8C83" }
          }
        >
          <PanelEstados datos={data.panel} propio={!esAdmin} dia={dia} />
        </PasoSistema>
        </>
        )}

        {/* Los pasos 3 y 4 eran uno solo mal partido: los dos contestan la
            misma pregunta —¿este lead ya está en mi WhatsApp?— por los dos
            caminos que existen. El cliente toca el botón y el agente
            confirma si llegó, o el agente se lo lleva él. Separados obligaban
            a recorrer dos listas del mismo día para saber lo mismo.

            Es del agente, no de la dirección: nadie más puede saber si el
            cliente apareció en el WhatsApp de otro. */}
        {!esAdmin && parte !== "meta" && (
          <PasoSistema
            numero={3}
            titulo="WhatsApp Business"
            detalle="Bajar manual o bajar por LeadConnector"
            {...paso(3)}
            resumen={
              pendientes[3] > 0
                ? { texto: `${pendientes[3]} sin confirmar`, fondo: "#FDF3E6", color: "#B5701F" }
                : { texto: "nada por confirmar", fondo: "#F2F3F6", color: "#8E8C83" }
            }
          >
            <ConfirmarBajadas dentroDePaso dia={dia} />
            {/* En un div y no suelto: el paso le quita el borde de arriba a
                las secciones que son hijas directas, y la segunda quedaría
                pegada a la primera sin nada que las separe. */}
            <div className="mt-4 [&>section]:mb-0">
              <LeadsDelDia modo="bajar" dia={dia} />
            </div>
          </PasoSistema>
        )}

        {/* Llamar va acá y no en Mis leads porque habla de los que entraron
            hoy; Mis leads es el seguimiento de los días que siguen. */}
        {!esAdmin && parte !== "meta" && (
          <PasoSistema
            numero={4}
            titulo="Llamar inmediatamente a mis leads nuevos"
            detalle="Hay mayor conversión si llama de inmediato · lo que programe aparece mañana en Mis leads"
            {...paso(4)}
            textoSiguiente="Terminé mi día ✓"
            resumen={
              pendientes[4] > 0
                ? { texto: `${pendientes[4]} para llamar`, fondo: "#FBE9E7", color: "#C0392B" }
                : { texto: "sin leads hoy", fondo: "#F2F3F6", color: "#8E8C83" }
            }
          >
            <LeadsDelDia modo="llamar" dia={dia} />
          </PasoSistema>
        )}

      </>
    )}
    </>
  );
}
