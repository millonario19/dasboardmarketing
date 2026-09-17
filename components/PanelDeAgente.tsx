"use client";

import { useEffect, useState } from "react";
import type { AgentProduction } from "@/lib/metrics";
import type { Seguimiento } from "@/lib/seguimiento";
import type { Accion, ResumenDelDia } from "@/lib/acciones";

/**
 * El día de un agente, visto por su dirección.
 *
 * No es un informe: son los mismos datos que esa persona tiene delante, leídos
 * con las mismas consultas. Un informe aparte se desincroniza —y el día que no
 * cuadre, nadie sabe cuál de los dos miente—.
 *
 * Solo lectura, a propósito. Si el director pudiera confirmar una bajada o
 * reportar una llamada desde acá, esa acción quedaría guardada a su nombre y
 * el hilo del cliente diría que la hizo alguien que nunca habló con él. Lo que
 * la dirección necesita de esta pantalla es saber qué está pasando; actuar es
 * trabajo del agente.
 */

const AZUL = "#17457F";
const AZUL_HONDO = "#0E2E57";
const CELESTE = "#EAF1FA";
const VERDE = "#157F52";
const ROJO = "#C0392B";
const AMBAR = "#B5701F";
const GRIS = "#9A998F";
const GRIS_2 = "#5E5C56";

type Tareas = { vencidas: Accion[]; hoy: Accion[]; masAdelante: number; resumen: ResumenDelDia };

