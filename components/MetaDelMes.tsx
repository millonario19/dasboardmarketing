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

/**
 * Un auto de carrera dibujado para esta pantalla.
 *
 * La foto de un Fórmula 1 y su logo tienen dueño. Este es un trazo propio:
 * alerón trasero, halo, morro largo y alerón delantero — la silueta que
 * cualquiera reconoce, sin tomar prestada la imagen de nadie.
 */
function AutoDeCarrera({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 230 86" className={className} aria-hidden>
      <defs>
        <linearGradient id="op-carro" x1="0" x2="1">
          <stop offset="0" stopColor="#2A3039" />
          <stop offset=".55" stopColor="#3A4250" />
          <stop offset="1" stopColor="#12161C" />
        </linearGradient>
        <linearGradient id="op-estela" x1="0" x2="1">
          <stop offset="0" stopColor="#E10600" stopOpacity="0" />
          <stop offset="1" stopColor="#FF5A3C" stopOpacity=".95" />
        </linearGradient>
      </defs>

      {/* estelas que salen de atrás */}
      <rect x="0" y="30" width="58" height="2.5" rx="1.25" fill="url(#op-estela)" />
      <rect x="6" y="44" width="46" height="2" rx="1" fill="url(#op-estela)" opacity=".7" />
      <rect x="0" y="57" width="70" height="2" rx="1" fill="url(#op-estela)" opacity=".5" />

      {/* alerón trasero */}
      <rect x="30" y="20" width="30" height="5" rx="2" fill="#E10600" />
      <rect x="42" y="25" width="5" height="16" fill="#2A3039" />

      {/* cuerpo: cola, cockpit, morro */}
      <path
        d="M36 52 L46 40 L74 36 Q86 24 104 24 L120 24 Q128 24 132 31
           L176 38 Q196 41 214 49 L214 55 Q190 58 150 57 L60 57 Z"
        fill="url(#op-carro)"
      />
      {/* halo */}
      <path d="M96 27 Q112 14 130 28" fill="none" stroke="#1A1F26" strokeWidth="4.5" strokeLinecap="round" />
      {/* franja roja del costado */}
      <path d="M62 50 L128 40 L176 45 L176 49 L126 45 L62 54 Z" fill="#E10600" opacity=".9" />
      {/* alerón delantero */}
      <rect x="198" y="55" width="32" height="5" rx="2" fill="#E10600" />

      {/* ruedas */}
      <circle cx="66" cy="54" r="17" fill="#0D1116" />
      <circle cx="66" cy="54" r="8" fill="#232B34" />
      <circle cx="174" cy="56" r="15" fill="#0D1116" />
      <circle cx="174" cy="56" r="7" fill="#232B34" />
    </svg>
  );
}

/** La marca de la casa, en lugar del logo prestado. */
function MarcaNexus() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="30" height="20" viewBox="0 0 30 20" aria-hidden>
        <path d="M2 16 L9 4 h5 L7 16 Z" fill="#E10600" />
        <path d="M11 16 L18 4 h5 l-7 12 Z" fill="#E10600" opacity=".72" />
        <path d="M20 16 L27 4 h3 l-7 12 Z" fill="#E10600" opacity=".42" />
      </svg>
      <span className="text-[19px] font-extrabold tracking-[.22em] leading-none">NEXUS</span>
    </span>
  );
}

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
      {/* El auto va detrás de todo, sangrando por el borde derecho. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden sm:flex items-center" aria-hidden>
        <AutoDeCarrera className="w-[300px] opacity-[.55]" />
      </div>

      <div className="relative">
        <div className="flex items-stretch gap-0 flex-col sm:flex-row">
          {/* Izquierda: de qué mes hablamos. */}
          <div
            className="flex flex-col justify-center px-5 sm:px-7 py-5 sm:py-7 sm:w-[34%]"
            style={{ borderBottom: `1px solid ${BORDE}` }}
          >
            <MarcaNexus />
            <span
              className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.22em] mt-3"
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
