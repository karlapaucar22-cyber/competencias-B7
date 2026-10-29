// servidor/ia.js
// Motor de IA con Google Gemini (API REST generateContent, fetch nativo): plantillas, tareas y límites.
// La clave (GEMINI_API_KEY) y el modelo (IA_MODELO) se leen solo de las variables de entorno.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as almacen from './almacen.js';
import { validarSalida, validarTexto, tieneControlTexto } from './esquemas-ia.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_PREPARADORES = path.resolve(__dirname, 'preparadores');
const DIR_PROMPTS = path.resolve(__dirname, 'prompts');

const URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const TIEMPO_MAXIMO_MS = 60000;
const NOMBRE_MODELO = /^[a-z0-9][a-z0-9.-]{1,80}$/;
const NOMBRE_TAREA = /^[a-z]+(?:-[a-z]+)*$/;          // solo minúsculas y guiones
const ZONA_HORARIA = 'America/Guayaquil';
const MAX_VALOR = 6000;                                // caracteres por cada {{clave}}

// Tareas conversacionales: temperatura 0,7 y límite limiteTutorDiario; el resto, 0,4 y limiteIADiario
// (neuri, neuri-borrador y neuri-actividad: tutor socrático de NeuroRitmo, comparten el límite del tutor)
const CONVERSACION = new Set(['tutor', 'rol-simulacion', 'evaluar-rol', 'neuri', 'neuri-borrador', 'neuri-actividad']);
const TEMPERATURA_CONVERSACION = new Set(['tutor', 'rol-simulacion', 'neuri', 'neuri-actividad']);
export const temperaturaDe = (tarea) => (TEMPERATURA_CONVERSACION.has(tarea) ? 0.7 : 0.4);
export const formatoDe = (tarea) => (TEMPERATURA_CONVERSACION.has(tarea) ? 'texto' : 'json');

function errorIa(mensaje, estado = 502, reintentable = false) {
  const err = new Error(mensaje);
  err.estado = estado;
  err.reintentable = reintentable;
  return err;
}

// Preparadores de servidor/preparadores/<tarea>.js. Cada archivo se aísla para que un módulo
// defectuoso no impida registrar los demás; una tarea ausente se vuelve a buscar al solicitarla.
const preparadores = new Map();
const erroresPreparadores = new Map();

async function cargarPreparador(tarea) {
  if (!NOMBRE_TAREA.test(tarea || '')) return null;
  const ruta = path.join(DIR_PREPARADORES, `${tarea}.js`);
  try {
    const marca = (await fs.stat(ruta)).mtimeMs;
    const modulo = await import(`${pathToFileURL(ruta).href}?v=${marca}`);
    if (typeof modulo.default !== 'function') throw new Error('no exporta una función predeterminada');
    preparadores.set(tarea, modulo.default);
    erroresPreparadores.delete(tarea);
    return modulo.default;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      erroresPreparadores.set(tarea, err.message);
      console.error(`No se pudo cargar el preparador de IA "${tarea}":`, err.message);
    }
    return null;
  }
}

try {
  const archivos = (await fs.readdir(DIR_PREPARADORES)).filter((a) => a.endsWith('.js'));
  await Promise.all(archivos.map((archivo) => cargarPreparador(archivo.slice(0, -3))));
} catch (err) {
  if (err.code !== 'ENOENT') console.error('Error al enumerar preparadores de IA:', err.message);
}

// ---------- Configuración ----------

