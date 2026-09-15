"use client";

import { useCallback, useEffect, useState } from "react";

import { BotonWhatsApp } from "@/components/ContactoRapido";
import { BotonLlamar, ReporteLlamada } from "@/components/Llamada";
import { FilaSeguimiento } from "@/components/FilaSeguimiento";
import type {
  Via,
  DiaDeSeguimiento,
  LeadEnBusiness,
  Promesa,
  Seguimiento as Datos,
} from "@/lib/seguimiento";

// Los títulos viven acá y no en lib/seguimiento: ese módulo importa la base de
// datos, y traérselo a un componente de cliente arrastra el driver de Postgres
// al paquete del navegador.
const VIA_TITULO: Record<Via, string> = {
  llego: "Confirmados en WhatsApp · falta cerrar",
  "clic-sin-llegar": "Hizo clic y no llegó",
  "tibio-sin-bajar": "Tibio sin bajar",
  "no-responde": "No responde",
};

/**
 * Las tres temperaturas, en el orden en que se trabaja el día: primero donde
 * está la plata más cerca. Cada una tiene su etiqueta y su flujo en GHL, y por
 * eso la lista se agrupa por acá y no por vía.
 */
const TEMPERATURAS = [
  { id: "caliente" as const, titulo: "Calientes", tag: "caliente", color: "#C0392B", fondo: "#FDF2F0" },
  { id: "tibio" as const, titulo: "Tibios", tag: "tibio", color: "#B5701F", fondo: "#FDF3E6" },
  { id: "frio" as const, titulo: "Fríos", tag: "frio", color: "#2A78D6", fondo: "#EEF3FA" },
];
const VIA_COLOR: Record<Via, string> = {
  llego: "#157F52",
  "clic-sin-llegar": "#C0392B",
  "tibio-sin-bajar": "#C08400",
  "no-responde": "#2A78D6",
};

/**
 * El seguimiento de los días anteriores y la agenda de promesas.
 *
 * El trabajo de la mañana no es el mes: es a quién de ayer le quedó algo
 * pendiente, después antier, después hace tres días. Por eso son pestañas y no
 * una lista larga — obligan a cerrar un día antes de pasar al siguiente.
 */

const AZUL = "#17457F";
const CELESTE = "#EAF1FA";
const ROJO = "#C0392B";
const VERDE = "#157F52";
const VERDE_CLARO = "#EEF7F2";
const GRIS_2 = "#5E5C56";
const AMBAR = "#B5701F";
const GRIS = "#9A998F";

function hora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

const RESULTADO: Record<string, string> = {
  registro: "se registró",
  deposita: "va a depositar",
  volver: "volver a llamar",
  "no-interesa": "no le interesa",
};

function Agenda({ promesas }: { promesas: Promesa[] }) {
  if (promesas.length === 0) return null;
  const vencidas = promesas.filter((p) => p.vencida);

  return (
    <section className="rounded-[22px] overflow-hidden bg-surface border border-gridline mb-5">
      <div
        className="flex items-center gap-x-3 gap-y-1 flex-wrap px-4 sm:px-5 py-2.5"
        style={{ background: AMBAR, color: "#fff" }}
      >
        <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Prometieron y falta cumplir</h2>
        {vencidas.length > 0 && (
          <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: ROJO }}>
            {vencidas.length} ya vencidas
          </span>
        )}
      </div>

      {promesas.map((p) => (
        <article
          key={p.llamadaId}
          className="flex items-center gap-2.5 px-4 sm:px-5 py-2 border-t border-gridline"
          style={{ background: p.vencida ? "#FDF2F0" : undefined }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <b className="text-[13.5px] font-semibold">{p.nombre || "Sin nombre"}</b>
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: p.vencida ? ROJO : AMBAR }}
              >
                {p.vencida ? "⏰ " : ""}
                {hora(p.cuando)}
              </span>
            </div>
            <p className="text-[11.5px] mt-0.5 truncate" style={{ color: GRIS }}>
              {RESULTADO[p.resultado ?? ""] ?? "quedó en algo"}
              {p.nota && ` · «${p.nota}»`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <ReporteLlamada contactId={p.contactId} />
            <BotonLlamar telefono={p.telefono} nombre={p.nombre ?? ""} contactId={p.contactId} tamano={26} />
            <BotonWhatsApp telefono={p.telefono} nombre={p.nombre ?? ""} tamano={26} />
          </div>
        </article>
      ))}
    </section>
  );
}

