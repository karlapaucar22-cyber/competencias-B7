# Índice de evidencias · Informe final Tarea 4

Fecha de organización: 27 de octubre de 2026. Este índice separa ejecución, documentos entregados y pendientes. Ninguna imagen se presenta como publicación pública.

## Evidencia de ejecución local

| Código | Archivo | Categoría | Qué demuestra | Límite de interpretación |
|---|---|---|---|---|
| E01 | `01-ecosistema-inicio-local.png` | Ecosistema | Inicio, identidad NeuroRitmo, Neuri, objetivo y menú con sesión estudiante | Entorno local; no demuestra publicación |
| E02 | `02-multimedia-recursos-local.png` | Multimedia/recursos | Dos tarjetas disponibles y matriz rotulada como pendiente sin enlace ficticio | Los enlaces externos se verificaron en NR-07.1; la captura no acredita licencias |
| E03 | `03-mision-1-local.png` | Misión funcional | M1 abierta, intento, instrucciones, casos, transcripción y audio apagado | Muestra la actividad iniciada, no una finalización nueva |
| E04 | `04-ia-tutor-local.png` | IA | Tutor socrático, preguntas guía y aviso de contraste con material | No se invocó al proveedor para fabricar una respuesta para el informe |
| E05 | `05-movil-mapa-local-360px.png` | Móvil | Mapa a 360 × 800, sesión, progreso y controles de Neuri | Emulación de Chrome; falta dispositivo físico |

Procedencia: capturas generadas con `pruebas/capturar-nr-07.6.mjs`, servidor local y `estudiante6@demo.ec`. El script restauró `sesiones.json` y `bitacora.jsonl` al finalizar.

## Evidencia documental entregada

| Código | Archivo | Uso correcto en anexos |
|---|---|---|
| E06 | `Tareas/TAREA 3-Grupal/Flujo de NeuroRitmo_ Misión Cerebro Sonoro.png` | Diseño del flujo general |
| E07 | `Tareas/TAREA 3-Grupal/Flujo del Estudiante_ NeuroRitmo.png` | Diseño del recorrido estudiantil |
| E08 | `Tareas/TAREA 3-Grupal/Guía visual de NeuroRitmo_ Misión Cerebro Sonoro.png` | Guía visual entregada |
| E09 | `Tareas/TAREA 3-Grupal/Ruta gamificada del aprendizaje estudiantil.png` | Diseño de la ruta gamificada |
| E10 | `publico/recursos/subidas/neuroritmo-mision-cerebro-sonoro.png` | Storyboard disponible en el proyecto |

Estas imágenes son antecedentes o maquetas; no deben rotularse como capturas del sistema ejecutándose.

## Prompts y pruebas reproducibles

- E11: `prompts-representativos.md` registra prompts de desarrollo recibidos y prompts de IA existentes, con procedencia.
- E12: `servidor/prompts/neuri.txt` y `servidor/prompts/neuri-borrador.txt` son los prompts reales de apoyo en misiones.
- E13: `pruebas/nr-07.1-recorrido.mjs` reproduce el recorrido integral documentado.
- E14: `pruebas/capturar-nr-07.6.mjs` reproduce las cinco capturas locales.
- E15: salida comprobada de `npm test` el 27 de octubre de 2026: 236 pruebas; 234 pasan, 0 fallan y 2 se omiten.

## Evidencias que no existen todavía

| Requisito | Estado | Qué debe entregar o ejecutar el equipo |
|---|---|---|
| Tres capturas de vibecoding | **PENDIENTE** | Tres capturas auténticas de sesiones de desarrollo que muestren prompt, respuesta/cambio y contexto visible. Ocultar claves, tokens, correos y rutas personales. No usar las láminas de Tarea 3 como sustituto. |
| Publicación | **PENDIENTE** | Captura de la URL HTTPS real abierta en incógnito y otra desde teléfono/datos móviles, después del humo de `docs/despliegue.md`. |
| IA en ejecución para el informe | **PENDIENTE DE DECISIÓN** | Si se exige, realizar una consulta controlada y conservar pregunta, salida y revisión docente. E04 solo acredita la interfaz. |
| Canción de M2 | **PENDIENTE** | Audio, letra/transcripción, autoría, licencia o permiso verificable. |
| Prueba móvil física | **PENDIENTE** | Android o iOS real, navegación y controles de audio; registrar dispositivo, navegador y fecha. |

## Orden recomendado de anexos

1. Tres capturas auténticas de vibecoding, cuando existan.
2. Prompts representativos (E11–E12).
3. Ecosistema en ejecución (E01) y láminas de diseño (E06–E10).
4. Misión funcional (E03) e IA (E04).
5. Multimedia (E02) y móvil (E05).
6. Matriz de pruebas y salida resumida (E13–E15).
7. Publicación real, únicamente después del despliegue; mientras tanto, incluir la tabla “PENDIENTE” anterior.

