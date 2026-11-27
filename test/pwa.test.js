const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { crearAppPrueba, PIN } = require('./helpers');

// --- Verificación del PIN ---

test('GET /api/pin con el PIN correcto responde 204 sin cuerpo', async () => {
  const { app } = crearAppPrueba();
  const res = await request(app).get('/api/pin').set('X-PIN', PIN);
  assert.equal(res.status, 204);
  assert.equal(res.text, '');
});

test('GET /api/pin sin PIN o con PIN incorrecto responde 401 pin_invalido', async () => {
  const { app } = crearAppPrueba();
  for (const pin of [undefined, '0000', '']) {
    const peticion = request(app).get('/api/pin');
    if (pin !== undefined) peticion.set('X-PIN', pin);
    const res = await peticion;
    assert.equal(res.status, 401, `pin: ${JSON.stringify(pin)}`);
    assert.equal(res.body.error, 'pin_invalido');
  }
});

// --- Archivos de la PWA ---

test('GET /manifest.json describe la app con start_url en el splash e íconos de 192 y 512', async () => {
  const { app } = crearAppPrueba();
  const res = await request(app).get('/manifest.json');

  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /json/);
  assert.equal(res.body.name, 'AsistQR');
  assert.equal(res.body.start_url, '/splash.html');
  assert.equal(res.body.display, 'standalone');
  assert.equal(res.body.theme_color, '#1a73e8');
  const tamanos = res.body.icons.map((icono) => icono.sizes);
  assert.ok(tamanos.includes('192x192'));
  assert.ok(tamanos.includes('512x512'));
  assert.ok(res.body.icons.some((icono) => icono.purpose === 'maskable'));
});

test('el splash y los íconos se sirven con el tipo correcto', async () => {
  const { app } = crearAppPrueba();
  const archivos = [
    ['/splash.html', /text\/html/],
    ['/img/icono-192.png', /image\/png/],
    ['/img/icono-512.png', /image\/png/],
    ['/img/logo.svg', /image\/svg\+xml/],
  ];
  for (const [ruta, tipo] of archivos) {
    const res = await request(app).get(ruta);
    assert.equal(res.status, 200, ruta);
    assert.match(res.headers['content-type'], tipo, ruta);
  }
});

test('index.html y splash.html enlazan el manifest y el ícono de Apple', async () => {
  const { app } = crearAppPrueba();
  for (const ruta of ['/', '/splash.html']) {
    const res = await request(app).get(ruta);
    assert.ok(res.text.includes('<link rel="manifest" href="/manifest.json">'), ruta);
    assert.ok(res.text.includes('<link rel="apple-touch-icon" href="/img/icono-192.png">'), ruta);
  }
});
