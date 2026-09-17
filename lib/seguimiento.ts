import {
  searchContacts,
  flujosPublicados,
  extractAttribution,
  contactDisplayName,
  type GhlContact,
} from "./ghl";
import {
  estadoDeLead,
  accionesDeLead,
  yaDeposito,
  confirmacionDeBajada,
  TAG_BUSINESS,
  TAG_BAJADA_SI,
  TAG_BAJADA_MANUAL,
  type EstadoLead,
} from "./leadStates";
import { notasDe, type Nota } from "./notas";
import { confirmadosDe } from "./confirmados";
import { tareasDe, cerrados, enviadosHoy, type Accion } from "./acciones";
import { ventanasDe, SIN_VENTANA, type Ventana } from "./ventana";
import { soloDelAgente } from "./metrics";
import { getPool } from "./db";

/**
 * El seguimiento de los días anteriores.
 *
 * El tablero mostraba el día de hoy y el mes entero, y entremedio no había
 * nada. Pero el trabajo de la mañana no es el mes: es «a quién de ayer le
 * quedé debiendo algo», y después antier, y después el de hace tres días. Un
 * lead de hace cuatro días ya está frío y no vale el mismo esfuerzo; uno de
 * ayer todavía se acuerda de la conversación.
 *
 * Aparte de los leads por día va la agenda: lo que un cliente prometió y no
 * cumplió. Ese dato no está en GHL ni en ninguna etiqueta — nace cuando el
 * agente reporta una llamada y dice «va a depositar el martes a las 9». Es el
 * único dato del tablero que crea trabajo para mañana.
 */

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Los días del embudo, contados desde que el lead entró por la pauta.
 *
 * Día 1 es el día que llegó. Los días 4, 5 y 6 no se muestran a propósito: a
 * esa altura el lead ya recibió tres toques y otro más seguido es la forma más
 * rápida de que te bloqueen. Vuelve el día 7, y ahí el trabajo es llamarlo, no
 * escribirle.
 */
export const DIAS_DEL_EMBUDO = [1, 2, 3, 7] as const;

/** Hasta dónde hay que mirar hacia atrás para armar todos los días. */
const DIAS_ATRAS = 6;

const CACHE_MS = 60_000;
const cache = new Map<string, { en: number; datos: Seguimiento }>();

/**
 * Lo que se está armando en este momento.
 *
 * Los pasos 3, 4 y 5 piden lo mismo por dos rutas distintas —«por-confirmar» y
 * «seguimiento»—, así que abrir dos pasos con la caché fría lanzaba dos veces
 * el mismo barrido de GHL, y las dos tardaban el doble por competir. Acá el
 * segundo se cuelga de la promesa del primero.
 */
const armando = new Map<string, Promise<Seguimiento>>();

/**
 * Tirar la caché cuando algo cambió de verdad.
 *
 * Armar el seguimiento cuesta un barrido de GHL, así que se guarda un minuto.
 * El problema es que ese minuto tapaba el trabajo recién hecho: el agente
 * mandaba un seguimiento, recargaba, y la pantalla le devolvía la foto de
 * antes — sin el «✓ enviado» y con el botón otra vez disponible.
 *
 * Lo llaman las rutas que escriben: mandar un seguimiento, confirmar una
 * bajada, registrar una acción.
 */
export function invalidarSeguimiento(): void {
  cache.clear();
}

/**
 * Por dónde va este lead.
 *
 * No es la temperatura —eso dice cuánto interés tiene— sino qué hay que hacer
 * con él. La diferencia que importa es una sola: si llegó o no al WhatsApp
 * Business del agente, porque a partir de ahí el sistema deja de ver.
 */
export type Via = "llego" | "clic-sin-llegar" | "tibio-sin-bajar" | "no-responde";

export const VIA_TITULO: Record<Via, string> = {
  llego: "Calientes · falta confirmar",
  "clic-sin-llegar": "Hizo clic y no llegó",
  "tibio-sin-bajar": "Tibio sin bajar",
  "no-responde": "No responde",
};

