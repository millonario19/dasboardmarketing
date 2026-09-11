"use client";

import Link from "next/link";

// Las dos pantallas del dashboard: la del agente y la de dirección. Se separan
// por quién las usa, no por tema — cada uno ve la mitad de lo que veía cuando
// todo convivía en una sola página.
export function CambiarVista({ actual }: { actual: "mi-dia" | "direccion" }) {
  const opciones = [
    { id: "mi-dia" as const, href: "/mi-dia", texto: "Mi día" },
    { id: "direccion" as const, href: "/", texto: "Dirección" },
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
