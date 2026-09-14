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
const ROJO_SUAVE = "#FF5A3C";
const VERDE = "#157F52";
const TINTA = "#14140f";
const TINTA_2 = "#6B6152";
const TINTA_3 = "#8e8e88";
const BORDE = "#EFEAE4";
const RIEL = "#EDE8E2";


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
  // El contorno va una sola vez: la franja roja, el brillo y la entrada de aire
  // se recortan contra él, así ninguna pieza se sale del cuerpo.
  const CUERPO =
    "M36 86 L34 68 C 40 60, 54 55, 78 53 L98 51 C 102 38, 114 32, 130 32 " +
    "C 142 32, 147 39, 147 48 L190 53 C 218 58, 246 65, 272 72 L304 79 L306 86 " +
    "C 280 88, 250 90, 228 90 L36 89 Z";

  return (
    <svg viewBox="0 0 320 120" className={className} aria-hidden>
      <defs>
        <linearGradient id="op-carro" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6E7B8D" />
          <stop offset=".46" stopColor="#414B5B" />
          <stop offset="1" stopColor="#212934" />
        </linearGradient>
        <linearGradient id="op-brillo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".30" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="op-estela" x1="0" x2="1">
          <stop offset="0" stopColor="#E10600" stopOpacity="0" />
          <stop offset="1" stopColor="#FF5A3C" stopOpacity=".9" />
        </linearGradient>
        <radialGradient id="op-sombra">
          <stop offset="0" stopColor="#14140f" stopOpacity=".22" />
          <stop offset="1" stopColor="#14140f" stopOpacity="0" />
        </radialGradient>
        <clipPath id="op-recorte">
          <path d={CUERPO} />
        </clipPath>
      </defs>

      <ellipse cx="170" cy="104" rx="132" ry="6" fill="url(#op-sombra)" />

      {/* estelas que salen de atrás */}
      <rect x="0" y="30" width="44" height="3" rx="1.5" fill="url(#op-estela)" />
      <rect x="4" y="50" width="34" height="2.5" rx="1.25" fill="url(#op-estela)" opacity=".75" />
      <rect x="0" y="70" width="54" height="2.5" rx="1.25" fill="url(#op-estela)" opacity=".45" />

      {/* alerón trasero: deriva atrás del todo, dos planos y el soporte al cuerpo */}
      <rect x="11" y="20" width="8" height="34" rx="2" fill="#2B333F" />
      <rect x="18" y="25" width="54" height="6.5" rx="3.25" fill="#E10600" />
      <rect x="24" y="37" width="42" height="4.5" rx="2.25" fill="#2B333F" />
      <rect x="42" y="40" width="7" height="22" fill="#39424F" />

      {/* difusor */}
      <path d="M34 76 L58 75 L58 89 L32 90 Z" fill="#1B2028" />

      <path d={CUERPO} fill="url(#op-carro)" />

      <g clipPath="url(#op-recorte)">
        <path d="M42 64 C 72 55, 102 50, 130 33 C 112 52, 92 57, 46 72 Z" fill="url(#op-brillo)" />
        <path d="M28 76 L200 76 C 240 78, 276 81, 312 84 L312 89 C 276 86, 240 83, 200 81 L28 81 Z" fill="#E10600" />
        <rect x="100" y="58" width="32" height="15" rx="7" fill="#151A21" />
      </g>

      {/* cabina y halo */}
      <path d="M145 48 C 155 45, 180 48, 192 54 L192 59 L145 55 Z" fill="#151A21" />
      <path d="M149 52 C 158 33, 190 34, 201 57" fill="none" stroke="#2B333F" strokeWidth="5" strokeLinecap="round" />

      {/* alerón delantero */}
      <rect x="304" y="72" width="8" height="24" rx="2" fill="#2B333F" />
      <rect x="280" y="78" width="28" height="4" rx="2" fill="#2B333F" />
      <rect x="274" y="86" width="36" height="6.5" rx="3.25" fill="#E10600" />

      {/* ruedas */}
      <circle cx="72" cy="76" r="25" fill="#14181E" />
      <circle cx="72" cy="76" r="15.5" fill="#2B333F" />
      <circle cx="72" cy="76" r="8.5" fill="#67748A" />
      <circle cx="72" cy="76" r="3.5" fill="#14181E" />
      <circle cx="250" cy="78" r="23" fill="#14181E" />
      <circle cx="250" cy="78" r="14" fill="#2B333F" />
      <circle cx="250" cy="78" r="7.5" fill="#67748A" />
      <circle cx="250" cy="78" r="3" fill="#14181E" />
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
        border: "1px solid #E6DFD8",
        background:
          "radial-gradient(620px 320px at 92% 50%, rgba(225,6,0,.10), transparent 62%), #FFFFFF",
        color: TINTA,
      }}
    >
      <div className="relative">
        <div className="flex items-stretch gap-0 flex-col sm:flex-row">
          {/* Izquierda: de qué mes hablamos. */}
          <div
            className="flex flex-col justify-center px-5 sm:px-7 py-5 sm:py-7 sm:w-[34%]"
            style={{ borderBottom: `1px solid ${BORDE}` }}
          >
            <MarcaNexus />
            <span
              className="text-[13px] sm:text-[15px] font-bold uppercase tracking-[.22em] mt-3 leading-none"
              style={{ color: TINTA }}
            >
              Mi meta
            </span>
            {/* El mes queda en chico: la meta se reinicia cada mes y hay que
                poder ver de cuál se está hablando sin que compita con el título. */}
            <span
              className="text-[10px] font-bold uppercase tracking-[.2em] mt-1.5"
              style={{ color: TINTA_3 }}
            >
              {MES}
            </span>
            <AutoDeCarrera className="w-[190px] mt-2 sm:hidden" />
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

          {/* Derecha: la frase y el auto. Antes el auto iba de fondo y las letras
              le quedaban encima; puestos uno debajo del otro no se pisan. */}
          <div
            className="hidden sm:flex flex-col justify-center gap-2 px-5 py-5 sm:w-[30%]"
            style={{ borderBottom: `1px solid ${BORDE}`, borderLeft: `1px solid ${BORDE}` }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-[.16em] leading-[1.7]"
              style={{ color: TINTA_2 }}
            >
              Un sueño requiere
              <br />
              un plan diario
              <br />
              para despertarlo
            </span>
            <AutoDeCarrera className="w-full max-w-[210px]" />
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
          style={{ borderTop: `1px solid ${BORDE}`, background: "#FBFBF8" }}
        >
          <label className="text-[11.5px]" style={{ color: TINTA_2 }}>
            Meta de FTD
            <input
              type="number"
              min={0}
              value={ftd}
              onChange={(e) => setFtd(e.target.value)}
              className="block w-[92px] mt-1 rounded-lg px-2.5 py-1.5 text-[16px] font-bold text-right tabular-nums outline-none"
              style={{ border: `1px solid ${BORDE}`, color: TINTA, background: "#FBFBF8" }}
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
              style={{ border: `1px solid ${BORDE}`, color: TINTA, background: "#FBFBF8" }}
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
              style={{ borderTop: `1px solid ${BORDE}`, background: "#FCFCFA", color: TINTA_3 }}
            >
              <span>
                meta <b style={{ color: TINTA }}>{meta.ftd} FTD</b>
              </span>
              <span style={{ color: "#D8D3CC" }}>·</span>
              <span>
                meta <b style={{ color: TINTA }}>{plata(meta.usd)}</b> facturado
              </span>
              <span className="text-[9px] opacity-60">{abierta ? "▲" : "▼"}</span>
            </button>

            {abierta && (
              <div
                className="px-5 pt-4 pb-5"
                style={{ borderTop: `1px solid ${BORDE}`, background: "#FCFCFA" }}
              >
                <Barra
                  titulo="FTD"
                  valor={`${ftdMes} de ${meta.ftd}`}
                  pct={pct(ftdMes, meta.ftd)}
                  color={`linear-gradient(90deg,#3E9E6C,${VERDE})`}
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
