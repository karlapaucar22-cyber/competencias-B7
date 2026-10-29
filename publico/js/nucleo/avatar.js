// publico/js/nucleo/avatar.js
// Avatar guía "Lumi" (o "Neuri" en NeuroRitmo): personaje SVG con globo de texto, voz opcional (speechSynthesis) y estados

const ESTADOS = ['reposo', 'hablando', 'pensando', 'celebrando'];
const CLAVE_VOZ = 'avatar.voz';          // "activa" | "silencio" (por defecto, silencio)
const CLAVE_VISTA = 'avatar.vista';       // "abierto" | "minimizado" | "oculto"
const CLAVE_OCULTO = 'avatar.oculto';     // compatibilidad con la preferencia anterior
const CLAVE_TEXTO = 'avatar.texto';       // transcripción de esta sesión al navegar
let raiz = null;
let ultimoTexto = '';
let temporizadorEstado = null;
let reproduciendo = false;
let vozPausada = false;

// Un solo SVG: los estados se logran con clases CSS que mueven boca, ojos y brazos
const SVG = `
<svg class="avatar-guia__figura" viewBox="0 0 120 132" aria-hidden="true" focusable="false">
  <g class="avatar-guia__pensamiento">
    <circle cx="98" cy="22" r="4"></circle>
    <circle cx="108" cy="11" r="6"></circle>
  </g>
  <line class="avatar-guia__antena" x1="60" y1="30" x2="60" y2="14"></line>
  <path class="avatar-guia__estrella" d="M60 2 L63 9 L70 9 L64.5 13.5 L66.5 20.5 L60 16.5 L53.5 20.5 L55.5 13.5 L50 9 L57 9 Z"></path>
  <ellipse class="avatar-guia__cuerpo" cx="60" cy="78" rx="38" ry="46"></ellipse>
  <ellipse class="avatar-guia__panza" cx="60" cy="96" rx="22" ry="20"></ellipse>
  <path class="avatar-guia__brazo avatar-guia__brazo--izq" d="M26 82 Q10 78 9 62"></path>
  <path class="avatar-guia__brazo avatar-guia__brazo--der" d="M94 82 Q110 78 111 62"></path>
  <g class="avatar-guia__ojos">
    <ellipse class="avatar-guia__ojo" cx="46" cy="64" rx="7" ry="8.5"></ellipse>
    <ellipse class="avatar-guia__ojo" cx="74" cy="64" rx="7" ry="8.5"></ellipse>
    <circle class="avatar-guia__brillo" cx="48.5" cy="60.5" r="2.2"></circle>
    <circle class="avatar-guia__brillo" cx="76.5" cy="60.5" r="2.2"></circle>
  </g>
  <circle class="avatar-guia__mejilla" cx="36" cy="77" r="4.5"></circle>
  <circle class="avatar-guia__mejilla" cx="84" cy="77" r="4.5"></circle>
  <path class="avatar-guia__boca avatar-guia__boca--sonrisa" d="M50 81 Q60 90 70 81"></path>
  <ellipse class="avatar-guia__boca avatar-guia__boca--abierta" cx="60" cy="84" rx="7" ry="5.5"></ellipse>
</svg>`;

