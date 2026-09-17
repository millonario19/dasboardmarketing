"use client";

import Link from "next/link";
import { useSesion } from "@/components/useSesion";

// Las tres pantallas del tablero, separadas por para qué sirven y no por tema:
// el día del agente, los tres pasos de la operación, y los números del mes.
// Las métricas viven aparte porque se miran una vez y no cambian nada de hoy —
// tenerlas abajo de los pasos hacía que la pantalla de trabajo terminara en un
// informe.
export function CambiarVista({
  actual,
}: {
  actual: "mi-dia" | "direccion" | "metricas" | "equipo";
}) {
  const sesion = useSesion();
  // «Mi equipo» solo para quien tiene equipo. Un agente que la ve y no puede
  // entrar aprende que hay algo que no le muestran, y eso no ayuda a nadie.
  const dirige = sesion?.rol === "admin" || sesion?.rol === "director";

  const opciones = [
    { id: "mi-dia" as const, href: "/mi-dia", texto: "Mis leads" },
    { id: "direccion" as const, href: "/", texto: "Mi día" },
    { id: "metricas" as const, href: "/metricas", texto: "Métricas" },
    ...(dirige ? [{ id: "equipo" as const, href: "/equipo", texto: "Mi equipo" }] : []),
  ];

  return (
    <nav className="inline-flex rounded-full border border-gridline overflow-hidden text-sm shrink-0">
      {opciones.map((o) => (
        <Link
          key={o.id}
          href={o.href}
          aria-current={actual === o.id ? "page" : undefined}
          className={`px-4 py-2 ${
            actual === o.id
              ? "bg-header text-header-ink font-medium"
              : "bg-surface text-ink-secondary hover:bg-page"
          }`}
        >
          {o.texto}
        </Link>
      ))}
    </nav>
  );
}
