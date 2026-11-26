const config = require('../config');

// Formateadores en 24 h y en la zona configurada; se crean una vez y se reutilizan.
const FECHA_HORA = new Intl.DateTimeFormat('es-MX', {
  timeZone: config.ZONA_HORARIA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const HORA = new Intl.DateTimeFormat('es-MX', {
  timeZone: config.ZONA_HORARIA,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Fecha y hora: '28/11/2026, 10:05'. */
function formatearFechaHora(iso) {
  return FECHA_HORA.format(new Date(iso));
}

/** Hora con segundos: '10:05:00'. */
function formatearHora(iso) {
  return HORA.format(new Date(iso));
}

/** Metros redondeados: '35 m', o '—' si no hay valor (registro sin ubicación). */
function formatearMetros(valor) {
  if (valor === null || valor === undefined) return '—';
  return `${Math.round(valor)} m`;
}

module.exports = { formatearFechaHora, formatearHora, formatearMetros };
