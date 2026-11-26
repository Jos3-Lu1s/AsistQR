const express = require('express');
const QRCode = require('qrcode');
const { insertarEvento } = require('../db');
const { requierePin } = require('../middleware/pin');
const { formatearAsistencia } = require('./asistencias');

// Columnas que se pueden enviar a cualquiera. El token NUNCA va aquí.
const COLUMNAS_PUBLICAS = `
  id, nombre, descripcion, lugar, inicio, fin,
  latitud, longitud, radio_m, creado_en
`;

const router = express.Router();

/** Busca un evento por id (sin token). Devuelve undefined si no existe. */
function buscarEvento(db, id) {
  if (!/^\d+$/.test(String(id))) return undefined; // Un id no numérico no existe.
  return db.prepare(`SELECT ${COLUMNAS_PUBLICAS} FROM eventos WHERE id = ?`).get(Number(id));
}

/** Responde 404 para un evento inexistente. */
function noEncontrado(res) {
  return res.status(404).json({
    error: 'evento_no_encontrado',
    mensaje: 'El evento no existe.',
  });
}

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v);
const esTextoOpcional = (v) => v === undefined || typeof v === 'string';

/** Convierte un texto de fecha a ISO 8601 UTC, o devuelve null si no es válida. */
function aISO(valor) {
  if (typeof valor !== 'string' || Number.isNaN(Date.parse(valor))) return null;
  return new Date(valor).toISOString();
}

/**
 * Valida el cuerpo de POST/PUT. Devuelve { datos } listos para la BD
 * o { detalles } con la lista de problemas encontrados.
 */
function validarEvento(cuerpo = {}) {
  const detalles = [];
  const { nombre, descripcion, lugar, latitud, longitud, radio_m = 100 } = cuerpo;
  const inicio = aISO(cuerpo.inicio);
  const fin = aISO(cuerpo.fin);

  if (typeof nombre !== 'string' || nombre.trim() === '') detalles.push('nombre es obligatorio.');
  if (!esTextoOpcional(descripcion)) detalles.push('descripcion debe ser texto.');
  if (!esTextoOpcional(lugar)) detalles.push('lugar debe ser texto.');
  if (!inicio) detalles.push('inicio debe ser una fecha ISO 8601.');
  if (!fin) detalles.push('fin debe ser una fecha ISO 8601.');
  if (inicio && fin && fin <= inicio) detalles.push('fin debe ser posterior a inicio.');
  if (!esNumero(latitud) || latitud < -90 || latitud > 90) detalles.push('latitud debe estar entre -90 y 90.');
  if (!esNumero(longitud) || longitud < -180 || longitud > 180) detalles.push('longitud debe estar entre -180 y 180.');
  if (!Number.isInteger(radio_m) || radio_m <= 0) detalles.push('radio_m debe ser un entero mayor que 0.');

  if (detalles.length > 0) return { detalles };
  return {
    datos: {
      nombre: nombre.trim(),
      descripcion: descripcion ?? '',
      lugar: lugar ?? '',
      inicio,
      fin,
      latitud,
      longitud,
      radio_m,
    },
  };
}

/** Responde 400 con la lista de problemas de validación. */
function datosInvalidos(res, detalles) {
  return res.status(400).json({
    error: 'datos_invalidos',
    mensaje: 'Los datos del evento no son válidos.',
    detalles,
  });
}

// Lista pública de eventos, del más próximo al más lejano.
router.get('/', (req, res) => {
  const { db } = req.app.locals;
  const eventos = db.prepare(`SELECT ${COLUMNAS_PUBLICAS} FROM eventos ORDER BY inicio`).all();
  res.json(eventos);
});

// Detalle público de un evento.
router.get('/:id', (req, res) => {
  const evento = buscarEvento(req.app.locals.db, req.params.id);
  if (!evento) return noEncontrado(res);
  res.json(evento);
});

// Asistentes de un evento para el contador en vivo del organizador.
router.get('/:id/asistencias', requierePin, (req, res) => {
  const { db } = req.app.locals;
  if (!buscarEvento(db, req.params.id)) return noEncontrado(res);

  // En orden de escaneo: los nuevos quedan al final.
  const filas = db
    .prepare('SELECT * FROM asistencias WHERE evento_id = ? ORDER BY capturada_en')
    .all(Number(req.params.id));

  res.json({ total: filas.length, asistencias: filas.map(formatearAsistencia) });
});

// Token en texto e imagen del QR para que el organizador los proyecte.
router.get('/:id/qr', requierePin, async (req, res, next) => {
  const { db } = req.app.locals;
  if (!buscarEvento(db, req.params.id)) return noEncontrado(res);

  // Único endpoint que expone el token; por eso exige PIN.
  const { token } = db.prepare('SELECT token FROM eventos WHERE id = ?').get(Number(req.params.id));
  try {
    const qr = await QRCode.toDataURL(token);
    res.json({ token, qr });
  } catch (err) {
    next(err); // Lo responde el manejador de errores de Express.
  }
});

// Crea un evento con un token nuevo.
router.post('/', requierePin, (req, res) => {
  const { db } = req.app.locals;
  const { datos, detalles } = validarEvento(req.body);
  if (detalles) return datosInvalidos(res, detalles);

  const id = insertarEvento(db, datos);
  res.status(201).json(buscarEvento(db, id));
});

// Modifica un evento existente.
router.put('/:id', requierePin, (req, res) => {
  const { db } = req.app.locals;
  if (!buscarEvento(db, req.params.id)) return noEncontrado(res);

  const { datos, detalles } = validarEvento(req.body);
  if (detalles) return datosInvalidos(res, detalles);

  // Reemplaza los campos editables; el token y creado_en no cambian.
  db.prepare(`
    UPDATE eventos
    SET nombre = @nombre, descripcion = @descripcion, lugar = @lugar,
        inicio = @inicio, fin = @fin, latitud = @latitud, longitud = @longitud, radio_m = @radio_m
    WHERE id = @id
  `).run({ ...datos, id: Number(req.params.id) });

  res.json(buscarEvento(db, req.params.id));
});

// Elimina un evento.
router.delete('/:id', requierePin, (req, res) => {
  const { db } = req.app.locals;
  if (!buscarEvento(db, req.params.id)) return noEncontrado(res);

  // ON DELETE CASCADE elimina también sus asistencias.
  db.prepare('DELETE FROM eventos WHERE id = ?').run(Number(req.params.id));
  res.status(204).end();
});

module.exports = router;
