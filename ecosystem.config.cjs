// ecosystem.config.cjs
// Configuración de PM2 para producción (ver docs/despliegue.md).
// Es .cjs porque package.json usa "type": "module" y PM2 lee este archivo con require().

const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'ecosistema',
      script: 'servidor/server.js',
      cwd: __dirname,                   // dotenv lee .env desde aquí

      // Una sola instancia: los datos son archivos JSON con colas de escritura en memoria
      // y los límites (intentos por hora, recordatorios, mensajes) también viven en memoria.
      exec_mode: 'fork',
      instances: 1,

      // Reinicio automático
      autorestart: true,
      watch: false,
      min_uptime: '10s',                // si cae antes de 10 s cuenta como arranque fallido
      max_restarts: 15,
      exp_backoff_restart_delay: 200,   // espera creciente entre reinicios si falla seguido
      max_memory_restart: '400M',
      kill_timeout: 5000,               // deja terminar las escrituras en curso antes de detener

      // Registros (rotación con pm2-logrotate)
      out_file: path.join(__dirname, 'registros', 'salida.log'),
      error_file: path.join(__dirname, 'registros', 'errores.log'),
      merge_logs: true,
      time: true,                       // fecha y hora en cada línea

      env: {
        NODE_ENV: 'production',
        TZ: 'America/Guayaquil'         // días, agenda y alertas en hora de Ecuador
      }
    }
  ]
};
