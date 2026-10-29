// publico/js/nucleo/ui.js
// Utilidades de interfaz de usuario, diálogos modales, avisos y sanitización

/**
 * Escapa caracteres especiales en un texto para prevenir inyecciones HTML.
 */
export function escapar(texto) {
  if (texto === null || texto === undefined) return '';
  const mapa = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(texto).replace(/[&<>"']/g, (m) => mapa[m]);
}

/**
 * Limpia y sanitiza HTML usando DOMPurify si está disponible; en caso contrario, escapa el texto.
 */
export function limpiar(html) {
  if (html === null || html === undefined) return '';
  if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
    return window.DOMPurify.sanitize(html);
  }
  return escapar(html);
}

/**
 * Muestra una notificación emergente (toast) que se cierra automáticamente a los 4 segundos
 * dentro de un contenedor accesible con aria-live="polite".
 */
export function aviso(texto, tipo = 'info') {
  if (typeof document === 'undefined') return;

  let contenedor = document.getElementById('contenedor-avisos');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'contenedor-avisos';
    contenedor.className = 'contenedor-avisos';
    contenedor.setAttribute('aria-live', 'polite');
    contenedor.setAttribute('aria-atomic', 'true');
    document.body.appendChild(contenedor);
  }

  const tiposValidos = ['info', 'exito', 'error'];
  const tipoFinal = tiposValidos.includes(tipo) ? tipo : 'info';

  const elementoAviso = document.createElement('div');
  elementoAviso.className = `aviso aviso-${tipoFinal}`;
  elementoAviso.setAttribute('role', 'status');
  elementoAviso.textContent = texto;

  contenedor.appendChild(elementoAviso);

  setTimeout(() => {
    if (elementoAviso.parentElement) {
      elementoAviso.remove();
    }
  }, 4000);
}

/**
 * Muestra una ventana modal accesible (role="dialog", aria-modal="true", cierre con Escape,
 * atrapado de foco) y devuelve una promesa con el valor de la acción seleccionada o null.
 */
export function modal({ titulo = '', contenido = '', acciones = [] }) {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolver) => {
    const elementoAnterior = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'modal-fondo';

    const dialogo = document.createElement('div');
    dialogo.className = 'modal-dialogo';
    dialogo.setAttribute('role', 'dialog');
    dialogo.setAttribute('aria-modal', 'true');
    dialogo.setAttribute('aria-labelledby', 'modal-titulo');
    dialogo.tabIndex = -1;

    const cabecera = document.createElement('div');
    cabecera.className = 'modal-cabecera';

    const h2 = document.createElement('h2');
    h2.id = 'modal-titulo';
    h2.className = 'modal-titulo';
    h2.textContent = titulo;

    const btnCerrar = document.createElement('button');
    btnCerrar.type = 'button';
    btnCerrar.className = 'modal-cerrar';
    btnCerrar.setAttribute('aria-label', 'Cerrar');
    btnCerrar.innerHTML = '&times;';

    cabecera.appendChild(h2);
    cabecera.appendChild(btnCerrar);

    const cuerpo = document.createElement('div');
    cuerpo.className = 'modal-cuerpo';
    if (contenido instanceof Node) {
      cuerpo.appendChild(contenido);
    } else if (typeof contenido === 'string') {
      cuerpo.innerHTML = contenido;
    }

    const pieAcciones = document.createElement('div');
    pieAcciones.className = 'modal-acciones';

    const cerrarModal = (valor) => {
      document.removeEventListener('keydown', manejarKeyDown);
      overlay.remove();
      if (elementoAnterior && typeof elementoAnterior.focus === 'function') {
        elementoAnterior.focus();
      }
      resolver(valor);
    };

    btnCerrar.addEventListener('click', () => cerrarModal(null));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cerrarModal(null);
      }
    });

    if (Array.isArray(acciones) && acciones.length > 0) {
      for (const accion of acciones) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = accion.clase || 'btn';
        boton.textContent = accion.texto || 'Aceptar';
        boton.addEventListener('click', async () => {
          if (typeof accion.validar === 'function') {
            try {
              const valido = await accion.validar();
              if (valido === false) return;
            } catch (err) {
              return;
            }
          }
          cerrarModal(accion.valor !== undefined ? accion.valor : null);
        });
        pieAcciones.appendChild(boton);
      }
    } else {
      const botonCerrar = document.createElement('button');
      botonCerrar.type = 'button';
      botonCerrar.className = 'btn';
      botonCerrar.textContent = 'Cerrar';
      botonCerrar.addEventListener('click', () => cerrarModal(null));
      pieAcciones.appendChild(botonCerrar);
    }

    dialogo.appendChild(cabecera);
    dialogo.appendChild(cuerpo);
    dialogo.appendChild(pieAcciones);
    overlay.appendChild(dialogo);
    document.body.appendChild(overlay);

    const selectoresFocus = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const manejarKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrarModal(null);
        return;
      }
      if (e.key === 'Tab') {
        const focusables = Array.from(dialogo.querySelectorAll(selectoresFocus));
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const primerElemento = focusables[0];
        const ultimoElemento = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === primerElemento) {
            e.preventDefault();
            ultimoElemento.focus();
          }
        } else {
          if (document.activeElement === ultimoElemento) {
            e.preventDefault();
            primerElemento.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', manejarKeyDown);

    const focusablesIniciales = Array.from(dialogo.querySelectorAll(selectoresFocus));
    if (focusablesIniciales.length > 0) {
      focusablesIniciales[0].focus();
    } else {
      dialogo.focus();
    }
  });
}

/**
 * Solicita confirmación al usuario utilizando el diálogo modal accesible.
 * Devuelve true si el usuario acepta, false en caso contrario.
 */
export async function confirmar(texto) {
  const contenido = typeof texto === 'string' ? `<p>${escapar(texto)}</p>` : texto;
  const resultado = await modal({
    titulo: 'Confirmación',
    contenido,
    acciones: [
      { texto: 'Cancelar', valor: false, clase: 'btn btn-secundario' },
      { texto: 'Aceptar', valor: true, clase: 'btn btn-primario' }
    ]
  });
  return Boolean(resultado);
}

/**
 * Controla la visualización del indicador de carga global (.cargando).
 */
export function cargando(activo) {
  if (typeof document === 'undefined') return;

  const existente = document.querySelector('.cargando');
  if (activo) {
    if (!existente) {
      const elemento = document.createElement('div');
      elemento.className = 'cargando';
      elemento.setAttribute('role', 'status');
      elemento.setAttribute('aria-live', 'polite');
      elemento.setAttribute('aria-label', 'Cargando');
      document.body.appendChild(elemento);
    }
  } else {
    if (existente) {
      existente.remove();
    }
  }
}
