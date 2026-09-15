"use client";

import { useState } from "react";
import { ESTADO_META } from "@/lib/leadStates";
import { BotonWhatsApp } from "@/components/ContactoRapido";
import { BotonLlamar } from "@/components/Llamada";
import { FichaCliente } from "@/components/FichaCliente";
import { metaTipo } from "@/lib/tiposAccion";
import { olvidarSeguimiento } from "@/components/Seguimiento";
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

/**
 * Cuándo entró el lead, con fecha, hora y cuánto lleva.
 *
 * En una pestaña que se llama «Día 2» el agente no tiene forma de saber de qué
 * fecha habla, y con tres pestañas abiertas los leads se le mezclan. La fecha
 * completa en cada fila cuesta un renglón y saca la duda de raíz.
 */
function llegada(iso: string): string {
  const d = new Date(iso);
  const fecha = d.toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Bogota",
  });
  const hora = d.toLocaleTimeString("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
  const dias = Math.floor(
    (new Date(new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10)).getTime() -
      new Date(new Date(d.getTime() - 5 * 3600e3).toISOString().slice(0, 10)).getTime()) /
      864e5
  );
  const cuanto = dias <= 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
  return `entró ${fecha}, ${hora} · ${cuanto}`;
}

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

/** La marca de WhatsApp: el agente reconoce el canal antes de leer nada. */
function IconoWhatsApp() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.17c-.25.69-1.44 1.32-1.99 1.36-.53.04-1.02.23-3.44-.72-2.9-1.14-4.73-4.1-4.87-4.29-.14-.19-1.16-1.54-1.16-2.94s.73-2.09.99-2.37c.26-.29.57-.36.76-.36l.54.01c.17 0 .41-.07.64.49.24.58.81 2 .88 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.47l-.42.49c-.14.14-.28.29-.12.57.16.29.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.17-.19.69-.8.87-1.08.19-.29.37-.24.62-.14.25.09 1.6.75 1.87.89.28.14.46.21.53.33.07.12.07.67-.18 1.36Z" />
    </svg>
  );
}

