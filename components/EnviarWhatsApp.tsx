"use client";

import { useState } from "react";
import { CANAL_NOMBRE } from "@/lib/ventana";
import type { LeadDeSeguimiento } from "@/lib/seguimiento";

/**
 * Escribirle al cliente desde el panel, con el texto de la casa ya puesto.
 *
 * Es lo que pidió el agente: mensajes automatizados que igual puede modificar.
 * Las dos mitades importan por igual. Sin el texto guardado, escribir treinta
 * mensajes al día a mano no lo hace nadie. Sin poder editarlo, el cliente
 * recibe algo que no tiene nada que ver con lo que acaba de preguntar, y eso
 * se nota y se pierde.
 *
 * Va aparte del compositor del día 2 y 3 porque no es lo mismo. Allá hay que
 * mirar la ventana de 24 horas y, si está cerrada, mandar una plantilla por un
 * flujo de GHL. Acá el cliente escribió hoy: la ventana está abierta, el texto
 * sale derecho y no hay plantilla que valga.
 */

const AZUL = "#17457F";
const CELESTE = "#EAF1FA";
const VERDE = "#157F52";
const VERDE_WA = "#1DA851";
const ROJO = "#C0392B";
const GRIS = "#9A998F";
const GRIS_2 = "#5E5C56";

/** Por dónde habla, en el nombre que usa la API de GHL. */
const TIPO_GHL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "IG",
  facebook: "FB",
  sms: "SMS",
};

/**
 * Volver a poner {nombre} antes de guardar el texto para todos.
 *
 * El agente edita un mensaje que ya dice «Hola David», y si se guardara así
 * el próximo frío recibiría un mensaje dirigido a David. Se escapa el nombre
 * porque estos vienen con emoji, paréntesis y signos que en una expresión
 * regular significan otra cosa —o la rompen.
 */
