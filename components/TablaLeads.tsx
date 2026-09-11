"use client";

import { ESTADO_META, type EstadoLead } from "@/lib/leadStates";
import { BotonLlamar, BotonWhatsApp, formatearTelefono } from "@/components/ContactoRapido";
import { Inicial } from "@/components/EscalaEmbudo";
import type { Bloque, LeadItem } from "@/lib/miDia";

const GRIS = "#8E8E88";
const GRIS_2 = "#5A5A54";
const NEGRO = "#0D0D0D";
const LIMA = "#C6F24E";

type Tono = { c: string; sob: string; fuerte: string };

/**
 * Color de cada bloque.
 *
 * Los tres de temperatura son exactamente los de Dirección: un mismo lead no
 * puede verse naranja en una pantalla y rojo en la otra.
 *
 * Rescates va en azul aunque sus leads hayan respondido alguna vez: un rescate
 * es, por definición, alguien que terminó enfriándose.
 */
const TONO: Record<string, Tono> = {
  movimiento: { c: NEGRO, sob: LIMA, fuerte: NEGRO },
  caliente: { c: ESTADO_META.caliente.color, sob: ESTADO_META.caliente.sobre, fuerte: ESTADO_META.caliente.fuerte },
  tibio: { c: ESTADO_META.tibio.color, sob: ESTADO_META.tibio.sobre, fuerte: ESTADO_META.tibio.fuerte },
  frio: { c: ESTADO_META.frio.color, sob: ESTADO_META.frio.sobre, fuerte: ESTADO_META.frio.fuerte },
  rescate: { c: ESTADO_META.frio.color, sob: ESTADO_META.frio.sobre, fuerte: ESTADO_META.frio.fuerte },
};

// Solo estos dos bloques mezclan temperaturas. En los otros, una columna que
// repite "Caliente" en cada renglón no agrega nada: ya lo dice la franja.
const CON_TEMPERATURA = new Set(["movimiento", "rescate"]);

function hora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function horaDeHoy(ms: number, esDeHoy: boolean): string {
  const t = new Date(ms).toLocaleString("es-CO", { hour: "numeric", minute: "2-digit" });
  return esDeHoy ? `hoy, ${t}` : hora(new Date(ms).toISOString());
}

/** Qué fue lo último que hizo el lead, y cuándo exactamente. */
function ultimaInteraccion(lead: LeadItem): { que: string; cuando: string } {
  if (lead.movimiento) {
    return {
      que: lead.movimiento.que,
      cuando: `${horaDeHoy(lead.movimiento.cuandoMs, !lead.movimiento.esRescate || lead.dias === 0)} · ${lead.movimiento.cuando}`,
    };
  }
  // Sin movimiento registrado, lo último que sabemos es su recorrido y el
  // momento en que entró.
  const que = lead.acciones.length > 0 ? lead.acciones[lead.acciones.length - 1] : "Solo entró, sin responder";
  const edad = lead.dias === 0 ? "hoy" : lead.dias === 1 ? "hace 1 día" : `hace ${lead.dias} días`;
  return { que, cuando: `${hora(lead.creado)} · ${edad}` };
}

/**
 * Qué tiene que hacer el agente con este lead.
 *
 * Va como texto y no como etiqueta de color: en una lista de cuarenta filas,
 * cuarenta píldoras de colores compiten con todo lo demás y dejan de leerse.
 */
function siguientePaso(lead: LeadItem, bloque: string): string {
  if (lead.acciones.includes("Se registró")) return "Cerrar el primer depósito";
  if (bloque === "rescate") return "Retomar — nunca bajó a WhatsApp";
  if (lead.estado === "caliente") return "Falta el registro";
  if (lead.estado === "tibio") return "Falta bajarlo a WhatsApp";
  return lead.dias === 0 ? "Escribile, es nuevo" : "Nunca respondió — escribile";
}

