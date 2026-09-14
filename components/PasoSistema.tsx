"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Un paso del tablero, plegable.
 *
 * La pantalla tiene un orden que no es decorativo: quién escribió, si está
 * interesado, y si ya llegó al WhatsApp del agente. Con los módulos abiertos
 * uno nunca ve los tres títulos juntos y parecen tres cosas sueltas; plegados
 * quedan pegados y se lee como lo que es, un procedimiento de tres pasos.
 *
 * Los tres van del mismo color a propósito. Pintar uno distinto convierte un
 * índice en una alarma, y la urgencia ya la lleva el módulo de abajo.
 */

const AZUL = "#17457F";

export function PasoSistema({
  numero,
  titulo,
  detalle,
  resumen,
  abiertoPorDefecto = false,
  children,
}: {
  numero: number;
  titulo: string;
  detalle?: string;
  /** Lo que pasa en este paso, sin abrirlo: «5 pendientes», «2 calientes». */
  resumen?: { texto: string; fondo: string; color: string } | null;
  abiertoPorDefecto?: boolean;
  children: ReactNode;
}) {
  const clave = `op_paso_${numero}`;
  const [abierto, setAbierto] = useState(abiertoPorDefecto);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(clave);
      if (guardado !== null) setAbierto(guardado === "1");
    } catch {
      /* modo privado: queda el valor por defecto */
    }
  }, [clave]);

  function alternar() {
    setAbierto((v) => {
      try {
        localStorage.setItem(clave, v ? "0" : "1");
      } catch {
        /* modo privado */
      }
      return !v;
    });
  }

  return (
    <>
      <button
        onClick={alternar}
        aria-expanded={abierto}
        className={`w-full flex items-center gap-3.5 px-4 sm:px-5 py-3 text-left bg-surface border border-gridline hover:bg-page ${
          abierto ? "rounded-t-[18px] mb-0" : "rounded-[18px] mb-4 sm:mb-5"
        }`}
      >
        <span
          className="text-[34px] sm:text-[38px] font-light leading-none tracking-[-0.06em] tabular-nums shrink-0 w-[26px]"
          style={{ color: AZUL }}
        >
          {numero}
        </span>
        <span className="w-px h-9 shrink-0" style={{ background: "var(--gridline)" }} />
        <span className="min-w-0 flex-1">
          <span className="block text-[9.5px] font-bold uppercase tracking-[.18em]" style={{ color: AZUL }}>
            Paso {numero}
          </span>
          <span className="block text-[15px] sm:text-[16.5px] font-semibold tracking-[-0.025em] leading-tight text-balance">
            {titulo}
          </span>
          {detalle && (
            <span className="hidden sm:block text-[11.5px] text-ink-muted mt-0.5">{detalle}</span>
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
            className="text-[11px] font-bold rounded-full px-2.5 py-1 whitespace-nowrap shrink-0 hidden sm:inline"
            style={{ background: resumen.fondo, color: resumen.color }}
          >
            {resumen.texto}
          </span>
        )}
        <span className="text-[10px] text-ink-muted shrink-0">{abierto ? "▲" : "▼"}</span>
      </button>

      {/* El módulo va debajo del encabezado, pegado: sin el margen de arriba
          los dos se leen como una sola pieza. */}
      {abierto && (
        <div className="mb-4 sm:mb-5 [&>section]:rounded-t-none [&>section]:border-t-0 [&>section]:mb-0">
          {children}
        </div>
      )}
    </>
  );
}
