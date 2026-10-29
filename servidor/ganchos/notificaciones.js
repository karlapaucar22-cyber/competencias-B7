// servidor/ganchos/notificaciones.js
// Cada usuario lista solo sus notificaciones (la ruta propia ya lo hace; esto protege la API genérica)

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  return lista.filter((n) => n.usuarioId === usuario.id);
}

export default { filtrarLista };
