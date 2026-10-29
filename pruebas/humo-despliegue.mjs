// pruebas/humo-despliegue.mjs
// Verificación de humo de un despliegue (configuración, seguridad, roles, multimedia y persistencia).
// No forma parte de npm test. Las credenciales se leen del entorno; nunca se escriben en el código.
//
// Uso:
//   set HUMO_URL=https://mi-servidor.example   (o http://localhost:3000)
//   set HUMO_ESTUDIANTE=correo:clave   HUMO_DOCENTE=correo:clave   HUMO_ADMIN=correo:clave   (opcionales)
//   node pruebas/humo-despliegue.mjs              → verificación completa; guarda un token para la persistencia
//   (reiniciar o volver a desplegar el servicio)
//   node pruebas/humo-despliegue.mjs --persistencia → comprueba que la sesión guardada sigue válida

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = String(process.env.HUMO_URL || '').replace(/\/+$/, '');
if (!BASE) {
  console.error('Define HUMO_URL con la dirección del despliegue.');
  process.exit(1);
}
const ARCHIVO_TOKEN = path.join(os.tmpdir(), 'humo-despliegue-token.json');
const resultados = [];
const comprobar = (cond, texto) => { resultados.push({ ok: Boolean(cond), texto }); console.log(`${cond ? '✔' : '✖'} ${texto}`); };

