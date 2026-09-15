"use client";

import { useState } from "react";
import { ESTADO_META } from "@/lib/leadStates";
import { BotonWhatsApp } from "@/components/ContactoRapido";
import { BotonLlamar } from "@/components/Llamada";
import { FichaCliente } from "@/components/FichaCliente";
import { metaTipo } from "@/lib/tiposAccion";
import type { LeadDeSeguimiento } from "@/lib/seguimiento";

/**
 * Una fila por cliente: quién es, qué le toca, y a un toque todo lo que pasó.
 *
 * Antes la fila traía el formulario entero —un texto, una acción, una fecha—
 * y los tres se pisaban entre sí. Ahora la fila solo muestra la próxima tarea,
 * que es lo único que hay que saber para decidir a quién atender; escribir se
 * hace adentro, en la ficha, donde el historial está a la vista.
 *
 * Y cuando no hay tarea la fila lo dice en rojo. No es un hueco cosmético: un
 * cliente sin próxima tarea es un cliente que se muere solo.
 */

const AZUL = "#17457F";
const CELESTE = "#EAF1FA";
const VERDE = "#157F52";
const ROJO = "#C0392B";
const ROJO_CLARO = "#FDF2F0";
const VERDE_WA = "#1DA851";
const AMBAR = "#B5701F";
const AMBAR_CLARO = "#FDF3E6";
const VERDE_CLARO = "#EEF7F2";
const GRIS = "#9A998F";
const GRIS_2 = "#5E5C56";

// La hora de la ventana a la que sale el seguimiento. El número vive también
// en lib/ventana; acá va suelto porque ese módulo habla con GHL y traerlo al
// navegador arrastra medio servidor al paquete.
const HORA_DE_ENVIO = 20;

// El diagnóstico del lead, en dos palabras. Va junto a las acciones: la
// temperatura dice cuánto interés hay, esto dice por dónde se trabó.
const VIA_CORTA: Record<string, string> = {
  llego: "llegó al Business",
  "clic-sin-llegar": "hizo clic y no llegó",
  "tibio-sin-bajar": "no bajó",
  "no-responde": "no responde",
};

function cuando(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
  const suyo = new Date(d.getTime() - 5 * 3600e3).toISOString().slice(0, 10);
  const hora = d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
  if (suyo === hoy) return `hoy ${hora}`;
  return `${d.toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" })} ${hora}`;
}

