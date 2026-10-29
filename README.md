# Ecosistema Educativo Digital

Plataforma web educativa para el desarrollo de competencias digitales y estrategias tecnológicas.

## Requisitos
- Node.js 20 o superior (versión LTS)
- npm (incluido con Node.js)

## Instalación y puesta en marcha
1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Configurar las variables de entorno:
   Copiar `.env.ejemplo` como `.env` (ajustar puerto o claves según sea necesario):
   ```bash
   cp .env.ejemplo .env
   # En Windows PowerShell:
   # Copy-Item .env.ejemplo .env
   ```
3. Iniciar el servidor:
   ```bash
   npm start
   ```

El servidor estará disponible por defecto en `http://localhost:3000`.

## Publicación en Render

El repositorio incluye `render.yaml` y el comando de inicio necesario para reconstruir los datos iniciales sin publicar `.env` ni claves privadas.

1. En Render, selecciona **New → Blueprint** y conecta este repositorio.
2. Confirma el servicio `neuroritmo-digital`.
3. Registra `GEMINI_API_KEY` como variable secreta si deseas activar Neuri mediante IA.
4. Despliega. Render asignará automáticamente la variable `PORT`.

Sin la variable `DISCO`, el servicio usa el sistema de archivos efímero de Render: las cuentas, respuestas y cargas pueden reiniciarse después de un nuevo despliegue. Para conservarlas, configura un disco persistente y define `DISCO` con su ruta absoluta de montaje, por ejemplo `/var/data`.

Para sincronizar un servicio creado manualmente, usa `npm ci` como Build Command y `npm start` como Start Command. El preinicio crea un respaldo, fusiona por identificador los contenidos de `despliegue/inicial/` y conserva los registros existentes. La ruta `/api/estado-despliegue` permite comprobar el commit, la rama y el tipo de almacenamiento sin exponer secretos.
