"use client";

import { useEffect, useState, type ReactNode } from "react";
import { mirarA } from "@/lib/mirando";

/**
 * Abrir el panel en nombre de otra persona.
 *
 * Adentro de esto, todo lo que la pantalla le pregunte al servidor va firmado
 * con el agente que se está mirando. El envoltorio lo consigue interceptando
 * `fetch` mientras está montado, y no editando las treinta llamadas que hay
 * repartidas por los componentes: esas llamadas son las mismas que usa el
 * agente en su propia pantalla, y duplicarlas para agregarles un parámetro
 * habría dejado dos caminos que con el tiempo se separan.
 *
 * Solo toca las rutas propias que empiezan por `/api/`, y se desarma al salir.
 *
 * La seguridad no está acá. Esto agrega un parámetro; quién puede mirar a
 * quién lo decide el servidor contra la base, en `lib/verComo`. Un agente que
 * fuerce el valor sigue viendo lo suyo.
 */

const original = typeof window !== "undefined" ? window.fetch.bind(window) : null;

function conAgente(url: string, agentId: string): string {
  if (!url.startsWith("/api/")) return url;
  // Si ya viene firmado —el panel de solo lectura lo hace— no se firma dos veces.
  if (/[?&]agente=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}agente=${encodeURIComponent(agentId)}`;
}

export function MirandoA({ agentId, children }: { agentId: string; children: ReactNode }) {
  // Los hijos no se montan hasta que el parche esté puesto: los efectos de un
  // hijo corren antes que los del padre, así que montarlos primero los dejaría
  // pedir sus datos sin firmar y mostrar los del director por un instante.
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!original) return;
    mirarA(agentId);
    window.fetch = ((entrada: RequestInfo | URL, init?: RequestInit) => {
      if (typeof entrada === "string") return original(conAgente(entrada, agentId), init);
      if (entrada instanceof Request && entrada.url.startsWith(window.location.origin)) {
        const ruta = entrada.url.slice(window.location.origin.length);
        if (ruta.startsWith("/api/")) {
          return original(new Request(conAgente(ruta, agentId), entrada), init);
        }
      }
      return original(entrada, init);
    }) as typeof window.fetch;
    setListo(true);

    return () => {
      window.fetch = original;
      mirarA(null);
    };
  }, [agentId]);

  if (!listo) {
    return (
      <p className="text-[13px] text-ink-secondary px-1 py-6">Abriendo su panel…</p>
    );
  }

  return <>{children}</>;
}
