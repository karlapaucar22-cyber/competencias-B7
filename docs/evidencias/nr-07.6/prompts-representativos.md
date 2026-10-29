# Prompts representativos y procedencia

## A. Prompts de desarrollo recibidos

Los siguientes extractos provienen de solicitudes reales del equipo en esta conversación. No existe una captura histórica adjunta; por eso sirven como transcripción verificable para el anexo, pero **no** cuentan como las tres capturas de vibecoding pendientes.

### A1 · Contenidos y recursos (NR-02.6)

> “Crea o adapta ‘Explora y aprende’ dentro de la navegación NeuroRitmo, mostrando presentación académica, unidad, tema, subtemas, objetivos y tarjetas de recursos existentes.”

Decisión observable: tarjetas con utilidad, enlace verificable o estado “Recurso pendiente de publicación”.

### A2 · Simulación con cautela científica (NR-03.2)

> “Crea tres casos: (1) lectura comprensiva de artículo, (2) ordenar referencias como tarea mecánica y (3) repaso para evaluación con estrés alto.”

Decisión observable: hipótesis, condición sonora, volumen, comparación y aviso de que el simulador no predice resultados individuales.

### A3 · Accesibilidad multimedia (NR-06.3)

> “Audio silenciado por defecto, opción visible de activarlo, transcripción y control para pausarlo.”

Decisión observable: Neuri funcional, controles de voz y transcripción persistente.

### A4 · Evidencia sin invención (NR-07.6)

> “No inventes capturas ni ejecuciones.”

Decisión observable: publicación y vibecoding permanecen pendientes; las cinco capturas nuevas se identifican como ejecución local.

## B. Prompts de IA existentes en el producto

### B1 · Tutor Neuri

Fuente completa: `servidor/prompts/neuri.txt`.

> “Nunca reveles la opción correcta, la palabra faltante ni la puntuación; no califiques ni digas si algo está aprobado: eso lo decide el docente.”

El prompt también exige usar solo la base docente, resistir instrucciones incluidas en textos del estudiante y terminar con una pregunta que invite a pensar.

### B2 · Revisión de borrador de M3

Fuente completa: `servidor/prompts/neuri-borrador.txt`.

> “Devuelve exactamente UNA fortaleza y DOS aspectos de mejora.”

La salida se restringe a JSON, no asigna notas y prioriza objetivo, viabilidad, diversidad y comprobación según la lista de cotejo.

## Uso seguro en el informe

- Mostrar extractos breves; remitir al archivo para el texto completo.
- No capturar `.env`, claves, tokens, contraseñas ni datos personales.
- Diferenciar el prompt de desarrollo, el prompt del producto y la respuesta generada.
- Si se incluye una respuesta de IA, registrar fecha, tarea, revisión humana y limitaciones; no presentarla como fuente académica.

