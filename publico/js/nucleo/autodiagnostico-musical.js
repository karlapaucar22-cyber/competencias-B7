// Preguntas y resumen compartidos por la interfaz y el servidor.

export const ESCALA_AUTODIAGNOSTICO = [
  { valor: 1, texto: 'Nunca o muy poco' },
  { valor: 2, texto: 'Ocasionalmente' },
  { valor: 3, texto: 'Frecuentemente' },
  { valor: 4, texto: 'Sistemáticamente' }
];

export const PREGUNTAS_AUTODIAGNOSTICO = [
  { id: 'habito-1', dimension: 'habitos', texto: 'Elijo la condición sonora según la tarea que voy a realizar, en vez de usar siempre la misma.' },
  { id: 'habito-2', dimension: 'habitos', texto: 'Comparo al menos dos condiciones, por ejemplo silencio y la canción principal, antes de decidir cuál conservar.' },
  { id: 'atencion-1', dimension: 'atencion', texto: 'Registro interrupciones, relecturas o momentos en que pierdo el hilo mientras estudio.' },
  { id: 'atencion-2', dimension: 'atencion', texto: 'Pauso el audio cuando noto que compite con una tarea verbal o con una parte especialmente compleja.' },
  { id: 'memoria-1', dimension: 'memoria', texto: 'Compruebo lo aprendido explicando ideas o resolviendo un ejercicio sin mirar el material.' },
  { id: 'memoria-2', dimension: 'memoria', texto: 'Si una melodía me ayuda a recordar el orden, verifico aparte que comprendo cada concepto.' },
  { id: 'autorregulacion-1', dimension: 'autorregulacion', texto: 'Observo mi concentración o activación antes y después de la condición sonora elegida.' },
  { id: 'autorregulacion-2', dimension: 'autorregulacion', texto: 'Cambio a una pausa o a silencio cuando la condición sonora no favorece mi objetivo en ese momento.' }
];

export const NOMBRES_DIMENSION = {
  habitos: 'Hábitos musicales de estudio',
  atencion: 'Atención y control inhibitorio',
  memoria: 'Memoria y comprobación',
  autorregulacion: 'Autorregulación'
};

const redondear = (numero) => Math.round(numero * 100) / 100;

export function resumirAutodiagnostico(respuestas = {}) {
  const dimensiones = {};
  for (const clave of Object.keys(NOMBRES_DIMENSION)) {
    const preguntas = PREGUNTAS_AUTODIAGNOSTICO.filter((p) => p.dimension === clave);
    const valores = preguntas.map((p) => Number(respuestas[p.id]));
    if (valores.some((v) => !Number.isInteger(v) || v < 1 || v > 4)) return null;
    dimensiones[clave] = redondear(valores.reduce((suma, valor) => suma + valor, 0) / valores.length);
  }
  const promedioGeneral = redondear(Object.values(dimensiones).reduce((suma, valor) => suma + valor, 0) / Object.keys(dimensiones).length);
  const nivel = promedioGeneral < 1.75 ? 'inicial' : promedioGeneral < 2.5 ? 'ocasional' : promedioGeneral < 3.25 ? 'frecuente' : 'sistematico';
  const mensajes = {
    inicial: 'Empieza con una comparación breve entre dos condiciones y registra un solo indicador observable.',
    ocasional: 'Ya realizas algunas comprobaciones. Intenta repetirlas en tareas comparables antes de adoptar una preferencia.',
    frecuente: 'Tu autoobservación es frecuente. Conserva registros breves y revisa si el resultado cambia según la tarea o el momento.',
    sistematico: 'Tu autoobservación es sistemática. Sigue contrastando tus decisiones y evita convertir una experiencia personal en una regla general.'
  };
  return { promedioGeneral, dimensiones, nivel, mensaje: mensajes[nivel] };
}
