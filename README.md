# Oficina Prime — Dashboard

Dashboard de métricas por agente y oficina para la subcuenta de GoHighLevel
(GHL) de Oficina Prime: leads/contactos creados y FTD (First Time Deposit).

## Arquitectura

- **Leads/contactos**: el dashboard consulta la API v2 de GHL en vivo
  (`lib/ghl.ts`), no pasan por n8n.
- **FTD**: viene de una plataforma externa (broker). n8n lo recibe/consulta y
  lo guarda en Postgres ya vinculado a agente/oficina. Ver [n8n/README.md](n8n/README.md).
- **Dashboard**: Next.js, junta ambas fuentes en `/api/metrics` y las muestra
  en `app/page.tsx`.

## Historial de etiquetas

GHL guarda **qué** etiquetas tiene un contacto, nunca **cuándo** se le pusieron.
Sin ese dato no se puede medir velocidad de primera respuesta ni leads
estancados, así que el dashboard lleva su propio cuaderno.

Un cron en el server llama cada 5 minutos a `/api/cron/tag-snapshot`
([deploy/tag-snapshot.sh](deploy/tag-snapshot.sh)). El sondeo pide a GHL los
contactos que cambiaron desde la última corrida y anota en `tag_history`
(ver [sql/002_tag_history.sql](sql/002_tag_history.sql)) las etiquetas que no
tenía registradas. El volumen real es de ~3 contactos por ventana: una sola
petición por vuelta.

La columna `source` marca si el tiempo es confiable:

- `poll` — la etiqueta se detectó en vivo, sobre un lead creado dentro de la
  ventana o un contacto que ya se venía siguiendo. **Sirve para medir tiempos.**
- `backfill` — ya existía cuando el sondeo vio al contacto por primera vez.
  `occurred_at` es solo una cota superior. **No sirve para medir tiempos.**

Sin esa distinción, un contacto viejo que hoy recibe una etiqueta arrastraría
las otras que ya tenía y quedarían registradas como recién ocurridas,
inventando tiempos de respuesta que nunca existieron.

A futuro esto se puede reemplazar por un webhook de GHL disparado al agregar
una etiqueta, que daría precisión al segundo en vez de la del intervalo de
sondeo. Requiere crear el workflow a mano en la interfaz de GHL: la API no
permite crearlos.

## Configuración

1. Copiá `.env.example` a `.env.local` si no existe ya, y completá:
   - `GHL_API_TOKEN`, `GHL_LOCATION_ID` — ya cargados.
   - `GHL_AGENT_SOURCE` / `GHL_OFFICE_SOURCE` — **revisar**: definen de qué
     campo de GHL sale el agente y la oficina de cada contacto. Por defecto
     asume `assignedTo` (usuario asignado del contacto) para agente y un
     custom field `office` para oficina. Ajustá el `fieldKey` al id real de
     tu custom field en GHL (Configuración → Campos personalizados).
   - `DATABASE_URL` — connection string de tu Postgres (mismo server de n8n).
   - `ADMIN_USER` / `ADMIN_PASSWORD` — el acceso de la dirección. Es la llave
     maestra: no vive en la base, así que sirve aunque Postgres esté caído.
   - `AGENT_PASSWORD` — contraseña común del equipo, para los agentes que no
     tienen una propia cargada desde la pantalla de Usuarios.
   - `CRON_SECRET` — token con el que el cron del server llama al sondeo de
     etiquetas. `/api/cron` queda fuera del middleware de sesión porque lo
     llama una máquina, no una persona.

2. Instalar dependencias:

   ```bash
   npm install
   ```

3. Crear la tabla de FTD en Postgres:

   ```bash
   psql "$DATABASE_URL" -f sql/001_ftd_records.sql
   ```

4. Levantar en desarrollo:

   ```bash
   npm run dev
   ```

   Abrí http://localhost:3000 — te va a pedir usuario y contraseña.

## Quién ve qué

Hay dos roles, y el filtro se aplica **en el servidor** a partir de la cookie de
sesión firmada, nunca de un parámetro de la URL:

- **Dirección** (`ADMIN_USER`): ve todo, y es la única que entra a
  `/admin/usuarios`, donde se crean las cuentas.
- **Agente**: ve las dos pantallas —Mi día y Dirección— pero solo con sus
  propios leads. Cada cuenta se ata a un agente de GHL (el `userId` que aparece
  en `assignedTo` de los contactos), y ese id es el que recorta las consultas.

Los usuarios viven en la tabla `usuarios`, que se crea sola en la primera
consulta. Si `password_hash` está vacío, la persona entra con `AGENT_PASSWORD`;
cargarle una contraseña propia desde la pantalla de Usuarios llena esa columna.

## Pendientes antes de usar en producción

- [ ] Confirmar `GHL_AGENT_SOURCE` / `GHL_OFFICE_SOURCE` contra tus contactos reales de GHL.
- [ ] Armar el workflow de n8n para FTD ([n8n/README.md](n8n/README.md)).
- [ ] Si la subcuenta tiene mucho volumen de contactos, migrar `fetchAllContacts`
      (en `lib/ghl.ts`) de listado paginado a `POST /contacts/search` con
      filtros server-side por fecha, una vez confirmado el contrato exacto de
      ese endpoint para tu cuenta (la doc pública de GHL no expone el detalle
      completo de filtros).
- [ ] Desplegar (Vercel, o el mismo servidor de n8n) y configurar HTTPS antes
      de usar la contraseña en producción.
