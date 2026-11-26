const test = require('node:test');
const assert = require('node:assert/strict');
const { ALFABETO, generarToken, normalizarToken } = require('../server/lib/token');
const { distanciaMetros } = require('../server/lib/distancia');

const cerca = (real, esperado, margen = 0.01) =>
  Math.abs(real - esperado) <= esperado * margen;

test('generarToken: 6 caracteres del alfabeto permitido', () => {
  for (let i = 0; i < 500; i++) {
    const token = generarToken();
    assert.equal(token.length, 6);
    for (const c of token) assert.ok(ALFABETO.includes(c), `carácter no permitido: ${c}`);
  }
});

test('generarToken: no usa caracteres ambiguos', () => {
  for (const c of '0O1I') assert.ok(!ALFABETO.includes(c));
});

test('normalizarToken: quita espacios y pasa a mayúsculas', () => {
  assert.equal(normalizarToken('  k7p2qx '), 'K7P2QX');
});

test('distanciaMetros: mismo punto = 0', () => {
  assert.equal(distanciaMetros(19.04, -98.2, 19.04, -98.2), 0);
});

test('distanciaMetros: 0.001° de latitud ≈ 111.2 m (±1 %)', () => {
  const d = distanciaMetros(19.0, -98.2, 19.001, -98.2);
  assert.ok(cerca(d, 111.19), `obtenido ${d}`);
});

test('distanciaMetros: París–Londres ≈ 343.5 km (±1 %)', () => {
  const d = distanciaMetros(48.8566, 2.3522, 51.5074, -0.1278);
  assert.ok(cerca(d, 343_500), `obtenido ${d}`);
});

// --- Formato (zona America/Mexico_City, UTC-6) ---

const { formatearFechaHora, formatearHora, formatearMetros } = require('../server/lib/formato');

test('formatearFechaHora: convierte UTC a hora de Ciudad de México', () => {
  assert.equal(formatearFechaHora('2026-11-28T16:05:00.000Z'), '28/11/2026, 10:05');
});

test('formatearHora: hora con segundos en formato de 24 h', () => {
  assert.equal(formatearHora('2026-11-28T16:05:00.000Z'), '10:05:00');
  assert.equal(formatearHora('2026-11-28T06:05:09.000Z'), '00:05:09');
});

test('formatearMetros: redondea y usa — cuando no hay valor', () => {
  assert.equal(formatearMetros(35.4), '35 m');
  assert.equal(formatearMetros(0), '0 m');
  assert.equal(formatearMetros(null), '—');
});

// --- Resumen ---

const { calcularResumen } = require('../server/lib/resumen');

test('calcularResumen: lista vacía da todos los totales en 0', () => {
  assert.deepEqual(calcularResumen([]), {
    total: 0,
    valida: 0,
    fuera_de_rango: 0,
    fuera_de_horario: 0,
    sin_ubicacion: 0,
    offline: 0,
  });
});

test('calcularResumen: cuenta por estado y los registros offline', () => {
  const asistencias = [
    { estado: 'valida', offline: 0 },
    { estado: 'valida', offline: 1 },
    { estado: 'valida', offline: true },
    { estado: 'fuera_de_rango', offline: 0 },
    { estado: 'fuera_de_horario', offline: 1 },
    { estado: 'sin_ubicacion', offline: false },
  ];
  assert.deepEqual(calcularResumen(asistencias), {
    total: 6,
    valida: 3,
    fuera_de_rango: 1,
    fuera_de_horario: 1,
    sin_ubicacion: 1,
    offline: 3,
  });
});