/**
 * Los que ya están en el WhatsApp Business del agente.
 *
 * Es la lista que el agente pidió y la que más pesa: acá el cliente ya salió
 * del alcance de GHL —no hay etiqueta que avise nada más— y lo único que
 * queda es que alguien lo trabaje. Por eso va primera, antes de las pestañas
 * por día, y por eso no se cae a los tres días como el resto.
 */
const DIAS_DEL_EMBUDO = [1, 2, 3, 7];

function EnMiBusiness({
  leads,
  onCerrado,
}: {
  leads: LeadEnBusiness[];
  onCerrado: (id: string) => void;
}) {
  const [dia, setDia] = useState(1);

  // El mismo embudo que el paso 3, pero el reloj arranca el día que el agente
  // confirmó que lo tiene, no el día que el lead entró por la pauta. Antes esto
  // era una lista suelta: al frío le dábamos tres días con estructura y al que
  // ya estaba en el WhatsApp —el que más cerca está de la plata— una lista.
  const porDia = new Map<number, LeadEnBusiness[]>();
  let ocultos = 0;
  for (const l of leads) {
    const n = l.dias + 1; // dias 0 = lo confirmó hoy = día 1
    if (!DIAS_DEL_EMBUDO.includes(n)) {
      ocultos += 1;
      continue;
    }
    porDia.set(n, [...(porDia.get(n) ?? []), l]);
  }
  const suyos = porDia.get(dia) ?? [];

  return (
    <section className="rounded-[22px] overflow-hidden bg-surface border border-gridline mb-5">
      <div
        className="flex items-center gap-x-3 gap-y-1 flex-wrap px-4 sm:px-5 py-2.5"
        style={{ background: VERDE, color: "#fff" }}
      >
        <h2 className="text-[15px] font-semibold tracking-[-0.02em]">En mi WhatsApp Business</h2>
        <span className="text-[12px]" style={{ color: "rgba(255,255,255,.72)" }}>
          confirmados por vos · acá arranca el seguimiento
        </span>
        <span
          className="ml-auto text-[12px] font-bold rounded-full px-2.5 py-0.5 tabular-nums"
          style={{ background: "rgba(255,255,255,.18)" }}
        >
          {leads.length}
        </span>
      </div>

      {leads.length === 0 ? (
        <p className="px-4 sm:px-5 py-4 text-[13px]" style={{ color: GRIS }}>
          Todavía no confirmaste a nadie. Cuando en el paso 3 digas que un cliente ya está en tu
          WhatsApp Business, aparece acá y no se va hasta que deposite o vos lo cierres.
        </p>
      ) : (
        <>
          <div className="flex gap-1.5 px-4 sm:px-5 py-2 border-b border-gridline flex-wrap items-center">
            {DIAS_DEL_EMBUDO.map((n) => (
              <button
                key={n}
                onClick={() => setDia(n)}
                className="rounded-full px-3 py-1 text-[12px] font-semibold"
                style={n === dia ? { background: VERDE, color: "#fff" } : { background: VERDE_CLARO, color: VERDE }}
              >
                Día {n}
                <b className="ml-1.5 tabular-nums font-bold opacity-70">{(porDia.get(n) ?? []).length}</b>
              </button>
            ))}
            {ocultos > 0 && (
              <span className="text-[11px] ml-auto" style={{ color: GRIS }}>
                {ocultos} en días 4–6 · vuelven el día 7
              </span>
            )}
          </div>

          {suyos.length === 0 ? (
            <p className="px-4 sm:px-5 py-4 text-[13px]" style={{ color: GRIS }}>
              {dia === 7
                ? "Nadie cumple siete días hoy."
                : `Nadie confirmado en el día ${dia}.`}
            </p>
          ) : (
            suyos.map((l) => (
              <FilaSeguimiento key={l.id} lead={l} pie={queToca(dia)} onCerrado={onCerrado} />
            ))
          )}
        </>
      )}
    </section>
  );
}

