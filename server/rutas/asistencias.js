const express = require('express');
const { normalizarToken } = require('../lib/token');
const { distanciaMetros } = require('../lib/distancia');
const { requierePin } = require('../middleware/pin');

const TOLERANCIA_ANTES_MS = 10 * 60 * 1000; // Se acepta hasta 10 min antes del inicio.
const TOPE_PRECISION_M = 100; // Máximo de precisión GPS que se descuenta de la distancia.

const router = express.Router();

const esTexto = (v) => typeof v === 'string' && v.trim() !== '';
const esNumero = (v) => typeof v === 'number' && Number.isFinite(v);

/** Convierte una fila de `asistencias` al formato de la API (offline como booleano). */
function formatearAsistencia(fila) {
  return { ...fila, offline: fila.offline === 1 };
}

/** Lee una asistencia por una condición y la deja lista para la API. */
function leerAsistencia(db, where, ...params) {
  const fila = db.prepare(`SELECT * FROM asistencias WHERE ${where}`).get(...params);
  return fila && formatearAsistencia(fila);
}

/** Valida el cuerpo del registro. Devuelve { datos } o { detalles }. */
function validarAsistencia(cuerpo = {}) {
  const detalles = [];
  const { uuid, token, matricula, nombre, capturadaEn, latitud, longitud, precision, offline } = cuerpo;

  for (const [campo, valor] of Object.entries({ uuid, token, matricula, nombre })) {
    if (!esTexto(valor)) detalles.push(`${campo} es obligatorio.`);
  }
  if (typeof capturadaEn !== 'string' || Number.isNaN(Date.parse(capturadaEn))) {
    detalles.push('capturadaEn debe ser una fecha ISO 8601.');
  }

  // La ubicación es opcional (el alumno puede negar el GPS), pero va completa o no va.
  const ubicacion = [latitud, longitud, precision];
  const conUbicacion = ubicacion.every((v) => v !== undefined && v !== null);
  if (!conUbicacion && ubicacion.some((v) => v !== undefined && v !== null)) {
    detalles.push('latitud, longitud y precision van los tres juntos o ninguno.');
  } else if (conUbicacion) {
    if (!esNumero(latitud) || latitud < -90 || latitud > 90) detalles.push('latitud debe estar entre -90 y 90.');
    if (!esNumero(longitud) || longitud < -180 || longitud > 180) detalles.push('longitud debe estar entre -180 y 180.');
    if (!esNumero(precision) || precision < 0) detalles.push('precision debe ser un número mayor o igual a 0.');
  }
  if (offline !== undefined && typeof offline !== 'boolean') detalles.push('offline debe ser booleano.');

  if (detalles.length > 0) return { detalles };
  return {
    datos: {
      uuid: uuid.trim(),
      token: normalizarToken(token),
      matricula: matricula.trim(),
      nombre: nombre.trim(),
      capturada_en: new Date(capturadaEn).toISOString(),
      latitud: conUbicacion ? latitud : null,
      longitud: conUbicacion ? longitud : null,
      precision_m: conUbicacion ? precision : null,
      offline: offline ? 1 : 0,
    },
  };
}

/**
 * Calcula la distancia al evento y el estado del registro.
 * Prioridad: fuera_de_horario > sin_ubicacion > fuera_de_rango > valida.
 */
function evaluar(evento, datos) {
  const conUbicacion = datos.latitud !== null;
  const distancia_m = conUbicacion
    ? distanciaMetros(datos.latitud, datos.longitud, evento.latitud, evento.longitud)
    : null;

  // Se valida con la hora del escaneo, no la de llegada, para no castigar envíos offline.
  const captura = Date.parse(datos.capturada_en);
  let estado;
  if (captura < Date.parse(evento.inicio) - TOLERANCIA_ANTES_MS || captura > Date.parse(evento.fin)) {
    estado = 'fuera_de_horario';
  } else if (!conUbicacion) {
    estado = 'sin_ubicacion';
  } else if (distancia_m - Math.min(datos.precision_m, TOPE_PRECISION_M) > evento.radio_m) {
    estado = 'fuera_de_rango';
  } else {
    estado = 'valida';
  }
  return { distancia_m, estado };
}

