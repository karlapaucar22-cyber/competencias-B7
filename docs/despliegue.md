# docs/despliegue.md · Despliegue en producción (Ubuntu 22.04 / 24.04)

Guía paso a paso para publicar el Ecosistema Educativo Digital en un VPS o máquina virtual con Ubuntu,
un dominio propio y HTTPS. Copia los comandos tal cual; donde veas un texto en MAYÚSCULAS entre `< >`,
reemplázalo por tu dato.

## Antes de empezar
- Un servidor Ubuntu 22.04 o 24.04 (mínimo 1 vCPU, 1 GB de RAM y 10 GB de disco) con acceso por SSH.
- Un dominio con dos registros DNS tipo **A** apuntando a la IP pública del servidor:
  `<DOMINIO>` y `www.<DOMINIO>` (p. ej. `ecosistema.unemi.edu.ec`). Los DNS pueden tardar unas horas en propagarse.
- La URL del repositorio del proyecto (`<URL_DEL_REPOSITORIO>`) y la clave de Google Gemini (`GEMINI_API_KEY`).
- Un segundo equipo o servidor para guardar copias de respaldo fuera del servidor (paso 11).

Cómo queda todo:

```
Internet ──443/80──▶ Nginx (HTTPS, caché, límite de subida) ──▶ Node.js en 127.0.0.1:3000 (PM2)
                                                                  └─ datos/ (JSON) y publico/recursos/subidas/
```

---

## 1. Primer acceso y preparación del sistema
Entra con el usuario administrador que te dio el proveedor (con `sudo`):

```bash
ssh <USUARIO_ADMIN>@<IP_DEL_SERVIDOR>
sudo apt update && sudo apt -y upgrade
sudo apt install -y git curl rsync ufw nginx
sudo timedatectl set-timezone America/Guayaquil   # agenda, alertas y "días" en hora de Ecuador
timedatectl                                       # comprueba: Time zone: America/Guayaquil
```

## 2. Usuario sin privilegios para la aplicación
La plataforma no debe ejecutarse como `root`. Crea un usuario `ecosistema` **sin sudo**:

```bash
sudo adduser --disabled-password --gecos "" ecosistema
```

Para trabajar como ese usuario usa `sudo -iu ecosistema` y para volver al administrador, `exit`.

## 3. Cortafuegos (ufw): solo 22, 80 y 443
Permite SSH **antes** de activar el cortafuegos (si no, perderás la conexión):

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing        # la IA necesita salir a Google por HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable                        # responde "y"
sudo ufw status verbose                # deben aparecer 22, 80 y 443 (ALLOW IN)
```

El puerto 3000 de Node queda cerrado hacia Internet: solo Nginx lo usa desde el propio servidor.

## 4. Node.js LTS y PM2
El proyecto necesita Node.js 20 o superior. Instala la versión LTS vigente desde NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x -o /tmp/nodesource_setup.sh
sudo bash /tmp/nodesource_setup.sh
sudo apt install -y nodejs
node -v        # v20.x o superior
npm -v
sudo npm install -g pm2
pm2 -v
```

## 5. Clonar el repositorio e instalar dependencias
Desde aquí, como usuario `ecosistema`:

```bash
sudo -iu ecosistema
git clone <URL_DEL_REPOSITORIO> ecosistema-educativo
cd ecosistema-educativo
npm ci --omit=dev
```

`npm ci` instala exactamente lo que dice `package-lock.json` (express, bcryptjs, dotenv y multer).
Si el repositorio es privado, agrega antes una *deploy key* de solo lectura en GitHub o GitLab.

## 6. Variables de entorno (.env)

```bash
cp .env.ejemplo .env
nano .env
```

Completa así (guarda con `Ctrl + O`, `Enter`, y sal con `Ctrl + X`):

```ini
PUERTO=3000
IA_PROVEEDOR=gemini
GEMINI_API_KEY=<TU_CLAVE_DE_GEMINI>
IA_MODELO=gemini-3.5-flash-lite
IA_MODELO_ALTERNO=
```

Protege el archivo (contiene la clave de la IA) y comprueba que no se suba al repositorio:

```bash
chmod 600 .env
git check-ignore .env     # debe responder: .env
```

