const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { crearAppPrueba, PIN } = require('./helpers');
const { insertarEvento } = require('../server/db');

const DATOS = {
  nombre: 'Tutoría Grupal 5A',
  descripcion: 'Prueba',
  lugar: 'Aula 5A',
  inicio: '2026-11-28T16:00:00.000Z',
  fin: '2026-11-28T18:00:00.000Z',
  latitud: 19.04,
  longitud: -98.2,
  radio_m: 150,
};

test('GET /api/eventos sin eventos devuelve []', async () => {
  const { app } = crearAppPrueba();
  const res = await request(app).get('/api/eventos');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('GET /api/eventos lista los eventos ordenados por inicio y sin token', async () => {
  const { app, db } = crearAppPrueba();
  insertarEvento(db, { ...DATOS, nombre: 'Después', inicio: '2026-11-29T16:00:00.000Z', fin: '2026-11-29T18:00:00.000Z' });
  insertarEvento(db, { ...DATOS, nombre: 'Antes' });

  const res = await request(app).get('/api/eventos');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((e) => e.nombre), ['Antes', 'Después']);
  for (const e of res.body) assert.ok(!('token' in e), 'el listado no debe incluir token');
});

test('GET /api/eventos/:id devuelve el evento sin token', async () => {
  const { app, db } = crearAppPrueba();
  const id = insertarEvento(db, DATOS);

  const res = await request(app).get(`/api/eventos/${id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.id, id);
  assert.equal(res.body.nombre, DATOS.nombre);
  assert.equal(res.body.radio_m, 150);
  assert.ok(!('token' in res.body), 'el detalle no debe incluir token');
});

test('GET /api/eventos/:id inexistente responde 404 evento_no_encontrado', async () => {
  const { app } = crearAppPrueba();
  for (const id of ['999', 'abc']) {
    const res = await request(app).get(`/api/eventos/${id}`);
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'evento_no_encontrado');
  }
});

// --- Escritura (POST / PUT / DELETE) ---

const NUEVO = {
  nombre: 'Conferencia de IA',
  lugar: 'Auditorio',
  inicio: '2026-11-29T16:00:00.000Z',
  fin: '2026-11-29T18:00:00.000Z',
  latitud: 19.05,
  longitud: -98.21,
};

/** Inserta una asistencia directo en la BD, sin pasar por las validaciones del registro. */
function insertarAsistencia(db, eventoId, matricula) {
  db.prepare(`
    INSERT INTO asistencias (uuid, evento_id, matricula, nombre, capturada_en, recibida_en, estado)
    VALUES (?, ?, ?, 'Alumno', '2026-11-28T16:05:00.000Z', '2026-11-28T16:05:01.000Z', 'valida')
  `).run(`uuid-${matricula}`, eventoId, matricula);
}

test('POST, PUT y DELETE sin PIN o con PIN incorrecto responden 401 pin_invalido', async () => {
  const { app, db } = crearAppPrueba();
  const id = insertarEvento(db, DATOS);
  const peticiones = [
    () => request(app).post('/api/eventos').send(NUEVO),
    () => request(app).put(`/api/eventos/${id}`).send(NUEVO),
    () => request(app).delete(`/api/eventos/${id}`),
  ];
  for (const peticion of peticiones) {
    for (const pin of [undefined, '0000']) {
      const r = peticion();
      if (pin) r.set('X-PIN', pin);
      const res = await r;
      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'pin_invalido');
    }
  }
  assert.equal(db.prepare('SELECT nombre FROM eventos WHERE id = ?').get(id).nombre, DATOS.nombre);
});

test('POST /api/eventos crea el evento: 201, radio por defecto 100 y sin token', async () => {
  const { app, db } = crearAppPrueba();
  const res = await request(app).post('/api/eventos').set('X-PIN', PIN).send(NUEVO);

  assert.equal(res.status, 201);
  assert.equal(res.body.nombre, NUEVO.nombre);
  assert.equal(res.body.radio_m, 100);
  assert.equal(res.body.descripcion, '');
  assert.ok(res.body.creado_en);
  assert.ok(!('token' in res.body));
  const fila = db.prepare('SELECT token FROM eventos WHERE id = ?').get(res.body.id);
  assert.equal(fila.token.length, 6);
});

test('POST /api/eventos con datos inválidos responde 400 datos_invalidos', async () => {
  const { app, db } = crearAppPrueba();
  const casos = [
    {},
    { ...NUEVO, nombre: '   ' },
    { ...NUEVO, inicio: 'no-es-fecha' },
    { ...NUEVO, fin: NUEVO.inicio },
    { ...NUEVO, latitud: 91 },
    { ...NUEVO, longitud: '-98.2' },
    { ...NUEVO, radio_m: 0 },
  ];
  for (const cuerpo of casos) {
    const res = await request(app).post('/api/eventos').set('X-PIN', PIN).send(cuerpo);
    assert.equal(res.status, 400, JSON.stringify(cuerpo));
    assert.equal(res.body.error, 'datos_invalidos');
    assert.ok(res.body.detalles.length > 0);
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM eventos').get().n, 0);
});

test('PUT /api/eventos/:id modifica el evento: 200 y conserva el token', async () => {
  const { app, db } = crearAppPrueba();
  const id = insertarEvento(db, DATOS);
  const tokenAntes = db.prepare('SELECT token FROM eventos WHERE id = ?').get(id).token;

  const res = await request(app).put(`/api/eventos/${id}`).set('X-PIN', PIN).send({ ...NUEVO, radio_m: 200 });

  assert.equal(res.status, 200);
  assert.equal(res.body.nombre, NUEVO.nombre);
  assert.equal(res.body.radio_m, 200);
  assert.ok(!('token' in res.body));
  assert.equal(db.prepare('SELECT token FROM eventos WHERE id = ?').get(id).token, tokenAntes);
});

test('PUT /api/eventos/:id responde 404 si no existe y 400 si los datos son inválidos', async () => {
  const { app, db } = crearAppPrueba();
  const id = insertarEvento(db, DATOS);

  const r404 = await request(app).put('/api/eventos/999').set('X-PIN', PIN).send(NUEVO);
  assert.equal(r404.status, 404);
  assert.equal(r404.body.error, 'evento_no_encontrado');

  const r400 = await request(app).put(`/api/eventos/${id}`).set('X-PIN', PIN).send({ ...NUEVO, latitud: null });
  assert.equal(r400.status, 400);
  assert.equal(r400.body.error, 'datos_invalidos');
});

test('DELETE /api/eventos/:id responde 204, elimina en cascada y luego 404', async () => {
  const { app, db } = crearAppPrueba();
  const id = insertarEvento(db, DATOS);
  const otro = insertarEvento(db, NUEVO);
  insertarAsistencia(db, id, 'UTP001');
  insertarAsistencia(db, id, 'UTP002');
  insertarAsistencia(db, otro, 'UTP003');

  const res = await request(app).delete(`/api/eventos/${id}`).set('X-PIN', PIN);
  assert.equal(res.status, 204);

  const contar = (eventoId) =>
    db.prepare('SELECT COUNT(*) AS n FROM asistencias WHERE evento_id = ?').get(eventoId).n;
  assert.equal(contar(id), 0, 'las asistencias del evento borrado deben desaparecer');
  assert.equal(contar(otro), 1, 'las asistencias de otros eventos no se tocan');

  const otraVez = await request(app).delete(`/api/eventos/${id}`).set('X-PIN', PIN);
  assert.equal(otraVez.status, 404);
});

// --- QR ---

test('GET /api/eventos/:id/qr devuelve el token y el QR como data URL PNG', async () => {
  const { app, db } = crearAppPrueba();
  const id = insertarEvento(db, DATOS);
  const { token } = db.prepare('SELECT token FROM eventos WHERE id = ?').get(id);

  const res = await request(app).get(`/api/eventos/${id}/qr`).set('X-PIN', PIN);
  assert.equal(res.status, 200);
  assert.equal(res.body.token, token);
  assert.match(res.body.token, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  assert.ok(res.body.qr.startsWith('data:image/png;base64,'));
});

test('GET /api/eventos/:id/qr responde 401 sin PIN y 404 si no existe', async () => {
  const { app, db } = crearAppPrueba();
  const id = insertarEvento(db, DATOS);

  const r401 = await request(app).get(`/api/eventos/${id}/qr`);
  assert.equal(r401.status, 401);
  assert.equal(r401.body.error, 'pin_invalido');
  assert.ok(!('token' in r401.body));

  const r404 = await request(app).get('/api/eventos/999/qr').set('X-PIN', PIN);
  assert.equal(r404.status, 404);
  assert.equal(r404.body.error, 'evento_no_encontrado');
});