export type LeadDeSeguimiento = {
  id: string;
  nombre: string;
  telefono: string | null;
  creado: string;
  agente: string;
  estado: EstadoLead;
  acciones: string[];
  via: Via;
  /** Lo que el agente escribió de su puño; vacío hasta que escriba. */
  nota: Nota | null;
  /**
   * La próxima tarea que el agente se puso. Vacío significa algo concreto: a
   * este cliente nadie le programó nada, y un cliente sin próxima tarea se
   * muere solo. Por eso la lista lo marca en rojo en vez de dejarlo pasar.
   */
  tarea: Accion | null;
  /**
   * Tocó el botón de bajar a WhatsApp y nadie dijo si del otro lado apareció.
   * Mientras siga así cuenta como caliente, y puede ser mentira.
   */
  porConfirmar: boolean;
  /**
   * Ya está en el WhatsApp del agente, por cualquiera de los dos caminos: el
   * cliente tocó el botón y él lo confirmó, o él se copió el número.
   */
  enMiWhatsApp: boolean;
  /**
   * Cuánto le queda de la ventana de 24 horas de Meta. De acá sale si el
   * seguimiento del día sale gratis o hay que gastar una plantilla — y si se
   * puede mandar algo, para empezar.
   */
  ventana: Ventana;
  /** Si ya le salió el seguimiento del embudo hoy, a qué hora. */
  enviadoHoy: string | null;
  /** La ficha del contacto en GHL, para ir a ver la conversación de verdad. */
  crmUrl: string;
  /**
   * Por dónde entró, según la atribución de Meta.
   *
   * Sirve para explicar el hueco cuando no hay teléfono: los de Messenger e
   * Instagram nunca traen número, y los de anuncio de clic a WhatsApp llegan
   * con una identidad tapada (`CO.1553…`) en vez del celular. Decirlo en la
   * fila evita que el agente crea que el tablero se lo perdió.
   */
  medio: string | null;
};

/**
 * Alguien que ya está en el WhatsApp Business del agente.
 *
 * Es la lista que de verdad importa: el cliente salió del alcance de GHL y
 * ahora depende de que el agente lo trabaje. No entra por el día en que el
 * lead llegó por la pauta —eso es otra cosa— sino por el día en que el agente
 * confirmó que lo tiene, y no se cae a los tres días: se sale de la lista
 * cuando deposita o cuando el agente marca «Cerrar seguimiento».
 */
export type LeadEnBusiness = LeadDeSeguimiento & {
  /** Cómo llegó al WhatsApp del agente. */
  comoLlego: "confirmado" | "manual";
  /** Cuándo el agente dijo que sí. */
  confirmadoEn: string;
  /** Días completos desde entonces, para saber por dónde va la cadencia. */
  dias: number;
};

/** Un clic en «bajar a WhatsApp» que nadie respondió si terminó en algo. */
export type PorConfirmar = {
  id: string;
  nombre: string;
  telefono: string | null;
  agente: string;
  creado: string;
  /** Cuándo tocó el botón. Null si el clic es anterior al sondeo. */
  clicEn: string | null;
  /**
   * Lo que ya contestó el agente, si contestó.
   *
   * Los contestados se quedan en la lista hasta que termina el día. Antes
   * desaparecían al responder y el agente perdía de vista a quién había
   * confirmado esa mañana — la lista del día no puede borrarse sola mientras
   * se trabaja.
   */
  confirmado: "si" | "no" | null;
};

export type Promesa = {
  llamadaId: number;
  contactId: string;
  nombre: string | null;
  telefono: string | null;
  /** Cuándo dijo el cliente que iba a hacerlo. */
  cuando: string;
  /** Ya pasó la hora y nadie volvió a llamar. */
  vencida: boolean;
  resultado: string | null;
  nota: string | null;
};

export type DiaDeSeguimiento = {
  fecha: string; // YYYY-MM-DD en Bogotá
  etiqueta: string; // «Hoy», «Ayer», «Antier», «Hace 3 días»
  leads: LeadDeSeguimiento[];
  // Cuántos hay de cada temperatura, para verlo sin abrir la pestaña.
  porEstado: Record<EstadoLead, number>;
};

