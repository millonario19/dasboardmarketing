import { getPool } from "./db";

/**
 * Cómo viene el agente, para poder decírselo.
 *
 * El tablero sabe contar. Lo que no hacía era mirar esos números y sacar una
 * conclusión: «entraron siete leads hoy y ninguno se registró» es un dato que
 * ya estaba en pantalla, repartido en tres celdas, y que nadie leía junto.
 *
 * Sale de `tag_history`, que guarda cada etiqueta con su fecha y su agente. No
 * le cuesta una llamada a GHL —es una consulta a nuestra base— y da lo único
 * que los totales del mes no dan: qué pasó cada día.
 */

const BOGOTA = "5 hours";

const TAG_LEAD = () => process.env.GHL_LEAD_TAG ?? "ingreso de pauta";
const TAG_REGISTRO = () => process.env.GHL_REGISTRO_TAG ?? "registrado";
const TAG_FTD = () => process.env.GHL_FTD_TAG ?? "ftd-efectuado";

export type DiaDelPulso = {
  /** Fecha de Bogotá, «2026-09-18». */
  dia: string;
  leads: number;
  registros: number;
  ftd: number;
};

export type Pulso = {
  /** Los últimos días, el más reciente primero. */
  dias: DiaDelPulso[];
  /**
   * Cuántos días hace que no cierra un FTD.
   *
   * `null` significa que no hay ninguno en lo que el tablero guarda, que no es
   * lo mismo que «nunca hizo»: el historial arranca el 10 de septiembre.
   */
  diasSinFtd: number | null;
  /** Desde cuándo hay historial, para no afirmar de más. */
  desde: string | null;
};

const VACIO: Pulso = { dias: [], diasSinFtd: null, desde: null };

/**
 * El pulso de un agente en los últimos días.
 *
 * Con `agentId` vacío devuelve el de toda la oficina, que es lo que mira la
 * dirección.
 */
export async function pulsoDe(agentId: string | null, dias = 7): Promise<Pulso> {
  try {
    const filtro = agentId ? "and agent_id = $4" : "";
    const args: unknown[] = [TAG_LEAD(), TAG_REGISTRO(), TAG_FTD()];
    if (agentId) args.push(agentId);

    const { rows } = await getPool().query<{
      dia: Date;
      leads: string;
      registros: string;
      ftd: string;
    }>(
      `select (occurred_at - interval '${BOGOTA}')::date as dia,
              count(*) filter (where tag = $1) as leads,
              count(*) filter (where tag = $2) as registros,
              count(*) filter (where tag = $3) as ftd
         from tag_history
        where occurred_at >= now() - interval '${dias} days'
          ${filtro}
        group by 1
        order by 1 desc`,
      args
    );

    const { rows: ultimo } = await getPool().query<{ dia: Date | null; desde: Date | null }>(
      `select max((occurred_at - interval '${BOGOTA}')::date) filter (where tag = $1) as dia,
              min((occurred_at - interval '${BOGOTA}')::date) as desde
         from tag_history
        where true ${agentId ? "and agent_id = $2" : ""}`,
      agentId ? [TAG_FTD(), agentId] : [TAG_FTD()]
    );

    const hoy = new Date(Date.now() - 5 * 3600e3);
    const aFecha = (d: Date) => d.toISOString().slice(0, 10);
    const ultimoFtd = ultimo[0]?.dia ?? null;

    return {
      dias: rows.map((r) => ({
        dia: aFecha(r.dia),
        leads: Number(r.leads),
        registros: Number(r.registros),
        ftd: Number(r.ftd),
      })),
      diasSinFtd: ultimoFtd
        ? Math.max(
            0,
            Math.round(
              (Date.parse(aFecha(hoy)) - Date.parse(aFecha(ultimoFtd))) / 864e5
            )
          )
        : null,
      desde: ultimo[0]?.desde ? aFecha(ultimo[0].desde) : null,
    };
  } catch {
    // Sin historial la pantalla se muestra igual, sin el recordatorio.
    return VACIO;
  }
}
