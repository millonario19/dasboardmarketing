"use client";

import { useEffect, useState } from "react";
import { comisionPorFtd } from "@/lib/comision";
import type { Meta } from "@/lib/metas";

/**
 * La meta del mes, arriba de todo.
 *
 * Un tablero que solo mide no mueve a nadie. Esta es la única parte de la
 * pantalla que habla de la plata del agente, así que va antes que los pasos:
 * no es un resumen del día, es el motivo por el que abre el tablero.
 *
 * Plegada muestra la comisión y las dos metas en letra chica; desplegada, las
 * dos barras. Lo que hace útil una barra no es decir cuánto falta, sino cuánto
 * falta por día.
 */

const ROJO = "#E10600";
const ROJO_SUAVE = "#FF3B30";
const VERDE = "#2FBF71";
const TINTA = "#FFFFFF";
const TINTA_2 = "rgba(255,255,255,.62)";
const TINTA_3 = "rgba(255,255,255,.40)";
const BORDE = "rgba(255,255,255,.10)";
const RIEL = "rgba(255,255,255,.14)";

// Líneas de velocidad, dibujadas con degradados. Un auto de carrera de verdad
// tiene dueño —la foto y el logo son marcas registradas—, así que la sensación
// se consigue con la luz y no con la imagen de nadie.
const ESTELAS = [
  "linear-gradient(90deg, transparent, rgba(225,6,0,.55) 60%, rgba(255,120,90,.9))",
  "linear-gradient(90deg, transparent, rgba(225,6,0,.30) 60%, rgba(255,255,255,.55))",
  "linear-gradient(90deg, transparent, rgba(225,6,0,.22) 70%, rgba(255,90,60,.6))",
];

const CLAVE = "op_meta_abierta";

const plata = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function diasQueQuedan(): number {
  const hoy = new Date(Date.now() - 5 * 3600e3);
  const ultimo = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0)).getUTCDate();
  return Math.max(ultimo - hoy.getUTCDate(), 1);
}

const MES = new Date(Date.now() - 5 * 3600e3).toLocaleDateString("es-CO", {
  month: "long",
  timeZone: "UTC",
});

