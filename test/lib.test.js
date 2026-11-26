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