export type Seguimiento = {
  dias: DiaDeSeguimiento[];
  /**
   * Cuántos quedaron en los días 4, 5 y 6, que no se muestran. No es un número
   * decorativo: sin él, el agente que buscaba a alguien cree que se perdió.
   */
  ocultos: number;
  /** Los que ya están en el WhatsApp Business del agente. */
  enBusiness: LeadEnBusiness[];
  /**
   * Todos los que entraron hoy, sin filtrar.
   *
   * Las pestañas por día sacan a los confirmados —están en su propia lista— y
   * eso tiene sentido para el seguimiento, pero no para la lista de llamadas
   * del día: el confirmado es justamente al que hay que llamar. Acá van todos,
   * fríos, tibios y calientes, incluidos los que ya se bajaron.
   */
  hoy: LeadDeSeguimiento[];
  /** Lo primero del día: el sistema sabe que hicieron clic, no si llegaron. */
  porConfirmar: PorConfirmar[];
  promesas: Promesa[];
  /**
   * Los flujos de GHL que existen y están publicados.
   *
   * Sin esto el panel ofrecía «enviar plantilla» para una etiqueta que nadie
   * escuchaba: no salía nada, la etiqueta quedaba pegada al contacto, y la
   * pantalla decía «mensaje enviado». Tres mentiras en un clic.
   */
  flujos: string[];
  generadoEn: string;
};

/** La ficha del contacto en el CRM. */
function fichaEnCrm(contactId: string): string {
  const base = (process.env.GHL_CRM_URL ?? "https://app.nexusia.com.co").replace(/\/+$/, "");
  return `${base}/v2/location/${process.env.GHL_LOCATION_ID}/contacts/detail/${contactId}`;
}