async function pedir(metodo, ruta, { token, cuerpo } = {}) {
  const r = await fetch(BASE + ruta, { method: metodo, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const texto = await r.text();
  return { estado: r.status, tipo: r.headers.get('content-type') || '', texto, datos: (() => { try { return JSON.parse(texto); } catch { return null; } })() };
}
const credencial = (variable) => {
  const v = process.env[variable];
  if (!v || !v.includes(':')) return null;
  const i = v.indexOf(':');
  return { correo: v.slice(0, i), clave: v.slice(i + 1) };
};
async function entrar(variable) {
  const c = credencial(variable);
  if (!c) return null;
  const r = await pedir('POST', '/api/auth/login', { cuerpo: c });
  comprobar(r.estado === 200 && r.datos?.token, `Ingreso con ${variable} (${c.correo.replace(/(.{2}).*@/, '$1…@')})`);
  return r.datos?.token ? r.datos : null;
}

if (process.argv.includes('--persistencia')) {
  const guardado = fs.existsSync(ARCHIVO_TOKEN) ? JSON.parse(fs.readFileSync(ARCHIVO_TOKEN, 'utf8')) : null;
  if (!guardado || guardado.url !== BASE) {
    console.error('Primero ejecuta la verificación completa con HUMO_ESTUDIANTE en esta misma URL.');
    process.exit(1);
  }
  const r = await pedir('GET', '/api/auth/yo', { token: guardado.token });
  comprobar(r.estado === 200 && r.datos?.id === guardado.usuarioId, 'La sesión creada antes del reinicio sigue válida (datos persistentes)');
  const temas = await pedir('GET', '/api/progreso-temas', { token: guardado.token });
  comprobar(temas.estado === 200 && (temas.datos || []).some((p) => p.temaId === guardado.temaId), 'El progreso registrado antes del reinicio se conserva');
} else {
  // ---------- Configuración y archivos que no deben servirse ----------
  comprobar(!BASE.startsWith('http://') || /localhost|127\.0\.0\.1/.test(BASE), `La URL pública usa HTTPS (${BASE.split('/')[2]})`);
  const inicio = await pedir('GET', '/');
  comprobar(inicio.estado === 200 && inicio.tipo.includes('text/html'), `Página de inicio → ${inicio.estado}`);
  const presentacion = await pedir('GET', '/api/neuroritmo/presentacion');
  comprobar(presentacion.estado === 200 && presentacion.datos?.experiencia?.misiones?.length === 3, 'El backend Express responde (/api/neuroritmo/presentacion con 3 misiones)');
  for (const ruta of ['/.env', '/.env.ejemplo', '/datos/usuarios.json', '/datos/config/permisos.json', '/servidor/server.js', '/package.json', '/node_modules/express/package.json']) {
    const r = await pedir('GET', ruta);
    comprobar(r.estado === 404 || !/GEMINI|"rol"|"clave"|express/i.test(r.texto), `No se sirve ${ruta} (${r.estado})`);
  }
  const sinSesion = await pedir('GET', '/api/neuroritmo');
  comprobar(sinSesion.estado === 401, `Sin sesión, /api/neuroritmo → ${sinSesion.estado}`);
  comprobar(!/AIza[0-9A-Za-z_-]{20,}/.test(inicio.texto + presentacion.texto), 'Ninguna respuesta pública contiene una clave de IA');

  // ---------- Cuentas de demostración ----------
  const demo = await pedir('POST', '/api/auth/login', { cuerpo: { correo: 'estudiante1@demo.ec', clave: 'Demo12345' } });
  comprobar(demo.estado !== 200, 'Las cuentas de demostración con la clave conocida están deshabilitadas o cambiadas');

  // ---------- Multimedia ----------
  const imagen = await pedir('GET', '/recursos/subidas/neuroritmo-mision-cerebro-sonoro.png');
  comprobar(imagen.estado === 200 && imagen.tipo.startsWith('image/'), `Imagen subida servida desde el disco persistente (${imagen.estado}, ${imagen.tipo})`);

  // ---------- Roles ----------
  const est = await entrar('HUMO_ESTUDIANTE');
  if (est) {
    const neuro = await pedir('GET', '/api/neuroritmo', { token: est.token });
    comprobar(neuro.estado === 200 && (neuro.datos?.progreso || neuro.datos?.sinGrupo), 'Estudiante: accede a NeuroRitmo');
    for (const ruta of ['/api/neuroritmo/grupos', '/api/usuarios', '/api/ia/configuracion', '/api/neuroritmo-entregas', '/api/neuroritmo/rubrica']) {
      const r = await pedir('GET', ruta, { token: est.token });
      comprobar([401, 403, 404].includes(r.estado), `Estudiante: ${ruta} negado (${r.estado})`);
    }
    const cert = await pedir('POST', '/api/certificados', { token: est.token, cuerpo: { tipo: 'neuroritmo' } });
    comprobar(cert.estado === 403 || neuro.datos?.progreso?.cumple, `Estudiante sin el logro: certificado negado (${cert.estado})`);
    // Persistencia: registra la lectura de un tema publicado y guarda la sesión para después del reinicio
    const temaId = neuro.datos?.experiencia?.misiones?.[0]?.temaId;
    if (temaId) {
      const marca = await pedir('POST', '/api/progreso-temas', { token: est.token, cuerpo: { temaId } });
      comprobar([200, 201, 400, 409].includes(marca.estado), `Estudiante: registra el tema revisado (${marca.estado})`);
      fs.writeFileSync(ARCHIVO_TOKEN, JSON.stringify({ url: BASE, token: est.token, usuarioId: est.usuario.id, temaId }));
      console.log('   Reinicia o vuelve a desplegar el servicio y ejecuta este script con --persistencia.');
    }
  }
  const doc = await entrar('HUMO_DOCENTE');
  if (doc) {
    const grupos = await pedir('GET', '/api/neuroritmo/grupos', { token: doc.token });
    comprobar(grupos.estado === 200, `Docente: consulta sus grupos de NeuroRitmo (${grupos.estado})`);
    comprobar([401, 403].includes((await pedir('GET', '/api/usuarios', { token: doc.token })).estado), 'Docente: /api/usuarios negado');
    comprobar([401, 403].includes((await pedir('GET', '/api/ia/configuracion', { token: doc.token })).estado), 'Docente: configuración de IA negada');
  }
  const adm = await entrar('HUMO_ADMIN');
  if (adm) {
    const ia = await pedir('GET', '/api/ia/configuracion', { token: adm.token });
    comprobar(ia.estado === 200 && ia.datos?.claveConfigurada && !/AIza[0-9A-Za-z_-]{20,}/.test(ia.texto), 'Admin: la IA está configurada en el servidor y la clave se ve enmascarada');
  }
}
const fallos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallos.length}/${resultados.length} comprobaciones correctas`);
process.exit(fallos.length ? 1 : 0);
