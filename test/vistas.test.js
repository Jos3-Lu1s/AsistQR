const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { crearAppPrueba, PIN } = require('./helpers');
const { insertarEvento } = require('../server/db');

// Evento de 10:00 a 12:00 en Ciudad de México (16:00–18:00 UTC).
const EVENTO = {
  nombre: 'Tutoría Grupal 5A',
  lugar: 'Aula 5A',
  inicio: '2026-11-28T16:00:00.000Z',
  fin: '2026-11-28T18:00:00.000Z',
  latitud: 19.04,
  longitud: -98.2,
  radio_m: 150,
};

/** Inserta una asistencia directo en la BD con valores por defecto sobrescribibles. */
function insertarAsistencia(db, eventoId, datos = {}) {
  const fila = {
    uuid: `uuid-${Math.random()}`,
    evento_id: eventoId,
    matricula: 'UTP0001',
    nombre: 'Ana López',
    latitud: 19.04,
    longitud: -98.2,
    precision_m: 20,
    distancia_m: 12.4,
    capturada_en: '2026-11-28T16:05:00.000Z',
    recibida_en: '2026-11-28T16:05:02.000Z',
    offline: 0,
    estado: 'valida',
    ...datos,
  };
  db.prepare(`
    INSERT INTO asistencias (uuid, evento_id, matricula, nombre, latitud, longitud, precision_m,
                             distancia_m, capturada_en, recibida_en, offline, estado)
    VALUES (@uuid, @evento_id, @matricula, @nombre, @latitud, @longitud, @precision_m,
            @distancia_m, @capturada_en, @recibida_en, @offline, @estado)
  `).run(fila);
}

/** App con un evento; devuelve su id y su token. */
function preparar() {
  const { app, db } = crearAppPrueba();
  const eventoId = insertarEvento(db, EVENTO);
  const { token } = db.prepare('SELECT token FROM eventos WHERE id = ?').get(eventoId);
  return { app, db, eventoId, token };
}

// --- Formulario de PIN ---

test('GET /eventos/:id/lista muestra el formulario de PIN sin datos de alumnos', async () => {
  const { app, db, eventoId, token } = preparar();
  insertarAsistencia(db, eventoId, { matricula: 'UTP7777', nombre: 'Rosa Secreta' });

  const res = await request(app).get(`/eventos/${eventoId}/lista`);
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.match(res.text, /<form method="post"/);
  assert.match(res.text, /name="pin"/);
  assert.ok(res.text.includes(EVENTO.nombre));
  assert.ok(!res.text.includes('UTP7777'), 'el formulario no debe mostrar matrículas');
  assert.ok(!res.text.includes('Rosa Secreta'), 'el formulario no debe mostrar nombres');
  assert.ok(!res.text.includes(token), 'el formulario no debe mostrar el token');
});

test('GET /eventos/:id/lista de un evento inexistente responde 404 en HTML', async () => {
  const { app } = preparar();
  for (const id of ['999', 'abc']) {
    const res = await request(app).get(`/eventos/${id}/lista`);
    assert.equal(res.status, 404);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.ok(res.text.includes('Evento no encontrado'));
  }
});

// --- POST con PIN ---

test('POST /eventos/:id/lista con PIN incorrecto o vacío responde 401 sin datos de alumnos', async () => {
  const { app, db, eventoId } = preparar();
  insertarAsistencia(db, eventoId, { matricula: 'UTP7777', nombre: 'Rosa Secreta' });

  for (const cuerpo of [{ pin: '0000' }, { pin: '' }, {}]) {
    const res = await request(app).post(`/eventos/${eventoId}/lista`).type('form').send(cuerpo);
    assert.equal(res.status, 401, JSON.stringify(cuerpo));
    assert.match(res.text, /PIN incorrecto/);
    assert.match(res.text, /name="pin"/);
    assert.ok(!res.text.includes('UTP7777'));
    assert.ok(!res.text.includes('Rosa Secreta'));
  }
});

test('POST /eventos/:id/lista de un evento inexistente responde 404 en HTML', async () => {
  const { app } = preparar();
  const res = await request(app).post('/eventos/999/lista').type('form').send({ pin: PIN });
  assert.equal(res.status, 404);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.ok(res.text.includes('Evento no encontrado'));
});

test('POST /eventos/:id/lista con PIN correcto muestra el encabezado del evento', async () => {
  const { app, eventoId, token } = preparar();
  const res = await request(app).post(`/eventos/${eventoId}/lista`).type('form').send({ pin: PIN });

  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.ok(res.text.includes(EVENTO.nombre));
  assert.ok(res.text.includes(EVENTO.lugar));
  assert.ok(res.text.includes('28/11/2026, 10:00 – 12:00'), 'horario en hora de Ciudad de México');
  assert.ok(res.text.includes('150 m'));
  assert.match(res.text, /Generada el \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);
  assert.ok(!res.text.includes(token), 'la lista no debe mostrar el token');
});

// --- Tabla, totales e impresión ---

/** Pide la lista con el PIN correcto. */
const pedirLista = (app, eventoId) =>
  request(app).post(`/eventos/${eventoId}/lista`).type('form').send({ pin: PIN });