// Neuri (NeuroRitmo): un cerebro con audífonos; usa las mismas clases para compartir los estados
const SVG_NEURI = `
<svg class="avatar-guia__figura figura-neuri" viewBox="0 0 120 132" aria-hidden="true" focusable="false">
  <g class="avatar-guia__pensamiento">
    <circle cx="104" cy="30" r="4"></circle>
    <circle cx="112" cy="18" r="6"></circle>
  </g>
  <path class="avatar-guia__estrella" d="M94 2 L106 0 L106 15 A4.5 4.5 0 1 1 102.5 10.6 L102.5 5.2 L97.5 6 L97.5 17 A4.5 4.5 0 1 1 94 12.6 Z"></path>
  <path class="avatar-guia__cuerpo" d="M60 36 C44 28 26 36 27 54 C16 60 15 82 27 88 C27 106 46 114 60 106 C74 114 93 106 93 88 C105 82 104 60 93 54 C94 36 76 28 60 36 Z"></path>
  <path class="figura-neuri__surco" d="M60 38 V58 M41 46 Q48 52 41 58 M79 46 Q72 52 79 58 M33 96 Q41 90 48 98 M87 96 Q79 90 72 98"></path>
  <path class="figura-neuri__diadema" d="M20 64 Q20 18 60 18 Q100 18 100 64"></path>
  <rect class="figura-neuri__auricular" x="11" y="54" width="16" height="26" rx="7"></rect>
  <rect class="figura-neuri__auricular" x="93" y="54" width="16" height="26" rx="7"></rect>
  <path class="avatar-guia__brazo avatar-guia__brazo--izq" d="M26 82 Q10 78 9 62"></path>
  <path class="avatar-guia__brazo avatar-guia__brazo--der" d="M94 82 Q110 78 111 62"></path>
  <g class="avatar-guia__ojos">
    <ellipse class="avatar-guia__ojo" cx="46" cy="66" rx="6.5" ry="8"></ellipse>
    <ellipse class="avatar-guia__ojo" cx="74" cy="66" rx="6.5" ry="8"></ellipse>
    <circle class="avatar-guia__brillo" cx="48.3" cy="62.5" r="2.1"></circle>
    <circle class="avatar-guia__brillo" cx="76.3" cy="62.5" r="2.1"></circle>
  </g>
  <circle class="avatar-guia__mejilla" cx="37" cy="78" r="4.5"></circle>
  <circle class="avatar-guia__mejilla" cx="83" cy="78" r="4.5"></circle>
  <path class="avatar-guia__boca avatar-guia__boca--sonrisa" d="M50 82 Q60 91 70 82"></path>
  <ellipse class="avatar-guia__boca avatar-guia__boca--abierta" cx="60" cy="85" rx="7" ry="5.5"></ellipse>
</svg>`;

const PERSONAJES = {
  lumi: { nombre: 'Lumi', svg: SVG },
  neuri: { nombre: 'Neuri', svg: SVG_NEURI }
};

/**
 * SVG de Neuri para usarlo fuera del avatar flotante (p. ej., portada de NeuroRitmo).
 * La figura es decorativa (aria-hidden): el texto que la acompaña debe nombrar a Neuri.
 */
export const figuraNeuri = () => SVG_NEURI;

function leerPreferencia(clave) {
  try { return localStorage.getItem(clave); } catch { return null; }
}

function guardarPreferencia(clave, valor) {
  try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento: solo para esta visita */ }
}

function leerSesion(clave) {
  try { return sessionStorage.getItem(clave); } catch { return null; }
}

function guardarSesion(clave, valor) {
  try { sessionStorage.setItem(clave, valor); } catch { /* sin almacenamiento: solo para esta página */ }
}

const hayVoz = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
export const vozActiva = () => hayVoz() && leerPreferencia(CLAVE_VOZ) === 'activa';
function vistaPreferida() {
  const vista = leerPreferencia(CLAVE_VISTA);
  if (['abierto', 'minimizado', 'oculto'].includes(vista)) return vista;
  return leerPreferencia(CLAVE_OCULTO) === '1' ? 'oculto' : 'minimizado';
}

function guardarVista(vista) {
  guardarPreferencia(CLAVE_VISTA, vista);
  guardarPreferencia(CLAVE_OCULTO, vista === 'oculto' ? '1' : '0');
}

// Voz en español preferida (es-EC, luego cualquier es-*)
function vozEspanol() {
  const voces = window.speechSynthesis.getVoices();
  return voces.find((v) => /^es[-_]EC/i.test(v.lang)) || voces.find((v) => /^es[-_]419/i.test(v.lang)) || voces.find((v) => /^es\b/i.test(v.lang)) || null;
}

function hablar(texto) {
  if (!vozActiva() || !texto) return false;
  const sintesis = window.speechSynthesis;
  sintesis.cancel();
  vozPausada = false;
  const frase = new SpeechSynthesisUtterance(texto);
  const voz = vozEspanol();
  if (voz) frase.voice = voz;
  frase.lang = voz?.lang || 'es-EC';
  frase.rate = 1;
  const terminar = () => {
    reproduciendo = false;
    vozPausada = false;
    cambiarEstado('reposo');
    pintarControles();
  };
  frase.onend = terminar;
  frase.onerror = terminar;
  reproduciendo = true;
  sintesis.speak(frase);
  pintarControles();
  return true;
}