/** Ir a la ficha en GHL, a ver la conversación de verdad. */
function IrAlCrm({ url, texto = false }: { url: string; texto?: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Ver la conversación en el CRM"
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold hover:opacity-80 whitespace-nowrap ${
        texto ? "px-3 py-1.5 text-[12px]" : "px-2.5 py-[3px] text-[11px]"
      }`}
      style={{ background: CELESTE, color: AZUL, border: "1px solid rgba(23,69,127,.18)" }}
    >
      <span aria-hidden>↗</span>
      {texto ? "Ver en el CRM" : "CRM"}
    </a>
  );
}

export function FilaSeguimiento({
  lead,
  pie,
  onCerrado,
  dia,
  hayFlujo = false,
}: {
  lead: LeadDeSeguimiento;
  pie?: string;
  /** Al cerrar el seguimiento la fila se va de la lista de arriba. */
  onCerrado?: (id: string) => void;
  /** Día del embudo, si esta fila está en una pestaña que manda seguimiento. */
  dia?: 2 | 3;
  /** Si existe en GHL el flujo que manda la plantilla de este grupo. */
  hayFlujo?: boolean;
}) {
  const meta = ESTADO_META[lead.estado];
  const [abierta, setAbierta] = useState(false);
  const [tarea, setTarea] = useState(lead.tarea);
  const [enviado, setEnviado] = useState(lead.enviadoHoy);
  const [enviando, setEnviando] = useState(false);
  const [falloEnvio, setFalloEnvio] = useState<string | null>(null);
  // El texto se ve antes de salir y se puede editar. Es lo único de todo el
  // sistema que el cliente lee, así que no puede ser una caja negra.
  const [redactando, setRedactando] = useState(false);
  const [texto, setTexto] = useState("");
  const [guardarComoDefecto, setGuardarComoDefecto] = useState(false);
  // Con la ventana cerrada el texto no sale de acá: lo manda la plantilla del
  // flujo. Lo que se muestra es una copia guardada, para no tocar a ciegas.
  const [editandoCopia, setEditandoCopia] = useState(false);
  const esPlantilla = !lead.ventana.abierta;

  const clave = dia ? `d${dia}-${lead.estado}` : "";

  function abrirRedaccion() {
    setRedactando(true);
    setFalloEnvio(null);
    if (texto) return;
    fetch("/api/mensajes")
      .then((r) => (r.ok ? r.json() : { mensajes: {} }))
      .then((d: { mensajes: Record<string, string> }) => {
        const plantilla = d.mensajes[clave] ?? "";
        const primero = lead.nombre.trim().split(/\s+/)[0] ?? "";
        setTexto(plantilla.replace(/\{nombre\}/g, primero));
      })
      .catch(() => setTexto(""));
  }
  // La pregunta del paso 3, acá mismo. El aviso de arriba solo trae los clics
  // de hoy; los de días anteriores se preguntan en la fila que les toca, que
  // es donde el agente igual los está mirando.
  const [porConfirmar, setPorConfirmar] = useState(lead.porConfirmar);
  const [confirmando, setConfirmando] = useState(false);

  function confirmar(llego: boolean) {
    setConfirmando(true);
    fetch("/api/contacts/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: lead.id, confirmado: llego }),
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        // Un «sí» lo manda al paso 2 y un «no» lo baja a tibio: en los dos
        // casos deja de ser esta fila. El dato vive en una sola etiqueta de
        // GHL, así que las dos pantallas quedan iguales sin sincronizar nada.
        setPorConfirmar(false);
        onCerrado?.(lead.id);
      })
      .catch(() => setFalloEnvio("No se pudo guardar la confirmación"))
      .finally(() => setConfirmando(false));
  }

  /** Ventana cerrada: la plantilla la manda el flujo de GHL, no el panel. */
  function enviarPlantilla() {
    setEnviando(true);
    setFalloEnvio(null);
    if (guardarComoDefecto) {
      fetch("/api/mensajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave, texto }),
      }).catch(() => undefined);
    }
    fetch("/api/seguimiento/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: lead.id,
        dia,
        plantilla: true,
        estado: lead.estado,
        nombre: lead.nombre,
        telefono: lead.telefono,
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo mandar");
        setEnviado(new Date().toISOString());
        setRedactando(false);
        olvidarSeguimiento();
      })
      .catch((e) => setFalloEnvio(e.message))
      .finally(() => setEnviando(false));
  }

  function enviarSeguimiento() {
    if (!texto.trim()) {
      setFalloEnvio("Escribí el mensaje antes de mandarlo.");
      return;
    }
    setEnviando(true);
    setFalloEnvio(null);
    if (guardarComoDefecto) {
      // El texto queda como punto de partida para el próximo del mismo grupo.
      fetch("/api/mensajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave, texto }),
      }).catch(() => undefined);
    }
    fetch("/api/seguimiento/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: lead.id,
        dia,
        texto,
        nombre: lead.nombre,
        telefono: lead.telefono,
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo mandar");
        setEnviado(new Date().toISOString());
        setRedactando(false);
        // Para que el próximo pedido traiga el envío y no la foto de antes.
        olvidarSeguimiento();
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

          {/* Qué hizo. En el módulo de mensajes la vía sobra: lo que importa es
              hasta dónde llegó, no el diagnóstico de por qué se trabó. */}
          <span className="block text-[11.5px] mt-0.5" style={{ color: GRIS_2 }}>
            {!dia && via && (
              <>
                <b className="font-semibold" style={{ color: meta.color }}>
                  {via}
                </b>
                {" · "}
              </>
            )}
            {lead.acciones.length > 0 ? lead.acciones.join(" · ") : "Solicitó información"}
          </span>

          <span className="block text-[11px] mt-0.5" style={{ color: GRIS }}>
            {llegada(lead.creado)}
          </span>

          {pie && (
            <span className="block text-[11px] font-semibold mt-0.5" style={{ color: VERDE }}>
              {pie}
            </span>
          )}

          {/* La tarea es del módulo de llamadas. Acá se escribe, no se agenda. */}
          {!dia &&
            (tarea ? (
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
            ))}

          {porConfirmar && (
            <span className="flex items-center gap-2 flex-wrap mt-1.5">
              <span className="text-[11.5px]" style={{ color: ROJO }}>
                ¿llegó a tu WhatsApp Business?
              </span>
              <button
                onClick={() => confirmar(true)}
                disabled={confirmando}
                className="rounded-full px-2.5 py-[2px] text-[11px] font-semibold text-white disabled:opacity-50"
                style={{ background: VERDE }}
              >
                Sí
              </button>
              <button
                onClick={() => confirmar(false)}
                disabled={confirmando}
                className="rounded-full px-2.5 py-[2px] text-[11px] font-semibold disabled:opacity-50"
                style={{ border: `1px solid ${GRIS}`, color: GRIS_2 }}
              >
                No
              </button>
            </span>
          )}

          {dia && <EstadoVentana lead={lead} dia={dia} enviado={enviado} />}
          {falloEnvio && (
            <span className="block text-[11px] mt-1" style={{ color: ROJO }}>
              {falloEnvio}
            </span>
          )}
        </span>

        {/* La temperatura, donde antes estaba el teléfono: es lo que decide qué
            mensaje le toca, y en una lista larga se busca con el ojo. */}
        {dia && (
          <span
            className="text-[10px] font-bold uppercase tracking-[.12em] rounded-full px-2.5 py-1 shrink-0 hidden sm:inline"
            style={{ background: `${meta.color}1A`, color: meta.color }}
          >
            {lead.estado === "frio" ? "Frío" : lead.estado === "tibio" ? "Tibio" : "Caliente"}
          </span>
        )}

        <span className="flex items-center gap-1.5 shrink-0">
          {/* Ventana cerrada pero el cliente escribió alguna vez: la única
              forma que deja Meta es una plantilla aprobada, y esa sale del
              flujo de GHL. El botón lo dice, porque esta sí se cobra. */}
          {dia && !enviado && !lead.ventana.abierta && !hayFlujo && (
            <span
              className="text-[11px] font-semibold rounded-full px-2.5 py-1 whitespace-nowrap"
              style={{ background: "#F1F0EB", color: GRIS_2 }}
              title={`Armá el flujo seg-d${dia}-${lead.estado} en GHL para poder mandar la plantilla`}
            >
              falta el flujo en GHL
            </span>
          )}
          {dia && !enviado && !lead.ventana.abierta && hayFlujo && (
            <button
              onClick={() => (redactando ? setRedactando(false) : abrirRedaccion())}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 whitespace-nowrap"
              style={{ background: redactando ? GRIS : AMBAR }}
            >
              {redactando ? "Cancelar" : `Ver plantilla día ${dia}`}
            </button>
          )}
          {dia && !enviado && lead.ventana.abierta && (
            <button
              onClick={() => (redactando ? setRedactando(false) : abrirRedaccion())}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 whitespace-nowrap"
              style={{ background: redactando ? GRIS : VERDE_WA }}
            >
              <IconoWhatsApp />
              {redactando ? "Cancelar" : "Escribirle"}
            </button>
          )}
          <button
            onClick={() => setAbierta((v) => !v)}
            className="rounded-full px-2.5 py-[3px] text-[11px] font-semibold"
            style={{ background: CELESTE, color: AZUL }}
          >
            {abierta ? "Cerrar" : "Ver"}
          </button>
          <IrAlCrm url={lead.crmUrl} />
          {/* En el módulo de mensajes no van el teléfono ni el WhatsApp
              personal: acá se escribe desde el panel, y dos botones más de
              canal hacen que el agente se vaya por el camino que no cierra. */}
          {!dia && (
            <>
              <BotonLlamar telefono={lead.telefono} nombre={lead.nombre} contactId={lead.id} tamano={26} />
              <BotonWhatsApp telefono={lead.telefono} nombre={lead.nombre} tamano={26} />
            </>
          )}
        </span>
      </article>

      {redactando && dia && (
        <div className="px-4 sm:px-5 pb-3 pt-2" style={{ background: "#FCFCFA" }}>
          {esPlantilla ? (
            <p className="text-[11.5px] mb-1.5" style={{ color: GRIS_2 }}>
              Su ventana está cerrada, así que sale la <b>plantilla aprobada</b> del flujo{" "}
              <b>seg-d{dia}-{lead.estado}</b>. Esto es una <b>copia</b> de ese texto guardada en el
              panel: GHL no deja leer las plantillas por fuera, así que si alguien la cambia allá,
              hay que actualizarla acá.
            </p>
          ) : (
            <p className="text-[11.5px] mb-1.5" style={{ color: GRIS_2 }}>
              Escribile a <b>{lead.nombre}</b> por WhatsApp. Está escrito para vos — cambialo a tu
              gusto antes de mandarlo.
            </p>
          )}

          <textarea
            rows={3}
            value={texto}
            readOnly={esPlantilla && !editandoCopia}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribí el mensaje…"
            className="w-full resize-none rounded-lg border border-gridline px-2.5 py-2 text-[13px] leading-snug outline-none focus:border-[#2A6FB8]"
            style={{ background: esPlantilla && !editandoCopia ? "var(--page-plane)" : undefined }}
          />

          <div className="flex items-center gap-3 flex-wrap mt-2">
            <button
              onClick={esPlantilla ? enviarPlantilla : enviarSeguimiento}
              disabled={enviando}
              className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
              style={{ background: esPlantilla ? AMBAR : VERDE_WA }}
            >
              {enviando ? "Mandando…" : esPlantilla ? `Enviar la plantilla` : "Mandar por WhatsApp"}
            </button>
            <span className="text-[11px]" style={{ color: GRIS }}>
              {esPlantilla
                ? "la manda el flujo de GHL · esta sí se cobra"
                : "sale por el WhatsApp de la oficina y queda guardado en la conversación"}
            </span>
          </div>

          {esPlantilla && !editandoCopia && (
            <button
              onClick={() => setEditandoCopia(true)}
              className="text-[11px] underline mt-2"
              style={{ color: AZUL }}
            >
              La plantilla cambió en GHL · corregir la copia
            </button>
          )}

          {(!esPlantilla || editandoCopia) && (
            <label
              className="flex items-start gap-2 text-[11.5px] mt-2 pt-2 border-t border-gridline"
              style={{ color: GRIS_2 }}
            >
              <input
                type="checkbox"
                className="mt-[3px]"
                checked={guardarComoDefecto}
                onChange={(e) => setGuardarComoDefecto(e.target.checked)}
              />
              <span>
                Dejar este texto para los próximos{" "}
                <b style={{ color: meta.color }}>
                  {lead.estado === "frio" ? "fríos" : `${lead.estado}s`} del día {dia}
                </b>
                .{" "}
                <span style={{ color: GRIS }}>
                  {esPlantilla
                    ? "Solo cambia lo que se muestra acá, no la plantilla de GHL."
                    : "No cambia el mensaje que estás por mandar: cambia el que va a venir escrito la próxima vez."}
                </span>
              </span>
            </label>
          )}
        </div>
      )}

      {abierta && (
        <FichaCliente
          contactId={lead.id}
          nombre={lead.nombre}
          telefono={lead.telefono}
          soloHistorial={!!dia}
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
      <span className="flex items-center gap-2 flex-wrap mt-1.5">
        <span
          className="inline-block text-[10.5px] font-bold rounded-full px-2 py-[2px]"
          style={{ background: VERDE_CLARO, color: VERDE }}
        >
          ✓ mensaje enviado {new Date(enviado).toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Bogota",
          })}
        </span>
        {/* Adónde ir a comprobar que llegó. Sin esto el «✓» es una promesa. */}
        <a
          href={lead.crmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10.5px] font-semibold underline"
          style={{ color: AZUL }}
        >
          ver la conversación
        </a>
      </span>
    );
  }

  // Vacío no quiere decir «nunca escribió»: el barrido de conversaciones abre
  // un tope de fichas por vuelta y las que quedan afuera vuelven sin dato.
  // Decirle al agente que el cliente nunca escribió sería inventarle un hecho.
  if (v.horas === null) {
    return (
      <span className="block text-[11.5px] mt-1" style={{ color: GRIS_2 }}>
        No pude leer su ventana. <b className="font-semibold">Con plantilla se puede igual.</b>
      </span>
    );
  }

  const horas = Math.floor(v.horas);
  if (!v.abierta) {
    return (
      <span className="block text-[11.5px] mt-1" style={{ color: GRIS_2 }}>
        <span aria-hidden style={{ color: ROJO }}>
          ●
        </span>{" "}
        Ventana de WhatsApp <b className="font-semibold">cerrada</b> hace {horas - 24} h · solo entra
        una plantilla
      </span>
    );
  }

  const cierra = new Date(v.cierraEn!).toLocaleTimeString("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
  const faltan = Math.max(Math.ceil(24 - v.horas), 0);
  const urge = v.porCerrarse;
  return (
    <span className="block text-[11.5px] mt-1" style={{ color: urge ? ROJO : GRIS_2 }}>
      <span aria-hidden style={{ color: urge ? ROJO : VERDE }}>
        ●
      </span>{" "}
      Ventana de WhatsApp abierta hasta las{" "}
      <b className="font-semibold tabular-nums">{cierra}</b>
      {urge ? (
        <b className="font-semibold"> · quedan {faltan} h, mandalo ahora</b>
      ) : (
        <> · quedan {faltan} h</>
      )}
    </span>
  );

}