/** Lee del HTML el número de una tarjeta de totales. */
function leerTotal(html, clave) {
  const coincidencia = html.match(new RegExp(`data-resumen="${clave}">([0-9]+)<`));
  return coincidencia && Number(coincidencia[1]);
}

test('la lista trae nombres, matrículas, estados y totales escritos en el HTML', async () => {
  const { app, db, eventoId } = preparar();
  insertarAsistencia(db, eventoId, { matricula: 'UTP0001', nombre: 'Ana López' });
  insertarAsistencia(db, eventoId, { matricula: 'UTP0002', nombre: 'Bruno Díaz', offline: 1 });
  insertarAsistencia(db, eventoId, { matricula: 'UTP0003', nombre: 'Carla Ruiz', estado: 'fuera_de_rango', distancia_m: 480 });
  insertarAsistencia(db, eventoId, { matricula: 'UTP0004', nombre: 'Diego Paz', estado: 'fuera_de_horario', offline: 1 });
  insertarAsistencia(db, eventoId, {
    matricula: 'UTP0005', nombre: 'Elena Mora', estado: 'sin_ubicacion',
    latitud: null, longitud: null, precision_m: null, distancia_m: null,
  });

  const res = await pedirLista(app, eventoId);
  assert.equal(res.status, 200);
  for (let i = 1; i <= 5; i++) assert.ok(res.text.includes(`UTP000${i}`));
  for (const nombre of ['Ana López', 'Bruno Díaz', 'Carla Ruiz', 'Diego Paz', 'Elena Mora']) {
    assert.ok(res.text.includes(nombre), nombre);
  }
  for (const etiqueta of ['Válida', 'Fuera de rango', 'Fuera de horario', 'Sin ubicación']) {
    assert.ok(res.text.includes(etiqueta), etiqueta);
  }

  assert.equal(leerTotal(res.text, 'total'), 5);
  assert.equal(leerTotal(res.text, 'valida'), 2);
  assert.equal(leerTotal(res.text, 'fuera_de_rango'), 1);
  assert.equal(leerTotal(res.text, 'fuera_de_horario'), 1);
  assert.equal(leerTotal(res.text, 'sin_ubicacion'), 1);
  assert.equal(leerTotal(res.text, 'offline'), 2);
  assert.equal((res.text.match(/data-offline/g) || []).length, 2, 'marca visible en cada registro offline');
});

test('las horas salen en hora de Ciudad de México y sin ubicación se muestra —', async () => {
  const { app, db, eventoId } = preparar();
  insertarAsistencia(db, eventoId, {
    capturada_en: '2026-11-28T16:05:00.000Z',
    recibida_en: '2026-11-28T17:30:40.000Z',
    estado: 'sin_ubicacion',
    latitud: null, longitud: null, precision_m: null, distancia_m: null,
  });

  const res = await pedirLista(app, eventoId);
  assert.ok(res.text.includes('10:05:00'), 'hora de escaneo');
  assert.ok(res.text.includes('11:30:40'), 'hora de recepción');
  const fila = res.text.slice(res.text.indexOf('<tbody'), res.text.indexOf('</tbody>'));
  assert.equal((fila.match(/>—</g) || []).length, 3, 'distancia, precisión y offline en —');
});

test('los asistentes van en orden alfabético considerando acentos y mayúsculas', async () => {
  const { app, db, eventoId } = preparar();
  const nombres = ['Zoe Ortiz', 'beatriz Soto', 'Álvaro Gil', 'Carlos Núñez'];
  nombres.forEach((nombre, i) => insertarAsistencia(db, eventoId, { matricula: `UTP${i}`, nombre }));

  const res = await pedirLista(app, eventoId);
  const posiciones = ['Álvaro Gil', 'beatriz Soto', 'Carlos Núñez', 'Zoe Ortiz'].map((n) => res.text.indexOf(n));
  assert.ok(posiciones.every((p) => p > 0));
  assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones);
});

test('un nombre con <script> sale escapado', async () => {
  const { app, db, eventoId } = preparar();
  insertarAsistencia(db, eventoId, { nombre: '<script>alert(1)</script>' });

  const res = await pedirLista(app, eventoId);
  assert.ok(res.text.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!res.text.includes('<script>alert(1)</script>'));
});

test('un evento sin asistencias muestra el mensaje y todos los totales en 0', async () => {
  const { app, eventoId } = preparar();
  const res = await pedirLista(app, eventoId);

  assert.ok(res.text.includes('Sin asistentes registrados'));
  assert.ok(!res.text.includes('<table'));
  for (const clave of ['total', 'valida', 'fuera_de_rango', 'fuera_de_horario', 'sin_ubicacion', 'offline']) {
    assert.equal(leerTotal(res.text, clave), 0, clave);
  }
});

test('la lista se envía con Cache-Control: no-store y botón Imprimir oculto al imprimir', async () => {
  const { app, eventoId } = preparar();
  const res = await pedirLista(app, eventoId);

  assert.equal(res.headers['cache-control'], 'no-store');
  assert.match(res.text, /onclick="window\.print\(\)"[^>]*print:hidden/);
});