function pintarControles() {
  if (!raiz) return;
  const activa = vozActiva();
  const boton = raiz.querySelector('.avatar-guia__voz');
  boton.hidden = !hayVoz();
  boton.textContent = activa ? '🔇 Silenciar voz' : '🔊 Activar voz';
  boton.setAttribute('aria-pressed', String(activa));
  const pausa = raiz.querySelector('.avatar-guia__pausa');
  pausa.hidden = !hayVoz();
  pausa.disabled = !activa || (!reproduciendo && !vozPausada);
  pausa.textContent = vozPausada ? '▶ Reanudar voz' : '⏸ Pausar voz';
  pausa.setAttribute('aria-pressed', String(vozPausada));
  const vista = vistaPreferida();
  const abierto = vista === 'abierto';
  raiz.dataset.vista = vista;
  raiz.classList.toggle('avatar-guia--abierto', abierto);
  raiz.classList.toggle('avatar-guia--minimizado', vista === 'minimizado');
  raiz.classList.toggle('avatar-guia--oculto', vista === 'oculto');
  raiz.querySelector('.avatar-guia__cuerpo-ui').hidden = !abierto;
  raiz.querySelector('.avatar-guia__minimizado').hidden = vista !== 'minimizado';
  raiz.querySelector('.avatar-guia__mostrar').hidden = vista !== 'oculto';
  raiz.querySelector('.avatar-guia__minimizado').setAttribute('aria-expanded', String(abierto));
  raiz.querySelector('.avatar-guia__mostrar').setAttribute('aria-expanded', String(abierto));
  document.body.classList.toggle('avatar-guia-abierta', abierto);
}

function mostrarGlobo(texto) {
  const globo = raiz.querySelector('.avatar-guia__globo');
  raiz.querySelector('.avatar-guia__texto').textContent = texto;
  globo.hidden = false;
}

/**
 * Crea el avatar (una sola vez) en la esquina inferior derecha.
 * personaje: "lumi" (por defecto) o "neuri" (NeuroRitmo).
 */