const modeloDe = (valor) => {
  const modelo = String(valor || '').trim().replace(/^models\//, '');
  return NOMBRE_MODELO.test(modelo) ? modelo : '';
};

/**
 * Configuración desde el entorno: GEMINI_API_KEY, IA_MODELO e IA_MODELO_ALTERNO (opcional).
 */
export function configuracion() {
  const modelo = modeloDe(process.env.IA_MODELO);
  const alterno = modeloDe(process.env.IA_MODELO_ALTERNO);
  return {
    proveedor: 'gemini',
    clave: (process.env.GEMINI_API_KEY || '').trim(),
    modelo,
    modeloAlterno: alterno && alterno !== modelo ? alterno : ''
  };
}

export function enmascarar(clave) {
  if (!clave) return '';
  return clave.length <= 12 ? '•'.repeat(clave.length) : `${clave.slice(0, 4)}…${clave.slice(-4)}`;
}

// Lo que puede ver el administrador: nunca la clave completa
export function configuracionPublica() {
  const { clave, ...resto } = configuracion();
  return {
    ...resto,
    origen: 'variables de entorno del servidor',
    claveConfigurada: Boolean(clave),
    claveMascara: enmascarar(clave),
    modeloConfigurado: Boolean(resto.modelo),
    temperaturas: { general: 0.4, tutor: 0.7, 'rol-simulacion': 0.7 }
  };
}

function exigirConfiguracion(config) {
  if (!config.clave || !config.modelo) {
    throw errorIa('La IA no está configurada en el servidor: faltan las variables de entorno GEMINI_API_KEY o IA_MODELO', 503);
  }
}

// Capacidades de cada modelo (models.get), en caché: ¿admite temperatura y hasta cuánto?
const capacidades = new Map();
async function capacidadesDe(modelo, clave) {
  if (!capacidades.has(modelo)) {
    const info = await solicitar(`models/${encodeURIComponent(modelo)}`, clave, {}, modelo);
    capacidades.set(modelo, { admiteTemperatura: typeof info.maxTemperature === 'number', maxTemperatura: info.maxTemperature });
  }
  return capacidades.get(modelo);
}

// ---------- Llamadas a Gemini ----------

function traducirError(estado, detalle, modelo) {
  // Gemini responde 400 o 401 "API key not valid" según el formato de la clave
  if ((estado === 400 || estado === 401) && /api.?key/i.test(detalle)) {
    return errorIa('La clave de la API de Gemini no es válida: revisa que sea una clave de Google AI Studio copiada completa', 502);
  }
  if (estado === 401 || estado === 403) return errorIa('La clave no tiene permiso para usar Gemini (revisa que la API esté habilitada)', 502);
  if (estado === 404) return errorIa(`El modelo "${modelo}" no existe o no está disponible para esta clave`, 502, true);
  if (estado === 429) return errorIa('Se agotó la cuota de Gemini; intenta más tarde', 429, true);
  if (estado >= 500) return errorIa('Gemini no está disponible en este momento; intenta más tarde', 503, true);
  // Sin reenviar el texto del proveedor (puede incluir datos de la petición)
  return errorIa(`Gemini rechazó la solicitud (código ${estado})`, 502);
}

async function solicitar(ruta, clave, opciones = {}, modelo = '') {
  let respuesta;
  try {
    respuesta = await fetch(`${URL_GEMINI}/${ruta}`, {
      ...opciones,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS)
    });
  } catch (err) {
    throw err.name === 'TimeoutError'
      ? errorIa('Gemini tardó demasiado en responder', 504, true)
      : errorIa('No se pudo conectar con Gemini; revisa la conexión a internet del servidor', 503, true);
  }
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw traducirError(respuesta.status, cuerpo?.error?.message || '', modelo);
  return cuerpo;
}

/**
 * Envía el mensaje al modelo principal y, si falla por modelo, cuota o servicio, al alterno.
 * historial: turnos previos [{ rol: "usuario" | "modelo", texto }] para conversaciones.
 * Petición según la API REST oficial de Gemini (models/<modelo>:generateContent).
 * @returns {{ texto, modelo, tokens }}
 */
export async function generar({ sistema = '', usuario, formato = 'json', historial = [], temperatura = 0.4 }, config) {
  exigirConfiguracion(config);
  const turnos = historial
    .filter((m) => typeof m?.texto === 'string' && m.texto.trim())
    .map((m) => ({ role: m.rol === 'modelo' ? 'model' : 'user', parts: [{ text: m.texto }] }));

  const fallidos = [];
  for (const modelo of [config.modelo, config.modeloAlterno].filter(Boolean)) {
    try {
      // La temperatura solo se envía si el modelo la admite (y sin pasar de su máximo)
      const { admiteTemperatura, maxTemperatura } = await capacidadesDe(modelo, config.clave);
      const cuerpo = JSON.stringify({
        ...(sistema ? { system_instruction: { parts: [{ text: sistema }] } } : {}),
        contents: [...turnos, { role: 'user', parts: [{ text: usuario }] }],
        generationConfig: {
          responseMimeType: formato === 'json' ? 'application/json' : 'text/plain',
          ...(admiteTemperatura ? { temperature: Math.min(temperatura, maxTemperatura) } : {})
        }
      });
      const datos = await solicitar(`models/${encodeURIComponent(modelo)}:generateContent`, config.clave,
        { method: 'POST', body: cuerpo }, modelo);
      const partes = datos.candidates?.[0]?.content?.parts || [];
      const texto = partes.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('').trim();
      if (!texto) {
        throw datos.promptFeedback?.blockReason
          ? errorIa('Gemini bloqueó la solicitud por sus filtros de seguridad', 502)
          : errorIa('Gemini no devolvió texto', 502, true);
      }
      return { texto, modelo, tokens: datos.usageMetadata?.totalTokenCount ?? null };
    } catch (err) {
      fallidos.push(err);
      if (!err.reintentable) break;
    }
  }
  // Si fallaron los dos modelos se informan ambos motivos
  const ultimo = fallidos.at(-1);
  if (fallidos.length > 1) ultimo.message = fallidos.map((e) => e.message).join(' · ');
  throw ultimo;
}