/** Qué toca hacer hoy con este cliente, según por qué día del embudo va. */
function queToca(dia: number): string {
  if (dia === 1) return "Día 1 · llegó hoy a tu WhatsApp — saludalo y arrancá";
  if (dia === 2) return "Día 2 · mandale el material y preguntá si le quedó claro";
  if (dia === 3) return "Día 3 · último empujón antes de que se enfríe";
  return "Día 7 · llamalo. A esta altura escribir ya no alcanza";
}

/**
 * Las tres partes se piden una sola vez.
 *
 * La pantalla monta tres veces este componente —la agenda, los confirmados y
 * las pestañas por día— porque cada uno vive bajo un paso distinto. Sin esto
 * serían tres barridos de GHL para la misma respuesta.
 */
let enVuelo: { en: number; promesa: Promise<Datos> } | null = null;

function pedirSeguimiento(forzar = false): Promise<Datos> {
  if (!forzar && enVuelo && Date.now() - enVuelo.en < 30_000) return enVuelo.promesa;
  const promesa = fetch("/api/seguimiento")
    .then(async (r) => {
      if (!r.ok) throw new Error((await r.json()).error ?? "Error al armar el seguimiento");
      return r.json() as Promise<Datos>;
    })
    .catch((e) => {
      enVuelo = null;
      throw e;
    });
  enVuelo = { en: Date.now(), promesa };
  return promesa;
}

export type ParteSeguimiento = "agenda" | "business" | "dias";

