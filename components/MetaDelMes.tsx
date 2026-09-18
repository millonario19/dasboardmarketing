"use client";

import { useEffect, useState, type ReactNode } from "react";
import { comisionPorFtd, ESCALONES } from "@/lib/comision";
import type { Meta } from "@/lib/metas";
import {
  MEMBRESIAS,
  SIN_MEMBRESIAS,
  metaDiaria,
  ritmoQueFalta,
  usdDeMembresias,
  unidadesDeMembresias,
  type ClaseMembresia,
  type Membresias,
} from "@/lib/comision";

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
/**
 * Los escalones rotulados, repartidos en partes iguales del arco.
 *
 * No van en su lugar de una escala lineal: ahí el 35 y el 45 quedaban
 * encimados en un rincón y el 120 y el 150 solos en el otro. Cada escalón es
 * un paso de la tabla, y darles a todos el mismo pedazo del reloj es la forma
 * de que se lean. La aguja interpola adentro de cada tramo, así que 80 FTD
 * cae justo entre el 65 y el 90.
 */
const ESCALA_FTD = [0, 35, 45, 65, 90, 120, 150];

/** La marca del reloj más cercana a ese punto del arco. */
function escalonEnPosicion(p: number): number {
  const ultimo = ESCALA_FTD.length - 1;
  const i = Math.round(Math.min(Math.max(p, 0), 1) * ultimo);
  return ESCALA_FTD[i];
}

/** Dónde cae esa cantidad de FTD sobre el arco, de 0 a 1. */
function posicionEnEscala(ftd: number): number {
  const ultimo = ESCALA_FTD.length - 1;
  if (ftd <= 0) return 0;
  if (ftd >= ESCALA_FTD[ultimo]) return 1;
  for (let i = 0; i < ultimo; i++) {
    const desde = ESCALA_FTD[i];
    const hasta = ESCALA_FTD[i + 1];
    if (ftd < hasta) {
      const dentro = (ftd - desde) / (hasta - desde);
      return (i + dentro) / ultimo;
    }
  }
  return 1;
}
const TOPE_RELOJ = ESCALA_FTD[ESCALA_FTD.length - 1];

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
  ftd,
  metaUsd,
  rotuloMeta,
  simulando,
  chico,
}: {
  /** Los FTD que marca la aguja. */
  ftd: number;
  /** El número grande del centro: la meta, o lo proyectado mientras arrastra. */
  metaUsd: number;
  /** El rótulo de abajo, que cambia cuando el número deja de ser la meta. */
  rotuloMeta: string;
  simulando: boolean;
  chico: boolean;
}) {
  const pct = posicionEnEscala(ftd);
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

  /**
   * La escala va en FTD, no en porcentaje.
   *
   * Un 0-25-50-75-100 obliga a traducir mentalmente: el agente no trabaja en
   * porcentajes, trabaja en FTD. Los números rotulados son los escalones que
   * pagan, así que la aguja además dice cuánto falta para que suba la
   * comisión, que es la pregunta de todos los días.
   *
   * Van en su lugar real sobre la escala —45 no cae en el cuarto del arco sino
   * donde le toca— porque lo contrario haría creer que de 45 a 65 hay tanto
   * camino como de 120 a 150, y no lo hay.
   */
  const marcas: ReactNode[] = [];
  for (let v = 0; v <= 40; v++) {
    const g = INICIO + (v / 40) * BARRIDO;
    const [x1, y1] = punto(g, R - GROSOR / 2 - 5);
    const [x2, y2] = punto(g, R - GROSOR / 2 - 10);
    marcas.push(
      <line
        key={`m${v}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={TINTA_3}
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity={0.35}
      />
    );
  }
  ESCALA_FTD.forEach((v, i) => {
    const g = INICIO + (i / (ESCALA_FTD.length - 1)) * BARRIDO;
    const [x1, y1] = punto(g, R - GROSOR / 2 - 5);
    const [x2, y2] = punto(g, R - GROSOR / 2 - 22);
    const [lx, ly] = punto(g, R - GROSOR / 2 - 38);
    marcas.push(
      <line key={`e${v}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={TINTA_3} strokeWidth={3} strokeLinecap="round" opacity={0.8} />,
      <text
        key={`t${v}`}
        x={lx}
        y={ly + 8}
        textAnchor="middle"
        fontSize={chico ? 32 : 23}
        fontWeight="700"
        fill={TINTA}
      >
        {v}
      </text>
    );
  });

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
    <svg
      viewBox={chico ? "40 66 680 412" : "0 0 760 516"}
      className="w-full max-w-[360px] sm:max-w-[620px] mx-auto block"
      aria-hidden
    >
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

      {ESCALA_FTD.map((v, i) => {
        const g = INICIO + (i / (ESCALA_FTD.length - 1)) * BARRIDO;
        const [ax, ay] = punto(g, R - GROSOR / 2 - 1);
        const [bx, by] = punto(g, R + GROSOR / 2 + 1);
        return <line key={`c${v}`} x1={ax} y1={ay} x2={bx} y2={by} stroke={FONDO} strokeWidth={4} />;
      })}

      {marcas}

      <path d={`M ${b1x} ${b1y} L ${px} ${py} L ${b2x} ${b2y} Z`} fill={TINTA} />
      <circle cx={CX} cy={CY} r={29} fill={TINTA} />
      <circle cx={CX} cy={CY} r={17} fill={TINTA} stroke={ORO} strokeWidth={4} />

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
        {plata(metaUsd)}
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
        {rotuloMeta}
      </text>
      <rect x={CX - 26} y={476} width={52} height={3} rx={1.5} fill={ORO} />
        </>
      )}
    </svg>
  );
}

