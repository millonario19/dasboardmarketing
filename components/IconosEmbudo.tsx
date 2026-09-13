import type { EstadoLead } from "@/lib/leadStates";

/**
 * Los pasos del embudo, dibujados.
 *
 * Son de trazo y no macizos: en una tarjeta que ya tiene una franja de color
 * fuerte arriba, cinco iconos rellenos compiten con el número, que es lo que
 * la tarjeta viene a decir.
 *
 * Cada paso lleva su propio color, no el de la tarjeta. Es lo que permite
 * reconocerlos sin leer: el verde de WhatsApp tiene que ser el verde de
 * WhatsApp en las tres temperaturas, no rojo en Caliente y azul en Frío. Por
 * lo mismo el canal usa el avión de Telegram, que es donde está el canal, y
 * no un megáfono genérico.
 */

export type Paso = "info" | "interaccion" | "canal" | "whatsapp" | "registro";

export const PASO_META: Record<Paso, { nombre: string; color: string; fondo: string }> = {
  info: { nombre: "Pidió información", color: "#A9761F", fondo: "#F4EADA" },
  interaccion: { nombre: "Interactuó", color: "#2A6FB8", fondo: "#E5EFFA" },
  canal: { nombre: "Entró al canal", color: "#229ED9", fondo: "#E3F1FB" },
  whatsapp: { nombre: "Bajó a WhatsApp", color: "#1EA855", fondo: "#E3F5E9" },
  registro: { nombre: "Se registró en el broker", color: "#157F52", fondo: "#E4F1EA" },
};

/**
 * Qué define cada temperatura. No es lo que hizo cada lead: es la regla con la
 * que el sistema lo clasificó, y por eso está siempre, también cuando la
 * tarjeta está en cero.
 *
 * Caliente lleva dos porque el registro también vuelve caliente a un lead,
 * aunque nunca haya bajado a WhatsApp.
 */
export const PASOS_DEL_ESTADO: Record<EstadoLead, Paso[]> = {
  frio: ["info"],
  tibio: ["interaccion", "canal"],
  caliente: ["whatsapp", "registro"],
};

const TRAZOS: Record<Paso, JSX.Element> = {
  info: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  interaccion: <path d="M20 11.4c0 3.9-3.6 7.1-8 7.1-.9 0-1.8-.1-2.7-.4L4.5 19.8l1.3-3.5A7 7 0 0 1 4 11.4c0-3.9 3.6-7.1 8-7.1s8 3.2 8 7.1Z" />,
  canal: (
    <>
      <path d="M21 4.5 2.9 11.3c-.5.2-.5.9 0 1l4.4 1.4 1.7 5.2c.2.5.8.6 1.1.2l2.3-2.5 4.3 3.2c.4.3 1 .1 1.1-.4l3.6-14.2c.1-.5-.4-.9-.9-.7Z" />
      <path d="m7.3 13.7 11-7.4-8.2 8.7" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M12 3.4a8.6 8.6 0 0 0-7.4 12.9l-1 3.6 3.7-1a8.6 8.6 0 1 0 4.7-15.5Z" />
      <path d="M9.3 8.4c.2-.4.4-.4.6-.4h.3c.2 0 .4 0 .5.4l.5 1.3c.1.2 0 .3-.1.4l-.4.5c-.1.1-.2.2-.1.4.2.3.6.9 1.2 1.5.7.6 1.3.9 1.6 1 .2.1.3 0 .4-.1l.5-.6c.1-.2.2-.2.4-.1l1.3.6c.2.1.3.2.3.3.1.2 0 .5-.1 1-.2.4-.9.8-1.3.9-.3 0-.7.1-2.3-.6-2-.8-3.3-2.8-3.4-3-.1-.2-.8-1.1-.8-2.1s.6-1.5.7-1.7Z" />
    </>
  ),
  registro: (
    <>
      <path d="M10 11.8a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z" />
      <path d="M4 20c0-3.4 2.8-5.6 6-5.6.9 0 1.7.1 2.4.4" />
      <path d="m14.8 18 2 2 3.7-4.2" />
    </>
  ),
};

export function IconoPaso({ paso, tamano = 15 }: { paso: Paso; tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke={PASO_META[paso].color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {TRAZOS[paso]}
    </svg>
  );
}

/** El icono en su recuadro y el nombre al lado, un paso por renglón. */
export function FilaDePaso({ paso }: { paso: Paso }) {
  const meta = PASO_META[paso];
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="w-[26px] h-[26px] rounded-[9px] shrink-0 flex items-center justify-center"
        style={{ background: meta.fondo, boxShadow: "inset 0 0 0 1px rgba(13,13,13,.05)" }}
      >
        <IconoPaso paso={paso} />
      </span>
      <span className="text-[12.5px] font-semibold text-ink-secondary">{meta.nombre}</span>
    </div>
  );
}
