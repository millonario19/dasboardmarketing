"use client";

import { useEffect, useState } from "react";
import type { Sesion } from "@/lib/auth";

/**
 * Quién está adentro, para decidir qué muestra la pantalla: el nombre en la
 * barra, el enlace de usuarios, el selector de agente.
 *
 * Es solo presentación. Lo que un agente puede ver ya viene recortado del
 * servidor; esconder un botón acá no protege nada por sí solo.
 */
export function useSesion(): Sesion | null {
  const [sesion, setSesion] = useState<Sesion | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/sesion")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (vivo) setSesion(s);
      })
      .catch(() => {
        /* la pantalla funciona igual sin saber quién es */
      });
    return () => {
      vivo = false;
    };
  }, []);

  return sesion;
}
