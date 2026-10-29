// pruebas/despliegue.test.js
// Pruebas de la tarea P13.3 (despliegue): PM2, Nginx, respaldo, archivos de Git y la guía docs/despliegue.md.
// Lo que exige Linux (bash, nginx) se ejecuta solo si está disponible; si no, la prueba queda omitida.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8');
const existe = (r) => fs.existsSync(path.join(RAIZ, r));
const disponible = (cmd, args = ['--version']) => spawnSync(cmd, args, { stdio: 'ignore', shell: false }).status === 0;
const temporales = [];
const carpetaTemporal = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'despliegue-'));
  temporales.push(dir);
  return dir;
};
after(() => temporales.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

const ajustes = JSON.parse(leer('datos/config/ajustes.json'));
const nginx = leer('despliegue/nginx-ecosistema.conf');
const respaldo = leer('despliegue/respaldar.sh');
const guia = leer('docs/despliegue.md');
const envEjemplo = leer('.env.ejemplo');
const puertoEjemplo = Number(/^PUERTO=(\d+)/m.exec(envEjemplo)?.[1]);

describe('ecosystem.config.cjs (PM2)', () => {
  const app = createRequire(import.meta.url)(path.join(RAIZ, 'ecosystem.config.cjs')).apps[0];

  test('carga con require() y apunta al servidor que existe', () => {
    assert.equal(app.name, 'ecosistema');
    assert.equal(app.script, 'servidor/server.js');
    assert.equal(app.cwd, RAIZ);   // dotenv lee .env desde aquí
    assert.ok(existe(app.script));
  });

  test('una sola instancia en modo fork (datos JSON y límites en memoria)', () => {
    assert.equal(app.exec_mode, 'fork');
    assert.equal(app.instances, 1);
  });

  test('reinicio automático con espera creciente y límite de memoria', () => {
    assert.equal(app.autorestart, true);
    assert.equal(app.watch, false);
    assert.ok(app.max_restarts >= 5);
    assert.ok(app.exp_backoff_restart_delay > 0);
    assert.match(app.max_memory_restart, /^\d+M$/);
  });

  test('registros con fecha en registros/ (carpeta versionada y logs ignorados)', () => {
    assert.equal(path.dirname(app.out_file), path.join(RAIZ, 'registros'));
    assert.equal(path.dirname(app.error_file), path.join(RAIZ, 'registros'));
    assert.equal(app.time, true);
    assert.ok(existe('registros/.gitkeep'));
    assert.match(leer('.gitignore'), /^registros\/\*\.log$/m);
  });

  test('producción y hora de Ecuador; Node respeta TZ', () => {
    assert.equal(app.env.NODE_ENV, 'production');
    assert.equal(app.env.TZ, 'America/Guayaquil');
    const r = spawnSync(process.execPath, ['-e', 'process.stdout.write(Intl.DateTimeFormat().resolvedOptions().timeZone)'], { env: { ...process.env, TZ: app.env.TZ } });
    assert.equal(r.stdout.toString(), 'America/Guayaquil');
  });
});

describe('Servidor con las variables de producción', () => {
  test('arranca con PUERTO y NODE_ENV, sirve páginas, estáticos y protege la API', async () => {
    const puerto = 3900 + Math.floor(Math.random() * 90);
    const hijo = spawn(process.execPath, ['servidor/server.js'], { cwd: RAIZ, env: { ...process.env, PUERTO: String(puerto), NODE_ENV: 'production', TZ: 'America/Guayaquil' }, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      await new Promise((ok, fallo) => {
        const t = setTimeout(() => fallo(new Error('El servidor no arrancó en 10 s')), 10000);
        hijo.stdout.on('data', (d) => { if (String(d).includes(`localhost:${puerto}`)) { clearTimeout(t); ok(); } });
        hijo.on('exit', (c) => fallo(new Error(`El servidor terminó con código ${c}`)));
      });
      const base = `http://127.0.0.1:${puerto}`;
      assert.equal((await fetch(`${base}/`)).status, 200);
      const css = await fetch(`${base}/css/base.css`);
      assert.equal(css.status, 200);
      // Express envía max-age=0: por eso Nginx oculta esa cabecera antes de aplicar "expires"
      assert.match(css.headers.get('cache-control') || '', /max-age=0/);
      // Sin sesión la API no entrega datos (401 en rutas propias, 403 en la API genérica)
      const api = await fetch(`${base}/api/temas`);
      assert.ok([401, 403].includes(api.status), `estado ${api.status}`);
      assert.ok(!Array.isArray(await api.json()));
    } finally {
      hijo.kill();
    }
  });
});

describe('Nginx (despliegue/nginx-ecosistema.conf)', () => {
  const bloques = (texto) => [...texto.matchAll(/location\s+([^{]+)\{([^}]*)\}/g)].map((m) => ({ ruta: m[1].trim(), cuerpo: m[2] }));
  const ubicaciones = bloques(nginx);
  const de = (ruta) => ubicaciones.find((u) => u.ruta === ruta)?.cuerpo || '';

  test('llaves balanceadas y cada directiva termina en ";"', () => {
    assert.equal((nginx.match(/\{/g) || []).length, (nginx.match(/\}/g) || []).length);
    const sueltas = nginx.split('\n').filter((l) => /^\s+\w/.test(l) && !/[;{}]\s*$/.test(l) && !/^\s*#/.test(l));
    assert.deepEqual(sueltas, []);
  });

  test('server_name con el marcador DOMINIO que reemplaza el paso 9', () => {
    assert.match(nginx, /server_name DOMINIO www\.DOMINIO;/);
    assert.match(guia, /sed 's\/DOMINIO\/<DOMINIO>\/g'/);
  });

  test('client_max_body_size cubre maxSubidaMB de ajustes.json', () => {
    const limite = Number(/client_max_body_size (\d+)m;/.exec(nginx)?.[1]);
    assert.ok(limite > ajustes.maxSubidaMB, `${limite} MB debe ser mayor que maxSubidaMB (${ajustes.maxSubidaMB})`);
  });

  test('todo va al puerto de Node de .env.ejemplo (3000), nunca expuesto', () => {
    const destinos = [...nginx.matchAll(/proxy_pass http:\/\/127\.0\.0\.1:(\d+);/g)].map((m) => Number(m[1]));
    assert.equal(destinos.length, ubicaciones.length);
    assert.ok(destinos.every((p) => p === puertoEjemplo));
    assert.match(leer('servidor/server.js'), /process\.env\.PUERTO \|\| 3000/);
  });

  test('caché de /css y /js (1 h) y /recursos (7 d) sin la cabecera de Express', () => {
    const estaticos = de('~ ^/(css|js)/');
    assert.match(estaticos, /expires 1h;/);
    assert.match(estaticos, /proxy_hide_header Cache-Control;/);
    assert.match(de('/recursos/'), /expires 7d;/);
    assert.match(de('/recursos/'), /proxy_hide_header Cache-Control;/);
  });

  test('/api sin caché y con espera suficiente para la IA (> 60 s)', () => {
    assert.match(de('/api/'), /no-store/);
    assert.ok(Number(/proxy_read_timeout (\d+)s;/.exec(de('/api/'))?.[1]) > 60);
  });

  test('nginx -t acepta la configuración (solo si nginx está instalado)', { skip: !disponible('nginx', ['-v']) && 'nginx no está instalado en este equipo' }, () => {
    const dir = carpetaTemporal();
    fs.writeFileSync(path.join(dir, 'sitio.conf'), nginx.replace(/DOMINIO/g, 'ejemplo.test'));
    fs.writeFileSync(path.join(dir, 'nginx.conf'), `pid ${dir}/nginx.pid; error_log stderr; events {} http { access_log off; include ${dir}/sitio.conf; }`);
    const r = spawnSync('nginx', ['-t', '-p', dir, '-c', path.join(dir, 'nginx.conf')]);
    assert.equal(r.status, 0, r.stderr.toString());
  });
});

describe('Respaldo (despliegue/respaldar.sh)', () => {
  test('script de bash seguro y con finales de línea LF', () => {
    assert.ok(respaldo.startsWith('#!/usr/bin/env bash\n'));
    assert.ok(!respaldo.includes('\r'), 'tiene CRLF: fallaría en Ubuntu');
    assert.match(respaldo, /set -euo pipefail/);
    assert.match(leer('.gitattributes'), /^\*\.sh text eol=lf$/m);
  });

  test('comprime datos/ y las subidas, sin datos/respaldos; verifica; 14 días; copia remota', () => {
    assert.match(respaldo, /--exclude='datos\/respaldos'/);
    assert.match(respaldo, /datos publico\/recursos\/subidas/);
    assert.match(respaldo, /tar -tzf "\$ARCHIVO"/);
    assert.match(respaldo, /DIAS="\$\{DIAS:-14\}"/);
    assert.match(respaldo, /-mtime \+"\$DIAS" -delete/);
    assert.match(respaldo, /rsync -a .* "\$REMOTO"/);
  });

  // Árbol de prueba: datos (con un respaldo interno que NO debe ir) y una subida
  function arbolDePrueba() {
    const app = carpetaTemporal();
    for (const [archivo, contenido] of [
      ['datos/usuarios.json', '[{"id":"usu_000001"}]'],
      ['datos/config/ajustes.json', '{"maxSubidaMB":10}'],
      ['datos/mensajes/con_000001.json', '[]'],
      ['datos/respaldos/2026-01-01/usuarios.json', '[]'],
      ['publico/recursos/subidas/foto.png', 'png']
    ]) {
      fs.mkdirSync(path.dirname(path.join(app, archivo)), { recursive: true });
      fs.writeFileSync(path.join(app, archivo), contenido);
    }
    return app;
  }

  test('el tar del script crea un archivo restaurable (tar del sistema)', { skip: !disponible('tar') && 'tar no está disponible' }, () => {
    const app = arbolDePrueba();
    const archivo = path.join(carpetaTemporal(), 'respaldo.tar.gz');
    const crear = spawnSync('tar', ['-czf', archivo, '-C', app, '--exclude=datos/respaldos', 'datos', 'publico/recursos/subidas']);
    assert.equal(crear.status, 0, crear.stderr.toString());
    const lista = spawnSync('tar', ['-tzf', archivo]).stdout.toString().split(/\r?\n/).filter(Boolean);
    assert.ok(lista.includes('datos/usuarios.json') && lista.includes('datos/mensajes/con_000001.json') && lista.includes('publico/recursos/subidas/foto.png'));
    assert.ok(!lista.some((l) => l.startsWith('datos/respaldos')));
    const destino = carpetaTemporal();
    assert.equal(spawnSync('tar', ['-xzf', archivo, '-C', destino]).status, 0);
    assert.equal(fs.readFileSync(path.join(destino, 'datos/usuarios.json'), 'utf8'), '[{"id":"usu_000001"}]');
  });

  test('respaldar.sh completo: crea, verifica y borra los de más de 14 días (solo con bash)', { skip: (os.platform() === 'win32' || !disponible('bash')) && 'bash no está disponible en este equipo' }, () => {
    const app = arbolDePrueba();
    const destino = carpetaTemporal();
    const viejo = path.join(destino, 'ecosistema-2020-01-01_0230.tar.gz');
    fs.writeFileSync(viejo, 'x');
    const hace20dias = new Date(Date.now() - 20 * 864e5);
    fs.utimesSync(viejo, hace20dias, hace20dias);
    const r = spawnSync('bash', [path.join(RAIZ, 'despliegue/respaldar.sh')], { env: { ...process.env, APP: app, DESTINO: destino, REMOTO: '' } });
    assert.equal(r.status, 0, r.stderr.toString());
    const archivos = fs.readdirSync(destino);
    assert.ok(archivos.some((a) => /^ecosistema-\d{4}-\d{2}-\d{2}_\d{4}\.tar\.gz$/.test(a)));
    assert.ok(!archivos.includes(path.basename(viejo)), 'el respaldo de hace 20 días debía borrarse');
  });
});

describe('Git: secretos y datos fuera del repositorio', () => {
  test('.env, datos, subidas y respaldos internos ignorados; config y semilla versionados', () => {
    const ignorar = leer('.gitignore');
    for (const regla of ['.env', 'datos/*.json', 'datos/*.jsonl', 'datos/mensajes/', 'datos/respaldos/', 'publico/recursos/subidas/']) {
      assert.ok(ignorar.split(/\r?\n/).includes(regla), `falta "${regla}" en .gitignore`);
    }
    assert.ok(ignorar.includes('!datos/config/') && ignorar.includes('!datos/semilla/'));
  });

  test('.env.ejemplo sin secretos y con las variables que pide la guía', () => {
    assert.match(envEjemplo, /^GEMINI_API_KEY=$/m);
    for (const v of ['PUERTO', 'IA_PROVEEDOR', 'GEMINI_API_KEY', 'IA_MODELO', 'IA_MODELO_ALTERNO']) {
      assert.match(envEjemplo, new RegExp(`^${v}=`, 'm'));
      assert.match(guia, new RegExp(`^${v}=`, 'm'));
    }
  });

  test('lockfile y dependencias de producción permitidas (npm ci --omit=dev)', () => {
    const pkg = JSON.parse(leer('package.json'));
    assert.ok(existe('package-lock.json'));
    assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['bcryptjs', 'dotenv', 'express', 'multer']);
    assert.equal(pkg.scripts.prestart, 'node despliegue/preparar-render.mjs');
    assert.equal(pkg.scripts.start, 'node servidor/server.js');
    assert.equal(pkg.scripts['crear-admin'], 'node servidor/crear-admin.js');
  });
});

describe('Guía docs/despliegue.md', () => {
  const tiene = (patron, mensaje) => assert.match(guia, patron, mensaje);

  test('usuario sin privilegios de root y zona horaria', () => {
    tiene(/adduser --disabled-password --gecos "" ecosistema/);
    tiene(/sudo -iu ecosistema/);
    tiene(/timedatectl set-timezone America\/Guayaquil/);
  });

  test('Node.js LTS (≥ 20), clonado y npm ci --omit=dev', () => {
    tiene(/setup_lts\.x/);
    tiene(/v20/);
    tiene(/git clone <URL_DEL_REPOSITORIO>/);
    tiene(/npm ci --omit=dev/);
  });

  test('.env protegido, insignias y crear-admin (sin semilla de demostración)', () => {
    tiene(/cp \.env\.ejemplo \.env/);
    tiene(/chmod 600 \.env/);
    tiene(/cp datos\/semilla\/insignias\.json datos\/insignias\.json/);
    tiene(/npm run crear-admin/);
    tiene(/\*\*no\*\* ejecutes `npm run semilla`/);
    assert.ok(existe('datos/semilla/insignias.json'));
  });

  test('PM2: inicio con el ecosystem, arranque con el sistema y rotación de registros', () => {
    tiene(/pm2 start ecosystem\.config\.cjs/);
    tiene(/pm2 save/);
    tiene(/pm2 startup systemd -u ecosistema --hp \/home\/ecosistema/);
    tiene(/pm2 install pm2-logrotate/);
  });

  test('Nginx, HTTPS con Certbot y cortafuegos con 22, 80 y 443 (no 3000)', () => {
    tiene(/sudo nginx -t/);
    tiene(/certbot --nginx -d <DOMINIO> -d www\.<DOMINIO>/);
    tiene(/certbot renew --dry-run/);
    const puertos = [...guia.matchAll(/ufw allow (\d+)\/tcp/g)].map((m) => Number(m[1]));
    assert.deepEqual(puertos, [22, 80, 443]);
    // SSH se permite antes de activar el cortafuegos
    assert.ok(guia.indexOf('ufw allow 22/tcp') < guia.indexOf('ufw enable'));
  });

  test('cron diario válido que ejecuta el script de respaldo', () => {
    const linea = guia.split('\n').find((l) => /^\d+ \d+ \* \* \* /.test(l));
    assert.ok(linea, 'falta la línea de crontab');
    const [min, hora] = linea.split(' ').map(Number);
    assert.ok(min >= 0 && min < 60 && hora >= 0 && hora < 24);
    assert.match(linea, /\/home\/ecosistema\/ecosistema-educativo\/despliegue\/respaldar\.sh/);
    assert.match(linea, />> .*respaldo\.log 2>&1$/);
  });

  test('actualización: respaldo, git pull, npm ci y pm2 reload, en ese orden', () => {
    const orden = ['./despliegue/respaldar.sh', 'git pull', 'npm ci --omit=dev', 'pm2 reload ecosistema'].map((c) => guia.indexOf(c, guia.indexOf('## 12.')));
    assert.ok(orden.every((i) => i > 0), JSON.stringify(orden));
    assert.deepEqual([...orden].sort((a, b) => a - b), orden);
  });

  test('lista de comprobación final con al menos 10 puntos', () => {
    const lista = guia.slice(guia.indexOf('## 13.'), guia.indexOf('## Problemas frecuentes'));
    assert.ok((lista.match(/^- \[ \]/gm) || []).length >= 10);
  });

  test('todos los archivos del proyecto que menciona la guía existen', () => {
    for (const r of ['ecosystem.config.cjs', 'despliegue/nginx-ecosistema.conf', 'despliegue/respaldar.sh', '.env.ejemplo', 'datos/semilla/insignias.json', 'datos/config/ajustes.json']) {
      assert.ok(guia.includes(r.replace('datos/config/', 'datos/config/')) && existe(r), r);
    }
  });
});
