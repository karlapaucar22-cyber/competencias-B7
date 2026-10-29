// servidor/crear-admin.js
// Script interactivo de consola para crear un usuario administrador inicial

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import * as almacen from './almacen.js';

/**
 * Solicita datos por una interfaz readline y crea un usuario administrador.
 * @param {readline.Interface} rl
 * @returns {Promise<Object>}
 */
export async function registrarAdminInteractiva(rl) {
  console.log('=== Crear Usuario Administrador ===\n');

  const nombre = (await rl.question('Nombre: ')).trim();
  if (!nombre) {
    throw new Error('El nombre no puede estar vacío.');
  }

  const apellido = (await rl.question('Apellido: ')).trim();
  if (!apellido) {
    throw new Error('El apellido no puede estar vacío.');
  }

  const correo = (await rl.question('Correo electrónico: ')).trim().toLowerCase();
  const formatoCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!correo || !formatoCorreo.test(correo)) {
    throw new Error('El formato del correo electrónico es inválido.');
  }

  // Verificar si el correo ya existe
  const usuarios = await almacen.leer('usuarios');
  const yaExiste = usuarios.some((u) => u.correo && u.correo.toLowerCase() === correo);
  if (yaExiste) {
    throw new Error(`El correo "${correo}" ya está registrado en el sistema.`);
  }

  const clave = (await rl.question('Contraseña: ')).trim();
  const formatoClave = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
  if (!clave || !formatoClave.test(clave)) {
    throw new Error('La contraseña debe tener al menos 8 caracteres e incluir letras y números.');
  }

  const claveHash = await bcrypt.hash(clave, 10);

  const nuevoAdmin = {
    nombre,
    apellido,
    correo,
    claveHash,
    rol: 'admin',
    activo: true,
    foto: null,
    consentimiento: {
      aceptado: true,
      fecha: new Date().toISOString()
    }
  };

  const creado = await almacen.agregar('usuarios', nuevoAdmin);

  console.log('\n✓ Usuario administrador creado exitosamente:');
  console.log(`  ID:     ${creado.id}`);
  console.log(`  Nombre: ${creado.nombre} ${creado.apellido}`);
  console.log(`  Correo: ${creado.correo}`);
  console.log(`  Rol:    ${creado.rol}`);

  return creado;
}

async function main() {
  const rl = readline.createInterface({ input, output });
  try {
    await registrarAdminInteractiva(rl);
  } catch (err) {
    console.error(`\n✗ Error: ${err.message}`);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

// Ejecutar automáticamente si es invocado directamente desde node
if (process.argv[1]) {
  try {
    const rutaArchivoActual = fileURLToPath(import.meta.url);
    const rutaEjecutada = path.resolve(process.argv[1]);
    if (rutaArchivoActual === rutaEjecutada) {
      main();
    }
  } catch {
    // Si no coincide o falla la resolución de ruta, ignorar
  }
}
