"use client";

import type { ReactNode } from "react";

/**
 * Un paso del recorrido.
 *
 * Los cuatro pasos son un procedimiento, pero la pantalla los trataba como
 * cajones sueltos: cada uno se abría y se cerraba por su cuenta, se podían
 * abrir dos a la vez, y al terminar uno había que acordarse de cerrarlo y
 * abrir el siguiente. En un teléfono —donde pasa el 90% del uso— eso es mucho
 * trabajo para leer cuatro títulos.
 *
 * Ahora hay uno solo abierto y lo decide la pantalla de arriba, que es la que
 * sabe cuál tiene trabajo. Este componente ya no recuerda nada: recibe si le
 * toca estar abierto y avisa cuando lo tocan.
 */

const AZUL = "#17457F";

export function PasoSistema({
  numero,
  titulo,
  detalle,
  resumen,
  abierto,
  hecho = false,
  onAlternar,
  onSiguiente,
  textoSiguiente,
  children,
}: {
  numero: number;
  titulo: string;
  detalle?: string;
  /** Lo que pasa en este paso, sin abrirlo: «5 pendientes», «2 calientes». */
  resumen?: { texto: string; fondo: string; color: string } | null;
  abierto: boolean;
  /** Ya no tiene nada pendiente: se apaga y muestra su visto. */
  hecho?: boolean;
  onAlternar: () => void;
  /** Cierra este y abre el que sigue. Sin esto no se dibuja el botón. */
  onSiguiente?: () => void;
  textoSiguiente?: string;
  children: ReactNode;
}) {
  const alternar = onAlternar;

  return (
    <>
      <button
        onClick={alternar}
        aria-expanded={abierto}
        className={`w-full flex items-center gap-3.5 md:gap-5 px-4 sm:px-5 md:px-7 py-3.5 sm:py-3 md:py-5 text-left bg-surface border hover:bg-page ${
          abierto ? "rounded-t-[18px] md:rounded-t-[22px] mb-0" : "rounded-[18px] md:rounded-[22px] mb-3 sm:mb-4 md:mb-5"
        }`}
        style={
          abierto
            ? { borderColor: AZUL, boxShadow: `0 0 0 2px ${AZUL}1a` }
            : { borderColor: "var(--gridline)", opacity: hecho ? 0.62 : 1 }
        }
      >
        <span
          className="text-[34px] sm:text-[38px] md:text-[48px] font-light leading-none tracking-[-0.06em] tabular-nums shrink-0 w-[26px] md:w-[36px]"
          style={{ color: AZUL }}
        >
          {numero}
        </span>
        <span className="w-px h-9 md:h-12 shrink-0" style={{ background: "var(--gridline)" }} />
        <span className="min-w-0 flex-1">
          <span className="block text-[9.5px] md:text-[11px] font-bold uppercase tracking-[.18em]" style={{ color: AZUL }}>
            Paso {numero}
          </span>
          <span className="block text-[15px] sm:text-[16.5px] md:text-[21px] font-semibold tracking-[-0.025em] leading-tight text-balance">
            {titulo}
          </span>
          {detalle && (
            <span className="hidden sm:block text-[11.5px] md:text-[13.5px] text-ink-muted mt-0.5 md:mt-1">{detalle}</span>
          )}
          {/* En el teléfono el resumen no cabe al lado del título: puesto en la
              fila le dejaba 113 px y el título se partía en tres renglones.
              Debajo ocupa un renglón propio y se lee de un vistazo. */}
          {resumen && (
            <span
              className="sm:hidden inline-block text-[10.5px] font-bold rounded-full px-2 py-[3px] whitespace-nowrap mt-1.5"
              style={{ background: resumen.fondo, color: resumen.color }}
            >
              {resumen.texto}
            </span>
          )}
        </span>
        {resumen && (
          <span
            className="text-[11px] md:text-[13px] font-bold rounded-full px-2.5 md:px-3.5 py-1 md:py-1.5 whitespace-nowrap shrink-0 hidden sm:inline"
            style={{ background: resumen.fondo, color: resumen.color }}
          >
            {resumen.texto}
          </span>
        )}
        <span className="text-[10px] md:text-[13px] text-ink-muted shrink-0">{abierto ? "▲" : "▼"}</span>
      </button>

      {/* El módulo va debajo del encabezado, pegado: sin el margen de arriba
          los dos se leen como una sola pieza. */}
      {abierto && (
        <div
          className="mb-3 sm:mb-4 md:mb-5 rounded-b-[18px] md:rounded-b-[22px] border border-t-0 border-gridline overflow-hidden [&>section]:rounded-none [&>section]:border-0 [&>section]:mb-0"
          style={{ borderColor: AZUL, boxShadow: `0 0 0 2px ${AZUL}1a` }}
        >
          {children}
          {/* Cerrar este y abrir el que sigue, de un toque.
              Sin esto el agente termina un paso y tiene que acordarse de
              plegarlo y desplegar el otro: dos toques y un scroll para algo
              que la pantalla ya sabe. */}
          {onSiguiente && (
            <button
              onClick={onSiguiente}
              className="block w-full text-center text-white px-4 py-3.5 md:py-4 text-[15px] md:text-[17px] font-bold active:scale-[.995] transition-transform"
              style={{ background: AZUL }}
            >
              {textoSiguiente ?? "Listo, siguiente →"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