## 7. Datos iniciales y cuenta de administración
Los datos viven en `datos/` y no vienen en el repositorio. En producción **no** ejecutes `npm run semilla`:
crea usuarios de demostración con la clave conocida `Demo12345`. Copia solo las insignias y crea el administrador:

```bash
cp datos/semilla/insignias.json datos/insignias.json
mkdir -p publico/recursos/subidas registros
npm run crear-admin          # pide nombre, apellido, correo y contraseña (8+ caracteres con letras y números)
```

Las asignaturas y el distributivo se crean luego desde la plataforma con esa cuenta; docentes y estudiantes se
registran solos y la administración asigna el rol docente en **Usuarios** (ver docs/manual-admin.md).
(Para un servidor de **demostración** sí puedes usar `npm run semilla`.)

### 7.1 Contenidos de NeuroRitmo
NeuroRitmo necesita los contenidos que el equipo creó (asignatura, unidades, temas, glosario, canciones,
simulaciones, banco de preguntas e insignias). Se trasladan **sin** usuarios, sesiones, intentos ni actividad de
demostración. En el equipo del equipo docente (no en el servidor):

```bash
node despliegue/exportar-contenidos.mjs ../paquete-neuroritmo
scp -r ../paquete-neuroritmo ecosistema@<DOMINIO>:~/paquete-neuroritmo
```

En el servidor, como `ecosistema` y dentro de `~/ecosistema-educativo` (`-n` no sobrescribe lo que ya exista):

```bash
cp -n ~/paquete-neuroritmo/datos/*.json datos/
cp -n ~/paquete-neuroritmo/subidas/* publico/recursos/subidas/
```

Después, con la cuenta de administración: crea el grupo de la asignatura de NeuroRitmo en **Distributivo**
(docente y estudiantes reales). Con la cuenta docente: crea en el foro del tema de la Misión 3 el hilo
«Galería NeuroRitmo», y aprueba la distribución de puntos de M2 y la rúbrica de M3 en el panel de NeuroRitmo.
El exportador avisa si algún contenido enlaza un archivo de `subidas/` que no existe: súbelo o quita ese recurso.

## 8. Arrancar con PM2 (reinicio automático y registros)
El archivo `ecosystem.config.cjs` del proyecto ya define:
- una sola instancia;
- reinicio automático, con espera creciente si falla seguido, y reinicio si supera 400 MB de memoria;
- zona horaria de Ecuador y `NODE_ENV=production`;
- registros con fecha y hora en `registros/salida.log` y `registros/errores.log`.

```bash
pm2 start ecosystem.config.cjs
pm2 status                              # "ecosistema" en estado online
curl -I http://127.0.0.1:3000/          # HTTP/1.1 200 OK
pm2 logs ecosistema --lines 20          # debe decir "Servidor activo en http://localhost:3000"
pm2 save                                # recuerda la lista de procesos
```

Rotación de registros (máximo 10 MB por archivo, 14 copias comprimidas):

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
exit                                    # vuelve al usuario administrador
```

Para que PM2 arranque solo al reiniciar el servidor, como **administrador**:

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ecosistema --hp /home/ecosistema
sudo systemctl status pm2-ecosistema --no-pager   # active (running)
```

## 9. Nginx como proxy inverso
El proyecto incluye la plantilla `despliegue/nginx-ecosistema.conf`. Tiene:
- límite de subida de 12 MB (los 10 MB de `maxSubidaMB` más un margen);
- caché en el navegador de 1 hora para `/css` y `/js`, y de 7 días para `/recursos`;
- hasta 90 s de espera en `/api`, porque la IA puede tardar.

Cópiala con tu dominio y actívala:

```bash
sudo sed 's/DOMINIO/<DOMINIO>/g' /home/ecosistema/ecosistema-educativo/despliegue/nginx-ecosistema.conf \
  | sudo tee /etc/nginx/sites-available/ecosistema > /dev/null
sudo ln -s /etc/nginx/sites-available/ecosistema /etc/nginx/sites-enabled/ecosistema
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t                      # syntax is ok / test is successful
sudo systemctl reload nginx
curl -I http://<DOMINIO>/          # HTTP/1.1 200 OK
```