function inicioDeDiaBogota(ms: number): number {
  const local = new Date(ms - BOGOTA_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + BOGOTA_OFFSET_MS;
}

function diaBogota(iso: string): string {
  return new Date(new Date(iso).getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Cuándo tocó cada uno el botón de bajar a WhatsApp.
 *
 * La etiqueta de GHL no trae hora, pero el sondeo de `tag_history` anota la
 * primera vez que la vio. Es aproximado —hasta lo que tarde el sondeo— y
 * alcanza de sobra para saber si el clic fue hoy.
 *
 * Sin esto, el aviso «tocaron tu WhatsApp» acumulaba una semana entera de
 * preguntas sin decir de cuándo era cada una.
 */
async function clicsDeBusiness(contactIds: string[]): Promise<Map<string, string>> {
  const salida = new Map<string, string>();
  if (contactIds.length === 0) return salida;
  try {
    const { rows } = await getPool().query<{ contact_id: string; occurred_at: Date }>(
      `select contact_id, occurred_at from tag_history
        where tag = $1 and contact_id = any($2::text[])`,
      [TAG_BUSINESS, contactIds]
    );
    for (const f of rows) salida.set(f.contact_id, f.occurred_at.toISOString());
  } catch {
    /* sin sondeo no se sabe la hora del clic */
  }
  return salida;
}

function viaDeLead(contacto: GhlContact, estado: EstadoLead): Via {
  const hizoClic = (contacto.tags ?? []).some((t) => t.toLowerCase() === TAG_BUSINESS);
  // El «no» del agente no lo devuelve al montón de tibios: este ya levantó la
  // mano y se cayó en el último paso, y se trabaja distinto.
  if (hizoClic && confirmacionDeBajada(contacto) === "no") return "clic-sin-llegar";
  // Los confirmados salieron de las pestañas por día: tienen su propia lista,
  // ordenada por cuándo se confirmaron. Lo que queda acá es el caliente al que
  // todavía nadie le verificó que llegó.
  if (estado === "caliente") return "llego";
  if (estado === "tibio") return "tibio-sin-bajar";
  return "no-responde";
}

/**
 * Los que ya están en el WhatsApp Business del agente.
 *
 * Búsqueda propia, sin la ventana de tres días: a estos no se los deja de
 * seguir porque hayan entrado hace una semana. Se cierran solos cuando
 * depositan, y a mano cuando el agente elige «Cerrar seguimiento».
 */
async function enMiBusiness(soloAgente: string | null | undefined): Promise<LeadEnBusiness[]> {
  const leadTag = process.env.GHL_LEAD_TAG ?? "ingreso de pauta";

  /**
   * Se busca por la etiqueta de bajada, no por toda la pauta.
   *
   * Esta lista no tiene corte de fecha —el seguimiento de un confirmado no se
   * puede caer a los tres días— y por eso antes barría el histórico completo:
   * 5.213 contactos en 53 páginas seguidas, 47 segundos, cada vez que alguien
   * abría un paso. Era el 90% de la demora de la pantalla.
   *
   * GHL cruza los filtros con Y, así que pedirle «pauta + bajada confirmada»
   * devuelve exactamente los mismos contactos en una página y medio segundo.
   * Son dos búsquedas porque las dos formas de llegar al WhatsApp del agente
   * cuentan: el cliente tocó el botón y el agente lo confirmó, o el agente se
   * copió el número y se lo llevó él. La segunda es como trabaja la mayoría.
   */
  const [porClic, porMano] = await Promise.all([
    searchContacts([
      { field: "tags", operator: "contains", value: leadTag },
      { field: "tags", operator: "contains", value: TAG_BAJADA_SI },
    ]),
    searchContacts([
      { field: "tags", operator: "contains", value: leadTag },
      { field: "tags", operator: "contains", value: TAG_BAJADA_MANUAL },
    ]),
  ]);

  // Quien tiene las dos etiquetas aparece en las dos búsquedas.
  const unicos = new Map<string, GhlContact>();
  for (const c of [...porClic, ...porMano]) unicos.set(c.id, c);

  const contactos = await soloDelAgente([...unicos.values()], soloAgente);
  const conVida = (contactos as GhlContact[]).filter((c) => !yaDeposito(c));
  const idsTodos = conVida.map((c) => c.id);
  const yaCerrados = await cerrados(idsTodos);
  // El agente da por terminado el seguimiento desde la misma ficha donde lo
  // hace todo. Sin esa salida la lista solo crece.
  const vivos = conVida.filter((c) => !yaCerrados.has(c.id));
  const ids = vivos.map((c) => c.id);
  const [notas, confirmados, tareas] = await Promise.all([
    notasDe(ids),
    confirmadosDe(ids),
    tareasDe(ids),
  ]);

  const ahora = Date.now();
  const salida: LeadEnBusiness[] = [];

  for (const contacto of vivos) {
    const nota = notas.get(contacto.id) ?? null;
    if (nota?.proximaAccion === CERRADO) continue;

    const { agent } = await extractAttribution(contacto);
    const confirmadoEn = confirmados.get(contacto.id) ?? contacto.dateAdded;
    salida.push({
      id: contacto.id,
      nombre: contactDisplayName(contacto),
      telefono: contacto.phone ?? null,
      creado: contacto.dateAdded,
      agente: agent,
      estado: estadoDeLead(contacto),
      acciones: accionesDeLead(contacto),
      via: "llego",
      comoLlego: (contacto.tags ?? []).some((t) => t.toLowerCase() === TAG_BAJADA_MANUAL)
        ? "manual"
        : "confirmado",
      nota,
      tarea: tareas.get(contacto.id) ?? null,
      // Ya confirmado: no hay nada que preguntar.
      porConfirmar: false,
      enMiWhatsApp: true,
      // Los confirmados no reciben automáticos: su ventana no se mira.
      ventana: SIN_VENTANA,
      enviadoHoy: null,
      crmUrl: fichaEnCrm(contacto.id),
      medio: contacto.attributionSource?.medium ?? null,
      confirmadoEn,
      dias: Math.max(
        0,
        Math.floor((inicioDeDiaBogota(ahora) - inicioDeDiaBogota(new Date(confirmadoEn).getTime())) / 864e5)
      ),
    });
  }

  // El último confirmado arriba: es el que todavía está caliente.
  salida.sort((a, b) => b.confirmadoEn.localeCompare(a.confirmadoEn));
  return salida;
}

/** Lo que el agente elige cuando ya no hay nada más que hacer con el cliente. */
export const CERRADO = "Cerrar seguimiento";


/**
 * Lo que el cliente prometió, todavía sin cumplir.
 *
 * Solo entran las llamadas donde el agente dejó una fecha: «va a depositar» o
 * «volver a llamar». Las que ya vencieron van primero, porque son las que
 * alguien dejó pasar.
 */
async function promesasPendientes(usuario: string | null): Promise<Promesa[]> {
  try {
    const { rows } = await getPool().query<{
      id: string | number;
      contact_id: string;
      nombre: string | null;
      telefono: string | null;
      promesa_en: Date;
      resultado: string | null;
      nota: string | null;
    }>(
      `select id, contact_id, nombre, telefono, promesa_en, resultado, nota
         from llamadas
        where promesa_en is not null
          and reportado_en is not null
          and promesa_en >= now() - interval '15 days'
          -- Desde que reportar una llamada crea la tarea en «acciones», la
          -- promesa ya se ve en «Leads programados». Mostrarla acá también la
          -- ponía dos veces en la misma pantalla. Las viejas —las que se
          -- prometieron antes de ese cambio y no tienen tarea— siguen
          -- saliendo: nadie pierde lo que ya había prometido.
          and not exists (
            select 1 from acciones a
             where a.contact_id = llamadas.contact_id
               and a.vence_en is not null
               and a.hecha_en is null
               and a.cerrada_en is null
          )
          ${usuario ? "and usuario = $1" : ""}
        order by promesa_en`,
      usuario ? [usuario] : []
    );
    const ahora = Date.now();
    return rows.map((f) => ({
      llamadaId: Number(f.id),
      contactId: f.contact_id,
      nombre: f.nombre,
      telefono: f.telefono,
      cuando: f.promesa_en.toISOString(),
      vencida: f.promesa_en.getTime() < ahora,
      resultado: f.resultado,
      nota: f.nota,
    }));
  } catch {
    // La tabla se crea sola en el primer reporte de llamada; hasta entonces no
    // hay agenda, y eso no es un error.
    return [];
  }
}

export async function computeSeguimiento(
  soloAgente: string | null | undefined,
  usuario: string | null,
  dias = DIAS_ATRAS
): Promise<Seguimiento> {
  const llave = `${soloAgente ?? "todos"}|${usuario ?? "-"}|${dias}`;
  const guardado = cache.get(llave);
  if (guardado && Date.now() - guardado.en < CACHE_MS) return guardado.datos;

  const yaVa = armando.get(llave);
  if (yaVa) return yaVa;

  const trabajo = construirSeguimiento(soloAgente, usuario, dias, llave).finally(() => {
    armando.delete(llave);
  });
  armando.set(llave, trabajo);
  return trabajo;
}

async function construirSeguimiento(
  soloAgente: string | null | undefined,
  usuario: string | null,
  dias: number,
  llave: string
): Promise<Seguimiento> {
  const ahora = Date.now();

  const arrancaHoy = inicioDeDiaBogota(ahora);
  // La ventana incluye hoy: el seguimiento del día en curso es el primero que
  // se mira, no el último.
  const desde = new Date(arrancaHoy - dias * 864e5).toISOString();
  const hasta = new Date(ahora).toISOString();

  // Una sola búsqueda cubre los tres días; separarlos serían tres consultas
  // para el mismo dato.
  const contactos = await soloDelAgente(
    await searchContacts([
      { field: "tags", operator: "contains", value: process.env.GHL_LEAD_TAG ?? "ingreso de pauta" },
      { field: "dateAdded", operator: "range", value: { gte: desde, lte: hasta } },
    ]),
    soloAgente
  );

  const porDia = new Map<string, LeadDeSeguimiento[]>();
  const porConfirmar: PorConfirmar[] = [];
  const utiles: { contacto: GhlContact; agente: string; estado: EstadoLead }[] = [];

  const clics = await clicsDeBusiness((contactos as GhlContact[]).map((c) => c.id));

  const crudosDeHoy: { contacto: GhlContact; agente: string; estado: EstadoLead }[] = [];

  for (const contacto of contactos as GhlContact[]) {
    // Los que ya depositaron salen: el seguimiento es de lo que falta cerrar.
    if (yaDeposito(contacto)) continue;
    const { agent } = await extractAttribution(contacto);
    const estado = estadoDeLead(contacto);
    // Los confirmados no entran a las pestañas por día —tienen su propia lista,
    // que no se cae a los tres días— pero sí siguen contando para la pregunta
    // del día, con su respuesta puesta.
    const yaConfirmado =
      confirmacionDeBajada(contacto) === "si" ||
      (contacto.tags ?? []).some((t) => t.toLowerCase() === TAG_BAJADA_MANUAL);
    if (!yaConfirmado) utiles.push({ contacto, agente: agent, estado });
    // La lista de llamadas del día los quiere a todos, confirmados incluidos.
    if (diaBogota(contacto.dateAdded) === diaBogota(new Date(arrancaHoy + 3600e3).toISOString())) {
      crudosDeHoy.push({ contacto, agente: agent, estado });
    }

    // Los clics con su fecha. El recorte por día lo hace la pantalla, que es la
    // que sabe qué día está mirando el agente: si eligió el 14 en el paso 2, el
    // paso 3 tiene que hablar del 14 y no de hoy.
    const hizoClic = (contacto.tags ?? []).some((t) => t.toLowerCase() === TAG_BUSINESS);
    const clic = clics.get(contacto.id) ?? null;
    if (hizoClic && clic) {
      porConfirmar.push({
        id: contacto.id,
        nombre: contactDisplayName(contacto),
        telefono: contacto.phone ?? null,
        agente: agent,
        creado: contacto.dateAdded,
        clicEn: clic,
        confirmado: confirmacionDeBajada(contacto),
      });
    }
  }

  const idsUtiles = [
    ...new Set([...utiles.map((u) => u.contacto.id), ...crudosDeHoy.map((u) => u.contacto.id)]),
  ];

  // La ventana solo se calcula para los días que mandan seguimiento —el 2 y el
  // 3—. Averiguarla cuesta abrir la conversación de cada lead, una llamada por
  // cabeza, y hacerlo para los siete días dejaba la pantalla en segundos por un
  // dato que en el día 1, el 7 y los ocultos no se usa para nada.
  const diaDe = (iso: string) =>
    Math.round((arrancaHoy - inicioDeDiaBogota(new Date(iso).getTime())) / 864e5) + 1;
  // Los de hoy también: desde que se les puede escribir desde el panel hay que
  // saber por dónde habla cada uno —WhatsApp, Instagram, Messenger— o el botón
  // manda al agente a un error de GHL en vez de a la conversación. Son pocos,
  // los del día, y las conversaciones ahora se abren de a seis.
  const idsConVentana = [
    ...new Set([
      ...utiles.filter((u) => [2, 3].includes(diaDe(u.contacto.dateAdded))).map((u) => u.contacto.id),
      ...crudosDeHoy.map((u) => u.contacto.id),
    ]),
  ];

  const [notas, tareasPorDia, cerradosPorDia, ventanas, enviados] = await Promise.all([
    notasDe(idsUtiles),
    tareasDe(idsUtiles),
    cerrados(idsUtiles),
    ventanasDe(idsConVentana),
    enviadosHoy(idsUtiles),
  ]);

  for (const { contacto, agente, estado } of utiles) {
    // Cerrado a mano en la ficha: no vuelve a salir en ninguna pestaña.
    if (cerradosPorDia.has(contacto.id)) continue;
    const dia = diaBogota(contacto.dateAdded);
    const lista = porDia.get(dia) ?? [];
    lista.push({
      id: contacto.id,
      nombre: contactDisplayName(contacto),
      telefono: contacto.phone ?? null,
      creado: contacto.dateAdded,
      agente,
      estado,
      acciones: accionesDeLead(contacto),
      via: viaDeLead(contacto, estado),
      nota: notas.get(contacto.id) ?? null,
      tarea: tareasPorDia.get(contacto.id) ?? null,
      porConfirmar:
        (contacto.tags ?? []).some((t) => t.toLowerCase() === TAG_BUSINESS) &&
        confirmacionDeBajada(contacto) === null,
      enMiWhatsApp:
        confirmacionDeBajada(contacto) === "si" ||
        (contacto.tags ?? []).some((t) => t.toLowerCase() === TAG_BAJADA_MANUAL),
      ventana: ventanas.get(contacto.id) ?? SIN_VENTANA,
      enviadoHoy: enviados.get(contacto.id) ?? null,
      crmUrl: fichaEnCrm(contacto.id),
      medio: contacto.attributionSource?.medium ?? null,
    });
    porDia.set(dia, lista);
  }

  // Caliente primero: es donde está la plata más cerca. Y dentro de cada
  // temperatura, la ventana que se cierra antes — esa se pierde si nadie la
  // toca hoy, y con ella el envío gratis.
  const orden: Record<EstadoLead, number> = { caliente: 0, tibio: 1, frio: 2 };
  const salida: DiaDeSeguimiento[] = [];
  let ocultos = 0;
  for (let n = 1; n <= dias + 1; n++) {
    const i = n - 1; // día 1 es hoy: cero días atrás
    const fecha = diaBogota(new Date(arrancaHoy - i * 864e5 + 3600e3).toISOString());
    if (!(DIAS_DEL_EMBUDO as readonly number[]).includes(n)) {
      ocultos += (porDia.get(fecha) ?? []).length;
      continue;
    }
    const leads = (porDia.get(fecha) ?? []).sort(
      (a, b) =>
        orden[a.estado] - orden[b.estado] ||
        (a.ventana.cierraEn ?? "9").localeCompare(b.ventana.cierraEn ?? "9") ||
        b.creado.localeCompare(a.creado)
    );
    const porEstado = { frio: 0, tibio: 0, caliente: 0 } as Record<EstadoLead, number>;
    for (const l of leads) porEstado[l.estado] += 1;
    salida.push({ fecha, etiqueta: `Día ${n}`, leads, porEstado });
  }

  const armar = (
    contacto: GhlContact,
    agente: string,
    estado: EstadoLead
  ): LeadDeSeguimiento => ({
    id: contacto.id,
    nombre: contactDisplayName(contacto),
    telefono: contacto.phone ?? null,
    creado: contacto.dateAdded,
    agente,
    estado,
    acciones: accionesDeLead(contacto),
    via: viaDeLead(contacto, estado),
    nota: notas.get(contacto.id) ?? null,
    tarea: tareasPorDia.get(contacto.id) ?? null,
    porConfirmar:
      (contacto.tags ?? []).some((t) => t.toLowerCase() === TAG_BUSINESS) &&
      confirmacionDeBajada(contacto) === null,
    enMiWhatsApp:
      confirmacionDeBajada(contacto) === "si" ||
      (contacto.tags ?? []).some((t) => t.toLowerCase() === TAG_BAJADA_MANUAL),
    ventana: ventanas.get(contacto.id) ?? SIN_VENTANA,
    enviadoHoy: enviados.get(contacto.id) ?? null,
    crmUrl: fichaEnCrm(contacto.id),
    medio: contacto.attributionSource?.medium ?? null,
  });

  const ordenTemp: Record<EstadoLead, number> = { caliente: 0, tibio: 1, frio: 2 };
  const hoy = crudosDeHoy
    .map((u) => armar(u.contacto, u.agente, u.estado))
    .sort(
      (a, b) => ordenTemp[a.estado] - ordenTemp[b.estado] || a.creado.localeCompare(b.creado)
    );

  const [enBusiness, promesas, flujos] = await Promise.all([
    enMiBusiness(soloAgente),
    promesasPendientes(usuario),
    flujosPublicados(),
  ]);

  const datos: Seguimiento = {
    dias: salida,
    hoy,
    ocultos,
    enBusiness,
    porConfirmar,
    promesas,
    flujos,
    generadoEn: new Date(ahora).toISOString(),
  };
  cache.set(llave, { en: ahora, datos });
  // Queda en el log del contenedor: si la pantalla vuelve a ponerse lenta, este
  // número dice en un vistazo si es el barrido de GHL o es otra cosa.
  console.log(`[seguimiento] ${llave} armado en ${Date.now() - ahora}ms`);
  return datos;
}
