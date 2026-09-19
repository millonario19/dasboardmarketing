"use client";

import Link from "next/link";
import { useSesion } from "@/components/useSesion";

// Las pantallas del tablero, separadas por la pregunta que contesta cada una:
//
//   Home      — cómo voy (la meta y la comisión)
//   Mi día    — qué hago ahora (los cuatro pasos)
//   Mis leads — el seguimiento de los días que siguen
//   Métricas  — los números del mes
//   Mi equipo — quién, para la dirección
//
// Home y Mi día estaban juntas en una sola. En el teléfono, que es donde pasa
// el 90% del uso, había que bajar media pantalla de meta antes de llegar al
// primer paso del trabajo.
export function CambiarVista({
  actual,
}: {
  actual: "home" | "mi-dia" | "mis-leads" | "metricas" | "equipo";
}) {
  const sesion = useSesion();
  // «Mi equipo» solo para quien tiene equipo. Un agente que la ve y no puede
  // entrar aprende que hay algo que no le muestran, y eso no ayuda a nadie.
  const dirige = sesion?.rol === "admin" || sesion?.rol === "director";

  const opciones = [
    { id: "home" as const, href: "/", texto: "Home" },
    { id: "mi-dia" as const, href: "/mi-dia", texto: "Mi día" },
    { id: "mis-leads" as const, href: "/mis-leads", texto: "Mis leads" },
    { id: "metricas" as const, href: "/metricas", texto: "Métricas" },
    ...(dirige ? [{ id: "equipo" as const, href: "/equipo", texto: "Mi equipo" }] : []),
  ];

  return (
    <nav className="inline-flex flex-wrap justify-center rounded-full border border-gridline overflow-hidden text-sm">
      {opciones.map((o) => (
        <Link
          key={o.id}
          href={o.href}
          aria-current={actual === o.id ? "page" : undefined}
          className={`px-3.5 sm:px-4 py-2.5 sm:py-2 ${
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