// Registra la asistencia de un alumno a partir del token del QR.
router.post('/', (req, res) => {
  const { db } = req.app.locals;

  const { datos, detalles } = validarAsistencia(req.body);
  if (detalles) {
    return res.status(400).json({
      error: 'datos_invalidos',
      mensaje: 'Los datos de la asistencia no son válidos.',
      detalles,
    });
  }

  // Un uuid ya recibido es un reintento de sincronización: éxito sin duplicar.
  const previa = leerAsistencia(db, 'uuid = ?', datos.uuid);
  if (previa) return res.status(200).json({ asistencia: previa, duplicado: true });

  // El token del QR identifica al evento.
  const evento = db.prepare('SELECT * FROM eventos WHERE token = ?').get(datos.token);
  if (!evento) {
    return res.status(404).json({
      error: 'token_invalido',
      mensaje: 'El código QR no corresponde a ningún evento.',
    });
  }

  // Un alumno solo se registra una vez por evento.
  const existente = leerAsistencia(db, 'evento_id = ? AND matricula = ?', evento.id, datos.matricula);
  if (existente) {
    return res.status(409).json({
      error: 'ya_registrado',
      mensaje: 'Ya tienes asistencia registrada en este evento.',
      asistencia: existente,
    });
  }

  const { distancia_m, estado } = evaluar(evento, datos);
  const { token, ...columnas } = datos; // El token no se guarda en la asistencia.
  const info = db.prepare(`
    INSERT INTO asistencias (uuid, evento_id, matricula, nombre, latitud, longitud, precision_m,
                             distancia_m, capturada_en, recibida_en, offline, estado)
    VALUES (@uuid, @evento_id, @matricula, @nombre, @latitud, @longitud, @precision_m,
            @distancia_m, @capturada_en, @recibida_en, @offline, @estado)
  `).run({
    ...columnas,
    evento_id: evento.id,
    distancia_m,
    estado,
    recibida_en: new Date().toISOString(),
  });

  res.status(201).json({
    asistencia: leerAsistencia(db, 'id = ?', info.lastInsertRowid),
    evento: { id: evento.id, nombre: evento.nombre },
  });
});

// Historial de un alumno: GET /api/asistencias?matricula=X
router.get('/', (req, res) => {
  const { db } = req.app.locals;
  const { matricula } = req.query;
  if (!esTexto(matricula)) {
    return res.status(400).json({
      error: 'datos_invalidos',
      mensaje: 'Falta el parámetro matricula.',
    });
  }

  // Del escaneo más reciente al más antiguo.
  const filas = db.prepare(`
    SELECT a.*, e.nombre AS evento_nombre
    FROM asistencias a
    JOIN eventos e ON e.id = a.evento_id
    WHERE a.matricula = ?
    ORDER BY a.capturada_en DESC
  `).all(matricula.trim());

  res.json(filas.map(formatearAsistencia));
});

// Elimina un registro erróneo (solo organizador).
router.delete('/:id', requierePin, (req, res) => {
  const { db } = req.app.locals;
  const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : null; // Un id no numérico no existe.
  const info = id === null ? { changes: 0 } : db.prepare('DELETE FROM asistencias WHERE id = ?').run(id);

  if (info.changes === 0) {
    return res.status(404).json({
      error: 'asistencia_no_encontrada',
      mensaje: 'El registro de asistencia no existe.',
    });
  }
  res.status(204).end();
});

module.exports = router;
// Se comparte con las rutas de eventos para responder con el mismo formato.
module.exports.formatearAsistencia = formatearAsistencia;
