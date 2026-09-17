"use client";

import { useEffect, useState, type ReactNode } from "react";
import { comisionPorFtd, ESCALONES } from "@/lib/comision";
import type { Meta } from "@/lib/metas";

/**
 * La meta del mes, arriba de todo.
 *
 * Un tablero que solo mide no mueve a nadie. Esta es la única parte de la
 * pantalla que habla de la plata del agente, así que va antes que los pasos:
 * no es un resumen del día, es el motivo por el que abre el tablero.
 *
 * El reloj no es adorno. «$420» suelto no dice si eso está bien o mal; la
 * aguja contra la meta sí, y se lee de un vistazo desde el otro lado del
 * escritorio.
 */

const TINTA = "#16233f";
const TINTA_2 = "#5b6782";
const TINTA_3 = "#939db4";
const LINEA = "#eceff4";
const PANEL = "#fbfcfe";
const FONDO = "#ffffff";
const RIEL = "#e3e6ec";
const ORO = "#f5a623";
const AZUL = "#2563eb";
const ROJO = "#E10600";
const VERDE = "#157F52";

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
 * El barrido de arranque: la aguja sale de cero y sube hasta donde va.
 *
 * No es adorno. Ver el recorrido es lo que hace que el número se sienta ganado
 * en vez de dado, y de paso muestra cuánto falta antes de que uno lea nada.
 *
 * La red de seguridad importa: con la pestaña en segundo plano el navegador
 * congela requestAnimationFrame y la aguja se quedaría clavada en cero. Ya
 * pasó una vez. El temporizador la deja siempre donde corresponde, corra la
 * animación o no.
 */
function useBarrido(objetivo: number, ms = 1200): number {
  const [valor, setValor] = useState(objetivo);

  useEffect(() => {
    const quieto =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (quieto || objetivo <= 0) {
      setValor(objetivo);
      return;
    }

    let cuadro = 0;
    const arranque = performance.now();
    setValor(0);

    const paso = (ahora: number) => {
      const k = Math.min((ahora - arranque) / ms, 1);
      // Frena al final: llega rápido y se acomoda, como una aguja de verdad.
      setValor(objetivo * (1 - Math.pow(1 - k, 3)));
      if (k < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);

    const red = setTimeout(() => {
      cancelAnimationFrame(cuadro);
      setValor(objetivo);
    }, ms + 500);

    return () => {
      cancelAnimationFrame(cuadro);
      clearTimeout(red);
    };
  }, [objetivo, ms]);

  return valor;
}

/**
 * ¿Estamos en un teléfono?
 *
 * El reloj es un SVG que se escala al ancho disponible, y con él se escala su
 * tipografía: los 13 puntos del rótulo terminan siendo 6 píxeles en una
 * pantalla de 375. Lo que en el escritorio es un detalle, en el teléfono no se
 * lee. Por eso el reloj se dibuja distinto según dónde esté.
 */
function useChico(): boolean {
  const [chico, setChico] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 640px)");
    const ver = () => setChico(m.matches);
    ver();
    m.addEventListener("change", ver);
    return () => m.removeEventListener("change", ver);
  }, []);
  return chico;
}

/* ── el reloj ─────────────────────────────────────────────────────────── */

const CX = 380;
const CY = 330;
const R = 230;
const GROSOR = 32;
const INICIO = 150;
const BARRIDO = 240;

/**
 * La rampa del arco: azul brillante al arrancar, azul marino en el tope y
 * dorado al acercarse a la meta. El color dice dónde está parado; la aguja y
 * el número dicen cuánto.
 */
const RAMPA: [number, [number, number, number]][] = [
  [0.0, [46, 123, 246]],
  [0.2, [27, 79, 224]],
  [0.4, [15, 42, 128]],
  [0.52, [11, 30, 94]],
  [0.64, [62, 74, 118]],
  [0.76, [201, 146, 46]],
  [1.0, [245, 166, 35]],
];

