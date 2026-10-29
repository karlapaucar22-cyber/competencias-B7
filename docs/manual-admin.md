# Manual de administración · Ecosistema Educativo Digital

La administración prepara la plataforma (asignaturas, grupos y roles), cuida la convivencia (reportes) y revisa el
servicio de inteligencia artificial. Además, puede usar todo lo que tienen los docentes en cualquier asignatura.

## Cómo obtener la primera cuenta de administración
1. El equipo técnico la crea en el servidor con `npm run crear-admin` (ver docs/despliegue.md).
2. Ingresa con ese correo y contraseña en **Inicio → Iniciar Sesión**.
3. Cambia la contraseña en **Mi perfil → Actualizar Contraseña** si te la entregaron otras personas.

## Cómo dar acceso a docentes y gestionar cuentas
Las personas se registran solas en **Registrarse** y quedan como estudiantes. Desde **Usuarios**:
1. Busca a la persona por nombre o correo (o filtra por rol).
2. Para un docente, cambia su rol a **Docente** en la lista desplegable (o **Admin** para otra persona de
   administración). El cambio se guarda al momento.
3. Para impedir el ingreso, desmarca la casilla **activo**: su sesión deja de funcionar enseguida.
4. Si alguien olvidó su clave, pulsa **Restablecer clave** y comunícale la **clave temporal** que aparece.

## Cómo crear asignaturas
1. Abre **Asignaturas** y pulsa **+ Nueva Asignatura**.
2. Escribe el nombre, la descripción y el nivel; guarda.
3. Usa **Editar** para corregirla. **Eliminar** solo funciona si la asignatura no tiene grupos.

## Cómo armar los grupos (distributivo)
1. Abre **Distributivo** y pulsa **+ Nuevo Grupo**.
2. Elige la asignatura, el paralelo, el período y el docente.
3. Busca y marca a los estudiantes (o usa **Marcar todos**); guarda.
4. Desde ese momento el docente puede editar la asignatura y los estudiantes la ven en **Mis asignaturas**.

## Cómo atender los reportes
1. Abre **Reportes**: aparecen los mensajes y publicaciones del foro reportados, con su contenido y quién reportó.
2. Para un **foro**: pulsa **Ocultar contenido** (desaparece para los estudiantes) o **Descartar** si no hay
   problema.
3. Para un **mensaje**: revisa el contexto (el mensaje y los 5 anteriores). Pulsa **Ocultar mensaje**, **Descartar** o,
   si es grave, **Desactivar usuario** (pide confirmación; después decide si ocultas o descartas).

## Cómo revisar la inteligencia artificial
1. Abre **Inteligencia artificial**: verás el proveedor, el modelo y la clave enmascarada.
2. Pulsa **Probar conexión**; debe responder "OK".
3. Con **Ver modelos de mi clave** compruebas qué modelos están disponibles. La clave y el modelo se cambian en el
   archivo `.env` del servidor (equipo técnico), nunca desde la página.

## Cómo comprobar un certificado
1. Abre **Verificar certificado** (también funciona sin iniciar sesión).
2. Escribe el código impreso en el PDF y consulta: si es auténtico verás el nombre de la persona, el detalle del
   certificado y la fecha de emisión.

## Preguntas frecuentes
1. **¿Cómo creo una cuenta de docente?** La persona se registra y tú le cambias el rol a **Docente** en
   **Usuarios**; luego la asignas a un grupo en el **Distributivo**.
2. **Un docente no puede editar su asignatura.** Revisa que figure como docente de un grupo de esa asignatura en el
   Distributivo.
3. **No puedo eliminar una asignatura.** Tiene grupos: elimínalos o reasígnalos primero en el Distributivo.
4. **La IA no responde o dice "no está configurada".** Pulsa **Probar conexión** y pide al equipo técnico revisar
   `GEMINI_API_KEY` e `IA_MODELO` en `.env`.
5. **¿Dónde cambio el tamaño máximo de subida, los límites diarios de IA o el chat entre estudiantes?** En
   `datos/config/ajustes.json` del servidor (`maxSubidaMB`, `limiteIADiario`, `limiteTutorDiario`,
   `chatEntreEstudiantes`). Lo hace el equipo técnico; si sube `maxSubidaMB`, también debe ajustar Nginx.