function cuando(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

function Franja({ texto }: { texto: string }) {
  return (
    <p
      className="px-4 sm:px-5 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] border-t border-gridline bg-page"
      style={{ color: GRIS }}
    >
      {texto}
    </p>
  );
}

function Linea({
  texto,
  detalle,
  derecha,
  color,
}: {
  texto: string;
  detalle?: string | null;
  derecha?: string;
  color?: string;
}) {
  return (
    <div className="flex gap-3 items-baseline px-4 sm:px-5 py-2 border-t border-gridline">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-tight">{texto}</span>
        {detalle && (
          <span className="block text-[11.5px] italic mt-0.5" style={{ color: GRIS_2 }}>
            «{detalle}»
          </span>
        )}
      </span>
      {derecha && (
        <span className="text-[11.5px] tabular-nums whitespace-nowrap" style={{ color: color ?? GRIS }}>
          {derecha}
        </span>
      )}
    </div>
  );
}

export function PanelDeAgente({ agentId, nombre }: { agentId: string; nombre: string }) {
  const [prod, setProd] = useState<AgentProduction | null>(null);
  const [seg, setSeg] = useState<Seguimiento | null>(null);
  const [tareas, setTareas] = useState<Tareas | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = `?agente=${encodeURIComponent(agentId)}`;
    const pedir = <T,>(ruta: string): Promise<T | null> =>
      fetch(ruta + q)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

    setProd(null);
    setSeg(null);
    setTareas(null);
    setError(null);

    pedir<AgentProduction>("/api/metrics/production").then(setProd);
    pedir<Seguimiento>("/api/seguimiento").then((d) => {
      setSeg(d);
      if (!d) setError("No se pudo leer el seguimiento de esta persona.");
    });
    pedir<Tareas>("/api/tareas").then(setTareas);
  }, [agentId]);

  const fila = prod?.rows.find((r) => r.agentId === agentId) ?? null;
  const hoy = seg?.hoy ?? [];
  const calientes = hoy.filter((l) => l.estado === "caliente").length;
  const sinLlamar = hoy.filter((l) => !l.enMiWhatsApp).length;
  const r = tareas?.resumen;

  return (
    <section className="rounded-[22px] overflow-hidden bg-surface border border-gridline mb-5">
      <div className="px-4 sm:px-5 py-3.5 flex items-center gap-3 flex-wrap" style={{ background: AZUL_HONDO, color: "#fff" }}>
        <span
          className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-[13px] font-bold"
          style={{ background: "rgba(255,255,255,.16)" }}
        >
          {(nombre.split(/\s+/)[0]?.[0] ?? "") + (nombre.split(/\s+/)[1]?.[0] ?? "")}
        </span>
        <span className="min-w-0">
          <span className="block text-[16px] font-semibold tracking-[-0.02em]">{nombre}</span>
          <span className="block text-[11.5px]" style={{ color: "rgba(255,255,255,.66)" }}>
            su día, tal como lo ve
          </span>
        </span>
        <span
          className="ml-auto text-[11px] rounded-full px-2.5 py-1 shrink-0"
          style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.28)" }}
        >
          👁 solo lectura
        </span>
      </div>

      {error && (
        <p className="px-4 sm:px-5 py-3 text-[13px]" style={{ color: ROJO }}>
          {error}
        </p>
      )}

      {/* El mes: lo mismo que la fila de la lista, para no tener que volver. */}
      <div className="flex flex-wrap border-t border-gridline">
        {[
          { l: "Leads del mes", v: fila?.leadsMes },
          { l: "Registros", v: fila?.registrosMes },
          { l: "FTD del mes", v: fila?.ftdMes, bueno: true },
          { l: "Leads hoy", v: fila?.leadsHoy },
          { l: "FTD hoy", v: fila?.ftdHoy, bueno: true },
        ].map((c) => (
          <div key={c.l} className="flex-1 min-w-[104px] px-4 sm:px-5 py-3 border-r border-gridline last:border-r-0">
            <span className="block text-[9.5px] font-bold uppercase tracking-[.14em]" style={{ color: GRIS }}>
              {c.l}
            </span>
            <div
              className="text-[23px] font-bold tracking-[-0.04em] leading-none tabular-nums mt-1"
              style={{ color: c.bueno && (c.v ?? 0) > 0 ? VERDE : undefined }}
            >
              {c.v ?? (prod === null ? "…" : 0)}
            </div>
          </div>
        ))}
      </div>

      {/* Los mismos cuatro pasos de Mi día, con lo que hay adentro de cada uno. */}
      <Franja texto="Sus cuatro pasos de hoy" />
      {seg === null ? (
        <p className="px-4 sm:px-5 py-3 text-[13px]" style={{ color: GRIS }}>
          Buscando su día…
        </p>
      ) : (
        <>
          <Linea
            texto="1 · Quién escribió hoy"
            derecha={`${hoy.length} ${hoy.length === 1 ? "lead" : "leads"}`}
          />
          <Linea
            texto="2 · Está interesado"
            derecha={calientes > 0 ? `${calientes} caliente${calientes === 1 ? "" : "s"}` : "ninguno caliente"}
            color={calientes > 0 ? ROJO : undefined}
          />
          <Linea
            texto="3 · WhatsApp Business"
            derecha={
              seg.porConfirmar.length > 0
                ? `${seg.porConfirmar.length} sin confirmar`
                : `${seg.enBusiness.length} en seguimiento`
            }
            color={seg.porConfirmar.length > 0 ? AMBAR : undefined}
          />
          <Linea
            texto="4 · Llamar a los nuevos"
            derecha={sinLlamar > 0 ? `${sinLlamar} sin bajar` : "todos bajados"}
            color={sinLlamar > 0 ? AMBAR : VERDE}
          />
        </>
      )}

      {/* Sus llamadas: es lo único de la pantalla que depende de que trabaje. */}
      {r && (
        <>
          <Franja texto="Sus llamadas de hoy" />
          <div className="flex flex-wrap">
            {[
              { l: "Llamadas", v: r.llamadas },
              { l: "No contestó", v: r.noContesto },
              { l: "Reprogramó", v: r.reprogramadas },
              { l: "Efectivas", v: r.efectivas, bueno: true },
              { l: "Se le pasaron", v: r.vencidas, malo: true },
            ].map((c) => (
              <div key={c.l} className="flex-1 min-w-[104px] px-4 sm:px-5 py-3 border-r border-gridline last:border-r-0">
                <span className="block text-[9.5px] font-bold uppercase tracking-[.14em]" style={{ color: GRIS }}>
                  {c.l}
                </span>
                <div
                  className="text-[21px] font-bold tracking-[-0.04em] leading-none tabular-nums mt-1"
                  style={{ color: c.malo && c.v > 0 ? ROJO : c.bueno && c.v > 0 ? VERDE : undefined }}
                >
                  {c.v}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Lo que dejó agendado: la única lista que el sistema no puede armar
          solo, y por eso la que dice si hay seguimiento de verdad. */}
      <Franja
        texto={`Lo que dejó programado${
          tareas ? ` · ${tareas.vencidas.length + tareas.hoy.length}` : ""
        }`}
      />
      {tareas === null && (
        <p className="px-4 sm:px-5 py-3 text-[13px]" style={{ color: GRIS }}>
          Buscando sus tareas…
        </p>
      )}
      {tareas && tareas.vencidas.length === 0 && tareas.hoy.length === 0 && (
        <p className="px-4 sm:px-5 py-3 text-[13px]" style={{ color: GRIS }}>
          No tiene nada programado para hoy.
          {tareas.masAdelante > 0 ? ` Tiene ${tareas.masAdelante} para más adelante.` : ""}
        </p>
      )}
      {tareas?.vencidas.map((t) => (
        <Linea
          key={t.id}
          texto={t.nombre || "Sin nombre"}
          detalle={t.detalle}
          derecha={`⏰ era ${cuando(t.venceEn!)}`}
          color={ROJO}
        />
      ))}
      {tareas?.hoy.map((t) => (
        <Linea
          key={t.id}
          texto={t.nombre || "Sin nombre"}
          detalle={t.detalle}
          derecha={cuando(t.venceEn!)}
          color={AMBAR}
        />
      ))}

      {/* Los de hoy, que es donde se ve si está llamando o dejando enfriar. */}
      {hoy.length > 0 && (
        <>
          <Franja texto={`Los leads que le entraron hoy · ${hoy.length}`} />
          {hoy.slice(0, 8).map((l) => (
            <Linea
              key={l.id}
              texto={l.nombre}
              detalle={l.nota?.nota ?? null}
              derecha={l.enMiWhatsApp ? "✓ ya lo bajó" : l.estado}
              color={l.enMiWhatsApp ? VERDE : l.estado === "caliente" ? ROJO : undefined}
            />
          ))}
          {hoy.length > 8 && (
            <p className="px-4 sm:px-5 py-2 text-[11.5px] border-t border-gridline" style={{ color: GRIS }}>
              y {hoy.length - 8} más
            </p>
          )}
        </>
      )}

      <p
        className="px-4 sm:px-5 py-2.5 text-[11.5px] border-t border-gridline"
        style={{ background: CELESTE, color: AZUL }}
      >
        Esto sale de las mismas consultas que usa su pantalla. Si acá aparece vacío, es porque
        está vacío allá.
      </p>
    </section>
  );
}
