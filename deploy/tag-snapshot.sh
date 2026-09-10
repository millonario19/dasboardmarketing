#!/bin/sh
# Sondeo del historial de etiquetas. Lo llama el cron del server cada 5 minutos.
#
# Instalación (en el server, como root):
#   chmod +x /docker/oficina-prime/app/deploy/tag-snapshot.sh
#   crontab -e   ->   */5 * * * * /docker/oficina-prime/app/deploy/tag-snapshot.sh
#
# El token sale de app.env, el mismo archivo que ya usa docker compose, así no
# queda duplicado en dos lugares. Se lee con grep en vez de "source" porque
# app.env tiene valores con espacios (ej. GHL_OFFICE_SOURCE=fixed:Oficina Prime)
# que el shell interpretaría como comandos.
set -eu

ENV_FILE=/docker/oficina-prime/app.env
LOG=/var/log/tag-snapshot.log
URL=https://dashboard.vozia.com.co/api/cron/tag-snapshot
MAX_LINEAS=2000

SECRET=$(grep -m1 '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2-)
if [ -z "$SECRET" ]; then
  echo "$(date -Is) ERROR: falta CRON_SECRET en $ENV_FILE" >> "$LOG"
  exit 1
fi

RESPUESTA=$(curl -s -m 120 -X POST -H "Authorization: Bearer $SECRET" "$URL" || echo '{"ok":false,"error":"curl fallo"}')
echo "$(date -Is) $RESPUESTA" >> "$LOG"

# El log crece ~288 líneas por día; lo recortamos para que no haga falta logrotate.
if [ "$(wc -l < "$LOG")" -gt "$MAX_LINEAS" ]; then
  tail -n "$MAX_LINEAS" "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
