# Workflow de n8n: FTD → Postgres

Este dashboard lee los contactos/leads **directo de la API de GHL**, pero el
dato de FTD (First Time Deposit) viene de una plataforma externa. n8n es el
puente: recibe/consulta esos depósitos y los guarda en la tabla `ftd_records`
de Postgres (ver [sql/001_ftd_records.sql](../sql/001_ftd_records.sql)), que
es lo que el dashboard consulta.

## 1. Crear la tabla

Corre una vez contra tu Postgres:

```bash
psql "$DATABASE_URL" -f sql/001_ftd_records.sql
```

## 2. Workflow en n8n

Nodo 1 — **Trigger**: según cómo entrega datos la plataforma externa:
- Si tiene **webhook**: nodo `Webhook` (POST) que la plataforma llama cuando ocurre un depósito.
- Si solo tiene **API para consultar**: nodo `Schedule Trigger` (ej. cada 15 min) + nodo `HTTP Request` a su endpoint de depósitos recientes.

Nodo 2 — **Vincular agente/oficina**: el payload de la plataforma externa
normalmente no trae "agente" ni "oficina" directamente, solo un identificador
del cliente/lead (email, teléfono, o el `contactId` de GHL si se lo pasaste
al abrir la cuenta en el broker). Con ese identificador:
- Nodo `HTTP Request` a GHL (`GET /contacts/search` o `GET /contacts/{id}`) para
  traer el contacto y leer su agente/oficina (mismo campo que usa el dashboard,
  ver `GHL_AGENT_SOURCE` / `GHL_OFFICE_SOURCE` en `.env.local`).

Nodo 3 — **Insertar en Postgres**: nodo `Postgres` → `Insert`, tabla
`ftd_records`, columnas `external_id, agent, office, contact_id, amount,
created_at`. Usa `external_id` = el id del depósito en la plataforma externa
para que reintentos/duplicados no inserten dos veces (columna `unique`).

## 3. Verificar

```sql
select * from ftd_records order by created_at desc limit 20;
```

Si estos datos aparecen bien, el dashboard los va a mostrar automáticamente
en el rango de fechas correspondiente — no hace falta tocar el código del
dashboard cuando cambie el volumen de FTD, solo este workflow.