export function FilaSeguimiento({
  lead,
  pie,
  onCerrado,
  dia,
}: {
  lead: LeadDeSeguimiento;
  pie?: string;
  /** Al cerrar el seguimiento la fila se va de la lista de arriba. */
  onCerrado?: (id: string) => void;
  /** Día del embudo, si esta fila está en una pestaña que manda seguimiento. */
  dia?: 2 | 3;
}) {
  const meta = ESTADO_META[lead.estado];
  const [abierta, setAbierta] = useState(false);
  const [tarea, setTarea] = useState(lead.tarea);
  const [enviado, setEnviado] = useState(lead.enviadoHoy);
  const [enviando, setEnviando] = useState(false);
  const [falloEnvio, setFalloEnvio] = useState<string | null>(null);

  function enviarSeguimiento() {
    setEnviando(true);
    setFalloEnvio(null);
    fetch("/api/seguimiento/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: lead.id,
        dia,
        estado: lead.estado,
        nombre: lead.nombre,
        telefono: lead.telefono,
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo mandar");
        setEnviado(new Date().toISOString());
      })
      .catch((e) => setFalloEnvio(e.message))
      .finally(() => setEnviando(false));
  }

  const via = VIA_CORTA[lead.via];
  const contexto = lead.acciones.length > 0 ? lead.acciones.join(" · ") : "Todavía no hizo nada";
  const vencida = tarea?.venceEn ? new Date(tarea.venceEn) < new Date() : false;

  return (
    <>
      <article className="flex gap-3 px-4 sm:px-5 py-2.5 border-t border-gridline items-start">
        <i className="w-[3px] rounded-full shrink-0 self-stretch" style={{ background: meta.color }} />

        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold leading-tight">{lead.nombre}</span>
          <span className="block text-[11.5px] mt-0.5" style={{ color: GRIS }}>
            {via && (
              <b className="font-semibold" style={{ color: meta.color }}>
                {via}
              </b>
            )}
            {via && " · "}
            {contexto}
          </span>
          {/* En la lista de «en mi WhatsApp Business» acá va desde cuándo lo
              tiene: es el reloj que manda la cadencia del seguimiento. */}
          {pie && (
            <span className="block text-[11px] font-semibold mt-0.5" style={{ color: VERDE }}>
              {pie}
            </span>
          )}

          {tarea ? (
            <span
              className="block text-[11.5px] mt-1.5 pl-2"
              style={{ borderLeft: `2px solid ${vencida ? ROJO : AZUL}`, color: vencida ? ROJO : GRIS_2 }}
            >
              {vencida && "⏰ "}
              <b className="font-semibold">{metaTipo(tarea.tipo).tarea}</b>
              {" — "}
              <b className="tabular-nums font-semibold">
                {vencida ? "era " : ""}
                {cuando(tarea.venceEn!)}
              </b>
              {tarea.detalle && <> · «{tarea.detalle}»</>}
            </span>
          ) : (
            <button
              onClick={() => setAbierta(true)}
              className="block text-[11.5px] mt-1.5 text-left"
              style={{ color: ROJO }}
            >
              Sin próximo paso · <b className="font-semibold underline">ponele una tarea</b>
            </button>
          )}

          {/* La ventana de Meta. Se muestra solo donde se puede mandar algo:
              en el paso 2 el seguimiento es a mano y el dato sobra. */}
          {dia && <EstadoVentana lead={lead} dia={dia} enviado={enviado} />}
          {falloEnvio && (
            <span className="block text-[11px] mt-1" style={{ color: ROJO }}>
              {falloEnvio}
            </span>
          )}
        </span>

        <span className="flex items-center gap-1.5 shrink-0">
          {dia && !enviado && lead.ventana.abierta && (
            <button
              onClick={enviarSeguimiento}
              disabled={enviando}
              title={`Pone la etiqueta seg-d${dia}-${lead.estado === "frio" ? "frio" : lead.estado} y el flujo manda el mensaje`}
              className="rounded-full px-2.5 py-[3px] text-[11px] font-semibold disabled:opacity-40 hover:opacity-70 whitespace-nowrap"
              style={{ border: `1px solid ${meta.color}`, color: meta.color, background: "transparent" }}
            >
              {enviando ? "Mandando…" : dia === 2 ? "↗ Enviar" : "↗ Plantilla"}
            </button>
          )}
          <button
            onClick={() => setAbierta((v) => !v)}
            className="rounded-full px-2.5 py-[3px] text-[11px] font-semibold"
            style={{ background: CELESTE, color: AZUL }}
          >
            {abierta ? "Cerrar" : "Ver"}
          </button>
          <BotonLlamar telefono={lead.telefono} nombre={lead.nombre} contactId={lead.id} tamano={26} />
          <BotonWhatsApp telefono={lead.telefono} nombre={lead.nombre} tamano={26} />
        </span>
      </article>

      {abierta && (
        <FichaCliente
          contactId={lead.id}
          nombre={lead.nombre}
          telefono={lead.telefono}
          onCambio={(cerrado) => {
            if (cerrado) {
              onCerrado?.(lead.id);
              return;
            }
            // La tarea de la fila se refresca sola: el seguimiento se guarda en
            // caché un minuto en el servidor y recargarlo devolvería la vieja.
            fetch(`/api/acciones/${encodeURIComponent(lead.id)}`)
              .then((r) => (r.ok ? r.json() : { hilo: [] }))
              .then((d: { hilo: LeadDeSeguimiento["tarea"][] }) => {
                const abierta = (d.hilo as NonNullable<LeadDeSeguimiento["tarea"]>[])
                  .filter((a) => a.venceEn && !a.hechaEn && !a.cerradaEn)
                  .sort((a, b) => a.venceEn!.localeCompare(b.venceEn!))[0];
                setTarea(abierta ?? null);
              })
              .catch(() => undefined);
          }}
        />
      )}
    </>
  );
}

/**
 * Cuánto le queda de ventana, en una línea.
 *
 * Es el dato que decide si el mensaje sale gratis o cuesta una plantilla, y el
 * agente lo tiene que ver antes de tocar el botón — no después, cuando Meta ya
 * rechazó el envío en silencio.
 */
function EstadoVentana({
  lead,
  dia,
  enviado,
}: {
  lead: LeadDeSeguimiento;
  dia: 2 | 3;
  enviado: string | null;
}) {
  const v = lead.ventana;

  if (enviado) {
    return (
      <span
        className="inline-block text-[10.5px] font-bold rounded-full px-2 py-[2px] mt-1.5"
        style={{ background: VERDE_CLARO, color: VERDE }}
      >
        ✓ seguimiento enviado {new Date(enviado).toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Bogota",
        })}
      </span>
    );
  }

  if (v.horas === null) {
    return (
      <span className="block text-[11px] mt-1.5" style={{ color: GRIS }}>
        Nunca escribió: no hay ventana abierta y Meta no deja mandar nada.
      </span>
    );
  }

  const horas = Math.floor(v.horas);
  if (!v.abierta) {
    return (
      <span
        className="inline-block text-[10.5px] font-bold rounded-full px-2 py-[2px] mt-1.5"
        style={{ background: ROJO_CLARO, color: ROJO }}
      >
        ✕ ventana cerrada hace {horas - 24} h · {dia === 2 ? "va mañana con plantilla" : "hace falta plantilla"}
      </span>
    );
  }

  const faltan = Math.max(Math.ceil(24 - v.horas), 0);
  const urge = v.porCerrarse;
  return (
    <span
      className="inline-block text-[10.5px] font-bold rounded-full px-2 py-[2px] mt-1.5"
      style={
        urge
          ? { background: ROJO_CLARO, color: ROJO }
          : { background: AMBAR_CLARO, color: AMBAR }
      }
    >
      {urge ? "⏰ " : ""}
      hora {horas} · cierra en {faltan} h
      {!urge && ` · se manda a la ${HORA_DE_ENVIO}`}
    </span>
  );
}
