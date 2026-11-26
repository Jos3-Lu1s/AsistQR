const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { crearAppPrueba, PIN } = require('./helpers');
const { insertarEvento } = require('../server/db');

// Evento de 16:00 a 18:00 UTC en (19.04, -98.2) con radio de 150 m.
const EVENTO = {
  nombre: 'Tutoría Grupal 5A',
  inicio: '2026-11-28T16:00:00.000Z',
  fin: '2026-11-28T18:00:00.000Z',
  latitud: 19.04,
  longitud: -98.2,
  radio_m: 150,
};

/** App con un evento; devuelve su token y utilidades para registrar. */
function preparar() {
  const { app, db } = crearAppPrueba();
  const eventoId = insertarEvento(db, EVENTO);
  const { token } = db.prepare('SELECT token FROM eventos WHERE id = ?').get(eventoId);
  let n = 0;
  const cuerpo = (extra = {}) => {
    n += 1;
    return {
      uuid: `uuid-${n}`,
      token,
      matricula: `UTP00${n}`,
      nombre: 'Ana López',
      latitud: EVENTO.latitud,
      longitud: EVENTO.longitud,
      precision: 10,
      capturadaEn: '2026-11-28T16:05:00.000Z',
      ...extra,
    };
  };
  const registrar = (datos) => request(app).post('/api/asistencias').send(datos);
  const contar = () => db.prepare('SELECT COUNT(*) AS n FROM asistencias').get().n;
  return { app, db, eventoId, token, cuerpo, registrar, contar };
}

// 0.001° de latitud ≈ 111.2 m.
const alNorte = (grados) => ({ latitud: EVENTO.latitud + grados });
const SIN_GPS = { latitud: undefined, longitud: undefined, precision: undefined };

test('400 datos_invalidos con cuerpos incompletos o mal formados', async () => {
  const { cuerpo, registrar, contar } = preparar();
  const casos = [
    {},
    cuerpo({ uuid: '' }),
    cuerpo({ token: undefined }),
    cuerpo({ matricula: '  ' }),
    cuerpo({ nombre: 5 }),
    cuerpo({ capturadaEn: 'ayer' }),
    cuerpo({ precision: undefined }),
    cuerpo({ latitud: 'x' }),
    cuerpo({ offline: 'si' }),
  ];
  for (const datos of casos) {
    const res = await registrar(datos);
    assert.equal(res.status, 400, JSON.stringify(datos));
    assert.equal(res.body.error, 'datos_invalidos');
  }
  assert.equal(contar(), 0);
});

test('201 valida: dentro del horario y del radio; responde asistencia y evento', async () => {
  const { eventoId, cuerpo, registrar, contar } = preparar();
  const res = await registrar(cuerpo({ offline: true }));

  assert.equal(res.status, 201);
  assert.equal(res.body.asistencia.estado, 'valida');
  assert.equal(res.body.asistencia.distancia_m, 0);
  assert.equal(res.body.asistencia.offline, true);
  assert.ok(res.body.asistencia.recibida_en);
  assert.deepEqual(res.body.evento, { id: eventoId, nombre: EVENTO.nombre });
  assert.equal(contar(), 1);
});

test('200 duplicado: repetir el mismo uuid no crea otra fila', async () => {
  const { cuerpo, registrar, contar } = preparar();
  const datos = cuerpo();
  const primera = await registrar(datos);
  const segunda = await registrar(datos);

  assert.equal(primera.status, 201);
  assert.equal(segunda.status, 200);
  assert.equal(segunda.body.duplicado, true);
  assert.equal(segunda.body.asistencia.id, primera.body.asistencia.id);
  assert.equal(contar(), 1);
});

test('404 token_invalido con un token inexistente', async () => {
  const { cuerpo, registrar, contar } = preparar();
  const res = await registrar(cuerpo({ token: 'ZZZZZZ' }));
  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'token_invalido');
  assert.equal(contar(), 0);
});

test('el token en minúsculas y con espacios funciona igual', async () => {
  const { token, cuerpo, registrar } = preparar();
  const res = await registrar(cuerpo({ token: ` ${token.toLowerCase()} ` }));
  assert.equal(res.status, 201);
  assert.equal(res.body.asistencia.estado, 'valida');
});

test('409 ya_registrado: misma matrícula, mismo evento, otro uuid', async () => {
  const { cuerpo, registrar, contar } = preparar();
  const primera = await registrar(cuerpo({ matricula: 'UTP999' }));
  const segunda = await registrar(cuerpo({ matricula: 'UTP999' }));

  assert.equal(segunda.status, 409);
  assert.equal(segunda.body.error, 'ya_registrado');
  assert.equal(segunda.body.asistencia.id, primera.body.asistencia.id);
  assert.equal(contar(), 1);
});

test('201 fuera_de_horario: 11 min antes del inicio o después del fin', async () => {
  const { cuerpo, registrar } = preparar();
  for (const capturadaEn of ['2026-11-28T15:49:00.000Z', '2026-11-28T18:00:01.000Z']) {
    const res = await registrar(cuerpo({ capturadaEn }));
    assert.equal(res.status, 201);
    assert.equal(res.body.asistencia.estado, 'fuera_de_horario', capturadaEn);
  }
});

test('la tolerancia acepta hasta 10 min antes del inicio', async () => {
  const { cuerpo, registrar } = preparar();
  const res = await registrar(cuerpo({ capturadaEn: '2026-11-28T15:50:00.000Z' }));
  assert.equal(res.body.asistencia.estado, 'valida');
});

