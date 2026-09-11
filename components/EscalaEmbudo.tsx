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

// Degradado de frío a caliente según la posición: el punto que se enciende
// más a la derecha es el que está más cerca del depósito.
const COLORES = ["#C0432A", "#E06A2B", "#E0A800", "#8FBF3F", "#1BAF7A"];
const APAGADO = "#DDDCD4";

/**
 * Escala de puntos del embudo. Reemplaza a una barra de progreso porque no es
 * un avance continuo sino cinco hitos concretos, y porque de un vistazo se ve
 * cuánto le falta a cada lead sin leer una sola palabra.
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
          className="w-2 h-2 rounded-full"
          style={{ background: hechos[i] ? COLORES[i] : APAGADO }}
        />
      ))}
    </div>
  );
}

// Círculo con iniciales en vez de foto: los leads de WhatsApp no tienen avatar,
// y teñirlo con el color del estado hace que la temperatura se lea antes que
// el nombre.
export function Inicial({ nombre, color }: { nombre: string; color: string }) {
  const limpio = nombre.trim();
  const palabras = limpio.split(/\s+/).filter(Boolean);
  let texto = palabras
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  // Nombres que son solo emoji, un teléfono o un correo: cae al primer
  // caracter, que al menos distingue una fila de otra.
  if (!/\p{L}/u.test(texto)) texto = [...limpio][0] ?? "?";

  return (
    <span
      className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0"
      style={{ background: `${color}1F`, color }}
      aria-hidden
    >
      {texto.toUpperCase()}
    </span>
  );
}
