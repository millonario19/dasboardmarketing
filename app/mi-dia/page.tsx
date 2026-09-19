"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CambiarVista } from "@/components/CambiarVista";
import { CerrarSesion } from "@/components/CerrarSesion";
import { MiDia } from "@/components/MiDia";
import { useSesion } from "@/components/useSesion";
import { nombreCorto } from "@/lib/nombre";

/**
 * Mi día: los cuatro pasos del trabajo, y nada más.
 *
 * Vive aparte del Home porque son dos preguntas distintas. El Home contesta
 * «cómo voy» y esta contesta «qué hago ahora». Juntas en una sola pantalla, en
 * el teléfono —que es donde pasa el 90% del uso— había que bajar media
 * pantalla de meta antes de llegar al primer paso.
 */
export default function MiDiaPage() {
  const sesion = useSesion();
  const esAdmin = sesion?.rol === "admin";
  const recargarRef = useRef<(() => void) | null>(null);
  const [recargando, setRecargando] = useState(false);

  function actualizar() {
    setRecargando(true);
    recargarRef.current?.();
    setTimeout(() => setRecargando(false), 800);
  }

  return (
    <main className="max-w-[960px] lg:max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
      <div className="flex flex-col items-center text-center gap-3 mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:text-left sm:gap-4">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
          <h1 className="text-[21px] sm:text-[25px] md:text-[31px] font-semibold text-ink-primary tracking-tight leading-[1.15]">
            Mi día
          </h1>
          {sesion && !esAdmin && (
            <span className="text-sm text-ink-secondary bg-surface border border-gridline rounded-full px-3 py-1.5">
              {nombreCorto(sesion.nombre)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
          <CambiarVista actual="mi-dia" />
          <button
            onClick={actualizar}
            disabled={recargando}
            className="flex items-center gap-2 bg-surface border border-gridline rounded-full px-4 py-2.5 text-sm font-medium text-ink-primary hover:bg-page disabled:opacity-50 shrink-0"
          >
            {recargando ? "Actualizando…" : "↻ Actualizar"}
          </button>
          {esAdmin && (
            <Link
              href="/admin/usuarios"
              className="bg-surface border border-gridline rounded-full px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-page hover:text-ink-primary shrink-0"
            >
              Usuarios
            </Link>
          )}
          <CerrarSesion className="bg-surface border border-gridline rounded-full px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-page hover:text-ink-primary disabled:opacity-50 shrink-0" />
        </div>
      </div>

      <MiDia esAdmin={esAdmin} parte="pasos" recargar={(fn) => (recargarRef.current = fn)} />
    </main>
  );
}