function colorEn(t: number): string {
  for (let i = 1; i < RAMPA.length; i++) {
    if (t <= RAMPA[i][0]) {
      const [t0, a] = RAMPA[i - 1];
      const [t1, b] = RAMPA[i];
      const k = (t - t0) / (t1 - t0 || 1);
      return `rgb(${[0, 1, 2].map((j) => Math.round(a[j] + (b[j] - a[j]) * k)).join(",")})`;
    }
  }
  return "rgb(245,166,35)";
}

const rad = (g: number) => (g * Math.PI) / 180;
const punto = (g: number, r: number): [number, number] => [
  CX + r * Math.cos(rad(g)),
  CY + r * Math.sin(rad(g)),
];

function arco(d1: number, d2: number, r: number): string {
  const a = punto(d1, r);
  const b = punto(d2, r);
  return `M ${a[0].toFixed(2)} ${a[1].toFixed(2)} A ${r} ${r} 0 ${d2 - d1 > 180 ? 1 : 0} 1 ${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
}

function Reloj({
  logrado,
  meta,
  simulando,
  chico,
}: {
  logrado: number;
  meta: number;
  simulando: boolean;
  chico: boolean;
}) {
  const pct = meta > 0 ? Math.min(logrado / meta, 1) : 0;
  const ang = INICIO + pct * BARRIDO;

  // El arco de color va por tramos para que el degradado siga la curva: un
  // linearGradient recto lo dibujaría en diagonal sobre un arco de 240°.
  const PASOS = 120;
  const tramos: { d: string; color: string; punta: boolean }[] = [];
  for (let i = 0; i < PASOS; i++) {
    const t0 = i / PASOS;
    if (t0 >= pct) break;
    const t1 = Math.min((i + 1) / PASOS, pct);
    tramos.push({
      d: arco(INICIO + t0 * BARRIDO, INICIO + t1 * BARRIDO + 0.35, R),
      color: colorEn(t0),
      punta: i === 0,
    });
  }

  const marcas: ReactNode[] = [];
  for (let v = 0; v <= 100; v += 2.5) {
    const g = INICIO + (v / 100) * BARRIDO;
    const grande = v % 25 === 0;
    const media = v % 12.5 === 0;
    const [x1, y1] = punto(g, R - GROSOR / 2 - 5);
    const [x2, y2] = punto(g, R - GROSOR / 2 - (grande ? 22 : media ? 16 : 10));
    marcas.push(
      <line
        key={`m${v}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={TINTA_3}
        strokeWidth={grande ? 3 : media ? 2 : 1.4}
        strokeLinecap="round"
        opacity={grande ? 0.8 : media ? 0.55 : 0.35}
      />
    );
    if (grande) {
      const [lx, ly] = punto(g, R - GROSOR / 2 - 36);
      marcas.push(
        <text key={`t${v}`} x={lx} y={ly + 8} textAnchor="middle" fontSize={chico ? 34 : 24} fontWeight="700" fill={TINTA}>
          {v}
        </text>
      );
    }
  }

  const [px, py] = punto(ang, R - GROSOR / 2 - 24);
  const [b1x, b1y] = punto(ang + 90, 13);
  const [b2x, b2y] = punto(ang - 90, 13);

  // El texto lleva un halo del color del fondo: a mitad de camino la aguja
  // apunta derecho arriba y le pasaría por encima a la frase. Un tablero de
  // verdad la pasa por detrás.
  const halo = {
    stroke: FONDO,
    strokeWidth: 7,
    paintOrder: "stroke" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg viewBox={chico ? "40 66 680 412" : "0 0 760 516"} className="w-full" aria-hidden>
      <path d={arco(INICIO, INICIO + BARRIDO, R)} stroke={RIEL} strokeWidth={GROSOR} fill="none" strokeLinecap="round" />
      {tramos.map((t, i) => (
        <path
          key={i}
          d={t.d}
          stroke={t.color}
          strokeWidth={GROSOR}
          fill="none"
          strokeLinecap={t.punta ? "round" : "butt"}
        />
      ))}

      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const g = INICIO + t * BARRIDO;
        const [ax, ay] = punto(g, R - GROSOR / 2 - 1);
        const [bx, by] = punto(g, R + GROSOR / 2 + 1);
        return <line key={`c${t}`} x1={ax} y1={ay} x2={bx} y2={by} stroke={FONDO} strokeWidth={3.5} />;
      })}

      {marcas}

      <path d={`M ${b1x} ${b1y} L ${px} ${py} L ${b2x} ${b2y} Z`} fill={TINTA} />
      <circle cx={CX} cy={CY} r={29} fill={TINTA} />
      <circle cx={CX} cy={CY} r={17} fill={TINTA} stroke={ORO} strokeWidth={4} />

      {!chico && (
        <>
          <text x={CX} y={226} textAnchor="middle" fontSize="21" fill={TINTA} {...halo}>
            Un sueño necesita un plan
          </text>
          <text x={CX} y={256} textAnchor="middle" fontSize="21" fontWeight="700" fill={TINTA} {...halo}>
            para despertarlo.
          </text>
          <rect x={CX - 26} y={271} width={52} height={3} rx={1.5} fill={ORO} />
        </>
      )}

      {/* Grande va la meta, no lo que lleva. Ver «$0» a principio de mes no
          mueve a nadie; ver a dónde va, sí. Lo que lleva lo dice la aguja, y
          el número chico de abajo lo pone en plata. */}
      {!chico && (
        <>
      <text
        x={CX}
        y={430}
        textAnchor="middle"
        fontSize={64}
        fontWeight="900"
        letterSpacing={-2.5}
        fill={TINTA}
        {...halo}
      >
        {plata(meta)}
      </text>
      <text
        x={CX}
        y={462}
        textAnchor="middle"
        fontSize={13}
        fontWeight="800"
        letterSpacing={5}
        fill={TINTA_2}
      >
        MI META DE {MES.toUpperCase()}
      </text>
      <rect x={CX - 26} y={476} width={52} height={3} rx={1.5} fill={ORO} />
      <text
        x={CX}
        y={499}
        textAnchor="middle"
        fontSize={17}
        fontWeight="700"
        fill={simulando ? AZUL : logrado > 0 ? VERDE : TINTA_3}
      >
        {simulando ? `si llega a ${plata(logrado)}` : `lleva ${plata(logrado)}`}
      </text>
        </>
      )}
    </svg>
  );
}

