// servidor/preparadores/neuri-borrador.js
// «Revisa mi borrador» (Misión 3): una fortaleza y dos aspectos de mejora sobre objetivo, viabilidad,
// diversidad individual y comprobación del aprendizaje. Al modelo solo llegan el contenido de la
// microactividad (saneado) y los criterios del docente: sin nombre, correo ni otros datos personales.

import * as almacen from '../almacen.js';
import { leerExperiencia, misionDe, PARTIDAS, exigirDesbloqueada, limpiarDiseno } from '../rutas/neuroritmo.js';
import { revisarDiseno, minutosSecuencia } from '../../publico/js/nucleo/neuroritmo.js';
import { exigirPolitica } from './neuri.js';

function rechazar(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  throw err;
}

const CORREO = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const NUMERO_LARGO = /\b\d[\d\s-]{6,}\d\b/g;   // cédulas, teléfonos u otros identificadores
const escaparRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Quita del texto correos, números largos y el nombre o apellido del estudiante.
 * @param {string} texto
 * @param {string[]} nombres partes del nombre del estudiante (3 letras o más)
 */
export function anonimizar(texto, nombres = []) {
  let t = String(texto || '').replace(CORREO, '[correo omitido]').replace(NUMERO_LARGO, '[número omitido]');
  for (const n of nombres.filter((x) => x && x.length >= 3)) t = t.replace(new RegExp(`\\b${escaparRegex(n)}\\b`, 'gi'), '[nombre omitido]');
  return t;
}

/**
 * Arma la entrada del modelo: microactividad saneada, lista de cotejo y criterios del docente.
 * Cualquier campo ajeno al diseño (nombre, correo…) se descarta en limpiarDiseno.
 * @returns {{ borrador: string, cotejo: string, criterios: string }}
 */
export function entradaBorrador(datos, mision, nombres = []) {
  const d = limpiarDiseno(datos, mision);
  const limpio = (v) => anonimizar(v, nombres) || '(vacío)';
  const recurso = mision.recursosSonoros.find((s) => s.id === d.recurso.tipo)?.texto || 'sin definir';
  const condiciones = d.recurso.tipo === 'silencio' ? '' : `; letra: ${d.recurso.letra || '-'}; volumen: ${d.recurso.volumen || '-'}; duración: ${d.recurso.duracion} min`;
  return {
    vacio: !d.objetivo && !d.justificacion,
    borrador: [
      `1. Objetivo: ${limpio(d.objetivo)}`,
      `2. Recurso sonoro o silencio: ${recurso}${condiciones}`,
      `3. Secuencia (${minutosSecuencia(d.secuencia, mision.bloques)} min): ${d.secuencia.map((id) => mision.bloques.find((b) => b.id === id)?.texto).join(' → ') || '(vacía)'}`,
      `   Instrucciones: ${limpio(d.instrucciones)}`,
      `4. Comprobación del aprendizaje: ${limpio(d.comprobacion)}`,
      `   Indicador de autorregulación: ${limpio(d.indicador)}`,
      `Justificación: ${limpio(d.justificacion)}`,
      `Precauciones ante las diferencias individuales: ${limpio(d.diferencias)}`
    ].join('\n'),
    cotejo: revisarDiseno(d, mision.bloques).map((c) => `${c.cumple ? '✔' : '✖'} ${c.texto}`).join('\n'),
    criterios: (mision.rubrica || []).map((c) => `- ${c.criterio}`).join('\n')
  };
}

/**
 * @param {{ borrador: object }} datos
 * @returns {{ mision, caso, base, criterios, cotejo, borrador }}
 */
export default async function preparar(datos, usuario) {
  if (usuario?.rol !== 'estudiante') rechazar('Neuri revisa el borrador de los estudiantes', 403);
  const experiencia = await leerExperiencia();
  const mision = misionDe(experiencia, 'm3');
  await exigirDesbloqueada(usuario.id, mision.id, experiencia);
  const partida = (await almacen.leer(PARTIDAS)).find((p) => p.usuarioId === usuario.id && p.mision === 'm3' && p.estado === 'en-curso');
  if (!partida) rechazar('Abre tu diseño de la Misión 3 para pedir la revisión de Neuri', 409);
  exigirPolitica(experiencia, mision, 'borrador', partida.numero);

  const persona = (await almacen.leer('usuarios')).find((u) => u.id === usuario.id) || {};
  const nombres = `${persona.nombre || ''} ${persona.apellido || ''}`.split(/\s+/);
  const entrada = entradaBorrador(datos?.borrador, mision, nombres);
  if (entrada.vacio) rechazar('Escribe al menos el objetivo o la justificación para que Neuri revise tu borrador', 400);

  // Registro de la solicitud de ayuda (sin textos): conteo de uso y fecha; el resultado queda en consumo-ia
  await almacen.actualizar(PARTIDAS, partida.id, {
    ia: { ...(partida.ia || {}), diseno: (Number(partida.ia?.diseno) || 0) + 1 },
    solicitudes: [...(partida.solicitudes || []), { tipo: 'revisa-borrador', fecha: new Date().toISOString() }]
  });

  return {
    mision: `Misión ${mision.numero}: ${mision.titulo} (nivel ${mision.nivel})`,
    caso: mision.caso || '',
    base: [mision.instrucciones, ...(mision.pistas || [])].join(' '),
    criterios: entrada.criterios,
    cotejo: entrada.cotejo,
    borrador: entrada.borrador
  };
}
