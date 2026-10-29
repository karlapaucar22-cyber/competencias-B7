// publico/js/nucleo/gamificacion.js
// Integración de gamificación en el navegador: intentos, insignias, logros y modales

import * as api from './api.js';
import * as ui from './ui.js';
import { cambiarEstado } from './avatar.js';

/**
 * Registra el intento de una actividad educativa en el servidor y muestra los logros obtenidos.
 *
 * @param {Object} intento - { actividad, temaId, nivel, puntaje, maximo, errores, duracionSeg, detalle }
 * @returns {Promise<{ puntosGanados: number, puntosTotales: number, insigniasNuevas: Array<Object> }>}
 */
export async function registrarIntento(intento) {
  try {
    const resultado = await api.llamar('POST', '/api/intentos', intento);
    await mostrarLogros(resultado);
    return resultado;
  } catch (err) {
    ui.aviso(err.message || 'Error al registrar el intento de actividad', 'error');
    throw err;
  }
}

/**
 * Muestra las recompensas obtenidas: aviso de puntos, actualización de marcador
 * y modal con animación de celebración por cada insignia nueva desbloqueada.
 *
 * @param {{ puntosGanados: number, puntosTotales: number, insigniasNuevas: Array<Object> }} resultado
 */
export async function mostrarLogros(resultado) {
  if (!resultado) return;

  // 1. Notificación de puntos ganados
  if (typeof resultado.puntosGanados === 'number' && resultado.puntosGanados > 0) {
    ui.aviso(`¡Has ganado +${resultado.puntosGanados} puntos de experiencia!`, 'exito');
  }

  // 2. Actualización del contador en la barra de navegación (#puntos-usuario)
  if (typeof resultado.puntosTotales === 'number') {
    const elementoPuntos = document.getElementById('puntos-usuario');
    if (elementoPuntos) {
      elementoPuntos.textContent = `🎯 ${resultado.puntosTotales} pts`;
      elementoPuntos.setAttribute('title', `Puntos acumulados: ${resultado.puntosTotales}`);
    }
  }

  // 3. Modales de celebración secuenciales por cada insignia nueva (el avatar, si está, celebra 3 s)
  if (Array.isArray(resultado.insigniasNuevas) && resultado.insigniasNuevas.length > 0) {
    if (document.querySelector('.avatar-guia')) {
      cambiarEstado('celebrando');
      setTimeout(() => cambiarEstado('reposo'), 3000);
    }
    for (const insignia of resultado.insigniasNuevas) {
      const contenidoHtml = `
        <div class="celebracion">
          <div class="celebracion__icono" aria-hidden="true">${ui.escapar(insignia.icono || '🏆')}</div>
          <h3 class="celebracion__nombre">${ui.escapar(insignia.nombre)}</h3>
          <p class="celebracion__texto">¡Felicidades! Has desbloqueado una nueva insignia por tu dedicación y aprendizaje.</p>
        </div>
      `;

      await ui.modal({
        titulo: '¡Nueva Insignia Desbloqueada!',
        contenido: contenidoHtml,
        acciones: [
          { texto: '¡Fantástico!', valor: 'continuar', primario: true }
        ]
      });
    }
  }
}

/**
 * Consulta los logros del usuario actual o de un usuario específico.
 *
 * @param {string} usuarioId - ID del usuario o "yo"
 * @returns {Promise<{ puntos: number, insignias: Array<Object>, nivelQuiz: Object }>}
 */
export async function logrosDe(usuarioId = 'yo') {
  try {
    const data = await api.llamar('GET', `/api/logros/${encodeURIComponent(usuarioId)}`);
    return {
      puntos: data?.puntos || 0,
      insignias: data?.insignias || [],
      nivelQuiz: data?.nivelQuiz || {}
    };
  } catch (err) {
    console.error('Error al obtener logros del usuario:', err);
    return { puntos: 0, insignias: [], nivelQuiz: {} };
  }
}

export default {
  registrarIntento,
  mostrarLogros,
  logrosDe
};
