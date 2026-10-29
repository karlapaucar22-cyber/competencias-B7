// publico/js/nucleo/menu.js
// Configuración centralizada del menú de navegación de NeuroRitmo Digital
// Cada opción: { texto, href, roles, icono (decorativo), grupo (sección del menú lateral) }
// El Inicio (/index.html) es la experiencia NeuroRitmo; /paginas/neuroritmo.html redirige a él.
// Las opciones con #sección (#mapa, #resultados, #panel) abren esa vista del Inicio; plantilla.js las marca
// como activas según el hash. Los permisos reales los aplica el servidor y montarPlantilla({ roles }).

export const GRUPOS_MENU = ["Ruta de aprendizaje", "Más para aprender", "Comunidad", "Mi cuenta", "Docencia", "Administración"];

export const MENU = [
  // Ruta obligatoria del estudiante (en este orden)
  { texto: "Inicio", href: "/index.html", roles: ["publico"], icono: "🧠", grupo: "Ruta de aprendizaje" },
  { texto: "Explora y aprende", href: "/paginas/explorar.html", roles: ["sesion"], icono: "🔎", grupo: "Ruta de aprendizaje" },
  { texto: "Mapa de misiones", href: "/index.html#mapa", roles: ["sesion"], icono: "🗺️", grupo: "Ruta de aprendizaje" },
  { texto: "Actividades", href: "/paginas/actividades.html", roles: ["estudiante", "docente"], icono: "🎮", grupo: "Ruta de aprendizaje" },
  { texto: "Canciones", href: "/paginas/canciones.html", roles: ["sesion"], icono: "🎵", grupo: "Ruta de aprendizaje" },
  { texto: "Pregúntale a Neuri", href: "/paginas/tutor.html", roles: ["estudiante"], icono: "💡", grupo: "Ruta de aprendizaje" },
  { texto: "Mi progreso", href: "/paginas/mi-progreso.html", roles: ["estudiante"], icono: "📈", grupo: "Ruta de aprendizaje" },
  { texto: "Certificado", href: "/index.html#resultados", roles: ["estudiante"], icono: "🏅", grupo: "Ruta de aprendizaje" },
  // Complementos fuera de la ruta obligatoria
  { texto: "Mis asignaturas", href: "/paginas/asignaturas.html", roles: ["estudiante", "docente"], icono: "📚", grupo: "Más para aprender" },
  { texto: "Simulaciones", href: "/paginas/simulaciones.html", roles: ["sesion"], icono: "🎭", grupo: "Más para aprender" },
  { texto: "Noticias", href: "/paginas/noticias.html", roles: ["sesion"], icono: "📰", grupo: "Comunidad" },
  { texto: "Foros", href: "/paginas/foros.html", roles: ["sesion"], icono: "💬", grupo: "Comunidad" },
  { texto: "Participantes", href: "/paginas/participantes.html", roles: ["estudiante"], icono: "👥", grupo: "Comunidad" },
  { texto: "Agenda", href: "/paginas/agenda.html", roles: ["sesion"], icono: "📅", grupo: "Comunidad" },
  { texto: "Mensajes", href: "/paginas/mensajes.html", roles: ["sesion"], icono: "✉️", grupo: "Comunidad" },
  { texto: "Mi perfil", href: "/paginas/perfil.html", roles: ["sesion"], icono: "👤", grupo: "Mi cuenta" },
  { texto: "Verificar certificado", href: "/paginas/verificar.html", roles: ["publico"], icono: "✅", grupo: "Mi cuenta" },
  { texto: "Privacidad", href: "/paginas/privacidad.html", roles: ["publico"], icono: "🔒", grupo: "Mi cuenta" },
  // Docencia (docente y admin; el servidor vuelve a comprobar cada permiso)
  { texto: "Editor de contenidos", href: "/paginas/editor-contenidos.html", roles: ["docente", "admin"], icono: "✏️", grupo: "Docencia" },
  { texto: "Banco de preguntas", href: "/paginas/banco-preguntas.html", roles: ["docente", "admin"], icono: "❓", grupo: "Docencia" },
  { texto: "Seguimiento", href: "/paginas/panel-docente.html", roles: ["docente", "admin"], icono: "📊", grupo: "Docencia" },
  { texto: "Validación de Misión 3", href: "/index.html#panel", roles: ["docente", "admin"], icono: "🎼", grupo: "Docencia" },
  { texto: "Asignaturas", href: "/paginas/admin-asignaturas.html", roles: ["admin"], icono: "🏫", grupo: "Administración" },
  { texto: "Distributivo", href: "/paginas/distributivo.html", roles: ["admin"], icono: "🗂️", grupo: "Administración" },
  { texto: "Usuarios", href: "/paginas/admin-usuarios.html", roles: ["admin"], icono: "👥", grupo: "Administración" },
  { texto: "Inteligencia artificial", href: "/paginas/admin-ia.html", roles: ["admin"], icono: "🤖", grupo: "Administración" },
  { texto: "Reportes", href: "/paginas/admin-reportes.html", roles: ["admin"], icono: "🚩", grupo: "Administración" },
  { texto: "Guía de estilos", href: "/paginas/guia-estilos.html", roles: ["admin"], icono: "🎨", grupo: "Administración" }
];
