# Design System · NeuroRitmo: Misión Cerebro Sonoro

**Documento de referencia para Antigravity**  
**Fuente visual:** Tarea 3-Grupal.pdf, especialmente Figura 3 (storyboard, página 17) y Figura 4 (recorrido integrado, página 18).  
**Importante:** los HEX son **aproximaciones visuales** de los diagramas, no valores oficiales definidos por el equipo. No se pretende reproducir el diseño pixel por pixel.

## 1. Propósito

Actualizar la apariencia del **Ecosistema Educativo Digital ya existente**, incorporando la identidad visual de NeuroRitmo sin recrear la aplicación, modificar rutas ni perder módulos funcionales. El prototipo HTML adjunto ilustra paleta, componentes, mapa de misiones, estados, puntuación, retroalimentación y ocho pantallas.

## 2. Paleta de referencia

| Token CSS | HEX estimado | Uso |
|---|---|---|
| `--nr-navy` | `#0B3850` | Títulos, texto destacado y encabezados |
| `--nr-blue` | `#126B82` | Encabezados secundarios |
| `--nr-teal` | `#12A6A5` | Interacción y Misión 2 |
| `--nr-teal-dark` | `#087D83` | Botones primarios con texto blanco |
| `--nr-green` | `#41AA79` | Misión 3, progreso y estado positivo |
| `--nr-mint` | `#DFF5E8` | Tarjetas de éxito, insignias y pistas |
| `--nr-yellow` | `#FFBA24` | Puntos, estrellas, premios y certificados |
| `--nr-coral` | `#F57A71` | Reintentos y acciones que requieren atención |
| `--nr-sky` | `#EAF8FD` | Fondos de instrucciones y retroalimentación |
| `--nr-lilac` | `#EAE6F6` | Panel docente / seguimiento |
| `--nr-bg` | `#F6FBFD` | Fondo de página |
| `--nr-white` | `#FFFFFF` | Superficies |
| `--nr-text` | `#143E51` | Texto principal |
| `--nr-muted` | `#527280` | Texto auxiliar |
| `--nr-border` | `#BFE9ED` | Bordes de tarjetas y divisores |

**Accesibilidad:** los colores decorativos no sustituyen pruebas de contraste WCAG AA. Para botones turquesa con letras blancas, preferir `--nr-teal-dark`; el coral con texto oscuro. No utilizar colores como único indicador de correcto/incorrecto.

## 3. Tipografía y estilo

- Fuente: `system-ui, -apple-system, 'Segoe UI', sans-serif`, por compatibilidad y carga rápida.
- Encabezados: negrita, azul petróleo. Cuerpo: azul oscuro sobre blanco o fondos claros.
- Esquinas de tarjetas: `18px`; botones tipo píldora; sombras suaves.
- Tarjetas con borde celeste tenue, espacios generosos y pequeñas ilustraciones educativas.
- Interfaz accesible y responsive, desde 360 px.

## 4. Componentes clave

1. **Bienvenida:** nombre NeuroRitmo y Neuri (cerebro con audífonos) junto al botón «Comenzar».
2. **Instrucciones:** tarjetas con reglas, pista, justificación y puntuación.
3. **Mapa:** tres estaciones con colores coordinados y progreso por misión.
4. **Actividades:** formularios y controles claros, predicción y justificación visibles.
5. **Retroalimentación:** tarjetas verdes para aciertos y coral suave para revisar.
6. **Progreso:** barras turquesa-verdes, puntos y estrellas amarillas.
7. **Resultado:** puntuación por misión, insignias y certificado condicionado.
8. **Reiniciar/cancelar:** acciones diferenciadas, con confirmación cuando corresponda.

## 5. Flujo educativo que guía la apariencia

Inicio → Instrucciones Neuri → Mapa de misiones → Misión 1 «Detectives de la atención» → Retroalimentación → Misión 2 «Laboratorio de la memoria» → Retroalimentación → Misión 3 «Crea tu misión musical» → Retroalimentación y revisión docente → Resultado final.

**Puntuación definida en Tarea 3:** 100 puntos por misión, al menos 70/100 por misión para avanzar; certificado desde 240/300 y aprobación docente de Misión 3.

## 6. Integración con la guía de vibecoding

La guía original define `publico/css/tokens.css`, `publico/css/base.css`, `publico/css/componentes.css` y módulos CSS específicos, además de `AGENTS.md`, `docs/contratos.md` y `docs/estado.md`.

**No sustituir directamente todos esos archivos por el HTML demostrativo.** Implementar los tokens en `tokens.css`, ajustar componentes globales solo cuando sea necesario y conservar nombres de clases y contratos actuales. Evitar cambios en API, lógica del servidor, puntos e información de usuarios al hacer cambios puramente visuales.

## 7. Prompt breve para Antigravity

> Usa los archivos adjuntos `design-system-neuroritmo.html` y `design-system-neuroritmo.md` como guía de diseño visual para mi proyecto **ya implementado**. Toma como referencia primaria el storyboard y los gráficos de las páginas 17 y 18 de `Tarea 3-Grupal.pdf`. Revisa `AGENTS.md`, `docs/contratos.md` y las hojas CSS actuales; adapta gradualmente `publico/css/tokens.css`, estilos globales y estilos de los módulos NeuroRitmo a la paleta propuesta. Conserva las páginas, rutas, funciones, base de datos JSON, permisos, gamificación y actividades existentes. No reemplaces el dibujo original de Neuri con un emoji si su imagen ya existe. Antes de editar, enumera los archivos CSS que cambiarás y comprueba que la paleta propuesta respeta el contraste. Después de aplicar los cambios, verifica en móvil y escritorio y resume solo archivos cambiados y pruebas realizadas.

## 8. Alcance del HTML entregado

`design-system-neuroritmo.html` es una guía visual autocontenida, con botones de demostración; **no** sustituye las actividades funcionales, la integración de IA ni los controles de evaluación de la plataforma real.
