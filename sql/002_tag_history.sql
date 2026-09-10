-- Cuaderno de etiquetas: una fila la primera vez que se ve una etiqueta sobre
-- un contacto. GHL no guarda cuándo se agregó un tag, así que este historial
-- es la única forma de medir tiempos (velocidad de primera respuesta, leads
-- estancados). Lo llena el sondeo de /api/cron/tag-snapshot.
create table if not exists tag_history (
  id bigserial primary key,
  contact_id text not null,        -- id del contacto en GHL
  tag text not null,               -- etiqueta, tal cual viene de GHL
  occurred_at timestamptz not null,-- dateUpdated del contacto al detectarla
  recorded_at timestamptz not null default now(),
  agent_id text,                   -- assignedTo al momento de detectarla
  -- 'poll'     -> detectada en vivo, el tiempo es confiable
  -- 'backfill' -> ya existía cuando el sondeo vio al contacto por primera vez;
  --               occurred_at es solo una cota superior, NO sirve para medir
  --               tiempos de respuesta
  source text not null default 'poll',
  unique (contact_id, tag)
);

create index if not exists tag_history_occurred_at_idx on tag_history (occurred_at);
create index if not exists tag_history_contact_id_idx on tag_history (contact_id);
create index if not exists tag_history_tag_idx on tag_history (tag);

-- Marca de agua del sondeo: hasta qué dateUpdated se procesó.
create table if not exists tag_sync_state (
  id int primary key default 1,
  last_updated_at timestamptz,
  last_run_at timestamptz,
  constraint tag_sync_state_singleton check (id = 1)
);

insert into tag_sync_state (id) values (1) on conflict (id) do nothing;
