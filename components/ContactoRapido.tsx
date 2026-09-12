"use client";

import { BotonLlamar, ReporteLlamada } from "@/components/Llamada";

export { BotonLlamar } from "@/components/Llamada";

// Verde oficial de WhatsApp: el botón se reconoce por el color antes que por
// el dibujo, sobre todo en el tamaño chico de una fila de tabla.
const VERDE_WA = "#25D366";

/**
 * Teléfonos de GHL vienen como "+573104804802"; cortarlos en grupos los hace
 * legibles de un vistazo cuando el agente compara con su WhatsApp.
 */
export function formatearTelefono(bruto: string): string {
  const d = bruto.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("57")) {
    return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  }
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return bruto;
}

// wa.me quiere el número sin "+" ni espacios. Menos de 8 dígitos no es un
// teléfono: mandar ahí abre un chat con un número inventado.
function paraWhatsApp(telefono: string): string | null {
  const d = telefono.replace(/\D/g, "");
  return d.length >= 8 ? d : null;
}

function IconoWhatsApp({ tamano }: { tamano: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.1a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.1 8.1 0 1 1 12 20.1Z" />
      <path d="M9.4 7.7c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.7 2.7 4.2 3.7 2 .8 2.5.7 2.9.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.5-.3l-1.6-.8c-.2-.1-.4-.1-.6.1l-.6.8c-.1.2-.3.2-.6.1-.3-.1-1.2-.5-2.2-1.4-.8-.7-1.3-1.6-1.5-1.8-.1-.2 0-.4.1-.5l.4-.5c.1-.1.2-.3.2-.4.1-.2 0-.3 0-.4l-.5-1.4Z" />
    </svg>
  );
}

/**
 * Botón para escribirle al lead por WhatsApp.
 *
 * Abre en pestaña nueva a propósito: el agente vuelve al tablero con el
 * historial, sin perder la lista en la que estaba trabajando.
 */
export function BotonWhatsApp({
  telefono,
  nombre,
  tamano = 30,
}: {
  telefono: string | null;
  nombre?: string;
  tamano?: number;
}) {
  const numero = telefono ? paraWhatsApp(telefono) : null;
  if (!numero) return null;

  return (
    <a
      href={`https://wa.me/${numero}`}
      target="_blank"
      rel="noreferrer"
      aria-label={nombre ? `Escribir a ${nombre} por WhatsApp` : "Escribir por WhatsApp"}
      title="Escribir por WhatsApp"
      className="inline-flex items-center justify-center rounded-full text-white shrink-0 transition-transform hover:scale-110"
      style={{ background: VERDE_WA, width: tamano, height: tamano }}
    >
      <IconoWhatsApp tamano={Math.round(tamano * 0.62)} />
    </a>
  );
}

/**
 * El teléfono y el botón de WhatsApp, juntos.
 *
 * El número es un enlace `tel:`: en el celular del agente marca directo, que
 * es donde de verdad se trabaja la lista. Sin esto había que copiarlo a mano
 * de una tabla a la app del teléfono.
 */
export function ContactoRapido({
  telefono,
  nombre,
  contactId,
  tamano = 30,
}: {
  telefono: string | null;
  nombre?: string;
  // Con el id, el botón de llamar deja constancia y aparece el «¿qué pasó?».
  // Sin él sigue funcionando igual, solo que sin registrar nada.
  contactId?: string;
  tamano?: number;
}) {
  if (!telefono) {
    return <span className="text-ink-muted">Sin teléfono</span>;
  }

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <a
        href={`tel:${telefono.replace(/\s/g, "")}`}
        title="Llamar"
        className="tabular-nums text-ink-secondary hover:text-ink-primary hover:underline"
      >
        {formatearTelefono(telefono)}
      </a>
      <BotonLlamar telefono={telefono} nombre={nombre} contactId={contactId} tamano={tamano} />
      <BotonWhatsApp telefono={telefono} nombre={nombre} tamano={tamano} />
      {contactId && <ReporteLlamada contactId={contactId} />}
    </span>
  );
}
