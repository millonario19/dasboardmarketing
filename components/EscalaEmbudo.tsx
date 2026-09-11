"use client";

// Los cinco pasos del embudo, en orden. El primero siempre está cumplido: si
// el lead está en la lista es porque entró por la pauta.
const PASOS = [
  { clave: null, nombre: "Entró por la pauta" },
  { clave: "Respondió", nombre: "Respondió" },
  { clave: "Entró al canal", nombre: "Entró al canal" },
  { clave: "Bajó a WhatsApp", nombre: "Bajó a WhatsApp" },
  { clave: "Se registró", nombre: "Se registró" },
] as const;

// Los colores de la referencia: rojo a verde según la posición.
const COLORES = ["#FF6B5A", "#FF9F45", "#FFD644", "#A8E05F", "#4CC96A"];
const APAGADO = "#E2E2DD";

/**
 * Escala de puntos del embudo. No es una barra de progreso porque no hay
 * avance continuo sino cinco hitos, y los huecos importan: un lead con el
 * punto del registro encendido y los del medio apagados se saltó el canal y
 * el enlace de WhatsApp.
 */
export function EscalaEmbudo({ acciones }: { acciones: string[] }) {
  const hechos = PASOS.map((p) => (p.clave === null ? true : acciones.includes(p.clave)));
  const cumplidos = hechos.filter(Boolean).length;

  return (
    <div
      className="flex items-center gap-1 shrink-0"
      title={`${cumplidos} de ${PASOS.length}: ${PASOS.filter((_, i) => hechos[i]).map((p) => p.nombre).join(" · ")}`}
    >
      {PASOS.map((p, i) => (
        <span
          key={p.nombre}
          className="w-[9px] h-[9px] rounded-full"
          style={{ background: hechos[i] ? COLORES[i] : APAGADO }}
        />
      ))}
    </div>
  );
}

// Los leads de WhatsApp no tienen foto, así que el avatar es un círculo con
// iniciales teñido con el color del estado: la temperatura se lee antes que
// el nombre.
export function Inicial({
  nombre,
  color,
  tamano = 40,
}: {
  nombre: string;
  color: string;
  tamano?: number;
}) {
  const limpio = nombre.trim();
  let texto = limpio
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  // Nombres que son solo emoji, un teléfono o un correo: cae al primer
  // caracter, que al menos distingue una fila de otra.
  if (!/\p{L}/u.test(texto)) texto = [...limpio][0] ?? "?";

  return (
    <span
      className="rounded-full flex items-center justify-center font-semibold shrink-0"
      style={{
        width: tamano,
        height: tamano,
        fontSize: tamano * 0.34,
        background: `${color}24`,
        color,
      }}
      aria-hidden
    >
      {texto.toUpperCase()}
    </span>
  );
}