/** La marca de la casa, en lugar del logo prestado. */
function MarcaNexus() {
  return (
    <span className="flex flex-col items-center gap-1.5">
      <svg width="76" height="26" viewBox="0 0 76 26" aria-hidden>
        <path d="M4 22 L20 4 h11 L15 22 Z" fill={ROJO} />
        <path d="M24 22 L40 4 h11 L35 22 Z" fill={ROJO} opacity=".7" />
        <path d="M44 22 L60 4 h11 L55 22 Z" fill={ROJO} opacity=".4" />
      </svg>
      <span className="text-[30px] font-black tracking-[-0.035em] leading-none">Nexus</span>
    </span>
  );
}

function Circulo({ children }: { children: ReactNode }) {
  return (
    <span
      className="w-[56px] h-[56px] rounded-full flex items-center justify-center mx-auto mb-3"
      style={{ background: FONDO, boxShadow: `inset 0 0 0 1px ${LINEA}` }}
    >
      {children}
    </span>
  );
}

function Rotulo({ titulo, pie, derecha = false }: { titulo: string; pie: string; derecha?: boolean }) {
  return (
    <span className={derecha ? "text-right" : undefined}>
      <span
        className="block text-[10.5px] sm:text-[11.5px] font-extrabold uppercase tracking-[.26em] leading-[1.5]"
        style={{ color: TINTA }}
      >
        {titulo}
      </span>
      <span
        className="block text-[9px] sm:text-[10px] font-semibold uppercase tracking-[.26em] mt-1"
        style={{ color: TINTA_3 }}
      >
        {pie}
      </span>
      <i className={`block w-[56px] h-[3px] rounded-sm mt-2.5 ${derecha ? "ml-auto" : ""}`} style={{ background: ORO }} />
    </span>
  );
}

