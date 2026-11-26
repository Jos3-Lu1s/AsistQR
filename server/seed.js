const { insertarEvento } = require('./db');

// Centro aproximado de Puebla. Para la demo, ajústalas con SEED_LAT / SEED_LNG
// o editando el evento.
const LAT_DEFECTO = 19.0414;
const LNG_DEFECTO = -98.2063;

const MIN = 60 * 1000;
const HORA = 60 * MIN;

/**
 * Crea los eventos de prueba solo si la tabla `eventos` está vacía.
 * Devuelve cuántos eventos insertó (0 o 2).
 */
function sembrar(db) {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM eventos').get();
  if (total > 0) return 0;

  const latitud = Number(process.env.SEED_LAT) || LAT_DEFECTO;
  const longitud = Number(process.env.SEED_LNG) || LNG_DEFECTO;
  const ahora = Date.now();

  // Mañana a las 16:00 UTC = 10:00 en Puebla.
  const conferencia = new Date(ahora);
  conferencia.setUTCDate(conferencia.getUTCDate() + 1);
  conferencia.setUTCHours(16, 0, 0, 0);

  const eventos = [
    {
      nombre: 'Tutoría Grupal 5A',
      descripcion: 'Sesión de tutoría grupal (evento de prueba, activo).',
      lugar: 'Edificio de TI, aula 5A',
      inicio: new Date(ahora - 30 * MIN).toISOString(),
      fin: new Date(ahora + 2 * HORA).toISOString(),
      latitud,
      longitud,
      radio_m: 150,
    },
    {
      nombre: 'Conferencia de IA',
      descripcion: 'Conferencia sobre inteligencia artificial (evento de prueba, próximo).',
      lugar: 'Auditorio principal',
      inicio: conferencia.toISOString(),
      fin: new Date(conferencia.getTime() + 2 * HORA).toISOString(),
      latitud,
      longitud,
      radio_m: 150,
    },
  ];

  db.transaction(() => eventos.forEach((e) => insertarEvento(db, e)))();
  return eventos.length;
}

module.exports = { sembrar };
