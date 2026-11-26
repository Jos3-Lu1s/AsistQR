const express = require('express');
const config = require('../config');
const { formatearFechaHora, formatearHora, formatearMetros } = require('../lib/formato');
const { calcularResumen } = require('../lib/resumen');

const router = express.Router();

/** Horario del evento: '28/11/2026, 10:00 – 12:00' (fecha completa en ambos si cambia de día). */
function formatearHorario(inicio, fin) {
  const desde = formatearFechaHora(inicio);
  const hasta = formatearFechaHora(fin);
  const [fechaDesde] = desde.split(', ');
  const [fechaHasta, horaHasta] = hasta.split(', ');
  return `${desde} – ${fechaDesde === fechaHasta ? horaHasta : hasta}`;
}

/** Busca un evento por id con los datos que muestran las vistas (sin token). */
function buscarEvento(db, id) {
  if (!/^\d+$/.test(String(id))) return undefined; // Un id no numérico no existe.
  return db
    .prepare('SELECT id, nombre, descripcion, lugar, inicio, fin, radio_m FROM eventos WHERE id = ?')
    .get(Number(id));
}

/**
 * Asistencias del evento en orden alfabético y ya formateadas para la tabla.
 * Se ordena en JavaScript porque ORDER BY de SQLite no ordena bien los acentos.
 */
function filasDeLista(asistencias) {
  return [...asistencias]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
    .map((a) => ({
      matricula: a.matricula,
      nombre: a.nombre,
      estado: a.estado,
      offline: a.offline === 1,
      capturada: formatearHora(a.capturada_en),
      recibida: formatearHora(a.recibida_en),
      distancia: formatearMetros(a.distancia_m),
      precision: formatearMetros(a.precision_m),
    }));
}

/** Responde 404 con la página de error. */
function eventoNoEncontrado(res) {
  return res.status(404).render('error', {
    titulo: 'Evento no encontrado',
    mensaje: 'El evento que buscas no existe o fue eliminado.',
  });
}

// Formulario de PIN para ver la lista de asistencia.
router.get('/:id/lista', (req, res) => {
  const evento = buscarEvento(req.app.locals.db, req.params.id);
  if (!evento) return eventoNoEncontrado(res);
  res.render('pin', { evento, error: null });
});

// Lista de asistencia: se genera solo si el PIN del formulario es correcto.
router.post('/:id/lista', (req, res) => {
  const { db } = req.app.locals;
  const evento = buscarEvento(db, req.params.id);
  if (!evento) return eventoNoEncontrado(res);

  if (req.body?.pin !== config.ORGANIZADOR_PIN) {
    return res.status(401).render('pin', { evento, error: 'PIN incorrecto' });
  }

  const asistencias = db.prepare('SELECT * FROM asistencias WHERE evento_id = ?').all(evento.id);

  // Contiene datos personales: que ni el navegador ni intermediarios la guarden.
  res.set('Cache-Control', 'no-store');
  res.render('lista', {
    evento,
    horario: formatearHorario(evento.inicio, evento.fin),
    generadaEn: formatearFechaHora(new Date().toISOString()),
    resumen: calcularResumen(asistencias),
    asistencias: filasDeLista(asistencias),
  });
});

module.exports = router;
