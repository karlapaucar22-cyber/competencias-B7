// servidor/ganchos/certificados.js
// Cada usuario lista solo sus certificados; el admin ve todos

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;
  return lista.filter((c) => c.usuarioId === usuario.id);
}

export default { filtrarLista };
