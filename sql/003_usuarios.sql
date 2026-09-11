-- Usuarios del dashboard.
--
-- Cada usuario está atado a un agente de GHL (agent_id = el userId que GHL
-- pone en assignedTo). Eso es lo que permite mostrarle solo sus leads: la
-- sesión lleva ese id y todas las consultas se filtran con él en el servidor.
--
-- password_hash puede quedar en NULL a propósito: mientras esté vacío, la
-- persona entra con la contraseña común del equipo (AGENT_PASSWORD). Ponerle
-- una contraseña propia a alguien es llenar esa columna, sin migración.

create table if not exists usuarios (
  id            serial primary key,
  usuario       text        not null unique,
  nombre        text        not null,
  agent_id      text        not null,
  rol           text        not null default 'agente' check (rol in ('admin', 'agente')),
  password_hash text,
  activo        boolean     not null default true,
  creado_en     timestamptz not null default now()
);

create index if not exists usuarios_agent_id_idx on usuarios (agent_id);