// Modelos de la clave que admiten generateContent
export async function listarModelos() {
  const config = configuracion();
  if (!config.clave) throw errorIa('Falta la variable de entorno GEMINI_API_KEY en el servidor', 503);
  const datos = await solicitar('models?pageSize=1000', config.clave);
  return (datos.models || [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => ({ id: m.name.replace(/^models\//, ''), nombre: m.displayName || m.name }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// Prueba de conexión: envía "Responde solo: OK" con la configuración del entorno
export async function probar() {
  const config = configuracion();
  exigirConfiguracion(config);
  const inicio = Date.now();
  const r = await generar({ usuario: 'Responde solo: OK', formato: 'texto', temperatura: 0.4 }, config);
  return {
    ok: true,
    modelo: r.modelo,
    usoAlterno: r.modelo !== config.modelo,
    ms: Date.now() - inicio,
    respuesta: r.texto.slice(0, 300),
    respuestaEsperada: /\bok\b/i.test(r.texto)
  };
}

// ---------- Tareas ----------

/**
 * Reemplaza cada {{clave}} por datos[clave]: listas unidas por saltos de línea y cada valor
 * recortado a 6.000 caracteres. Los valores insertados no se vuelven a interpretar.
 */
export function rellenar(plantilla, datos) {
  return plantilla.replace(/\{\{(\w+)\}\}/g, (_, clave) => {
    const valor = datos?.[clave];
    if (valor === undefined || valor === null) return '';
    const texto = Array.isArray(valor)
      ? valor.map((v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v))).join('\n')
      : typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
    return texto.slice(0, MAX_VALOR);
  });
}

// "### USUARIO" separa la instrucción de sistema del mensaje del usuario (solo la primera aparición,
// para que un texto del estudiante que la repita no altere la división)
export function separar(texto) {
  const marca = /^###\s*USUARIO\s*$/m.exec(texto);
  if (!marca) return { sistema: '', usuario: texto.trim() };
  return { sistema: texto.slice(0, marca.index).trim(), usuario: texto.slice(marca.index + marca[0].length).trim() };
}

/**
 * Primer bloque JSON de la respuesta (dentro de ```json … ``` o suelto), respetando cadenas.
 * @returns el valor parseado o undefined si no hay JSON válido
 */
export function extraerJson(texto) {
  const bloque = /```(?:json)?\s*([\s\S]*?)```/i.exec(texto);
  const fuente = bloque ? bloque[1] : texto;
  const inicio = fuente.search(/[[{]/);
  if (inicio < 0) return undefined;
  const pila = [];
  let enCadena = false, escape = false;
  for (let i = inicio; i < fuente.length; i++) {
    const c = fuente[i];
    if (enCadena) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') enCadena = false;
      continue;
    }
    if (c === '"') enCadena = true;
    else if (c === '{' || c === '[') pila.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') {
      if (pila.pop() !== c) return undefined;
      if (!pila.length) {
        try { return JSON.parse(fuente.slice(inicio, i + 1)); } catch { return undefined; }
      }
    }
  }
  return undefined;
}

const dia = (fecha) => new Date(fecha).toLocaleDateString('sv-SE', { timeZone: ZONA_HORARIA });
const grupoDe = (tarea) => (CONVERSACION.has(tarea) ? 'conversacion' : 'generacion');

/**
 * Usos que le quedan hoy: tutor, rol-simulacion y evaluar-rol comparten limiteTutorDiario;
 * las tareas generar-* comparten limiteIADiario. null = sin límite configurado.
 */
export async function restantesHoy(usuario, tarea) {
  const grupo = grupoDe(tarea);
  const ajustes = await almacen.leerConfig('ajustes');
  const limite = Number(grupo === 'conversacion' ? ajustes.limiteTutorDiario : ajustes.limiteIADiario) || 0;
  if (!limite) return null;
  const hoy = dia(Date.now());
  const usados = (await almacen.leerLineas('consumo-ia'))
    .filter((r) => r.usuarioId === usuario.id && grupoDe(r.tarea) === grupo && dia(r.fecha) === hoy).length;
  return Math.max(0, limite - usados);
}

async function verificarLimite(usuario, tarea) {
  if ((await restantesHoy(usuario, tarea)) !== 0) return;
  const ajustes = await almacen.leerConfig('ajustes');
  throw errorIa(grupoDe(tarea) === 'conversacion'
    ? `Por hoy ya usaste tus ${ajustes.limiteTutorDiario} mensajes con el tutor. ¡Buen trabajo! Mañana puedes seguir conversando.`
    : `Por hoy ya usaste tus ${ajustes.limiteIADiario} generaciones con IA. Mañana podrás generar más contenido.`, 429);
}

const FORMATO_INVALIDO = 'La IA no devolvió un formato válido';
const PEDIR_JSON = '\n\nResponde SOLO con JSON válido.';
const RECORDAR_REGLAS = '\n\nRecuerda: de 2 a 4 frases breves, exactamente una pregunta orientadora, sin revelar la respuesta, la opción ni la palabra correcta, y sin hablar de puntajes.';

/**
 * Ejecuta una tarea: preparador (valida permisos y arma datos) → plantilla → Gemini → validación.
 * En formato json reintenta una vez si la respuesta no es JSON válido o no cumple el esquema.
 * Registra en consumo-ia.jsonl solo conteos de caracteres (nunca textos ni datos personales).
 */
export async function ejecutarTarea(tarea, datos, usuario, { formato = formatoDe(tarea) } = {}) {
  let preparador = NOMBRE_TAREA.test(tarea || '') ? preparadores.get(tarea) : null;
  if (!preparador && NOMBRE_TAREA.test(tarea || '')) preparador = await cargarPreparador(tarea);
  if (!preparador) {
    const detalle = erroresPreparadores.get(tarea);
    throw errorIa(detalle
      ? `La tarea de IA "${tarea}" no pudo cargarse en el servidor`
      : `La tarea de IA "${tarea}" no está disponible`, detalle ? 500 : 404);
  }

  let plantilla;
  try {
    plantilla = await fs.readFile(path.join(DIR_PROMPTS, `${tarea}.txt`), 'utf-8');
  } catch {
    throw errorIa(`Falta la plantilla servidor/prompts/${tarea}.txt`, 500);
  }

  await verificarLimite(usuario, tarea);
  // historial: lista de turnos → conversación nativa; texto → variable {{historial}} de la plantilla
  // __control: datos del preparador solo para validar la salida (no se envían al modelo)
  const { historial: previo, __control: control, ...resto } = await preparador(datos || {}, usuario);
  const historial = Array.isArray(previo) ? previo : [];
  const variables = typeof previo === 'string' ? { ...resto, historial: previo } : resto;
  const config = configuracion();
  exigirConfiguracion(config);   // antes de registrar: sin configuración no cuenta como uso
  const { sistema, usuario: mensaje } = separar(rellenar(plantilla, variables));
  const temperatura = temperaturaDe(tarea);

  const registro = {
    usuarioId: usuario?.id || null,
    tarea,
    entrada: sistema.length + mensaje.length + historial.reduce((s, m) => s + String(m.texto || '').length, 0),
    salida: 0,
    ok: false,
    fecha: new Date().toISOString()
  };
  try {
    let r = await generar({ sistema, usuario: mensaje, formato, historial, temperatura }, config);
    registro.salida = r.texto.length;
    if (formato !== 'json') {
      // Tareas de texto con control (neuri): se reintenta una vez si es larga o revela la solución
      for (let intento = 1; tieneControlTexto(tarea); intento++) {
        try {
          const texto = validarTexto(tarea, r.texto, control);
          registro.ok = true;
          return texto;
        } catch { /* no cumple: se reintenta */ }
        if (intento === 2) throw errorIa('La IA no devolvió una orientación válida', 502);
        r = await generar({ sistema, usuario: mensaje + RECORDAR_REGLAS, formato, historial, temperatura }, config);
        registro.salida += r.texto.length;
      }
      registro.ok = true;
      return r.texto;
    }

    for (let intento = 1; ; intento++) {
      const valor = extraerJson(r.texto);
      if (valor !== undefined) {
        try {
          const resultado = validarSalida(tarea, valor);
          registro.ok = true;
          return resultado;
        } catch { /* no cumple el esquema: se reintenta */ }
      }
      if (intento === 2) throw errorIa(FORMATO_INVALIDO, 502);
      r = await generar({ sistema, usuario: mensaje + PEDIR_JSON, formato, historial, temperatura }, config);
      registro.salida += r.texto.length;
    }
  } finally {
    await almacen.anexarLinea('consumo-ia', registro).catch((e) => console.error('No se pudo registrar consumo-ia:', e));
  }
}