function conNombreDeVuelta(texto: string, nombre: string): string {
  const primero = nombre.trim().split(/\s+/)[0] ?? "";
  if (primero.length < 2) return texto;
  const escapado = primero.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Sin distinguir mayúsculas: el texto entra en minúscula como viene de GHL
  // y el agente lo suele capitalizar al editarlo.
  return texto.replace(new RegExp(escapado, "gi"), "{nombre}");
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

export function EnviarWhatsApp({
  lead,
  dia = 1,
  onEnviado,
}: {
  lead: LeadDeSeguimiento;
  /** Qué texto guardado se carga: «d1-tibio», «d2-frio»… */
  dia?: 1 | 2 | 3;
  onEnviado?: () => void;
}) {
  const [enviado, setEnviado] = useState(lead.enviadoHoy);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [guardarDefecto, setGuardarDefecto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canal = lead.ventana.canal;
  const canalNombre = canal ? CANAL_NOMBRE[canal] : null;
  // Por Instagram y Messenger se escribe sin teléfono; por WhatsApp y SMS no.
  const sePuede =
    !!canal && (canal === "instagram" || canal === "facebook" || !!lead.telefono);
  const clave = `d${dia}-${lead.estado}`;

  function abrir() {
    setAbierto(true);
    setError(null);
    if (texto) return;
    fetch("/api/mensajes")
      .then((r) => (r.ok ? r.json() : { mensajes: {} }))
      .then((d: { mensajes: Record<string, string> }) => {
        const primero = lead.nombre.trim().split(/\s+/)[0] ?? "";
        setTexto((d.mensajes[clave] ?? "").replace(/\{nombre\}/g, primero));
      })
      .catch(() => setTexto(""));
  }

  function enviar() {
    setEnviando(true);
    setError(null);
    const guardar = guardarDefecto
      ? fetch("/api/mensajes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Se guarda con {nombre} de vuelta: el texto es para todos, no para este.
          body: JSON.stringify({
            clave,
            texto: conNombreDeVuelta(texto, lead.nombre),
          }),
        }).catch(() => undefined)
      : Promise.resolve();

    guardar
      .then(() =>
        fetch("/api/seguimiento/enviar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: lead.id,
            dia,
            texto,
            tipo: canal ? TIPO_GHL[canal] : "WhatsApp",
            estado: lead.estado,
            nombre: lead.nombre,
            telefono: lead.telefono,
          }),
        })
      )
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo enviar");
        setEnviado(new Date().toISOString());
        setAbierto(false);
        onEnviado?.();
      })
      .catch((e) => setError(e.message))
      .finally(() => setEnviando(false));
  }

  if (enviado) {
    return (
      <span className="text-[11.5px] font-semibold" style={{ color: VERDE }}>
        ✓ le escribiste a las {hora(enviado)}
      </span>
    );
  }

  // Sin canal no se sabe por dónde habla: mejor ningún botón que uno que
  // manda al agente a un error de GHL.
  if (!sePuede) return null;

  /**
   * Ventana cerrada: acá no se manda texto libre.
   *
   * Pasadas 24 horas del último mensaje del cliente, Meta solo entrega
   * plantillas aprobadas —y no da error: simplemente no las entrega—. El botón
   * verde ahí sería una mentira. Pero esconderlo del todo era peor: el agente
   * abría el día 14, no veía con qué escribir y creía que faltaba la función.
   *
   * Así que se dice qué pasa y se manda al único lugar donde sí se puede: la
   * conversación en el CRM, que tiene las plantillas aprobadas a mano.
   */
  if (!lead.ventana.abierta) {
    return (
      <a
        href={lead.crmUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Pasaron más de 24 horas desde su último mensaje: Meta solo entrega plantillas aprobadas, y esas se mandan desde el CRM"
        className="inline-flex items-center gap-1 rounded-full min-h-[40px] sm:min-h-0 px-3.5 sm:px-2.5 py-[5px] text-[11.5px] font-semibold whitespace-nowrap"
        style={{ background: "var(--page)", color: GRIS_2, border: "1px solid var(--gridline)" }}
      >
        🔒 Ventana cerrada · escribirle en el CRM
      </a>
    );
  }

  if (!abierto) {
    return (
      <button
        onClick={abrir}
        className="rounded-full min-h-[40px] sm:min-h-0 px-4 sm:px-3 py-[5px] text-[11.5px] font-bold text-white whitespace-nowrap hover:opacity-90 inline-flex items-center"
        style={{ background: VERDE_WA }}
      >
        ✎ Escribirle por {canalNombre}
      </button>
    );
  }

  return (
    <div
      className="rounded-xl p-3 mt-1"
      style={{ background: CELESTE, border: "1px solid rgba(23,69,127,.14)" }}
    >
      <p className="text-[11px] mb-1.5" style={{ color: GRIS }}>
        Sale por el {canalNombre} de la oficina y queda en la conversación del CRM.
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        placeholder="Escríbale…"
        className="w-full rounded-lg border border-gridline bg-surface px-3 py-2 text-[13px] outline-none resize-y"
      />

      <label className="flex items-center gap-2 mt-2 text-[11.5px] cursor-pointer">
        <input
          type="checkbox"
          checked={guardarDefecto}
          onChange={(e) => setGuardarDefecto(e.target.checked)}
        />
        <span style={{ color: GRIS }}>
          Guardarlo como el texto de arranque para los{" "}
          <b>{lead.estado === "frio" ? "fríos" : `${lead.estado}s`}</b> del día {dia}
        </span>
      </label>

      {error && (
        <p className="text-[11.5px] mt-1.5" style={{ color: ROJO }}>
          {error}
        </p>
      )}

      <div className="flex gap-2 mt-2.5">
        <button
          onClick={() => setAbierto(false)}
          disabled={enviando}
          className="rounded-full px-3 py-1.5 text-[11.5px] disabled:opacity-50"
          style={{ background: "var(--surface)", color: AZUL, border: "1px solid rgba(23,69,127,.2)" }}
        >
          Cancelar
        </button>
        <button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          className="flex-1 rounded-full px-3 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-40"
          style={{ background: VERDE_WA }}
        >
          {enviando ? "Enviando…" : `Enviar por ${canalNombre}`}
        </button>
      </div>
    </div>
  );
}
