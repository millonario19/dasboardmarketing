"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CambiarVista } from "@/components/CambiarVista";
import { CerrarSesion } from "@/components/CerrarSesion";
import { MiDia } from "@/components/MiDia";
import { useSesion } from "@/components/useSesion";
import { nombreCorto } from "@/lib/nombre";

export default function DashboardPage() {
  const sesion = useSesion();
  const esAdmin = sesion?.rol === "admin";
  // El botón de la cabecera y la carga de datos viven en componentes distintos;
  // esto es el cable entre los dos.
  const recargarRef = useRef<(() => void) | null>(null);
  const [recargando, setRecargando] = useState(false);

  function actualizar() {
    setRecargando(true);
    recargarRef.current?.();
    setTimeout(() => setRecargando(false), 800);
  }

  // px-4 en el teléfono: los 24 px de margen a cada lado se comían 16 px de
  // las tarjetas, que es justo lo que le falta a un nombre largo para no
  // cortarse.
  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
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
            onClick={actualizar}
            disabled={recargando}
            className="flex items-center gap-2 bg-surface border border-gridline rounded-full px-4 py-2.5 text-sm font-medium text-ink-primary hover:bg-page disabled:opacity-50 shrink-0"
          >
            📅 {recargando ? "Actualizando…" : "Actualizar"} ⌄
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

      <MiDia esAdmin={esAdmin} recargar={(fn) => (recargarRef.current = fn)} />
    </main>
  );
}
