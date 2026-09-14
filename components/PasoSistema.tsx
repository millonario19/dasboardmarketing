/**
 * El rótulo de cada paso del tablero.
 *
 * La pantalla tiene un orden que no es decorativo: primero quién habló,
 * después en qué estado quedó cada lead, y al final la corrección del único
 * dato que el sistema no puede saber solo. Sin los rótulos, eso es tres
 * módulos apilados; con ellos, es un procedimiento — y se nota al entrar, sin
 * que nadie lo explique.
 *
 * Los tres van del mismo color a propósito: son la misma cosa, y pintar uno
 * distinto convierte un índice en una alarma. La urgencia ya la lleva el
 * módulo que va debajo.
 */

const AZUL = "#17457F";

export function PasoSistema({
  numero,
  titulo,
  detalle,
}: {
  numero: number;
  titulo: string;
  detalle?: string;
}) {
  return (
    <div className="flex items-center gap-3.5 mt-8 mb-3 first:mt-0">
      <span
        className="text-[42px] sm:text-[52px] font-light leading-none tracking-[-0.06em] tabular-nums shrink-0"
        style={{ color: AZUL }}
      >
        {numero}
      </span>
      <span className="h-10 w-px shrink-0" style={{ background: "var(--gridline)" }} />
      <span className="min-w-0">
        <span
          className="block text-[10px] font-bold uppercase tracking-[.18em]"
          style={{ color: AZUL }}
        >
          Paso {numero}
        </span>
        <span className="block text-[17px] sm:text-[19px] font-semibold tracking-[-0.025em] leading-tight">
          {titulo}
        </span>
        {detalle && (
          <span className="block text-[12px] text-ink-muted mt-0.5">{detalle}</span>
        )}
      </span>
      <span className="hidden sm:block flex-1 h-px" style={{ background: "var(--gridline)" }} />
    </div>
  );
}