function PildoraTemperatura({ estado }: { estado: EstadoLead }) {
  const meta = ESTADO_META[estado];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full whitespace-nowrap"
      style={{
        background: meta.color,
        color: meta.sobre,
        padding: "2.5px 9px 2.5px 8px",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {meta.nombre}
    </span>
  );
}

function Acciones({ lead, crm }: { lead: LeadItem; crm: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 justify-end">
      <BotonLlamar telefono={lead.telefono} nombre={lead.nombre} tamano={32} />
      <BotonWhatsApp telefono={lead.telefono} nombre={lead.nombre} tamano={32} />
      <a
        href={crm}
        target="_blank"
        rel="noreferrer"
        title="Abrir en el CRM"
        aria-label={`Abrir ${lead.nombre} en el CRM`}
        className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] shrink-0 hover:opacity-80"
        style={{ background: "rgba(13,13,13,.05)", color: GRIS_2 }}
      >
        ↗
      </a>
    </span>
  );
}

function Quien({ lead, estado }: { lead: LeadItem; estado: EstadoLead }) {
  const meta = ESTADO_META[estado];
  return (
    <span className="flex items-center gap-2.5 min-w-0">
      <Inicial nombre={lead.nombre} color={meta.fuerte} tamano={34} />
      <span className="min-w-0">
        <span
          className="block text-[14px] font-bold tracking-[-0.015em] leading-tight truncate max-w-[200px]"
          title={lead.nombre}
        >
          {lead.nombre}
        </span>
        {lead.telefono ? (
          <a
            href={`tel:${lead.telefono.replace(/\s/g, "")}`}
            className="block text-[12px] tabular-nums hover:text-ink-primary"
            style={{ color: GRIS_2, fontFamily: "Arial, Helvetica, sans-serif" }}
          >
            {formatearTelefono(lead.telefono)}
          </a>
        ) : (
          <span className="block text-[12px]" style={{ color: GRIS, fontFamily: "Arial, Helvetica, sans-serif" }}>
            Sin teléfono
          </span>
        )}
      </span>
    </span>
  );
}

