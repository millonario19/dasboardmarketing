"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CerrarSesion } from "@/components/CerrarSesion";
import { CambiarVista } from "@/components/CambiarVista";
import { useSesion } from "@/components/useSesion";
import { SeMovioHoy } from "@/components/SeMovioHoy";
import { Seguimiento } from "@/components/Seguimiento";
import { TareasDeHoy } from "@/components/TareasDeHoy";
import { LlamarPorDia } from "@/components/LlamarPorDia";
import { PasoSistema } from "@/components/PasoSistema";
import { MetaDelMes } from "@/components/MetaDelMes";
import { nombreCorto } from "@/lib/nombre";
import type { AgentProduction } from "@/lib/metrics";


export default function MiDiaPage() {
  const sesion = useSesion();
  // El agente no elige a quién mira: su sesión lo fija. El selector y el
  // recuerdo en el navegador quedan solo para la dirección, que sí necesita
  // pasar de un agente a otro.
  const esAgente = sesion?.rol === "agente";
  // primero que el agente quiere ver. Si quedara en "todos", al llegar la
  // lista completa la pantalla saltaría sola de un bloque a cinco.
  // por él.
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


  return (
    <main className="max-w-[960px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
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
          {/* Cada módulo tiene su propio «Actualizar»; este recarga todo de
              una, que es lo que uno espera de un botón en la cabecera. */}
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-surface border border-gridline rounded-full px-4 py-2.5 text-sm font-medium text-ink-primary hover:bg-page shrink-0"
          >
            ↻ Actualizar
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

      {/* Arriba de todo, igual que en Dirección. Para la dirección no va: la
          meta es personal. */}
      {esAgente && ftdMes !== null && <MetaDelMes ftdMes={ftdMes} />}

        {/* Lo primero del día: quién se movió, sin importar cuándo entró. Un
            lead de hace dos semanas que vuelve a escribir vale más que uno
            nuevo, y antes no aparecía en ninguna parte. */}
        <SeMovioHoy />

        {/* Lo que alguien prometió y no cumplió, arriba de los pasos: es una
            alarma, no un paso. */}
        <Seguimiento parte="agenda" />

        {/* Los tres pasos del seguimiento, el mismo orden que en Dirección.
            Primero lo que usted programó, después los que ya tiene en el
            WhatsApp, y al final los que todavía no bajaron. */}
        {/* El rótulo de la sección. Las dos pantallas tienen un paso 1, un 2 y
            un 3, y sin esto el agente no sabe de cuáles está leyendo. */}
        <div className="flex items-center gap-3 mb-3">
          <span className="flex-1 h-px" style={{ background: "var(--gridline)" }} />
          <h2
            className="text-[12px] sm:text-[13px] font-bold uppercase tracking-[.2em] text-center"
            style={{ color: "#17457F" }}
          >
            Seguimiento mis leads
          </h2>
          <span className="flex-1 h-px" style={{ background: "var(--gridline)" }} />
        </div>

        <PasoSistema
          numero={1}
          titulo="Llamadas para hoy"
          detalle="Pendientes de FTD, día 2 y día 3, y lo que usted agendó"
          abiertoPorDefecto
          resumen={
            porHacer === null
              ? null
              : porHacer > 0
                ? { texto: `${porHacer} por hacer`, fondo: "#FBE9E7", color: "#C0392B" }
                : { texto: "al día", fondo: "#E4F1EA", color: "#157F52" }
          }
        >
          {/* Primero la cola del embudo —día 2 y día 3— y después lo que el
              agente se programó él mismo. */}
          <LlamarPorDia />
          <TareasDeHoy onResumen={setPorHacer} />
        </PasoSistema>

        <PasoSistema
          numero={2}
          titulo="En mi WhatsApp Business"
          detalle="Calientes que ya bajaron y confirmaste · acá el sistema no ve nada, solo usted"
          abiertoPorDefecto
        >
          <Seguimiento parte="business" />
        </PasoSistema>

        <PasoSistema
          numero={3}
          titulo="Todavía no bajaron a WhatsApp"
          detalle="Seguimiento por WhatsApp · fríos y tibios, hasta que bajen o hagan FTD"
        >
          <Seguimiento parte="dias" />
        </PasoSistema>

    </main>
  );
}
