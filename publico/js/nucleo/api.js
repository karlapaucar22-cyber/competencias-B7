// publico/js/nucleo/api.js
// Cliente HTTP para la API de NeuroRitmo Digital

/**
 * Realiza una petición HTTP a cualquier ruta de la API.
 * Gestiona autorización por Bearer token, manejo de errores y redirección ante 401.
 */
export async function llamar(metodo, ruta, cuerpo = null) {
  const cabeceras = {};
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('token') : null;
  if (token) {
    cabeceras['Authorization'] = `Bearer ${token}`;
  }

  const opciones = {
    method: metodo,
    headers: cabeceras
  };

  if (cuerpo !== null && cuerpo !== undefined) {
    if (typeof FormData !== 'undefined' && cuerpo instanceof FormData) {
      opciones.body = cuerpo;
    } else {
      cabeceras['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }
  }

  const respuesta = await fetch(ruta, opciones);

  if (respuesta.status === 401) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('usuario');
    }
    if (typeof window !== 'undefined' && window.location) {
      const rutaActual = window.location.pathname || '';
      if (!rutaActual.endsWith('ingreso.html') && !rutaActual.endsWith('registro.html')) {
        window.location.href = '/paginas/ingreso.html';
      }
    }
    let datosError = null;
    try {
      datosError = await respuesta.json();
    } catch {
      // Ignorar si no es JSON válido
    }
    const mensaje = (datosError && datosError.error) || 'Sesión expirada o no autorizada';
    throw new Error(mensaje);
  }

  let datos = null;
  const tipoContenido = respuesta.headers.get('content-type');
  if (tipoContenido && tipoContenido.includes('application/json')) {
    try {
      datos = await respuesta.json();
    } catch {
      datos = null;
    }
  } else if (respuesta.status !== 204) {
    const texto = await respuesta.text().catch(() => '');
    if (texto) {
      try {
        datos = JSON.parse(texto);
      } catch {
        datos = { respuesta: texto };
      }
    }
  }

  // El error lleva el código HTTP en "estado" (p. ej., 429 para límites diarios)
  if (datos && typeof datos === 'object' && 'error' in datos) {
    throw Object.assign(new Error(datos.error), { estado: respuesta.status });
  }

  if (!respuesta.ok) {
    throw Object.assign(new Error(`Error ${respuesta.status}: ${respuesta.statusText}`), { estado: respuesta.status });
  }

  return datos;
}

/**
 * Obtiene la lista de registros de una colección aplicando filtros por consulta.
 */
export async function listar(col, filtros = {}) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null) {
      params.append(clave, valor);
    }
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  return await llamar('GET', `/api/${col}${query}`);
}

/**
 * Obtiene un único registro por su ID.
 */
export async function obtener(col, id) {
  return await llamar('GET', `/api/${col}/${id}`);
}

/**
 * Crea un nuevo registro en la colección especificada.
 */
export async function crear(col, datos) {
  return await llamar('POST', `/api/${col}`, datos);
}

/**
 * Actualiza parcialmente un registro existente (fusiona campos).
 */
export async function actualizar(col, id, cambios) {
  return await llamar('PUT', `/api/${col}/${id}`, cambios);
}

/**
 * Elimina un registro por su ID.
 */
export async function eliminar(col, id) {
  return await llamar('DELETE', `/api/${col}/${id}`);
}

/**
 * Sube un archivo mediante FormData con el campo "archivo".
 */
export async function subir(archivo) {
  const formData = new FormData();
  formData.append('archivo', archivo);
  return await llamar('POST', '/api/subidas', formData);
}

/**
 * Envía una solicitud a una tarea de Inteligencia Artificial.
 */
export async function ia(tarea, datos) {
  return await llamar('POST', `/api/ia/${tarea}`, datos);
}