/**
 * La marca de la casa: el monograma NX y la palabra.
 *
 * Es un dibujo de una sola línea —la N con su diagonal doblada y la X que
 * baja a tocarle la punta al pie de la N— y no un archivo de imagen. Así
 * queda nítido en cualquier tamaño y toma el color de la tinta del panel, que
 * es lo que lo deja bien en claro y en oscuro sin tener dos versiones.
 *
 * La palabra va en mayúsculas espaciadas y en peso liviano, como en la marca:
 * el monograma es lo que pesa, el nombre solo lo acompaña.
 */
function MarcaNexus() {
  return (
    <span className="flex flex-col items-center gap-2.5" style={{ color: TINTA }}>
      <svg
        width="96"
        height="48"
        viewBox="0 0 110 56"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        aria-label="Nexus"
        role="img"
      >
        {/* La N de un solo trazo: sube el palo izquierdo, baja la diagonal y
            vuelve a subir el palo derecho. */}
        <path d="M8 50 V16 L48 46 V6" />
        {/* La segunda diagonal, paralela y corrida hacia arriba, que se pasa
            de largo por abajo. Es el detalle que hace a esta marca esta marca
            y no una N cualquiera. */}
        <path d="M3 9 L54 47" />
        {/* La X, que arranca justo donde esa diagonal termina. */}
        <path d="M58 6 L104 50" />
        <path d="M104 6 L58 50" />
      </svg>
      <span className="text-[15px] font-light tracking-[.38em] leading-none pl-[.38em]">
        NEXUS
      </span>
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
        className="block text-[9px] sm:text-[10px] font-extrabold uppercase tracking-[.22em] leading-[1.45]"
        style={{ color: TINTA }}
      >
        {titulo}
      </span>
      <span
        className="block text-[8px] sm:text-[8.5px] font-semibold uppercase tracking-[.22em] mt-0.5"
        style={{ color: TINTA_3 }}
      >
        {pie}
      </span>
      <i className={`block w-[42px] h-[2px] rounded-sm mt-1.5 ${derecha ? "ml-auto" : ""}`} style={{ background: ORO }} />
    </span>
  );
}

