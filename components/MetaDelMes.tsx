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

const DORADO = "#A07C22";
const DORADO_CLARO = "#C79D3C";
const VERDE = "#177A4F";
const TINTA = "#1A1712";
const TINTA_2 = "#6B6152";
const TINTA_3 = "#8A7F6C";
const BORDE = "#E7DCC6";
const RIEL = "#E6DCC7";

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
      className="rounded-[20px] overflow-hidden mb-6"
      style={{
        border: `1px solid ${BORDE}`,
        background:
          "radial-gradient(560px 280px at 50% -40%, rgba(199,157,60,.18), transparent 62%)," +
          " linear-gradient(170deg, #FBF6EC 0%, #F5EEE0 100%)",
        color: TINTA,
      }}
    >
      <div className="px-5 pt-6 pb-5 text-center">
        <div className="text-[9.5px] font-extrabold uppercase tracking-[.2em]" style={{ color: DORADO }}>
          Comisión de {MES}
        </div>
        <div className="text-[46px] sm:text-[58px] font-light tracking-[-0.055em] leading-none mt-2.5 tabular-nums">
          {plata(pago)}
        </div>
        <div className="text-[13.5px] mt-2" style={{ color: TINTA_2 }}>
          {meta ? (
            <>
              de tu meta de <b style={{ color: DORADO }}>{plata(meta.usd)}</b>
            </>
          ) : (
            <>
              por {ftdMes} FTD este mes —{" "}
              <button onClick={() => setEditando(true)} className="underline font-semibold" style={{ color: DORADO }}>
                poné tu meta
              </button>
            </>
          )}
        </div>
      </div>

      {editando ? (
        <div
          className="flex items-end justify-center gap-3 flex-wrap px-5 py-4"
          style={{ borderTop: `1px solid ${BORDE}`, background: "rgba(255,255,255,.5)" }}
        >
          <label className="text-[11.5px]" style={{ color: TINTA_2 }}>
            Meta de FTD
            <input
              type="number"
              min={0}
              value={ftd}
              onChange={(e) => setFtd(e.target.value)}
              className="block w-[92px] mt-1 rounded-lg px-2.5 py-1.5 text-[16px] font-bold text-right tabular-nums bg-white outline-none"
              style={{ border: `1px solid ${BORDE}`, color: TINTA }}
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
              className="block w-[110px] mt-1 rounded-lg px-2.5 py-1.5 text-[16px] font-bold text-right tabular-nums bg-white outline-none"
              style={{ border: `1px solid ${BORDE}`, color: TINTA }}
            />
          </label>
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-full px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
            style={{ background: DORADO }}
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
              style={{ borderTop: `1px solid ${BORDE}`, background: "rgba(255,255,255,.45)", color: TINTA_3 }}
            >
              <span>
                meta <b style={{ color: TINTA }}>{meta.ftd} FTD</b>
              </span>
              <span style={{ color: "#D6C9AE" }}>·</span>
              <span>
                meta <b style={{ color: TINTA }}>{plata(meta.usd)}</b> facturado
              </span>
              <span className="text-[9px] opacity-60">{abierta ? "▲" : "▼"}</span>
            </button>

            {abierta && (
              <div
                className="px-5 pt-4 pb-5"
                style={{ borderTop: `1px solid ${BORDE}`, background: "rgba(255,255,255,.4)" }}
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
                    color={`linear-gradient(90deg,${DORADO_CLARO},${DORADO})`}
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
                  <button onClick={() => setEditando(true)} className="underline font-semibold" style={{ color: DORADO }}>
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
