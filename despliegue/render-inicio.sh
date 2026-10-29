#!/usr/bin/env bash
# despliegue/render-inicio.sh
# Arranque en Render (Start Command: bash despliegue/render-inicio.sh).
# Con DISCO, datos y subidas viven en el disco persistente. Sin DISCO se usa
# el sistema de archivos efímero del servicio. Nunca sobrescribe datos existentes.
set -e
DISCO="${DISCO:-}"
mkdir -p registros publico/recursos

copiar_si_falta() {   # copiar_si_falta <carpeta-origen> <carpeta-destino>
  for f in "$1"/*; do
    [ -f "$f" ] || continue
    [ -e "$2/$(basename "$f")" ] || cp "$f" "$2/"
  done
}

# Sin disco persistente, Render puede trabajar directamente en el checkout.
if [ -z "$DISCO" ]; then
  mkdir -p datos publico/recursos/subidas
  copiar_si_falta despliegue/inicial/datos datos
  copiar_si_falta despliegue/inicial/subidas publico/recursos/subidas
  node servidor/semilla.js
  exec node servidor/server.js
fi

# Con disco persistente, los enlaces apuntan a rutas absolutas de montaje.
mkdir -p "$DISCO/datos/config" "$DISCO/datos/semilla" "$DISCO/subidas"
copiar_si_falta datos/config "$DISCO/datos/config"
copiar_si_falta datos/semilla "$DISCO/datos/semilla"
rm -rf datos
ln -s "$DISCO/datos" datos
copiar_si_falta despliegue/inicial/datos "$DISCO/datos"

# Completa únicamente las colecciones que aún falten (usuarios de demostración, agenda, foros, etc.).
node servidor/semilla.js

rm -rf publico/recursos/subidas
ln -s "$DISCO/subidas" publico/recursos/subidas
copiar_si_falta despliegue/inicial/subidas "$DISCO/subidas"

exec node servidor/server.js