export function MetaDelMes({ ftdMes }: { ftdMes: number }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [cargada, setCargada] = useState(false);
  const [abierta, setAbierta] = useState(false);
  const [editando, setEditando] = useState(false);
  const [ftd, setFtd] = useState("45");
  const [usd, setUsd] = useState("1500");
  const [guardando, setGuardando] = useState(false);
  const chico = useChico();

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
      .catch(() => undefined)
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

  // Los hooks van antes de cualquier return: mientras carga el componente
  // devolvía null, y al llegar la meta aparecía un hook nuevo. React cuenta
  // los hooks por render y esa diferencia tumba la pantalla entera.
  const { pago, siguiente } = comisionPorFtd(ftdMes);
  const objetivo = meta?.usd ?? 1500;
  // La aguja y la barra suben juntas desde cero al abrir la pantalla.
  const barrido = useBarrido(pago);
  /**
   * El agente puede arrastrar la barra para ver el reloj moverse.
   *
   * Podría quedar en un juguete, y un juguete sobre la plata de alguien es
   * mentira. Lo que lo hace útil es la línea de abajo: mientras arrastra, el
   * panel le dice cuántos FTD necesita para llegar ahí. Deja de ser «mirá cómo
   * se mueve» y pasa a ser «esto es lo que te cuesta».
   */
  const [simulado, setSimulado] = useState<number | null>(null);
  const simulando = simulado !== null;
  const mostrado = simulando ? simulado : barrido;

  if (!cargada) return null;
  const quedan = diasQueQuedan();
  const faltaFtd = meta ? Math.max(meta.ftd - ftdMes, 0) : 0;
  const faltaUsd = meta ? Math.max(meta.usd - pago, 0) : 0;
  const pct = (a: number, b: number) => (b > 0 ? Math.min((a / b) * 100, 100) : 0);
  const porciento = Math.round(pct(pago, objetivo));
  const porcientoAnimado = pct(mostrado, objetivo);

  return (
    <section
      className="rounded-[22px] overflow-hidden mb-6 px-4 sm:px-7 pt-5 sm:pt-6 pb-4"
      style={{
        border: `1px solid ${LINEA}`,
        background: `radial-gradient(900px 520px at 50% 8%, rgba(37,99,235,.045), transparent 62%), ${FONDO}`,
        color: TINTA,
      }}
    >
      <div className="flex justify-between items-start gap-4">
        <Rotulo titulo={`Comisión de ${MES}`} pie="Tu esfuerzo genera libertad" />
        <span className="hidden sm:flex items-start gap-2.5">
          <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden className="mt-0.5 hidden sm:block">
            <g fill={TINTA_3}>
              <rect x="0" y="0" width="7.5" height="5.5" />
              <rect x="15" y="0" width="7.5" height="5.5" />
              <rect x="7.5" y="5.5" width="7.5" height="5.5" />
              <rect x="22.5" y="5.5" width="7.5" height="5.5" />
              <rect x="0" y="11" width="7.5" height="5.5" />
              <rect x="15" y="11" width="7.5" height="5.5" />
              <rect x="7.5" y="16.5" width="7.5" height="5.5" />
              <rect x="22.5" y="16.5" width="7.5" height="5.5" />
            </g>
          </svg>
          <Rotulo titulo="Más que números" pie="Es tu futuro" derecha />
        </span>
      </div>

      {/* En el teléfono solo el reloj: las tarjetas de los lados son ánimo, y
          el ánimo no vale media pantalla de scroll. */}
      <div className="grid grid-cols-1 lg:grid-cols-[196px_1fr_196px] gap-4 items-center mt-1">
        <div
          className="hidden lg:block rounded-[20px] text-center px-4 py-6"
          style={{ background: PANEL, border: `1px solid ${LINEA}` }}
        >
          <span className="block mb-5">
            <MarcaNexus />
          </span>
          <Circulo>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={TINTA_3}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M8 21h8M12 17.5V21M7 3h10v6a5 5 0 0 1-10 0V3Z" />
              <path d="M17 4.5h3.2v1.8a3.2 3.2 0 0 1-3.2 3.2M7 4.5H3.8v1.8A3.2 3.2 0 0 0 7 9.5" />
            </svg>
          </Circulo>
          <p className="text-[10.5px] font-bold uppercase tracking-[.22em] leading-[2.1]" style={{ color: TINTA_2 }}>
            Sigue avanzando
            <br />
            tu momento es ahora
          </p>
        </div>

        <Reloj logrado={mostrado} meta={objetivo} simulando={simulando} chico={chico} />

        <div
          className="hidden lg:block rounded-[20px] text-center px-4 py-10"
          style={{ background: PANEL, border: `1px solid ${LINEA}` }}
        >
          <Circulo>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={AZUL} strokeWidth="1.5" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="8.2" />
              <circle cx="12" cy="12" r="4.4" />
              <circle cx="12" cy="12" r="1.2" fill={AZUL} />
              <path d="M12 1.6v2.6M12 19.8v2.6M22.4 12h-2.6M4.2 12H1.6" />
            </svg>
          </Circulo>
          <p className="text-[10.5px] font-bold uppercase tracking-[.22em] leading-[2.1]" style={{ color: TINTA }}>
            Disciplina
            <br />
            enfoque
            <br />
            resultados
          </p>
        </div>
      </div>

      <div className="mt-2">
        <div className="text-right text-[14px] font-extrabold tabular-nums mb-1.5">
          {Math.round(porcientoAnimado)}%
        </div>

        {/* La barra se puede arrastrar y el reloj la sigue. Es un input de
            rango de verdad —no un div con eventos— así que también anda con el
            teclado y lo lee un lector de pantalla. */}
        <div className="relative h-[26px] flex items-center">
          <div className="absolute inset-x-0 h-[15px] rounded-full overflow-hidden" style={{ background: RIEL }}>
            <span
              className="block h-full rounded-full"
              style={{
                width: `${porcientoAnimado}%`,
                background: "linear-gradient(90deg,#2e7bf6 0%,#1b4fe0 26%,#0f2a80 50%,#8a7a52 76%,#f5a623 100%)",
              }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(objetivo, 1)}
            step={Math.max(Math.round(objetivo / 100), 1)}
            value={Math.round(mostrado)}
            onChange={(e) => setSimulado(Number(e.target.value))}
            aria-label="Mover para simular otra comisión"
            className="relative w-full appearance-none bg-transparent cursor-grab active:cursor-grabbing
                       [&::-webkit-slider-runnable-track]:h-[15px] [&::-webkit-slider-runnable-track]:bg-transparent
                       [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[24px]
                       [&::-webkit-slider-thumb]:h-[24px] [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[3px]
                       [&::-webkit-slider-thumb]:border-[#16233f] [&::-webkit-slider-thumb]:shadow-md
                       [&::-webkit-slider-thumb]:mt-[-4.5px]
                       [&::-moz-range-track]:h-[15px] [&::-moz-range-track]:bg-transparent
                       [&::-moz-range-thumb]:w-[24px] [&::-moz-range-thumb]:h-[24px]
                       [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white
                       [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-[#16233f]"
          />
        </div>

        <div className="flex justify-between text-[12px] tabular-nums mt-1" style={{ color: TINTA_3 }}>
          <span>$0</span>
          <span>{plata(objetivo)}</span>
        </div>

        {/* Lo que convierte el arrastre en información: cuánto cuesta llegar. */}
        <div className="h-[22px] mt-1.5 text-center text-[12px]">
          {simulando && (
            <span style={{ color: TINTA_2 }}>
              {(() => {
                const escalon = ESCALONES.find(([, p]) => p >= (simulado ?? 0));
                if (!escalon) return "Eso pasa el último escalón de la tabla.";
                const faltan = Math.max(escalon[0] - ftdMes, 0);
                return faltan === 0
                  ? `Ya cobrás eso con tus ${ftdMes} FTD.`
                  : `Necesitás ${escalon[0]} FTD — te faltan ${faltan} en ${quedan} días.`;
              })()}{" "}
              <button onClick={() => setSimulado(null)} className="underline font-semibold" style={{ color: AZUL }}>
                volver a mi número
              </button>
            </span>
          )}
        </div>
      </div>

      {/* En pantalla ancha todo esto vive adentro del arco. En el teléfono el
          arco mide unos 250 px y ahí no entra: baja acá, con tamaños de CSS
          que no dependen de cuánto se encoja el dibujo. */}
      <div className="sm:hidden text-center -mt-1">
        <p className="text-[44px] font-black tracking-[-0.045em] leading-none tabular-nums">
          {plata(objetivo)}
        </p>
        <p className="text-[10px] font-extrabold uppercase tracking-[.26em] mt-2" style={{ color: TINTA_2 }}>
          Mi meta de {MES}
        </p>
        <i className="block w-[52px] h-[3px] rounded-sm mx-auto my-2" style={{ background: ORO }} />
        <p
          className="text-[14px] font-bold"
          style={{ color: simulando ? AZUL : pago > 0 ? VERDE : TINTA_3 }}
        >
          {simulando ? `si llega a ${plata(mostrado)}` : `lleva ${plata(pago)}`}
        </p>
        <p className="text-[13px] leading-snug mt-3" style={{ color: TINTA }}>
          Un sueño necesita un plan <b className="font-bold">para despertarlo.</b>
        </p>
      </div>

      <div className="flex items-center justify-center gap-3.5 mt-5">
        <i className="hidden sm:block w-[76px] h-[2px] shrink-0" style={{ background: ORO, opacity: 0.75 }} />
        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.26em] text-center" style={{ color: TINTA_2 }}>
          Grandes resultados se construyen día a día
        </span>
        <i className="hidden sm:block w-[76px] h-[2px] shrink-0" style={{ background: ORO, opacity: 0.75 }} />
      </div>

      {editando ? (
        <div className="flex items-end justify-center gap-3 flex-wrap px-2 py-4 mt-4" style={{ borderTop: `1px solid ${LINEA}` }}>
          <label className="text-[11.5px]" style={{ color: TINTA_2 }}>
            Meta de FTD
            <input
              type="number"
              min={0}
              value={ftd}
              onChange={(e) => setFtd(e.target.value)}
              className="block w-[92px] mt-1 rounded-lg px-2.5 py-1.5 text-[16px] font-bold text-right tabular-nums outline-none"
              style={{ border: `1px solid ${LINEA}`, color: TINTA, background: PANEL }}
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
              style={{ border: `1px solid ${LINEA}`, color: TINTA, background: PANEL }}
            />
          </label>
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-full px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
            style={{ background: AZUL }}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <button onClick={() => setEditando(false)} className="rounded-full px-3 py-2 text-[12.5px]" style={{ color: TINTA_3 }}>
            Cancelar
          </button>
        </div>
      ) : !meta ? (
        <div className="text-center mt-4 pt-4" style={{ borderTop: `1px solid ${LINEA}` }}>
          <button
            onClick={() => setEditando(true)}
            className="text-[12.5px] font-bold uppercase tracking-[.14em] underline"
            style={{ color: AZUL }}
          >
            Ponga su meta
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={alternar}
            aria-expanded={abierta}
            className="w-full flex items-center justify-center gap-2.5 flex-wrap px-4 py-3 mt-4 text-[11.5px]"
            style={{ borderTop: `1px solid ${LINEA}`, color: TINTA_3 }}
          >
            <span>
              meta <b style={{ color: TINTA }}>{meta.ftd} FTD</b>
            </span>
            <span style={{ color: RIEL }}>·</span>
            <span>
              meta <b style={{ color: TINTA }}>{plata(meta.usd)}</b> facturado
            </span>
            <span className="text-[9px] opacity-60">{abierta ? "▲" : "▼"}</span>
          </button>

          {abierta && (
            <div className="pt-4 pb-2" style={{ borderTop: `1px solid ${LINEA}` }}>
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
                  color="linear-gradient(90deg,#1b4fe0,#f5a623)"
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
                <button onClick={() => setEditando(true)} className="underline font-semibold" style={{ color: AZUL }}>
                  Cambiar mi meta
                </button>
              </div>
            </div>
          )}
        </>
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
