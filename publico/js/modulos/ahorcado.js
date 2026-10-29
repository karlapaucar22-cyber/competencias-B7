// publico/js/modulos/ahorcado.js
// Actividad interactiva del Ahorcado Pedagógico de 6 letras

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { montarAyudaNeuri } from '../nucleo/ayuda-neuri.js';

// Filas del teclado en pantalla (incluyendo Ñ)
const FILAS_TECLADO = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

// Estado global de la sesión de juego
let temaActual = null;
let terminosDisponibles = [];
const terminosUsados = new Set();

let terminoActual = null;
let palabraOriginal = '';
let palabraNormalizada = '';
let letrasAcertadas = new Set();
let letrasErradas = new Set();
let errores = 0;
let juegoTerminado = false;
let tiempoInicio = 0;
let ayuda = null;

// Referencias del DOM
let elBadgeTema;
let elAhorcadoCargando;
let elAhorcadoVacio;
let elAhorcadoTablero;
let elSvgGlobo;
let elVidasTexto;
let elTextoPista;
let elContenedorCasillas;
let elPanelFinPartida;
let elContenedorRetro;
let elBtnOtraPalabra;
let elTeclado;
let elBadgeMision;
let elBtnCambiarTema;
let elEnlaceVolverTema;

async function iniciar() {
  await montarPlantilla({ titulo: 'Ahorcado', roles: ['estudiante', 'docente'] });

  // Obtener elementos
  elBadgeTema = document.getElementById('badgeTema');
  elBadgeMision = document.getElementById('badgeMision');
  elBtnCambiarTema = document.getElementById('btnCambiarTema');
  elAhorcadoCargando = document.getElementById('ahorcadoCargando');
  elAhorcadoVacio = document.getElementById('ahorcadoVacio');
  elAhorcadoTablero = document.getElementById('ahorcadoTablero');
  elSvgGlobo = document.getElementById('svgGlobo');
  elVidasTexto = document.getElementById('vidasTexto');
  elTextoPista = document.getElementById('textoPista');
  elContenedorCasillas = document.getElementById('contenedorCasillas');
  elPanelFinPartida = document.getElementById('panelFinPartida');
  elContenedorRetro = document.getElementById('contenedorRetro');
  elBtnOtraPalabra = document.getElementById('btnOtraPalabra');
  elTeclado = document.getElementById('tecladoEnPantalla');
  elEnlaceVolverTema = document.getElementById('enlaceVolverTema');

  // Neuri: pistas graduadas y explicación de las letras falladas (sin revelar la palabra)
  ayuda = montarAyudaNeuri({
    actividad: 'ahorcado',
    antesDe: elPanelFinPartida,
    contexto: (modo) => {
      if (!terminoActual || juegoTerminado) return 'La partida terminó: pide otra palabra para seguir practicando.';
      if (modo === 'error' && !letrasErradas.size) return 'Aún no tienes letras falladas en esta palabra.';
      return {
        clave: terminoActual.id,
        datos: { temaId: temaActual.id, terminoId: terminoActual.id, acertadas: [...letrasAcertadas].join(''), erradas: [...letrasErradas].join('') }
      };
    }
  });

  // Configurar botón "Otra palabra"
  if (elBtnOtraPalabra) {
    elBtnOtraPalabra.addEventListener('click', () => {
      iniciarNuevaRonda();
    });
  }

  // Configurar botón "Cambiar tema"
  if (elBtnCambiarTema) {
    elBtnCambiarTema.addEventListener('click', async () => {
      try {
        const elegido = await obtenerTemaActividad({ forzarModal: true });
        if (elegido && elegido.id) {
          await cargarTema(elegido);
        }
      } catch (err) {
        console.error('Error al cambiar de tema:', err);
      }
    });
  }

  // Configurar píldoras de acceso rápido a los temas de la carpeta Tareas
  const pildoras = document.querySelectorAll('.btn-pildora-tema');
  pildoras.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const temaId = btn.dataset.temaId;
      if (!temaId || (temaActual && temaActual.id === temaId)) return;
      try {
        const tema = await api.obtener('temas', temaId);
        if (tema && tema.id) {
          await cargarTema(tema);
        }
      } catch (err) {
        console.error(`Error al cargar tema ${temaId}:`, err);
      }
    });
  });

  // Escuchar teclado físico
  document.addEventListener('keydown', manejarTecladoFisico);

  // Obtener tema inicial de la actividad
  temaActual = await obtenerTemaActividad();
  if (!temaActual || !temaActual.id) {
    mostrarVacio();
    return;
  }

  await cargarTema(temaActual);
}