export function Seguimiento({ parte = "dias" }: { parte?: ParteSeguimiento }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dia, setDia] = useState(0);
  // Si nadie lo tocó todavía, se abre en el primer día que tenga algo: caer en
  // un «Ayer» vacío hace pensar que el módulo está roto, y el domingo pasado
  // no entró un solo lead.
  const [elegido, setElegido] = useState(false);

  const cargar = useCallback((forzar = false) => {
    setCargando(true);
    setError(null);
    pedirSeguimiento(forzar)
      .then((d: Datos) => {
        setDatos(d);
        if (!elegido) {
          const conAlgo = d.dias.findIndex((x) => x.leads.length > 0);
          setDia(conAlgo >= 0 ? conAlgo : 0);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [elegido]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const actual: DiaDeSeguimiento | undefined = datos?.dias[dia];
  // El día 1 no manda seguimiento: lo cubren los flujos de bienvenida que ya
  // existen. Los que mandan son el 2 y el 3.
  // El día 1 no manda nada: lo cubren los flujos de bienvenida. El día 7
  // tampoco: a esa altura el trabajo es llamar, no escribir.
  const etiquetaActual = datos?.dias[dia]?.etiqueta;
  const diaDelEmbudo: 2 | 3 | undefined =
    etiquetaActual === "Día 2" ? 2 : etiquetaActual === "Día 3" ? 3 : undefined;

  if (parte === "agenda") {
    return datos ? <Agenda promesas={datos.promesas} /> : null;
  }

  if (parte === "business") {
    if (!datos) {
      return (
        <section className="rounded-[22px] bg-surface border border-gridline mb-5 px-4 sm:px-5 py-4">
          <p className="text-[13px]" style={{ color: GRIS }}>
            {error ?? "Buscando a los que ya están en tu WhatsApp…"}
          </p>
        </section>
      );
    }
    return (
      <EnMiBusiness
        leads={datos.enBusiness}
        onCerrado={(id) =>
          setDatos((d) => (d ? { ...d, enBusiness: d.enBusiness.filter((l) => l.id !== id) } : d))
        }
      />
    );
  }

  return (
    <section className="rounded-[22px] overflow-hidden bg-surface border border-gridline mb-5">
      <div
        className="flex items-center gap-x-3 gap-y-1 flex-wrap px-4 sm:px-5 py-2.5"
        style={{ background: AZUL, color: "#fff" }}
      >
        <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Todavía no bajaron</h2>
        <span className="text-[12px]" style={{ color: "rgba(255,255,255,.6)" }}>
          hoy y los tres días anteriores
        </span>
        <button
          onClick={() => cargar(true)}
          disabled={cargando}
          className="ml-auto rounded-full px-2.5 py-[3px] text-[11px] disabled:opacity-50 hover:opacity-80"
          style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.28)" }}
        >
          {cargando ? "Leyendo…" : "↻ Actualizar"}
        </button>
      </div>

      {/* Pestañas por día: obligan a cerrar uno antes de pasar al siguiente,
          que es como se trabaja una lista de seguimiento. */}
      {datos && (
        <div className="flex gap-1.5 px-4 sm:px-5 py-2 border-b border-gridline flex-wrap items-center">
          {datos.dias.map((d, i) => (
            <button
              key={d.fecha}
              onClick={() => {
                setDia(i);
                setElegido(true);
              }}
              className="rounded-full px-3 py-1 text-[12px] font-semibold"
              style={i === dia ? { background: AZUL, color: "#fff" } : { background: CELESTE, color: AZUL }}
            >
              {d.etiqueta}
              <b className="ml-1.5 tabular-nums font-bold opacity-70">{d.leads.length}</b>
            </button>
          ))}
          {/* Sin este aviso, el agente que busca a alguien de hace cuatro días
              cree que el sistema lo perdió. */}
          {datos.ocultos > 0 && (
            <span className="text-[11px] ml-auto" style={{ color: GRIS }}>
              {datos.ocultos} en días 4–6 · vuelven el día 7
            </span>
          )}
        </div>
      )}

      {error && <p className="px-4 sm:px-5 py-4 text-[13px] text-series2">{error}</p>}

      {cargando && !datos && (
        <p className="px-4 sm:px-5 py-4 text-[13px]" style={{ color: GRIS }}>
          Armando el seguimiento…
        </p>
      )}

      {actual && actual.leads.length === 0 && !cargando && (
        <p className="px-4 sm:px-5 py-4 text-[13px]" style={{ color: GRIS }}>
          Ese día no entró ningún lead que siga pendiente.
        </p>
      )}

      {/* Agrupado por TEMPERATURA, que es lo que elige la etiqueta y por lo
          tanto el flujo que se dispara. Antes agrupaba por vía —hizo clic, no
          responde— y eso contaba otra historia: buena para entender al lead,
          inútil para saber qué mensaje le toca. La vía no se pierde: sigue en
          la fila, debajo del nombre. */}
      {TEMPERATURAS.map((t) => {
        const suyos = (actual?.leads ?? []).filter((l) => l.estado === t.id);
        if (suyos.length === 0) return null;
        return (
          <div key={t.id}>
            <div
              className="flex items-center gap-2 px-4 sm:px-5 py-[7px] border-t border-gridline"
              style={{ background: t.fondo }}
            >
              <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: t.color }} />
              <span className="text-[10px] font-bold uppercase tracking-[.16em]" style={{ color: t.color }}>
                {t.titulo}
              </span>
              <span className="text-[11px] tabular-nums font-bold" style={{ color: t.color, opacity: 0.55 }}>
                {suyos.length}
              </span>
              {/* Qué flujo se dispara desde acá. Es el único lugar donde el
                  agente ata lo que ve con lo que armó marketing en GHL. */}
              {diaDelEmbudo && (
                <span
                  className="ml-auto text-[10.5px] hidden sm:inline"
                  style={{ color: t.color, opacity: 0.5 }}
                >
                  seg-d{diaDelEmbudo}-{t.tag}
                </span>
              )}
            </div>
            {suyos.map((l) => (
              <FilaSeguimiento key={l.id} lead={l} dia={diaDelEmbudo} />
            ))}
          </div>
        );
      })}
    </section>
  );
}
