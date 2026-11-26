const { abrirBD } = require('../server/db');
const { crearApp } = require('../server/app');
const config = require('../server/config');

/** PIN válido para usar en el header X-PIN de los tests. */
const PIN = config.ORGANIZADOR_PIN;

/**
 * Crea una app lista para supertest con una BD en memoria, vacía y aislada.
 * Cada llamada devuelve una BD nueva, así los tests no se afectan entre sí.
 */
function crearAppPrueba() {
  const db = abrirBD(':memory:');
  const app = crearApp({ db });
  return { app, db };
}

module.exports = { crearAppPrueba, PIN };