Si cambias `maxSubidaMB` en `datos/config/ajustes.json`, sube también `client_max_body_size` en
`/etc/nginx/sites-available/ecosistema` y ejecuta `sudo nginx -t && sudo systemctl reload nginx`.

## 10. HTTPS con Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <DOMINIO> -d www.<DOMINIO> -m <CORREO_DEL_RESPONSABLE> --agree-tos --redirect
sudo certbot renew --dry-run       # comprueba la renovación automática (cada 90 días)
curl -I https://<DOMINIO>/         # HTTP/2 200
curl -I http://<DOMINIO>/          # 301 hacia https://
```

## 11. Respaldo diario (cron)
El script `despliegue/respaldar.sh` hace lo siguiente:
- comprime `datos/` y `publico/recursos/subidas/` en `~/respaldos/ecosistema-AAAA-MM-DD_HHMM.tar.gz`;
- comprueba que el archivo se pueda leer;
- borra los de más de 14 días;
- copia la carpeta a otro servidor con `rsync`.

(La plataforma, además, guarda copias diarias de los JSON en `datos/respaldos/`, pero esas siguen dentro del servidor.)

**a) Probarlo a mano** (como `ecosistema`):

```bash
sudo -iu ecosistema
chmod +x ecosistema-educativo/despliegue/respaldar.sh
ecosistema-educativo/despliegue/respaldar.sh
ls -lh ~/respaldos/
```

**b) Copia fuera del servidor.** Necesitas otro equipo con SSH: un segundo VPS, un NAS o el servidor de la institución. Allí debe existir la carpeta `/respaldos/ecosistema`.

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519      # clave sin frase, solo para respaldos
ssh-copy-id <USUARIO_RESPALDO>@<IP_RESPALDO>          # pide una vez la contraseña del otro equipo
REMOTO=<USUARIO_RESPALDO>@<IP_RESPALDO>:/respaldos/ecosistema ecosistema-educativo/despliegue/respaldar.sh
```

**c) Programarlo todos los días a las 02:30** (`crontab -e` y elige `nano`). Agrega al final:

```cron
30 2 * * * REMOTO=<USUARIO_RESPALDO>@<IP_RESPALDO>:/respaldos/ecosistema /home/ecosistema/ecosistema-educativo/despliegue/respaldar.sh >> /home/ecosistema/respaldos/respaldo.log 2>&1
```

Al día siguiente revisa `tail ~/respaldos/respaldo.log`.

**Restaurar un respaldo** (como `ecosistema`):

```bash
pm2 stop ecosistema
tar -xzf ~/respaldos/ecosistema-<FECHA>.tar.gz -C ~/ecosistema-educativo
pm2 start ecosistema
```

## 12. Actualizar la plataforma
Haz siempre un respaldo antes. Como `ecosistema`:

```bash
sudo -iu ecosistema
cd ~/ecosistema-educativo
./despliegue/respaldar.sh                 # respaldo previo
git log -1 --oneline                      # anota la versión actual (por si hay que volver)
git pull
npm ci --omit=dev
pm2 reload ecosistema
pm2 logs ecosistema --lines 20            # sin errores
curl -I http://127.0.0.1:3000/            # 200 OK
```

`git pull` no toca `.env`, `datos/` ni las subidas (están en `.gitignore`). Con una sola instancia,
`pm2 reload` reinicia en uno o dos segundos.

Tras actualizar, los navegadores pueden usar CSS y JS anteriores hasta por una hora; pide a los usuarios `Ctrl + F5` si ven algo raro.

**Volver a la versión anterior:** `git checkout <COMMIT_ANOTADO> && npm ci --omit=dev && pm2 reload ecosistema`.
Si además cambiaron los datos, restaura el respaldo previo (paso 11).