export function MetaDelMes({ ftdMes }: { ftdMes: number }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [cargada, setCargada] = useState(false);
  const [abierta, setAbierta] = useState(false);
  const [editando, setEditando] = useState(false);
  const [ftd, setFtd] = useState("45");
  // Las dos listas de membresías: la que piensa vender y la que lleva vendida.
  const [plan, setPlan] = useState<Membresias>({ ...SIN_MEMBRESIAS });
  const [vendidas, setVendidas] = useState<Membresias>({ ...SIN_MEMBRESIAS });
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
          setPlan({ ...SIN_MEMBRESIAS, ...d.meta.plan });
          setVendidas({ ...SIN_MEMBRESIAS, ...d.meta.vendidas });
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

  function guardar(cierra = true, conVendidas = vendidas) {
    setGuardando(true);
    fetch("/api/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ftd: Number(ftd), plan, vendidas: conVendidas }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { meta: Meta }) => {
        setMeta(d.meta);
        if (cierra) setEditando(false);
      })
      .catch(() => undefined)
      .finally(() => setGuardando(false));
  }

  /** Anotar una membresía vendida, que es el único dato que nadie más tiene. */
  function anotarVenta(id: ClaseMembresia, delta: number) {
    const proxima = { ...vendidas, [id]: Math.max(0, (vendidas[id] || 0) + delta) };
    setVendidas(proxima);
    guardar(false, proxima);
  }

  // Los hooks van antes de cualquier return: mientras carga el componente
  // devolvía null, y al llegar la meta aparecía un hook nuevo. React cuenta
  // los hooks por render y esa diferencia tumba la pantalla entera.
  // Las dos mitades de la comisión: el escalón de FTD que ya alcanzó, y lo
  // que lleva vendido en membresías. El reloj muestra la suma, que es lo que
  // le entra en el bolsillo a fin de mes.
  const { pago, siguiente } = comisionPorFtd(ftdMes);
  const ganadoMembresias = usdDeMembresias(vendidas);
  const ganado = pago + ganadoMembresias;
  const objetivo = meta?.usd ?? 1500;
  /**
   * La aguja descansa en la meta, no en lo que lleva.
   *
   * Es la misma razón por la que el número grande es la meta: ver la aguja
   * clavada en cero el día 3 del mes no mueve a nadie. El reloj dice a dónde
   * va; lo que lleva lo dicen los cuatro datos de abajo y el renglón de la
   * comisión, que son los que tienen que ser exactos.
   *
   * Y por eso al soltar el arrastre vuelve acá: a los 45 FTD que se puso, no
   * a los 7 que lleva hoy.
   */
  const metaFtd = meta?.ftd ?? (Number(ftd) || 45);
  const barrido = useBarrido(metaFtd);
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
  /** Los FTD que marca la aguja: los de verdad, o los que está simulando. */
  const ftdMostrado = simulando ? simulado : barrido;
  /**
   * Lo que paga la tabla con esos FTD, sola.
   *
   * Sin sumarle las membresías a propósito: mover la aguja a 90 tiene que
   * decir los $850 de la tabla. Si le sumara lo vendido diría otro número y el
   * reloj dejaría de poderse leer contra la tabla, que es para lo que sirve.
   */
  const escalonMostrado = comisionPorFtd(Math.round(ftdMostrado));
  const plataMostrada = escalonMostrado.pago;

  /**
   * El número grande mientras se arrastra: lo que ganaría con ese escalón.
   *
   * Es la comisión del escalón más las membresías del plan. No es la meta más
   * la comisión: la meta ya trae adentro el escalón que eligió —los $360 de
   * los 45 FTD— y sumarla entera los contaría dos veces.
   */
  const membresiasDelPlan = usdDeMembresias(meta?.plan ?? plan);
  const proyectado = plataMostrada + membresiasDelPlan;


  if (!cargada) return null;
  const quedan = diasQueQuedan();
  const faltaFtd = meta ? Math.max(meta.ftd - ftdMes, 0) : 0;
  const faltaUsd = meta ? Math.max(meta.usd - ganado, 0) : 0;
  const pct = (a: number, b: number) => (b > 0 ? Math.min((a / b) * 100, 100) : 0);
  const porciento = Math.round(pct(ganado, objetivo));
  const porcientoFtd = posicionEnEscala(ftdMostrado) * 100;
  const porcientoAnimado = porcientoFtd;

  return (
    <section
      className="rounded-[18px] overflow-hidden mb-4 px-3 sm:px-5 pt-3.5 sm:pt-4 pb-3"
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

      {/* Solo el reloj. Las tarjetas de los lados —«Sigue avanzando» y
          «Disciplina, enfoque, resultados»— ocupaban un tercio del ancho para
          no decir nada que se pueda hacer hoy. */}
      <div className="mt-1">
        <Reloj
          ftd={ftdMostrado}
          metaUsd={simulando ? proyectado : objetivo}
          rotuloMeta={
            simulando
              ? `SI LLEGO A ${Math.round(ftdMostrado)} FTD`
              : `MI META DE ${MES.toUpperCase()}`
          }
          simulando={simulando}
          chico={chico}
        />
      </div>

      {/* De dónde sale la plata, en letra que se lee.
          Adentro del arco decía «lleva $350» y nada más: el agente no tenía
          cómo saber que esos $350 eran sus tres membresías anotadas y que sus
          7 FTD todavía no pagan nada. Acá entra la cuenta entera, y entra
          igual en el teléfono. */}
      <div className="text-center mt-1">
        <p
          className="text-[19px] sm:text-[22px] font-extrabold tracking-[-0.03em] tabular-nums"
          style={{ color: simulando ? AZUL : ganado > 0 ? VERDE : TINTA_3 }}
        >
          {simulando ? `Si llego: ${plata(proyectado)}` : `Llevo ${plata(ganado)}`}
        </p>
        <p className="text-[12px] sm:text-[13px] mt-1" style={{ color: TINTA_2 }}>
          {simulando ? (
            <>
              {plata(plataMostrada)} por los {Math.round(ftdMostrado)} FTD
              <span style={{ color: TINTA_3 }}> · </span>
              {plata(membresiasDelPlan)} por las membresías del plan
            </>
          ) : (
            <>
              <b style={{ color: pago > 0 ? TINTA : TINTA_3 }}>{plata(pago)}</b> por mis{" "}
              {ftdMes} FTD
              {pago === 0 && siguiente ? ` (el primer escalón son ${siguiente[0]})` : ""}
              <span style={{ color: TINTA_3 }}> · </span>
              <b style={{ color: ganadoMembresias > 0 ? TINTA : TINTA_3 }}>
                {plata(ganadoMembresias)}
              </b>{" "}
              por {unidadesDeMembresias(vendidas)}{" "}
              {unidadesDeMembresias(vendidas) === 1 ? "membresía" : "membresías"}
            </>
          )}
        </p>
      </div>

      <div className="mt-2">
        {/* Desde que la aguja descansa en la meta, el porcentaje del arco ya
            no dice cómo va sino dónde cae la meta en el dibujo. El que sirve
            es este: cuánto de su meta lleva hecho. */}
        <div className="text-right text-[12px] tabular-nums mb-1" style={{ color: TINTA_3 }}>
          <b className="font-extrabold" style={{ color: ftdMes > 0 ? VERDE : TINTA_3 }}>
            {Math.round(pct(ftdMes, metaFtd))}%
          </b>{" "}
          de mi meta
        </div>

        {/* La barra se puede arrastrar y el reloj la sigue. Es un input de
            rango de verdad —no un div con eventos— así que también anda con el
            teclado y lo lee un lector de pantalla. */}
        <div className="relative h-[20px] flex items-center">
          <div className="absolute inset-x-0 h-[11px] rounded-full overflow-hidden" style={{ background: RIEL }}>
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
            max={1000}
            step={1}
            value={Math.round(posicionEnEscala(ftdMostrado) * 1000)}
            onChange={(e) => setSimulado(escalonEnPosicion(Number(e.target.value) / 1000))}
            aria-label="Mover para simular otra cantidad de FTD"
            className="relative w-full appearance-none bg-transparent cursor-grab active:cursor-grabbing
                       [&::-webkit-slider-runnable-track]:h-[11px] [&::-webkit-slider-runnable-track]:bg-transparent
                       [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[19px]
                       [&::-webkit-slider-thumb]:h-[19px] [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[3px]
                       [&::-webkit-slider-thumb]:border-[#16233f] [&::-webkit-slider-thumb]:shadow-md
                       [&::-webkit-slider-thumb]:mt-[-4.5px]
                       [&::-moz-range-track]:h-[11px] [&::-moz-range-track]:bg-transparent
                       [&::-moz-range-thumb]:w-[19px] [&::-moz-range-thumb]:h-[19px]
                       [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white
                       [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-[#16233f]"
          />
        </div>

        <div className="flex justify-between text-[10.5px] tabular-nums mt-0.5" style={{ color: TINTA_3 }}>
          <span>0 FTD</span>
          <span>{TOPE_RELOJ} FTD</span>
        </div>

        {/* Lo que convierte el arrastre en información: cuánto cuesta llegar. */}
        <div className="h-[18px] mt-1 text-center text-[10.5px]">
          {simulando && (
            <span style={{ color: TINTA_2 }}>
              {(() => {
                const simu = Math.round(simulado ?? 0);
                const faltan = Math.max(simu - ftdMes, 0);
                const { siguiente: proximo } = comisionPorFtd(simu);
                if (faltan === 0) return `Eso ya lo cobra con sus ${ftdMes} FTD.`;
                const empuje = proximo
                  ? ` Con ${proximo[0] - simu} más el escalón sube a ${plata(proximo[1])}.`
                  : "";
                return `Le faltan ${faltan} FTD en ${quedan} días.${empuje}`;
              })()}{" "}
              <button onClick={() => setSimulado(null)} className="underline font-semibold" style={{ color: AZUL }}>
                volver a mi meta
              </button>
            </span>
          )}
        </div>
      </div>

      {/* En pantalla ancha todo esto vive adentro del arco. En el teléfono el
          arco mide unos 250 px y ahí no entra: baja acá, con tamaños de CSS
          que no dependen de cuánto se encoja el dibujo. */}
      <div className="sm:hidden text-center -mt-1">
        <p className="text-[34px] font-black tracking-[-0.045em] leading-none tabular-nums">
          {plata(simulando ? proyectado : objetivo)}
        </p>
        <p className="text-[8.5px] font-extrabold uppercase tracking-[.22em] mt-1.5" style={{ color: TINTA_2 }}>
          {simulando ? `Si llego a ${Math.round(ftdMostrado)} FTD` : `Mi meta de ${MES}`}
        </p>
        <i className="block w-[40px] h-[2px] rounded-sm mx-auto my-1.5" style={{ background: ORO }} />
      </div>

      <div className="flex items-center justify-center gap-2.5 mt-3">
        <i className="hidden sm:block w-[54px] h-[1.5px] shrink-0" style={{ background: ORO, opacity: 0.75 }} />
        <span className="text-[8.5px] sm:text-[9.5px] font-bold uppercase tracking-[.22em] text-center" style={{ color: TINTA_2 }}>
          Grandes resultados se construyen día a día
        </span>
        <i className="hidden sm:block w-[54px] h-[1.5px] shrink-0" style={{ background: ORO, opacity: 0.75 }} />
      </div>

      {editando ? (
        <div className="px-2 py-4 mt-4" style={{ borderTop: `1px solid ${LINEA}` }}>
          {/* Paso 1: el escalón. No se escribe un número suelto porque la
              comisión no es proporcional — con 50 FTD se cobra el escalón de
              45 igual que con 45. Elegir de la tabla evita ponerse una meta
              que no paga nada más que la de abajo. */}
          <p className="text-[12.5px] font-bold text-center" style={{ color: TINTA }}>
            ¿Cuál es su meta de FTD este mes?
          </p>
          <p className="text-[11px] text-center mb-2.5" style={{ color: TINTA_3 }}>
            Se paga por escalón alcanzado, no por FTD suelto
          </p>
          <div className="flex gap-1.5 flex-wrap justify-center">
            {ESCALONES.map(([cantidad, monto]) => (
              <button
                key={cantidad}
                onClick={() => setFtd(String(cantidad))}
                aria-pressed={Number(ftd) === cantidad}
                className="rounded-xl px-3 py-1.5 text-center min-w-[74px]"
                style={
                  Number(ftd) === cantidad
                    ? { background: AZUL, color: "#fff" }
                    : { background: PANEL, border: `1px solid ${LINEA}`, color: TINTA }
                }
              >
                <b className="block text-[15px] font-extrabold tabular-nums leading-none">{cantidad}</b>
                <span className="block text-[10.5px] tabular-nums opacity-75">{plata(monto)}</span>
              </button>
            ))}
          </div>

          {/* Paso 2: las membresías, que sí se pagan por unidad desde la
              primera. */}
          <p className="text-[12.5px] font-bold text-center mt-5" style={{ color: TINTA }}>
            ¿Cuál es su meta de membresías?
          </p>
          <p className="text-[11px] text-center mb-2.5" style={{ color: TINTA_3 }}>
            Ármela como la piensa lograr
          </p>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(188px,1fr))" }}>
            {MEMBRESIAS.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                style={{ background: PANEL, border: `1px solid ${LINEA}` }}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                <span className="min-w-0 flex-1">
                  <b className="block text-[12.5px] font-semibold" style={{ color: TINTA }}>{m.nombre}</b>
                  <span className="text-[10.5px] tabular-nums" style={{ color: TINTA_3 }}>
                    {plata(m.usd)} cada una
                  </span>
                </span>
                <button
                  onClick={() => setPlan({ ...plan, [m.id]: Math.max(0, (plan[m.id] || 0) - 1) })}
                  aria-label={`Menos ${m.nombre}`}
                  className="w-7 h-7 rounded-full text-[16px] leading-none"
                  style={{ border: `1px solid ${LINEA}`, color: TINTA }}
                >
                  −
                </button>
                <output className="w-6 text-center text-[15px] font-extrabold tabular-nums" style={{ color: TINTA }}>
                  {plan[m.id] || 0}
                </output>
                <button
                  onClick={() => setPlan({ ...plan, [m.id]: (plan[m.id] || 0) + 1 })}
                  aria-label={`Más ${m.nombre}`}
                  className="w-7 h-7 rounded-full text-[16px] leading-none"
                  style={{ border: `1px solid ${LINEA}`, color: TINTA }}
                >
                  +
                </button>
              </div>
            ))}
          </div>

          {/* La suma, en vivo: es lo que hace que elegir un escalón más alto o
              una membresía más se sienta antes de comprometerse. */}
          <div
            className="flex items-baseline gap-3 flex-wrap mt-4 pt-3.5"
            style={{ borderTop: `1px solid ${LINEA}` }}
          >
            <span>
              <span className="block text-[9.5px] font-bold uppercase tracking-[.16em]" style={{ color: TINTA_3 }}>
                Su meta de {MES}
              </span>
              <b className="block text-[30px] font-extrabold tracking-[-0.05em] leading-none tabular-nums mt-1" style={{ color: TINTA }}>
                {plata(comisionPorFtd(Number(ftd) || 0).pago + usdDeMembresias(plan))}
              </b>
            </span>
            <span className="ml-auto text-right text-[11.5px] tabular-nums" style={{ color: TINTA_2 }}>
              {ftd} FTD · {plata(comisionPorFtd(Number(ftd) || 0).pago)}
              <br />
              {unidadesDeMembresias(plan)} membresías · {plata(usdDeMembresias(plan))}
              <br />
              <b style={{ color: TINTA }}>{metaDiaria(Number(ftd) || 0)} FTD por día</b>
            </span>
          </div>

          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => guardar()}
              disabled={guardando}
              className="rounded-full px-5 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
              style={{ background: AZUL }}
            >
              {guardando ? "Guardando…" : "Guardar mi meta"}
            </button>
            <button onClick={() => setEditando(false)} className="rounded-full px-3 py-2 text-[12.5px]" style={{ color: TINTA_3 }}>
              Cancelar
            </button>
          </div>
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
          {/* Cuatro datos de FTD y nada más.
              Antes este renglón mezclaba la meta del día, la plata del mes y
              las membresías en una sola frase corrida, y decía dos veces lo
              mismo. Acá solo se habla de FTD: la plata y las membresías tienen
              su lugar abajo, al desplegar. */}
          <button
            onClick={alternar}
            aria-expanded={abierta}
            className="w-full mt-3 px-2 py-3.5 text-left"
            style={{ borderTop: `1px solid ${LINEA}` }}
          >
            <span className="flex items-stretch justify-center flex-wrap">
              {[
                { t: "Mi meta hoy", v: `${metaDiaria(meta.ftd)} FTD`, color: AZUL },
                { t: "Meta total", v: `${meta.ftd} FTD` },
                { t: "Llevo", v: `${ftdMes} FTD`, color: ftdMes > 0 ? VERDE : undefined },
                {
                  t: "Me faltan",
                  v: faltaFtd > 0 ? `${faltaFtd} FTD` : "cumplida",
                  color: faltaFtd > 0 ? ORO : VERDE,
                },
              ].map((c, i) => (
                <span
                  key={c.t}
                  className="px-3 sm:px-6 text-center"
                  style={{ borderLeft: i > 0 ? `1px solid ${LINEA}` : undefined }}
                >
                  <span
                    className="block text-[9.5px] font-bold uppercase tracking-[.14em] whitespace-nowrap"
                    style={{ color: TINTA_3 }}
                  >
                    {c.t}
                  </span>
                  <b
                    className="block text-[20px] sm:text-[23px] font-extrabold tracking-[-0.035em] tabular-nums leading-none mt-1.5 whitespace-nowrap"
                    style={{ color: c.color ?? TINTA }}
                  >
                    {c.v}
                  </b>
                </span>
              ))}
            </span>
            <span className="block text-center text-[9px] mt-2" style={{ color: TINTA_3 }}>
              {abierta ? "▲ ocultar el detalle" : "▼ ver la comisión y las membresías"}
            </span>
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
                    ? `Faltan ${faltaFtd} · ${ritmoQueFalta(meta.ftd, ftdMes)} por día en los ${quedan} días que quedan`
                    : "Meta cumplida 🎉"
                }
              />
              <div className="mt-4">
                <Barra
                  titulo="Comisión"
                  valor={`${plata(ganado)} de ${plata(meta.usd)}`}
                  pct={pct(ganado, meta.usd)}
                  color="linear-gradient(90deg,#1b4fe0,#f5a623)"
                  pie={
                    siguiente
                      ? `${plata(pago)} por FTD + ${plata(ganadoMembresias)} por membresías · con ${siguiente[0] - ftdMes} FTD más el escalón sube a ${plata(siguiente[1])}`
                      : faltaUsd > 0
                        ? `Faltan ${plata(faltaUsd)}`
                        : "Meta cumplida 🎉"
                  }
                />
              </div>

              {/* Las membresías vendidas las anota él.
                  No es pereza: no hay de dónde leerlas. Los FTD llegan de GHL
                  y los registros también, pero una venta de Oro no deja rastro
                  en ningún sistema que el tablero pueda consultar. Mientras no
                  lo haya, el único que sabe es el agente — y si no tiene dónde
                  anotarla, la mitad de su comisión no existe en la pantalla. */}
              <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${LINEA}` }}>
                <p className="text-[11px] font-bold uppercase tracking-[.14em] text-center" style={{ color: TINTA_3 }}>
                  Mis membresías vendidas
                </p>
                <div
                  className="grid gap-1.5 mt-2.5"
                  style={{ gridTemplateColumns: "repeat(auto-fit,minmax(176px,1fr))" }}
                >
                  {MEMBRESIAS.map((m) => {
                    const hechas = vendidas[m.id] || 0;
                    const pedidas = meta.plan[m.id] || 0;
                    return (
                      <div
                        key={m.id}
                        className="flex items-center gap-2 rounded-xl px-2.5 py-1.5"
                        style={{ background: PANEL, border: `1px solid ${LINEA}` }}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                        <span className="min-w-0 flex-1">
                          <b className="block text-[12px] font-semibold leading-tight" style={{ color: TINTA }}>
                            {m.nombre.replace("Miembro ", "")}
                          </b>
                          <span className="text-[10px] tabular-nums" style={{ color: TINTA_3 }}>
                            {hechas} de {pedidas} · {plata(hechas * m.usd)}
                          </span>
                        </span>
                        <button
                          onClick={() => anotarVenta(m.id, -1)}
                          disabled={guardando || hechas === 0}
                          aria-label={`Quitar una venta de ${m.nombre}`}
                          className="w-6 h-6 rounded-full text-[15px] leading-none disabled:opacity-30"
                          style={{ border: `1px solid ${LINEA}`, color: TINTA }}
                        >
                          −
                        </button>
                        <button
                          onClick={() => anotarVenta(m.id, 1)}
                          disabled={guardando}
                          aria-label={`Anotar una venta de ${m.nombre}`}
                          className="w-6 h-6 rounded-full text-[15px] leading-none text-white disabled:opacity-40"
                          style={{ background: VERDE }}
                        >
                          +
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap mt-4 text-[11px]" style={{ color: TINTA_3 }}>
                <span>
                  Los FTD los trae el CRM. Las membresías las anota usted, hasta que haya de dónde
                  leerlas.
                </span>
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