async function cargarTema(nuevoTema) {
  if (!nuevoTema || !nuevoTema.id) {
    mostrarVacio();
    return;
  }
  temaActual = nuevoTema;

  // Actualizar URL sin recargar la página
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('temaId', temaActual.id);
    window.history.replaceState(null, '', url.toString());
  } catch (e) {
    // En caso de que no soporte history.replaceState
  }

  // Actualizar indicador de tema y narrativa de estación NeuroRitmo
  if (elBadgeTema) {
    elBadgeTema.textContent = `Tema: ${temaActual.titulo}`;
  }
  if (elBadgeMision) {
    if (temaActual.id === 'tem_000001') {
      elBadgeMision.textContent = 'Misión 1: Funciones Ejecutivas';
      elBadgeMision.title = 'Subtema 1.1 Tareas: Procesamiento auditivo y funciones ejecutivas';
    } else if (temaActual.id === 'tem_000002') {
      elBadgeMision.textContent = 'Misión 2: Autorregulación y Estrés';
      elBadgeMision.title = 'Subtema 1.2 Tareas: Impacto socioemocional y artes sonoras';
    } else {
      elBadgeMision.textContent = 'Misión Cerebro Sonoro';
    }
  }

  // Actualizar estado de las píldoras de temas
  const pildoras = document.querySelectorAll('.btn-pildora-tema');
  pildoras.forEach((btn) => {
    if (btn.dataset.temaId === temaActual.id) {
      btn.classList.add('activa');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('activa');
      btn.setAttribute('aria-pressed', 'false');
    }
  });

  if (elEnlaceVolverTema) {
    elEnlaceVolverTema.href = `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`;
  }

  // Reiniciar estado de términos y cargar glosario
  terminosUsados.clear();
  if (elAhorcadoCargando) elAhorcadoCargando.style.display = 'block';
  if (elAhorcadoTablero) elAhorcadoTablero.style.display = 'none';
  if (elAhorcadoVacio) elAhorcadoVacio.style.display = 'none';

  try {
    const glosario = await api.listar('glosario', { temaId: temaActual.id });
    const lista = Array.isArray(glosario) ? glosario : [];

    // Filtrar solo términos cuyo término normalizado tenga exactamente 6 letras
    terminosDisponibles = lista.filter((item) => {
      if (!item || !item.termino) return false;
      const normalizado = util.normalizar(item.termino);
      return normalizado.length === 6;
    });

    if (terminosDisponibles.length === 0) {
      mostrarVacio();
      return;
    }

    iniciarNuevaRonda();
  } catch (err) {
    console.error('Error al cargar glosario:', err);
    mostrarVacio();
  }
}

function mostrarVacio() {
  if (elAhorcadoCargando) elAhorcadoCargando.style.display = 'none';
  if (elAhorcadoTablero) elAhorcadoTablero.style.display = 'none';
  if (elAhorcadoVacio) elAhorcadoVacio.style.display = 'block';
}

function iniciarNuevaRonda() {
  // Filtrar los que aún no se hayan usado en esta partida
  const restantes = terminosDisponibles.filter((t) => !terminosUsados.has(t.id));

  if (restantes.length === 0) {
    mostrarVacio();
    return;
  }

  // Elegir uno al azar
  const indiceAzar = Math.floor(Math.random() * restantes.length);
  terminoActual = restantes[indiceAzar];
  terminosUsados.add(terminoActual.id);

  palabraOriginal = terminoActual.termino.trim();
  palabraNormalizada = util.normalizar(palabraOriginal);

  // Reiniciar estado
  errores = 0;
  letrasAcertadas.clear();
  letrasErradas.clear();
  juegoTerminado = false;
  tiempoInicio = Date.now();

  // Actualizar interfaz
  if (elAhorcadoCargando) elAhorcadoCargando.style.display = 'none';
  if (elAhorcadoVacio) elAhorcadoVacio.style.display = 'none';
  if (elAhorcadoTablero) elAhorcadoTablero.style.display = 'flex';
  if (elPanelFinPartida) elPanelFinPartida.style.display = 'none';
  if (elContenedorRetro) elContenedorRetro.innerHTML = '';
  ayuda?.reiniciar();

  // Actualizar pista didáctica
  if (elTextoPista) {
    elTextoPista.textContent = terminoActual.pista || 'Sin pista adicional para esta palabra.';
  }

  actualizarEstadoGlobo();
  renderizarCasillas();
  renderizarTeclado();
}

function actualizarEstadoGlobo() {
  if (elSvgGlobo) {
    // En un <svg>, className es de solo lectura: se usa el atributo class
    elSvgGlobo.setAttribute('class', `ahorcado-globo-svg estado-${errores}`);
  }

  if (elVidasTexto) {
    const restantes = 3 - errores;
    if (restantes > 1) {
      elVidasTexto.textContent = `${restantes} intentos restantes`;
      elVidasTexto.className = 'contador-vidas';
    } else if (restantes === 1) {
      elVidasTexto.textContent = '1 intento restante';
      elVidasTexto.className = 'contador-vidas';
    } else if (restantes === 0) {
      elVidasTexto.textContent = '¡Última oportunidad!';
      elVidasTexto.className = 'contador-vidas peligro';
    } else {
      elVidasTexto.textContent = 'Globo desinflado (0 intentos)';
      elVidasTexto.className = 'contador-vidas peligro';
    }
  }
}

