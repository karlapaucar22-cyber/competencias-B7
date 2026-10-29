#!/usr/bin/env bash
# despliegue/respaldar.sh
# Respaldo diario: comprime datos/ y las subidas, guarda 14 días y copia el archivo fuera del servidor.
# Uso: bash despliegue/respaldar.sh   (lo ejecuta cron; ver docs/despliegue.md)
set -euo pipefail

APP="${APP:-$HOME/ecosistema-educativo}"        # carpeta del proyecto
DESTINO="${DESTINO:-$HOME/respaldos}"           # respaldos locales
DIAS="${DIAS:-14}"                              # retención
REMOTO="${REMOTO:-}"                            # copia externa, p. ej. usuario@servidor-respaldos:/respaldos/ecosistema

mkdir -p "$DESTINO"
FECHA="$(date +%Y-%m-%d_%H%M)"
ARCHIVO="$DESTINO/ecosistema-$FECHA.tar.gz"

# datos/ (sin sus respaldos internos) + archivos subidos por los usuarios
tar -czf "$ARCHIVO" -C "$APP" \
  --exclude='datos/respaldos' \
  datos publico/recursos/subidas

# Comprueba que el archivo se puede leer
tar -tzf "$ARCHIVO" > /dev/null

# Retención: borra los de más de $DIAS días
find "$DESTINO" -name 'ecosistema-*.tar.gz' -type f -mtime +"$DIAS" -delete

# Copia fuera del servidor (si está configurada)
if [ -n "$REMOTO" ]; then
  rsync -a --delete -e "ssh -o BatchMode=yes" "$DESTINO"/ "$REMOTO"/
fi

echo "$(date '+%F %T') Respaldo listo: $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"
