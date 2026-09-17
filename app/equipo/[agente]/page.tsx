"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MiDia } from "@/components/MiDia";
import { MirandoA } from "@/components/MirandoA";
import { CerrarSesion } from "@/components/CerrarSesion";
import { useSesion } from "@/components/useSesion";
import type { AgentProduction } from "@/lib/metrics";

/**
 * El panel de un agente, abierto por su dirección.
 *
 * Es el mismo componente que usa él —los mismos pasos, los mismos botones—
 * y no una copia de lectura: la dirección quería entrar al panel, no mirar un
 * resumen. Lo único que cambia es que todas las consultas salen firmadas con
 * su agente, y de eso se encarga el envoltorio.
 *
 * Quién puede abrir a quién no se decide acá sino en el servidor: el admin a
 * cualquiera, un director solo a los de su oficina. Si alguien fuerza la URL,
 * las consultas vuelven a devolver lo suyo y la pantalla queda vacía.
 */
export default function PanelDeAgentePage({ params }: { params: { agente: string } }) {
  const sesion = useSesion();
  const puede = sesion?.rol === "admin" || sesion?.rol === "director";
  const [nombre, setNombre] = useState<string | null>(null);

  // El nombre sale de la producción del equipo, que la dirección ya puede ver.
  // Es una consulta que igual se hace; acá solo se le pide el nombre.
  useEffect(() => {
    if (!puede) return;
    fetch("/api/metrics/production")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AgentProduction | null) => {
        setNombre(d?.rows.find((r) => r.agentId === params.agente)?.agent ?? "");
      })
      .catch(() => setNombre(""));
  }, [params.agente, puede]);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col items-center text-center gap-3 mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:text-left sm:gap-4">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
          <Link
            href="/equipo"
            className="text-sm text-ink-secondary bg-surface border border-gridline rounded-full px-3.5 py-2 hover:bg-page shrink-0"
          >
            ← Mi equipo
          </Link>
          <h1 className="text-[20px] sm:text-[24px] font-semibold text-ink-primary tracking-tight leading-[1.15]">
            {nombre || "Su panel"}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
          <span
            className="text-[12px] rounded-full px-3 py-2 shrink-0"
            style={{ background: "#FDF3E6", color: "#B5701F", border: "1px solid rgba(181,112,31,.25)" }}
          >
            Está viendo el panel de otra persona
          </span>
          <CerrarSesion className="bg-surface border border-gridline rounded-full px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-page hover:text-ink-primary disabled:opacity-50 shrink-0" />
        </div>
      </div>

      {sesion && !puede && (
        <p className="text-[13.5px] text-ink-secondary">
          Esta pantalla es de la dirección. Su panel de trabajo es <b>Mi día</b>.
        </p>
      )}

      {puede && (
        <MirandoA agentId={params.agente}>
          <MiDia />
        </MirandoA>
      )}
    </main>
  );
}
