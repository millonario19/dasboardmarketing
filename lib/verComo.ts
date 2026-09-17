import type { NextRequest } from "next/server";
import { agentesDeOficina } from "./oficinas";
import { usuarioPorAgentId } from "./usuarios";
import { alcanceDeAgente, sesionActual } from "./sesion";

/**
 * Mirar el tablero por los ojos de un agente.
 *
 * La dirección no quiere un informe sobre su gente: quiere ver lo que su gente
 * ve. Si Diana abre a Tatiana tiene que aparecerle el día de Tatiana —sus
 * pasos, sus pendientes, sus llamadas sin reportar— y no una tabla de
 * contactos que nadie usa para trabajar.
 *
 * Por eso el alcance puede venir de la URL, cosa que hasta ahora estaba
 * prohibida a propósito: si un agente pudiera mandar `?agente=otro`, el filtro
 * no filtraría nada. La regla que lo hace seguro es que el permiso se
 * comprueba acá y contra la base, no contra lo que diga el navegador:
 *
 *   admin    — puede mirar a cualquiera
 *   director — solo a la gente de su oficina
 *   agente   — a nadie; el parámetro se ignora y ve lo suyo
 *
 * Un director que pida a alguien de otra oficina no recibe un error distinto
 * del de un id inventado: en los dos casos vuelve a ver lo suyo. Decirle
 * «ese agente existe pero no es tuyo» ya sería contarle algo de otra oficina.
 */
export type Mirada = {
  /** Con qué id de GHL se filtran los contactos. */
  agentId: string | null;
  /**
   * Con qué login se buscan las tareas y las notas. Son dos llaves para la
   * misma persona: los contactos viven en GHL y se filtran por `agent_id`; las
   * tareas viven en nuestra base y se guardan por `usuario`.
   */
  usuario: string | null;
  /** Si está mirando a otro, y no lo suyo. */
  prestado: boolean;
};

export async function alcanceMirando(req: NextRequest): Promise<Mirada> {
  const sesion = await sesionActual();
  const propia: Mirada = {
    agentId: await alcanceDeAgente(),
    usuario: sesion?.rol === "agente" ? sesion.usuario : null,
    prestado: false,
  };

  const pedido = req.nextUrl.searchParams.get("agente");
  if (!pedido || !sesion) return propia;

  const puede =
    sesion.rol === "admin" ||
    (sesion.rol === "director" &&
      !!sesion.oficinaId &&
      (await agentesDeOficina(sesion.oficinaId).catch(() => [] as string[])).includes(pedido));

  // Ni admin ni dueño de ese agente: se ignora el pedido y sigue viendo lo suyo.
  if (!puede) return propia;

  const suyo = await usuarioPorAgentId(pedido).catch(() => null);
  return { agentId: pedido, usuario: suyo?.usuario ?? null, prestado: true };
}

/**
 * A nombre de quién se guarda lo que se acaba de hacer.
 *
 * Cuando la dirección entra al panel de un agente, el panel funciona: puede
 * confirmar una bajada, reportar una llamada, mandar un mensaje. Eso tiene que
 * quedar guardado a nombre del agente, no del director.
 *
 * Si quedara a nombre del director pasarían dos cosas feas a la vez: la tarea
 * de mañana le saldría a él —que no va a llamar a ese cliente— y le
 * desaparecería al agente, que es quien sí. Y el hilo del cliente diría que lo
 * llamó alguien con quien nunca habló.
 */
export async function usuarioQueActua(req: NextRequest): Promise<string> {
  const sesion = await sesionActual();
  const mirada = await alcanceMirando(req);
  return (mirada.prestado ? mirada.usuario : null) ?? sesion?.usuario ?? "";
}
