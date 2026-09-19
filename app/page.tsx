"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CambiarVista } from "@/components/CambiarVista";
import { CerrarSesion } from "@/components/CerrarSesion";
import { MiDia } from "@/components/MiDia";
import { useSesion } from "@/components/useSesion";
import { nombreCorto } from "@/lib/nombre";

/**
 * El Home: la meta, y un botón para ir a trabajar.
 *
 * Es lo primero que ve al entrar y contesta una sola pregunta —cómo voy—. El
 * trabajo está en Mi día, a un toque.
 *
 * Estaban juntas. En el teléfono, que es donde pasa el 90% del uso, había que
 * bajar media pantalla de meta antes de llegar al primer paso, y la meta
 * —que es lo que motiva— quedaba convertida en un techo que había que cruzar.
 */
export default function HomePage() {
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
    <main className="max-w-[960px] mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <div className="flex flex-col items-center text-center gap-3 mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:text-left sm:gap-4">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
          <h1 className="text-[21px] sm:text-[25px] font-semibold text-ink-primary tracking-tight leading-[1.15]">
            CRM - Marketing
          </h1>
          {sesion && !esAdmin && (
            <span className="text-sm text-ink-secondary bg-surface border border-gridline rounded-full px-3 py-1.5">
              {nombreCorto(sesion.nombre)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
          <CambiarVista actual="home" />
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

      <MiDia esAdmin={esAdmin} parte="meta" recargar={(fn) => (recargarRef.current = fn)} />

      {/* El botón de arrancar.
          Ancho completo y alto de pulgar: en el teléfono es lo único que hay
          que tocar en esta pantalla, así que no compite con nada y no hace
          falta apuntar. La dirección no lo ve — no trabaja leads por acá. */}
      {!esAdmin && (
        <Link
          href="/mi-dia"
          className="block w-full text-center rounded-[18px] mt-5 px-5 py-4 sm:py-4 text-white active:scale-[.99] transition-transform"
          style={{ background: "#17457F", boxShadow: "0 8px 22px rgba(23,69,127,.22)" }}
        >
          <span className="block text-[17px] sm:text-[18px] font-bold tracking-[-0.01em]">
            Empezar mi día
          </span>
          <span className="block text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,.78)" }}>
            Los cuatro pasos, uno por uno
          </span>
        </Link>
      )}
    </main>
  );
}
