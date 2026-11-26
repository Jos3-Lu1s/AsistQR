const path = require('node:path');

// Raíz del proyecto, para que las rutas no dependan de la carpeta desde donde se arranca.
const RAIZ = path.join(__dirname, '..');

// Cada valor se puede sobrescribir con una variable de entorno (.env).
module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  DB_PATH: process.env.DB_PATH || path.join(RAIZ, 'server', 'data', 'asistqr.db'),
  ORGANIZADOR_PIN: process.env.ORGANIZADOR_PIN || '1234',
  ZONA_HORARIA: process.env.ZONA_HORARIA || 'America/Mexico_City', // Zona de las horas en las vistas.
  DIR_PUBLIC: path.join(RAIZ, 'public'),
};
