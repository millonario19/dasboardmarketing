"use client";

import Link from "next/link";
import { EquipoComercial } from "@/components/EquipoComercial";
import { CambiarVista } from "@/components/CambiarVista";
import { CerrarSesion } from "@/components/CerrarSesion";
import { useSesion } from "@/components/useSesion";
import { nombreCorto } from "@/lib/nombre";

/**
 * La pantalla de la dirección.
 *
 * Es la única que no habla de un día: habla de personas. El admin entra y ve
 * sus cuatro oficinas; un director entra y ve a su gente. Los dos abren a
 * cualquiera para mirar qué está pasando ahí adentro.
 *
 * Vive aparte de Métricas a propósito. Métricas responde «cómo vamos»;
 * esta responde «quién», que es la única de las dos sobre la que la dirección
 * puede hacer algo hoy mismo.
 */
export default function EquipoPage() {
  const sesion = useSesion();
  const puedeVer = sesion?.rol === "admin" || sesion?.rol === "director";

  return (
    <main className="max-w-[960px] mx-auto px-6 py-8">
      <div className="flex flex-col items-center text-center gap-3 mb-7 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:text-left sm:gap-4">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
          <h1 className="text-[21px] sm:text-[25px] font-semibold text-ink-primary tracking-tight leading-[1.15]">
            Mi equipo
          </h1>
          {sesion && (
            <span className="text-sm text-ink-secondary bg-surface border border-gridline rounded-full px-3 py-1.5">
              {sesion.rol === "admin" ? "Alejandro Facundo" : nombreCorto(sesion.nombre)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
          <CambiarVista actual="equipo" />
          {sesion?.rol === "admin" && (
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

      {/* Mientras carga la sesión no se decide nada: mostrar el «no podés» a
          quien sí puede, aunque sea por medio segundo, es peor que esperar. */}
      {sesion && !puedeVer && (
        <p className="text-[13.5px] text-ink-secondary">
          Esta pantalla es de la dirección. Su panel de trabajo es <b>Mi día</b>.
        </p>
      )}

      {puedeVer && <EquipoComercial />}
    </main>
  );
}