function renderizarCasillas() {
  if (!elContenedorCasillas) return;
  elContenedorCasillas.innerHTML = '';

  for (let i = 0; i < palabraNormalizada.length; i++) {
    const letraNorm = palabraNormalizada[i];
    const letraOrig = palabraOriginal[i].toUpperCase();

    const casilla = document.createElement('div');
    casilla.className = 'casilla-letra';
    casilla.dataset.indice = String(i);

    if (letrasAcertadas.has(letraNorm)) {
      casilla.textContent = letraOrig;
      casilla.classList.add('acertada');
    } else {
      casilla.innerHTML = '&nbsp;';
    }

    elContenedorCasillas.appendChild(casilla);
  }
}

function renderizarTeclado() {
  if (!elTeclado) return;
  elTeclado.innerHTML = '';

  FILAS_TECLADO.forEach((fila) => {
    const filaDiv = document.createElement('div');
    filaDiv.className = 'teclado-fila';

    fila.forEach((letra) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'teclado-tecla';
      btn.dataset.letra = letra;
      btn.textContent = letra;
      btn.setAttribute('aria-label', `Letra ${letra}`);

      btn.addEventListener('click', () => {
        probarLetra(letra);
      });

      filaDiv.appendChild(btn);
    });

    elTeclado.appendChild(filaDiv);
  });
}

function probarLetra(letraIngresada) {
  if (juegoTerminado) return;

  const letra = util.normalizar(letraIngresada);
  if (!letra || letra.length !== 1) return;

  // Si ya fue usada
  if (letrasAcertadas.has(letra) || letrasErradas.has(letra)) return;

  // Buscar tecla en pantalla para actualizar su estado
  const btnTecla = elTeclado ? elTeclado.querySelector(`[data-letra="${letra}"]`) : null;

  if (palabraNormalizada.includes(letra)) {
    letrasAcertadas.add(letra);
    if (btnTecla) {
      btnTecla.classList.add('tecla--acierto');
      btnTecla.disabled = true;
    }
    renderizarCasillas();

    // Comprobar si ya se adivinaron todas las letras
    const gano = palabraNormalizada.split('').every((l) => letrasAcertadas.has(l));
    if (gano) {
      finalizarPartida(true);
    }
  } else {
    letrasErradas.add(letra);
    errores++;
    if (btnTecla) {
      btnTecla.classList.add('tecla--error');
      btnTecla.disabled = true;
    }
    actualizarEstadoGlobo();

    // Se permiten 3 errores: el juego termina en el cuarto
    if (errores >= 4) {
      finalizarPartida(false);
    }
  }
}

function manejarTecladoFisico(evento) {
  if (juegoTerminado) return;

  // Ignorar si el usuario está enfocado en un campo de texto o similar
  const tag = evento.target?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

  const tecla = evento.key;
  if (!tecla) return;

  // Normalizar y comprobar si es letra A-Z o Ñ
  const letra = util.normalizar(tecla);
  if (/^[A-ZÑ]$/.test(letra)) {
    evento.preventDefault();
    probarLetra(letra);
  }
}

async function finalizarPartida(gano) {
  juegoTerminado = true;

  // Deshabilitar todas las teclas restantes
  if (elTeclado) {
    const teclas = elTeclado.querySelectorAll('.teclado-tecla');
    teclas.forEach((t) => (t.disabled = true));
  }

  // Revelar la palabra en las casillas si perdió
  if (!gano && elContenedorCasillas) {
    const casillas = elContenedorCasillas.querySelectorAll('.casilla-letra');
    for (let i = 0; i < palabraNormalizada.length; i++) {
      const letraNorm = palabraNormalizada[i];
      const letraOrig = palabraOriginal[i].toUpperCase();
      if (!letrasAcertadas.has(letraNorm) && casillas[i]) {
        casillas[i].textContent = letraOrig;
        casillas[i].classList.add('revelada-fallida');
      }
    }
  }

  // Calcular métricas
  const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));
  const puntaje = gano ? Math.max(0, 10 - errores * 2) : 0;

  // Mostrar retroalimentación pedagógica
  if (elContenedorRetro) {
    elContenedorRetro.innerHTML = '';
    const panelRetro = mostrarRetro({
      correcto: gano,
      explicacion: terminoActual.definicion || `La palabra era "${palabraOriginal}".`,
      sugerencia: terminoActual.retroalimentacion || 'Repasa los conceptos clave del glosario.',
      enlaceTema: temaActual.id
    });
    elContenedorRetro.appendChild(panelRetro);
  }

  if (elPanelFinPartida) {
    elPanelFinPartida.style.display = 'block';
  }

  // Registrar intento en el servidor y procesar recompensas
  try {
    await registrarIntento({
      actividad: 'ahorcado',
      temaId: temaActual.id,
      puntaje,
      maximo: 10,
      errores,
      duracionSeg
    });
  } catch (err) {
    console.error('Error al registrar intento de ahorcado:', err);
  }
}

document.addEventListener('DOMContentLoaded', iniciar);