## 13. Lista de comprobación final
- [ ] `node -v` es v20 o superior; `timedatectl` muestra `America/Guayaquil`.
- [ ] La aplicación corre como `ecosistema` (`ps -o user= -p $(pgrep -f servidor/server.js)` → `ecosistema`), no como root.
- [ ] `.env` tiene `GEMINI_API_KEY` e `IA_MODELO`, con permisos `-rw-------` (`ls -l .env`).
- [ ] `datos/insignias.json` existe y **no** hay usuarios de demostración (`Demo12345`) en producción.
- [ ] `pm2 status` → `ecosistema` online; tras `sudo reboot`, vuelve a estar online solo.
- [ ] `sudo ufw status` → solo 22, 80 y 443; `curl -I http://<IP_DEL_SERVIDOR>:3000/` desde fuera **no** responde.
- [ ] `https://<DOMINIO>` abre con candado; `http://` redirige a `https://`; `sudo certbot renew --dry-run` sin errores.
- [ ] Ingreso con la cuenta de administración; Inteligencia artificial → "Probar conexión" responde OK.
- [ ] Un docente sube un archivo de 9 MB sin errores; uno de 11 MB lo rechaza la plataforma con su mensaje
      (más de 12 MB lo corta Nginx con 413).
- [ ] `curl -I https://<DOMINIO>/css/base.css` incluye `Cache-Control: max-age=3600`.
- [ ] Existe un `.tar.gz` de hoy en `~/respaldos/` y también en el equipo de respaldo; se probó una restauración.
- [ ] `pm2 logs` sin errores y `registros/` con los archivos de salida y errores.
- [ ] La verificación de humo (paso 14) termina sin fallos y, tras `pm2 reload ecosistema`, la de persistencia también.
- [ ] La URL abre en una ventana de incógnito y en un teléfono con datos móviles (otra red); un estudiante ingresa y abre el mapa.

## Problemas frecuentes
| Síntoma | Causa probable | Solución |
|---|---|---|
| 502 Bad Gateway | Node no está corriendo | `sudo -iu ecosistema pm2 status` y `pm2 logs ecosistema --lines 50` |
| 413 Request Entity Too Large | Archivo mayor que `client_max_body_size` | Ajusta el valor en Nginx (paso 9) |
| La IA responde "no está configurada" | Falta la clave o el modelo en `.env` | Edita `.env` y ejecuta `pm2 reload ecosistema` |
| Certbot falla | El DNS aún no apunta al servidor o el puerto 80 está cerrado | `dig +short <DOMINIO>` debe mostrar la IP; revisa `ufw` |
| Fechas u horas desfasadas | Zona horaria distinta | Paso 1 (`timedatectl`) y `pm2 reload ecosistema` |

## 14. Verificación de la URL publicada
No basta con que el servidor arranque: valida configuración, persistencia, roles y seguridad **antes** de compartir
el enlace. Desde cualquier equipo con Node.js y una copia del proyecto (las cuentas se pasan por variables de entorno,
nunca en el código; usa cuentas reales de prueba creadas en producción, no las de demostración):

```bash
export HUMO_URL=https://<DOMINIO>
export HUMO_ESTUDIANTE='<CORREO_ESTUDIANTE_DE_PRUEBA>:<CLAVE>'
export HUMO_DOCENTE='<CORREO_DOCENTE_DE_PRUEBA>:<CLAVE>'
export HUMO_ADMIN='<CORREO_ADMIN>:<CLAVE>'
node pruebas/humo-despliegue.mjs                 # HTTPS, archivos protegidos, roles, IA enmascarada, multimedia
# en el servidor: sudo -iu ecosistema pm2 reload ecosistema
node pruebas/humo-despliegue.mjs --persistencia  # la sesión y el progreso siguen tras el reinicio
```

Comprobación manual (anótala en `docs/estado.md` con la fecha):
1. **Incógnito:** abre `https://<DOMINIO>` en una ventana privada: portada de NeuroRitmo, sin errores en la consola (F12).
2. **Otro dispositivo y otra red:** en un teléfono con datos móviles, ingresa como estudiante de prueba, abre el mapa y M1.
3. **Multimedia:** imágenes de la portada y de los temas, enlaces externos (Genially) y audios de los temas se reproducen;
   la canción de M2 sigue «pendiente de audio autorizado» hasta que se suba el archivo.
4. **Estudiante:** no puede abrir `#mision-m2` sin superar M1 ni `/paginas/panel-docente.html`.
5. **Docente:** ve el panel de NeuroRitmo de su grupo; **IA:** «Pregúntale a Neuri» responde desde el segundo intento de M1.

| Fecha | URL pública | Humo | Persistencia | Incógnito | Otro dispositivo | Multimedia | Responsable |
|---|---|---|---|---|---|---|---|
| | (pendiente: aún no publicado) | | | | | | |