export function TablaLeads({ bloque, locationId }: { bloque: Bloque; locationId: string }) {
  if (bloque.total === 0) return null;

  const tono = TONO[bloque.tono] ?? TONO.frio;
  const conTemp = CON_TEMPERATURA.has(bloque.id);
  const crmDe = (id: string) => `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${id}`;

  const columnas = [
    ...(conTemp ? ["Temperatura"] : []),
    "Lead",
    "Última interacción",
    "Siguiente paso",
    "Acciones",
  ];

  return (
    <section style={{ ["--c" as string]: tono.c }}>
      {/* El nombre del bloque va afuera del panel: adentro solo datos, y así
          la franja de color ocupa la mitad. */}
      <div className="flex items-baseline gap-2.5 flex-wrap px-1 pb-2.5">
        <h3 className="text-[16px] font-extrabold tracking-[-0.025em]">{bloque.titulo}</h3>
        <span
          className="text-[12px] font-bold tabular-nums pb-px"
          style={{ color: GRIS_2, borderBottom: `2px solid ${tono.c}` }}
        >
          {bloque.total} leads
        </span>
        <span className="text-[12.5px]" style={{ color: GRIS, fontFamily: "Arial, Helvetica, sans-serif" }}>
          {bloque.subtitulo}
        </span>
      </div>

      <div
        className="rounded-[22px] overflow-hidden"
        style={{
          background:
            "linear-gradient(168deg, rgba(255,255,255,.88) 0%, rgba(255,255,255,.56) 55%, rgba(255,255,255,.34) 100%)",
          backdropFilter: "blur(18px) saturate(1.5)",
          WebkitBackdropFilter: "blur(18px) saturate(1.5)",
          border: "1px solid rgba(255,255,255,.62)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.9), 0 2px 6px rgba(13,13,13,.035), 0 24px 46px -24px rgba(13,13,13,.36)",
        }}
      >
        {/* Escritorio: una fila por lead. */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 760 }}>
            <thead>
              {/* El color va en la fila y no en cada celda: con border-collapse
                  los fondos por celda dejan hilos asomando entre columnas. */}
              <tr style={{ background: tono.c }}>
                <th style={{ width: 2, padding: 0 }} />
                {columnas.map((c) => (
                  <th
                    key={c}
                    className="text-left px-3.5 py-[7px] text-[9.5px] font-bold uppercase tracking-[.10em] whitespace-nowrap"
                    style={{
                      color: `color-mix(in srgb, ${tono.sob} 72%, transparent)`,
                      textAlign: c === "Acciones" ? "right" : "left",
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloque.items.map((l) => {
                const meta = ESTADO_META[l.estado];
                const ultima = ultimaInteraccion(l);
                return (
                  <tr key={l.id} className="border-b last:border-b-0" style={{ borderColor: "rgba(13,13,13,.045)" }}>
                    <td style={{ width: 2, padding: 0 }}>
                      <span style={{ display: "block", width: 2, height: 40, background: meta.color }} />
                    </td>
                    {conTemp && (
                      <td className="px-3.5 py-2.5">
                        <PildoraTemperatura estado={l.estado} />
                      </td>
                    )}
                    <td className="px-3.5 py-2.5">
                      <Quien lead={l} estado={l.estado} />
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="text-[13px] font-bold tracking-[-0.01em] whitespace-nowrap first-letter:uppercase">{ultima.que}</div>
                      <div
                        className="text-[11.5px] mt-px tabular-nums whitespace-nowrap"
                        style={{ color: GRIS, fontFamily: "Arial, Helvetica, sans-serif" }}
                      >
                        {ultima.cuando}
                      </div>
                    </td>
                    {/* Sin whitespace-nowrap: un paso largo estiraba la tabla
                        hasta empujar los botones fuera de la pantalla. */}
                    <td className="px-3.5 py-2.5">
                      <span
                        className="text-[13px] leading-snug"
                        style={{ color: meta.fuerte, fontFamily: "Arial, Helvetica, sans-serif", minWidth: 130, display: "inline-block" }}
                      >
                        {siguientePaso(l, bloque.id)}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap" style={{ width: "1%" }}>
                      <Acciones lead={l} crm={crmDe(l.id)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Celular: la fila se apila. Sin encabezado de columnas, una línea del
            color arriba mantiene la identidad del bloque. */}
        <div className="md:hidden" style={{ borderTop: `3px solid ${tono.c}` }}>
          {bloque.items.map((l) => {
            const meta = ESTADO_META[l.estado];
            const ultima = ultimaInteraccion(l);
            return (
              <div key={l.id} className="flex border-b last:border-b-0" style={{ borderColor: "rgba(13,13,13,.045)" }}>
                <span className="shrink-0" style={{ width: 3, background: meta.color }} />
                <div className="flex-1 min-w-0 px-3.5 py-3">
                  {conTemp && (
                    <div className="mb-2">
                      <PildoraTemperatura estado={l.estado} />
                    </div>
                  )}
                  <div className="flex items-center gap-2.5">
                    <Quien lead={l} estado={l.estado} />
                    <span className="ml-auto">
                      <Acciones lead={l} crm={crmDe(l.id)} />
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                    <span className="text-[13px] font-bold tracking-[-0.01em] first-letter:uppercase">{ultima.que}</span>
                    <span
                      className="text-[11.5px] tabular-nums"
                      style={{ color: GRIS, fontFamily: "Arial, Helvetica, sans-serif" }}
                    >
                      {ultima.cuando}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 text-[13px] leading-snug"
                    style={{ color: meta.fuerte, fontFamily: "Arial, Helvetica, sans-serif" }}
                  >
                    {siguientePaso(l, bloque.id)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {bloque.total > bloque.items.length && (
        <p className="text-[12.5px] mt-2.5 px-1" style={{ color: GRIS }}>
          Se muestran {bloque.items.length} de {bloque.total}. Atendé estos primero.
        </p>
      )}
    </section>
  );
}
