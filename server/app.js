const express = require('express');
const config = require('./config');
const rutasEventos = require('./rutas/eventos');
const rutasAsistencias = require('./rutas/asistencias');

/**
 * Crea la aplicación Express sin abrir puertos.
 * Recibe la conexión a la BD para que los tests puedan usar una en memoria.
 */
function crearApp({ db }) {
  const app = express();

  app.locals.db = db; // Disponible en las rutas como req.app.locals.db.

  app.use(express.json());
  app.use(express.static(config.DIR_PUBLIC)); // Archivos de la PWA.

  // Comprueba que el servidor responde.
  app.get('/api/salud', (req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/eventos', rutasEventos);
  app.use('/api/asistencias', rutasAsistencias);

  return app;
}

module.exports = { crearApp };