test('fuera_de_horario gana aunque esté fuera de rango o sin ubicación', async () => {
  const { cuerpo, registrar } = preparar();
  const tarde = '2026-11-28T19:00:00.000Z';
  const lejos = await registrar(cuerpo({ capturadaEn: tarde, ...alNorte(0.01) }));
  const sinGps = await registrar(cuerpo({ capturadaEn: tarde, ...SIN_GPS }));
  assert.equal(lejos.body.asistencia.estado, 'fuera_de_horario');
  assert.ok(lejos.body.asistencia.distancia_m > 1000, 'la distancia se calcula aunque esté fuera de horario');
  assert.equal(sinGps.body.asistencia.estado, 'fuera_de_horario');
});

test('201 sin_ubicacion: dentro del horario y sin coordenadas', async () => {
  const { cuerpo, registrar } = preparar();
  const res = await registrar(cuerpo(SIN_GPS));
  assert.equal(res.status, 201);
  assert.equal(res.body.asistencia.estado, 'sin_ubicacion');
  assert.equal(res.body.asistencia.latitud, null);
  assert.equal(res.body.asistencia.distancia_m, null);
});

test('201 fuera_de_rango: distancia − min(precision, 100) > radio', async () => {
  const { cuerpo, registrar } = preparar();
  // ~333 m con precisión 10 → 323 > 150.
  const res = await registrar(cuerpo(alNorte(0.003)));
  assert.equal(res.status, 201);
  assert.equal(res.body.asistencia.estado, 'fuera_de_rango');
});

test('la precisión se descuenta con tope de 100 m', async () => {
  const { cuerpo, registrar } = preparar();
  // ~222 m con precisión 100 → 122 ≤ 150: válida.
  const compensada = await registrar(cuerpo({ ...alNorte(0.002), precision: 100 }));
  // ~278 m con precisión 5000 → solo se descuentan 100 → 178 > 150: fuera de rango.
  const topada = await registrar(cuerpo({ ...alNorte(0.0025), precision: 5000 }));
  assert.equal(compensada.body.asistencia.estado, 'valida');
  assert.equal(topada.body.asistencia.estado, 'fuera_de_rango');
});

// --- Consultas y borrado ---

test('GET /api/asistencias?matricula= devuelve solo esa matrícula, con evento_nombre', async () => {
  const { app, db, cuerpo, registrar } = preparar();
  const otroId = insertarEvento(db, { ...EVENTO, nombre: 'Conferencia de IA' });
  const otroToken = db.prepare('SELECT token FROM eventos WHERE id = ?').get(otroId).token;

  await registrar(cuerpo({ matricula: 'UTP111', capturadaEn: '2026-11-28T16:05:00.000Z' }));
  await registrar(cuerpo({ matricula: 'UTP111', token: otroToken, capturadaEn: '2026-11-28T16:30:00.000Z' }));
  await registrar(cuerpo({ matricula: 'UTP222' }));

  const res = await request(app).get('/api/asistencias').query({ matricula: 'UTP111' });
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
  assert.ok(res.body.every((a) => a.matricula === 'UTP111'));
  assert.deepEqual(res.body.map((a) => a.evento_nombre), ['Conferencia de IA', 'Tutoría Grupal 5A']);
  assert.equal(typeof res.body[0].offline, 'boolean');
});

test('GET /api/asistencias sin matricula responde 400; matrícula sin registros devuelve []', async () => {
  const { app } = preparar();
  const r400 = await request(app).get('/api/asistencias');
  assert.equal(r400.status, 400);
  assert.equal(r400.body.error, 'datos_invalidos');

  const vacio = await request(app).get('/api/asistencias').query({ matricula: 'NADIE' });
  assert.equal(vacio.status, 200);
  assert.deepEqual(vacio.body, []);
});

test('GET /api/eventos/:id/asistencias devuelve total y lista (con PIN)', async () => {
  const { app, eventoId, cuerpo, registrar } = preparar();
  await registrar(cuerpo());
  await registrar(cuerpo());
  await registrar(cuerpo(SIN_GPS));

  const res = await request(app).get(`/api/eventos/${eventoId}/asistencias`).set('X-PIN', PIN);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 3);
  assert.equal(res.body.asistencias.length, 3);
  assert.ok(res.body.asistencias.every((a) => a.evento_id === eventoId));
});

test('GET /api/eventos/:id/asistencias responde 401 sin PIN y 404 si el evento no existe', async () => {
  const { app, eventoId } = preparar();
  const r401 = await request(app).get(`/api/eventos/${eventoId}/asistencias`);
  assert.equal(r401.status, 401);
  assert.equal(r401.body.error, 'pin_invalido');

  const r404 = await request(app).get('/api/eventos/999/asistencias').set('X-PIN', PIN);
  assert.equal(r404.status, 404);
  assert.equal(r404.body.error, 'evento_no_encontrado');
});

test('DELETE /api/asistencias/:id responde 204 y luego 404; sin PIN responde 401', async () => {
  const { app, cuerpo, registrar, contar } = preparar();
  const { body } = await registrar(cuerpo());
  const id = body.asistencia.id;

  const r401 = await request(app).delete(`/api/asistencias/${id}`);
  assert.equal(r401.status, 401);
  assert.equal(contar(), 1);

  const r204 = await request(app).delete(`/api/asistencias/${id}`).set('X-PIN', PIN);
  assert.equal(r204.status, 204);
  assert.equal(contar(), 0);

  for (const otro of [id, 'abc']) {
    const r404 = await request(app).delete(`/api/asistencias/${otro}`).set('X-PIN', PIN);
    assert.equal(r404.status, 404);
    assert.equal(r404.body.error, 'asistencia_no_encontrada');
  }
});