export function MetaDelMes({ ftdMes }: { ftdMes: number }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [cargada, setCargada] = useState(false);
  const [abierta, setAbierta] = useState(true);
  const [editando, setEditando] = useState(false);
  const [ftd, setFtd] = useState("45");
  const [usd, setUsd] = useState("1500");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(CLAVE);
      if (v !== null) setAbierta(v === "1");
    } catch {
      /* modo privado */
    }
    fetch("/api/meta")
      .then((r) => (r.ok ? r.json() : { meta: null }))
      .then((d: { meta: Meta | null }) => {
        setMeta(d.meta);
        if (d.meta) {
          setFtd(String(d.meta.ftd));
          setUsd(String(d.meta.usd));
        }
      })
      .catch(() => {
        /* sin meta se invita a ponerla */
      })
      .finally(() => setCargada(true));
  }, []);

  function alternar() {
    setAbierta((v) => {
      try {
        localStorage.setItem(CLAVE, v ? "0" : "1");
      } catch {
        /* modo privado */
      }
      return !v;
    });
  }

  function guardar() {
    setGuardando(true);
    fetch("/api/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ftd: Number(ftd), usd: Number(usd) }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { meta: Meta }) => {
        setMeta(d.meta);
        setEditando(false);
      })
      .catch(() => undefined)
      .finally(() => setGuardando(false));
  }

  if (!cargada) return null;

  const { pago, siguiente } = comisionPorFtd(ftdMes);
  const quedan = diasQueQuedan();
  const faltaFtd = meta ? Math.max(meta.ftd - ftdMes, 0) : 0;
  const faltaUsd = meta ? Math.max(meta.usd - pago, 0) : 0;
  const pct = (a: number, b: number) => (b > 0 ? Math.min((a / b) * 100, 100) : 0);

  return (
    <section
      className="relative rounded-[20px] overflow-hidden mb-6"
      style={{
        border: `1px solid rgba(225,6,0,.35)`,
        background:
          "radial-gradient(620px 320px at 88% 50%, rgba(225,6,0,.22), transparent 62%)," +
          " linear-gradient(105deg, #0B0E12 0%, #141920 58%, #1B1013 100%)",
        color: TINTA,
      }}
    >
      {/* Las estelas viven detrás de todo y no capturan clics. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {ESTELAS.map((fondo, i) => (
          <span
            key={i}
            className="absolute right-0 h-[2px] rounded-full"
            style={{
              background: fondo,
              width: [220, 320, 170][i],
              top: [`${34 + i * 13}%`, `${34 + i * 13}%`, `${34 + i * 13}%`][i],
              opacity: 0.85,
            }}
          />
        ))}
      </div>

      <div className="relative">
        <div className="flex items-stretch gap-0 flex-col sm:flex-row">
          {/* Izquierda: de qué mes hablamos. */}
          <div
            className="flex flex-col justify-center px-5 sm:px-7 py-5 sm:py-7 sm:w-[34%]"
            style={{ borderBottom: `1px solid ${BORDE}` }}
          >
            <span
              className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.22em]"
              style={{ color: TINTA_2 }}
            >
              Comisión de {MES}
            </span>
          </div>

          {/* Centro: la meta, y debajo lo que lleva. */}
          <div
            className="flex flex-col items-center justify-center px-5 py-4 sm:py-7 flex-1 text-center"
            style={{ borderBottom: `1px solid ${BORDE}`, borderLeft: `1px solid ${BORDE}` }}
          >
            <span className="text-[44px] sm:text-[58px] font-extrabold tracking-[-0.045em] leading-none tabular-nums">
              {plata(meta ? meta.usd : pago)}
            </span>
            {meta ? (
              <span className="text-[13px] font-bold uppercase tracking-[.16em] mt-2" style={{ color: TINTA_3 }}>
                Llevás{" "}
                <b className="text-[19px] tracking-[-0.02em]" style={{ color: pago > 0 ? VERDE : ROJO_SUAVE }}>
                  {plata(pago)}
                </b>
              </span>
            ) : (
              <button
                onClick={() => setEditando(true)}
                className="text-[12.5px] font-bold uppercase tracking-[.14em] mt-2 underline"
                style={{ color: ROJO_SUAVE }}
              >
                Poné tu meta
              </button>
            )}
          </div>

          {/* Derecha: la frase. Es lo único de la pantalla que no es un dato. */}
          <div
            className="hidden sm:flex items-center px-6 py-7 sm:w-[26%]"
            style={{ borderBottom: `1px solid ${BORDE}`, borderLeft: `1px solid ${BORDE}` }}
          >
            <span className="text-[11px] font-bold uppercase tracking-[.16em] leading-[1.7]" style={{ color: TINTA_2 }}>
              Disciplina hoy,
              <br />
              resultados mañana
            </span>
          </div>
        </div>

        {/* La barra, de borde a borde. */}
        {meta && (
          <div className="flex items-center gap-3 px-5 sm:px-7 py-4" style={{ borderBottom: `1px solid ${BORDE}` }}>
            <span className="flex-1 h-[9px] rounded-full overflow-hidden" style={{ background: RIEL }}>
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max(pct(pago, meta.usd), 1.5)}%`,
                  background:
                    pago >= meta.usd
                      ? `linear-gradient(90deg, ${VERDE}, #6FE6A8)`
                      : `linear-gradient(90deg, ${ROJO}, ${ROJO_SUAVE})`,
                }}
              />
            </span>
            <b className="text-[13px] font-bold tabular-nums shrink-0" style={{ color: TINTA_2 }}>
              {Math.round(pct(pago, meta.usd))}%
            </b>
          </div>
        )}
      </div>

      {editando ? (
        <div
          className="flex items-end justify-center gap-3 flex-wrap px-5 py-4"
          style={{ borderTop: `1px solid ${BORDE}`, background: "rgba(255,255,255,.04)" }}
        >
          <label className="text-[11.5px]" style={{ color: TINTA_2 }}>
            Meta de FTD
            <input
              type="number"
              min={0}
              value={ftd}
              onChange={(e) => setFtd(e.target.value)}
              className="block w-[92px] mt-1 rounded-lg px-2.5 py-1.5 text-[16px] font-bold text-right tabular-nums outline-none"
              style={{ border: `1px solid ${BORDE}`, color: TINTA, background: "rgba(255,255,255,.06)" }}
            />
          </label>
          <label className="text-[11.5px]" style={{ color: TINTA_2 }}>
            Quiero ganar (USD)
            <input
              type="number"
              min={0}
              step={50}
              value={usd}
              onChange={(e) => setUsd(e.target.value)}
              className="block w-[110px] mt-1 rounded-lg px-2.5 py-1.5 text-[16px] font-bold text-right tabular-nums outline-none"
              style={{ border: `1px solid ${BORDE}`, color: TINTA, background: "rgba(255,255,255,.06)" }}
            />
          </label>
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-full px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
            style={{ background: ROJO }}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <button
            onClick={() => setEditando(false)}
            className="rounded-full px-3 py-2 text-[12.5px]"
            style={{ color: TINTA_3 }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        meta && (
          <>
            <button
              onClick={alternar}
              aria-expanded={abierta}
              className="w-full flex items-center justify-center gap-2.5 flex-wrap px-4 py-3 text-[11.5px]"
              style={{ borderTop: `1px solid ${BORDE}`, background: "rgba(255,255,255,.03)", color: TINTA_3 }}
            >
              <span>
                meta <b style={{ color: TINTA }}>{meta.ftd} FTD</b>
              </span>
              <span style={{ color: "rgba(255,255,255,.22)" }}>·</span>
              <span>
                meta <b style={{ color: TINTA }}>{plata(meta.usd)}</b> facturado
              </span>
              <span className="text-[9px] opacity-60">{abierta ? "▲" : "▼"}</span>
            </button>

            {abierta && (
              <div
                className="px-5 pt-4 pb-5"
                style={{ borderTop: `1px solid ${BORDE}`, background: "rgba(255,255,255,.03)" }}
              >
                <Barra
                  titulo="FTD"
                  valor={`${ftdMes} de ${meta.ftd}`}
                  pct={pct(ftdMes, meta.ftd)}
                  color={`linear-gradient(90deg,${VERDE},#6FE6A8)`}
                  pie={
                    faltaFtd > 0
                      ? `Faltan ${faltaFtd} · ${(faltaFtd / quedan).toFixed(1)} por día en los ${quedan} días que quedan`
                      : "Meta cumplida 🎉"
                  }
                />
                <div className="mt-4">
                  <Barra
                    titulo="Comisión"
                    valor={`${plata(pago)} de ${plata(meta.usd)}`}
                    pct={pct(pago, meta.usd)}
                    color={`linear-gradient(90deg,${ROJO_SUAVE},${ROJO})`}
                    pie={
                      siguiente
                        ? `Con ${siguiente[0] - ftdMes} FTD más pasás al escalón de ${siguiente[0]} y cobrás ${plata(siguiente[1])}`
                        : faltaUsd > 0
                          ? `Faltan ${plata(faltaUsd)}`
                          : "Meta cumplida 🎉"
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap mt-4 text-[11px]" style={{ color: TINTA_3 }}>
                  <span>Solo cuenta la comisión por FTD — las ventas todavía no las registra el sistema.</span>
                  <button onClick={() => setEditando(true)} className="underline font-semibold" style={{ color: ROJO }}>
                    Cambiar mi meta
                  </button>
                </div>
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}

function Barra({
  titulo,
  valor,
  pct,
  color,
  pie,
}: {
  titulo: string;
  valor: string;
  pct: number;
  color: string;
  pie: string;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline text-[12px] mb-1.5" style={{ color: TINTA_3 }}>
        <span>{titulo}</span>
        <b className="text-[14px] font-bold tabular-nums" style={{ color: TINTA }}>
          {valor}
        </b>
      </div>
      <div className="h-[9px] rounded-full overflow-hidden" style={{ background: RIEL }}>
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-[11.5px] mt-1.5" style={{ color: TINTA_3 }}>
        {pie}
      </div>
    </div>
  );
}
