import { actualizarNombreContacto, obtenerContacto, contactDisplayName } from "./ghl";
import { getPool } from "./db";

/**
 * Corrección de nombres, con memoria de lo que había antes.
 *
 * Media base llega del formulario de Facebook con lo que el cliente quiso
 * poner: «mi guía», «mi hijo», «dios», un corazón. El agente que ya habló con
 * esa persona sabe el nombre real y es el único que lo sabe.
 *
 * Se guarda el original a propósito. Si se pisa sin dejar rastro se pierde la
 * evidencia de que la pauta trae gente que no escribe su nombre —que es un
 * dato de la pauta, no del agente— y, con doce personas editando, no habría
 * forma de distinguir una corrección de una equivocación.
 */

let tablaLista: Promise<void> | undefined;

function asegurarTabla(): Promise<void> {
  if (!tablaLista) {
    tablaLista = getPool()
      .query(
        `create table if not exists nombres_editados (
           contact_id text        primary key,
           original   text        not null,
           nuevo      text        not null,
           usuario    text        not null,
           editado_en timestamptz not null default now()
         )`
      )
      .then(() => undefined)
      .catch((e) => {
        tablaLista = undefined;
        throw e;
      });
  }
  return tablaLista;
}

/** «Juan Carlos Pérez Gómez» -> firstName «Juan Carlos», lastName «Pérez Gómez». */
function partir(nombre: string): { firstName: string; lastName: string } {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return { firstName: p[0] ?? "", lastName: "" };
  // Con cuatro o más, la mitad es nombre y la mitad apellido. Con dos o tres,
  // el primero es el nombre y el resto el apellido: es lo que acierta más
  // seguido en nombres colombianos.
  const corte = p.length >= 4 ? 2 : 1;
  return { firstName: p.slice(0, corte).join(" "), lastName: p.slice(corte).join(" ") };
}

export async function renombrarContacto(
  contactId: string,
  nuevo: string,
  usuario: string
): Promise<{ nombre: string; original: string }> {
  const limpio = nuevo.trim().replace(/\s+/g, " ");
  if (limpio.length < 2) throw new Error("El nombre tiene que tener al menos 2 letras");
  if (limpio.length > 80) throw new Error("El nombre es demasiado largo");

  await asegurarTabla();
  const contacto = await obtenerContacto(contactId);
  if (!contacto) throw new Error("Ese contacto no existe en GHL");
  const original = contactDisplayName(contacto);

  const { firstName, lastName } = partir(limpio);
  await actualizarNombreContacto(contactId, firstName, lastName);

  // El original se escribe una sola vez: en la segunda corrección, lo que
  // interesa seguir siendo es lo que trajo el formulario, no la corrección
  // anterior.
  await getPool().query(
    `insert into nombres_editados (contact_id, original, nuevo, usuario)
     values ($1, $2, $3, $4)
     on conflict (contact_id) do update
       set nuevo = excluded.nuevo, usuario = excluded.usuario, editado_en = now()`,
    [contactId, original, limpio, usuario]
  );

  return { nombre: limpio, original };
}
