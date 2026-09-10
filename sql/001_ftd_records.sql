-- Tabla donde el workflow "[Maestro] FTD Nexus — 6 Sub-cuentas" (n8n) inserta
-- cada FTD, ya resuelto a qué sub-cuenta/oficina de GHL pertenece.
-- El agente NO se guarda acá: el dashboard lo resuelve al leer el contacto
-- en GHL por contact_id (misma lógica que usa para contar leads), así la
-- atribución de agente vive en un solo lugar.
create table if not exists ftd_records (
  id bigserial primary key,
  external_id text unique,        -- brokerId + fecha del depósito (evita duplicados en reintentos)
  contact_id text not null,       -- id del contacto en GHL
  location_id text not null,      -- locationId de GHL de la sub-cuenta (ej. Oficina Prime)
  equipo text not null,           -- nombre interno de la oficina en el workflow maestro (ej. 'julian')
  currency text,
  amount_original numeric(14, 2),
  amount_usd numeric(14, 2),
  deposit_date text,              -- fecha tal como la reporta el broker
  created_at timestamptz not null default now()
);

create index if not exists ftd_records_created_at_idx on ftd_records (created_at);
create index if not exists ftd_records_location_id_idx on ftd_records (location_id);
create index if not exists ftd_records_contact_id_idx on ftd_records (contact_id);
