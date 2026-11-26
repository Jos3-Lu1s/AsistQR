const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { generarToken } = require('./lib/token');

// Fechas en ISO 8601 UTC. Un evento tiene muchas asistencias; borrar el evento borra sus asistencias.
const ESQUEMA = `
CREATE TABLE IF NOT EXISTS eventos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre       TEXT    NOT NULL,
  descripcion  TEXT    NOT NULL DEFAULT '',
  lugar        TEXT    NOT NULL DEFAULT '',
  inicio       TEXT    NOT NULL,
  fin          TEXT    NOT NULL,
  latitud      REAL    NOT NULL,
  longitud     REAL    NOT NULL,
  radio_m      INTEGER NOT NULL DEFAULT 100,
  token        TEXT    NOT NULL UNIQUE,
  creado_en    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS asistencias (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid         TEXT    NOT NULL UNIQUE,
  evento_id    INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  matricula    TEXT    NOT NULL,
  nombre       TEXT    NOT NULL,
  latitud      REAL,
  longitud     REAL,
  precision_m  REAL,
  distancia_m  REAL,
  capturada_en TEXT    NOT NULL,
  recibida_en  TEXT    NOT NULL,
  offline      INTEGER NOT NULL DEFAULT 0,
  estado       TEXT    NOT NULL CHECK (estado IN
                 ('valida','fuera_de_rango','fuera_de_horario','sin_ubicacion')),
  UNIQUE (evento_id, matricula)
);
`;

/**
 * Abre (o crea) la BD SQLite en `ruta` y asegura el esquema.
 * Acepta ':memory:' para los tests.
 */
function abrirBD(ruta) {
  if (ruta !== ':memory:') {
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
  }

  const db = new Database(ruta);
  db.pragma('foreign_keys = ON'); // SQLite no aplica ON DELETE CASCADE sin esto.
  db.exec(ESQUEMA);
  return db;
}

const INTENTOS_TOKEN = 10;

/**
 * Inserta un evento con un token nuevo y devuelve su id.
 * Si el token choca con el UNIQUE de eventos.token, genera otro y reintenta.
 */
function insertarEvento(db, datos) {
  const insertar = db.prepare(`
    INSERT INTO eventos (nombre, descripcion, lugar, inicio, fin, latitud, longitud, radio_m, token, creado_en)
    VALUES (@nombre, @descripcion, @lugar, @inicio, @fin, @latitud, @longitud, @radio_m, @token, @creado_en)
  `);

  for (let intento = 1; ; intento++) {
    try {
      const info = insertar.run({
        descripcion: '',
        lugar: '',
        radio_m: 100,
        ...datos,
        token: generarToken(),
        creado_en: new Date().toISOString(),
      });
      return Number(info.lastInsertRowid);
    } catch (err) {
      const chocoToken = err.code === 'SQLITE_CONSTRAINT_UNIQUE' && err.message.includes('eventos.token');
      if (!chocoToken || intento >= INTENTOS_TOKEN) throw err;
    }
  }
}

module.exports = { abrirBD, insertarEvento };
