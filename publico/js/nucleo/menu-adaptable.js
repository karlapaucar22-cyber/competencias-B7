// Estado compartido del menú: expandido, contraído u oculto en escritorio y cajón en móvil.

const ESTADOS = ['expandido', 'contraido', 'oculto'];
const consultaMovil = '(max-width: 767px)';

export const clavePreferenciaMenu = (usuario) => `menu.vista:${usuario?.id || 'publico'}`;

export function leerPreferenciaMenu(usuario, almacenamiento = globalThis.localStorage) {
  try {
    const valor = almacenamiento?.getItem(clavePreferenciaMenu(usuario));
    return ESTADOS.includes(valor) ? valor : 'contraido';
  } catch {
    return 'contraido';
  }
}

export function guardarPreferenciaMenu(usuario, estado, almacenamiento = globalThis.localStorage) {
  if (!ESTADOS.includes(estado)) return;
  try { almacenamiento?.setItem(clavePreferenciaMenu(usuario), estado); } catch { /* preferencia opcional */ }
}

export function siguienteEstadoMenu(estado) {
  if (estado === 'expandido') return 'contraido';
  if (estado === 'contraido') return 'oculto';
  return 'expandido';
}

export function montarMenuAdaptable({ menu, boton, botonCerrar, botonFijar, usuario } = {}) {
  if (!menu || !boton || typeof window === 'undefined') return;
  const media = window.matchMedia(consultaMovil);
  let estado = leerPreferenciaMenu(usuario);
  let temporizadorContraccion;

  const rotuloBoton = (accion, simbolo) => {
    boton.textContent = simbolo;
    boton.setAttribute('aria-label', accion);
    boton.title = accion;
  };

  const actualizarFijacion = () => {
    if (!botonFijar) return;
    const fijado = estado === 'expandido';
    botonFijar.setAttribute('aria-pressed', String(fijado));
    botonFijar.title = fijado ? 'Permitir contracción automática' : 'Mantener menú expandido';
    const texto = botonFijar.querySelector('.menu-lateral__fijar-texto');
    if (texto) texto.textContent = botonFijar.title;
  };

  const contraerTemporal = (inmediato = false) => {
    clearTimeout(temporizadorContraccion);
    const cerrar = () => {
      document.body.classList.remove('menu-temporal-expandido');
      delete menu.dataset.expandidoTemporal;
      if (estado === 'contraido') boton.setAttribute('aria-expanded', 'false');
    };
    if (inmediato) cerrar();
    else temporizadorContraccion = window.setTimeout(cerrar, 180);
  };

  const expandirTemporal = () => {
    if (media.matches || estado !== 'contraido') return;
    clearTimeout(temporizadorContraccion);
    document.body.classList.add('menu-temporal-expandido');
    menu.dataset.expandidoTemporal = 'true';
    boton.setAttribute('aria-expanded', 'true');
  };

  const cerrarMovil = ({ devolverFoco = false } = {}) => {
    contraerTemporal(true);
    menu.classList.remove('abierto');
    document.body.classList.remove('menu-movil-abierto');
    menu.setAttribute('aria-hidden', 'true');
    menu.inert = true;
    boton.setAttribute('aria-expanded', 'false');
    rotuloBoton('Abrir menú de navegación', '☰');
    if (devolverFoco) boton.focus();
  };

  const abrirMovil = () => {
    menu.classList.add('abierto');
    document.body.classList.add('menu-movil-abierto');
    menu.setAttribute('aria-hidden', 'false');
    menu.inert = false;
    boton.setAttribute('aria-expanded', 'true');
    rotuloBoton('Cerrar menú de navegación', '×');
    botonCerrar?.focus();
  };

  const aplicarEscritorio = (nuevoEstado, guardar = false) => {
    contraerTemporal(true);
    estado = ESTADOS.includes(nuevoEstado) ? nuevoEstado : 'contraido';
    document.body.classList.toggle('menu-contraido', estado === 'contraido');
    document.body.classList.toggle('menu-oculto', estado === 'oculto');
    document.body.classList.remove('menu-movil-abierto');
    menu.classList.remove('abierto');
    menu.dataset.vista = estado;
    menu.inert = estado === 'oculto';
    menu.setAttribute('aria-hidden', String(estado === 'oculto'));
    boton.setAttribute('aria-expanded', String(estado === 'expandido'));
    if (estado === 'expandido') rotuloBoton('Contraer menú de navegación', '«');
    else if (estado === 'contraido') rotuloBoton('Ocultar menú de navegación', '×');
    else rotuloBoton('Mostrar menú de navegación', '☰');
    actualizarFijacion();
    if (guardar) guardarPreferenciaMenu(usuario, estado);
  };

  const aplicarModo = () => {
    if (media.matches) {
      document.body.classList.remove('menu-contraido', 'menu-oculto');
      menu.dataset.vista = 'movil';
      cerrarMovil();
    } else {
      aplicarEscritorio(estado);
    }
  };

  boton.addEventListener('click', (evento) => {
    evento.stopPropagation();
    if (media.matches) {
      if (menu.classList.contains('abierto')) cerrarMovil({ devolverFoco: true });
      else abrirMovil();
      return;
    }
    aplicarEscritorio(siguienteEstadoMenu(estado), true);
  });

  botonCerrar?.addEventListener('click', () => {
    if (media.matches) cerrarMovil({ devolverFoco: true });
    else {
      aplicarEscritorio('oculto', true);
      boton.focus();
    }
  });

  botonFijar?.addEventListener('click', () => {
    if (media.matches) return;
    aplicarEscritorio(estado === 'expandido' ? 'contraido' : 'expandido', true);
    botonFijar.focus();
  });

  document.addEventListener('pointermove', (evento) => {
    if (media.matches || estado !== 'contraido' || document.body.classList.contains('menu-temporal-expandido')) return;
    const borde = menu.getBoundingClientRect().right;
    if (evento.clientX >= 0 && evento.clientX <= borde + 32) expandirTemporal();
  }, { passive: true });

  menu.addEventListener('pointerenter', expandirTemporal);
  menu.addEventListener('pointerleave', () => contraerTemporal());
  menu.addEventListener('focusin', expandirTemporal);
  menu.addEventListener('focusout', (evento) => {
    if (!menu.contains(evento.relatedTarget)) contraerTemporal();
  });

  document.addEventListener('click', (evento) => {
    if (media.matches && menu.classList.contains('abierto') && !menu.contains(evento.target) && evento.target !== boton) {
      cerrarMovil();
    }
  });

  menu.addEventListener('click', (evento) => {
    if (media.matches && evento.target.closest('a')) cerrarMovil();
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && media.matches && menu.classList.contains('abierto')) {
      cerrarMovil({ devolverFoco: true });
    }
  });

  media.addEventListener?.('change', aplicarModo);
  aplicarModo();
}
