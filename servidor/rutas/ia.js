// servidor/rutas/ia.js
// Rutas de IA: estado de la configuración (.env), prueba de conexión y ejecución de tareas

import { Router } from 'express';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';
import * as ia from '../ia.js';

const router = Router();
const MAX_RESPUESTA_TUTOR = 700;
const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Guayaquil' });

// Respuesta del tutor hasta 700 caracteres, cortada en un espacio cuando es posible
export function recortarRespuesta(texto, max = MAX_RESPUESTA_TUTOR) {
  const limpio = String(texto || '').trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max - 1);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).trimEnd()}…`;
}

// Uso del tutor en consultas-tutor: un registro por usuario, tema y día con el número de mensajes
// (sin textos). Las altas van de una en una para no perder conteos.
let cola = Promise.resolve();
function registrarConsulta(usuarioId, temaId) {
  const tarea = cola.then(async () => {
    const dia = hoy();
    const registro = (await almacen.leer('consultas-tutor'))
      .find((c) => c.usuarioId === usuarioId && c.temaId === temaId && c.dia === dia);
    if (registro) await almacen.actualizar('consultas-tutor', registro.id, { mensajes: (Number(registro.mensajes) || 0) + 1 });
    else await almacen.agregar('consultas-tutor', { usuarioId, temaId, dia, mensajes: 1 });
  });
  cola = tarea.catch(() => {});
  return tarea;
}

function responderError(res, err) {
  const estado = typeof err.estado === 'number' ? err.estado : 500;
  if (estado === 500) console.error('Error en el servicio de IA:', err.message);
  res.status(estado).json({ error: estado === 500 ? 'Error en el servicio de IA' : err.message });
}

/**
 * GET /api/ia/configuracion (admin) · proveedor, modelos y clave enmascarada (se configuran en .env)
 */
router.get('/ia/configuracion', exigirRol('admin'), (req, res) => {
  res.json(ia.configuracionPublica());
});

/**
 * GET /api/ia/modelos (admin) · modelos disponibles para la clave del servidor
 */
router.get('/ia/modelos', exigirRol('admin'), async (req, res) => {
  try {
    res.json(await ia.listarModelos());
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * GET /api/ia/prueba (admin) · envía "Responde solo: OK" a Gemini
 */
router.get('/ia/prueba', exigirRol('admin'), async (req, res) => {
  try {
    res.json(await ia.probar());
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * GET /api/ia/restantes?tarea= · usos que le quedan hoy al usuario → { restantes, limite }
 * (restantes y limite son null si no hay límite configurado)
 */
router.get('/ia/restantes', exigirRol(), async (req, res) => {
  try {
    const tarea = String(req.query.tarea || 'tutor');
    const restantes = await ia.restantesHoy(req.usuario, tarea);
    const ajustes = await almacen.leerConfig('ajustes');
    const total = Number(tarea.startsWith('generar-') ? ajustes.limiteIADiario : ajustes.limiteTutorDiario) || null;
    res.json({ restantes, limite: restantes === null ? null : total });
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * POST /api/ia/:tarea · el navegador solo envía datos; las instrucciones viven en servidor/prompts.
 * generar-* solo docente y admin; tutor, rol-simulacion y evaluar-rol con sesión.
 * Formato: json en generar-* y evaluar-rol; texto en tutor y rol-simulacion.
 * tutor: { temaId, contexto: { misionId?, itemId?, actividad? }, historial } → { respuesta }
 * (2–4 frases, una pregunta orientadora, ≤ 90 palabras; límite ajustes.limiteTutorDiario)
 * neuri: { mision, item, modo: "pista" | "error" | "borrador", nivel?, justificacion?, borrador? } → { respuesta }
 * neuri-actividad: { actividad, modo: "pista" | "error", nivel?, ...identificadores del juego } → { respuesta }
 * Sin preparador servidor/preparadores/<tarea>.js → 404.
 */
router.post('/ia/:tarea', exigirRol(), async (req, res) => {
  const { tarea } = req.params;
  try {
    if (tarea.startsWith('generar-') && !['docente', 'admin'].includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Solo docentes y administradores pueden generar contenido con IA' });
    }
    const formato = ia.formatoDe(tarea);
    const resultado = await ia.ejecutarTarea(tarea, req.body, req.usuario, { formato });
    if (tarea === 'tutor') {
      try {
        await registrarConsulta(req.usuario.id, req.body.temaId);
      } catch (err) {
        console.error('No se pudo registrar la consulta al tutor:', err.message);
      }
      return res.json({ respuesta: recortarRespuesta(resultado) });
    }
    if (tarea === 'neuri' || tarea === 'neuri-actividad') return res.json({ respuesta: recortarRespuesta(resultado) });
    res.json(formato === 'texto' ? { respuesta: resultado } : resultado);
  } catch (err) {
    responderError(res, err);
  }
});

export default router;