export function montarAvatar({ personaje = 'lumi' } = {}) {
  if (raiz || typeof document === 'undefined') return raiz;
  const { nombre, svg } = PERSONAJES[personaje] || PERSONAJES.lumi;
  ultimoTexto = leerSesion(CLAVE_TEXTO) || `${nombre} está disponible para acompañarte. Abre el panel cuando necesites la transcripción o los controles de voz.`;
  raiz = document.createElement('aside');
  raiz.className = 'avatar-guia avatar-guia--reposo';
  raiz.setAttribute('aria-label', `${nombre}, tu guía`);
  raiz.innerHTML = `
    <div class="avatar-guia__cuerpo-ui">
      <div id="avatar-guia-panel" class="avatar-guia__panel" role="region" aria-label="Panel de ${nombre}">
        <div class="avatar-guia__cabecera">
          <button type="button" class="avatar-guia__personaje" aria-label="${nombre}: repetir las instrucciones">${svg}</button>
          <p class="avatar-guia__nombre">${nombre}</p>
          <button type="button" class="avatar-guia__boton avatar-guia__minimizar" aria-label="Minimizar el panel de ${nombre}">— <span>Minimizar</span></button>
          <button type="button" class="avatar-guia__boton avatar-guia__ocultar" aria-label="Ocultar a ${nombre}">Ocultar</button>
        </div>
        <div class="avatar-guia__globo" role="status" aria-live="polite" aria-atomic="true">
          <p class="avatar-guia__etiqueta">Transcripción de ${nombre}</p>
          <p class="avatar-guia__texto"></p>
        </div>
        <div class="avatar-guia__controles" aria-label="Controles de voz">
          <button type="button" class="avatar-guia__boton avatar-guia__voz" aria-pressed="false"></button>
          <button type="button" class="avatar-guia__boton avatar-guia__pausa" aria-pressed="false">⏸ Pausar voz</button>
          <button type="button" class="avatar-guia__boton avatar-guia__repetir">↻ Repetir mensaje</button>
        </div>
      </div>
    </div>
    <button type="button" class="avatar-guia__boton avatar-guia__minimizado" aria-controls="avatar-guia-panel" aria-expanded="false" aria-label="Abrir el panel de ${nombre}">🧠 Abrir ${nombre}</button>
    <button type="button" class="avatar-guia__boton avatar-guia__mostrar" aria-controls="avatar-guia-panel" aria-expanded="false" hidden>🧠 Mostrar ${nombre}</button>`;
  document.body.append(raiz);
  document.body.classList.add('con-avatar-guia');
  raiz.querySelector('.avatar-guia__texto').textContent = ultimoTexto;

  raiz.querySelector('.avatar-guia__voz').addEventListener('click', () => {
    const activar = !vozActiva();
    guardarPreferencia(CLAVE_VOZ, activar ? 'activa' : 'silencio');
    if (!activar) {
      window.speechSynthesis.cancel();
      reproduciendo = false;
      vozPausada = false;
      cambiarEstado('reposo');
    }
    pintarControles();
    if (activar && ultimoTexto) decir(ultimoTexto);
  });
  raiz.querySelector('.avatar-guia__pausa').addEventListener('click', () => {
    if (!hayVoz() || !vozActiva()) return;
    if (vozPausada) {
      window.speechSynthesis.resume();
      vozPausada = false;
      reproduciendo = true;
      cambiarEstado('hablando');
    } else if (reproduciendo || window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      vozPausada = true;
      reproduciendo = false;
      cambiarEstado('reposo');
    }
    pintarControles();
  });
  raiz.querySelector('.avatar-guia__repetir').addEventListener('click', () => { if (ultimoTexto) decir(ultimoTexto); });
  raiz.querySelector('.avatar-guia__minimizar').addEventListener('click', () => {
    guardarVista('minimizado');
    pintarControles();
    raiz.querySelector('.avatar-guia__minimizado').focus();
  });
  raiz.querySelector('.avatar-guia__minimizado').addEventListener('click', () => {
    guardarVista('abierto');
    pintarControles();
    raiz.querySelector('.avatar-guia__minimizar').focus();
  });
  raiz.querySelector('.avatar-guia__ocultar').addEventListener('click', () => {
    guardarVista('oculto');
    if (hayVoz()) window.speechSynthesis.cancel();
    reproduciendo = false;
    vozPausada = false;
    pintarControles();
    raiz.querySelector('.avatar-guia__mostrar').focus();
  });
  raiz.querySelector('.avatar-guia__mostrar').addEventListener('click', () => {
    guardarVista('abierto');
    pintarControles();
    raiz.querySelector('.avatar-guia__minimizar').focus();
  });
  raiz.querySelector('.avatar-guia__personaje').addEventListener('click', () => { if (ultimoTexto) decir(ultimoTexto); });
  raiz.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape' || vistaPreferida() !== 'abierto') return;
    evento.stopPropagation();
    guardarVista('minimizado');
    pintarControles();
    raiz.querySelector('.avatar-guia__minimizado').focus();
  });
  if (hayVoz()) window.speechSynthesis.getVoices();   // pide la lista de voces con anticipación
  pintarControles();
  return raiz;
}

export function abrirAvatar() {
  if (!raiz) montarAvatar({ personaje: 'neuri' });
  guardarVista('abierto');
  pintarControles();
  raiz.querySelector('.avatar-guia__minimizar')?.focus();
  return raiz;
}

/**
 * Cambia el estado del avatar: reposo | hablando | pensando | celebrando.
 */
export function cambiarEstado(estado) {
  if (!raiz || !ESTADOS.includes(estado)) return;
  clearTimeout(temporizadorEstado);
  ESTADOS.forEach((e) => raiz.classList.toggle(`avatar-guia--${e}`, e === estado));
  raiz.dataset.estado = estado;
}

/**
 * Muestra el texto en el globo y, si la voz está activa, lo lee en español.
 * opciones.soloVoz mantiene el comportamiento heredado de otros módulos sin transcripción.
 */
export function decir(texto, { soloVoz = false } = {}) {
  if (!raiz) montarAvatar();
  texto = String(texto || '').trim();
  if (!texto) return;
  if (!soloVoz) {
    ultimoTexto = texto;
    guardarSesion(CLAVE_TEXTO, texto);
  }
  if (vistaPreferida() === 'oculto') return;
  if (!soloVoz) mostrarGlobo(texto);
  cambiarEstado('hablando');
  // Sin voz, "hablando" dura según el largo del texto
  if (!hablar(texto)) temporizadorEstado = setTimeout(() => cambiarEstado('reposo'), Math.min(6000, 1500 + texto.length * 35));
}

export default { montarAvatar, abrirAvatar, decir, cambiarEstado, vozActiva, figuraNeuri };
