# SPEC 01 — Servidor, base de datos y API REST

> **Estado:** Aprobado
> **Depende de:** —
> **Fecha:** 2026-11-26
> **Objetivo:** Levantar un servidor Node.js + Express con SQLite que exponga la API REST de eventos y asistencias, con todas sus validaciones, y que cree datos de prueba al primer arranque.

---

## Por qué existe esta spec

Es el primer bloque del cronograma (`Planeacion.md` §12, sábado en la mañana). Todo lo demás depende de esta API: la PWA, la cola offline, la vista SSR y las notificaciones. La vista SSR, que en el cronograma va en el mismo bloque, se separó a la SPEC 02 para que esta spec quede verificable por sí sola con `npm test`.

---

## Alcance

**Dentro:**

- Proyecto Node.js (CommonJS) con `package.json`, scripts `start` y `test`, `.gitignore` y `.env.example`.
- Servidor Express que sirve `public/` como estáticos (con un `public/index.html` provisional) y la API bajo `/api`.
- Base de datos SQLite con `better-sqlite3`: tablas `eventos` y `asistencias`, creadas al arrancar si no existen.
- Datos de prueba ("Tutoría Grupal 5A" y "Conferencia de IA"), solo si la tabla `eventos` está vacía.
- Middleware de PIN: header `X-PIN` comparado contra la variable de entorno `ORGANIZADOR_PIN` (por defecto `1234`).
- Endpoints de eventos: listar, consultar uno, crear, modificar, eliminar y obtener el QR (token en texto e imagen en data URL).
- Endpoints de asistencias: registrar (con las validaciones de §5 de la planeación), historial por matrícula, asistentes de un evento y eliminar un registro.
- Generación del token (6 caracteres) y del QR con la librería `qrcode`.
- Cálculo de distancia (fórmula de Haversine) en el servidor.
- Tests automáticos con `node:test` y `supertest` contra una BD en memoria.

**Fuera de alcance (para specs futuras):**

- Vista SSR `/eventos/:id/lista` con EJS → SPEC 02.
- Toda la interfaz de la PWA: splash, home, vistas, estilos, manifest e íconos.
- Service Worker, cachés, cola offline y sincronización.
- Notificaciones (locales y push).
- Escáner QR en el cliente (`html5-qrcode`), geolocalización y vibración.
- Exposición por HTTPS con ngrok.
- Autenticación de usuarios o una tabla de alumnos.

---

## Modelo de datos

### Esquema SQLite (`server/db.js`)

```sql
CREATE TABLE IF NOT EXISTS eventos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre       TEXT    NOT NULL,
  descripcion  TEXT    NOT NULL DEFAULT '',
  lugar        TEXT    NOT NULL DEFAULT '',
  inicio       TEXT    NOT NULL,            -- ISO 8601 UTC
  fin          TEXT    NOT NULL,            -- ISO 8601 UTC
  latitud      REAL    NOT NULL,
  longitud     REAL    NOT NULL,
  radio_m      INTEGER NOT NULL DEFAULT 100,
  token        TEXT    NOT NULL UNIQUE,     -- 6 caracteres; nunca sale en listados
  creado_en    TEXT    NOT NULL             -- ISO 8601 UTC
);

CREATE TABLE IF NOT EXISTS asistencias (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid         TEXT    NOT NULL UNIQUE,
  evento_id    INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  matricula    TEXT    NOT NULL,
  nombre       TEXT    NOT NULL,
  latitud      REAL,                        -- NULL si el alumno negó el GPS
  longitud     REAL,
  precision_m  REAL,
  distancia_m  REAL,                        -- calculada por el servidor; NULL sin ubicación
  capturada_en TEXT    NOT NULL,            -- hora del escaneo (ISO 8601 UTC)
  recibida_en  TEXT    NOT NULL,            -- hora de llegada al servidor (ISO 8601 UTC)
  offline      INTEGER NOT NULL DEFAULT 0,  -- 1 si llegó por sincronización
  estado       TEXT    NOT NULL CHECK (estado IN
                 ('valida','fuera_de_rango','fuera_de_horario','sin_ubicacion')),
  UNIQUE (evento_id, matricula)
);
```

- La conexión ejecuta `PRAGMA foreign_keys = ON` para que el `ON DELETE CASCADE` funcione.
- Archivo de BD: `server/data/asistqr.db`, configurable con `DB_PATH`. Los tests usan `:memory:`.

### Token

- 6 caracteres del alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, sin `0/O/1/I` para evitar confusiones.
- Se genera con `crypto.randomInt`. Si choca con el `UNIQUE`, se vuelve a generar.
- Se compara sin distinguir mayúsculas y minúsculas (se normaliza con `toUpperCase()` y `trim()`).

### Configuración (`server/config.js`)

| Variable | Valor por defecto | Uso |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `DB_PATH` | `server/data/asistqr.db` | Ruta del archivo SQLite |
| `ORGANIZADOR_PIN` | `1234` | PIN que se espera en `X-PIN` |

`.env` se carga con `node --env-file-if-exists=.env`, que es nativo en Node 22.9 o superior, así que no hace falta `dotenv`.

### Contrato de la API

Todos los cuerpos van en JSON. Los errores tienen la forma `{ "error": "<codigo>", "mensaje": "<texto legible>" }`.

| Método | Ruta | PIN | Respuesta correcta | Errores |
|---|---|---|---|---|
| GET | `/api/eventos` | No | 200 `[evento]` sin `token` | — |
| GET | `/api/eventos/:id` | No | 200 `evento` sin `token` | 404 `evento_no_encontrado` |
| POST | `/api/eventos` | Sí | 201 `evento` sin `token` | 400 `datos_invalidos`, 401 `pin_invalido` |
| PUT | `/api/eventos/:id` | Sí | 200 `evento` sin `token` | 400, 401, 404 |
| DELETE | `/api/eventos/:id` | Sí | 204 (borra sus asistencias en cascada) | 401, 404 |
| GET | `/api/eventos/:id/qr` | Sí | 200 `{ token, qr: "data:image/png;base64,..." }` | 401, 404 |
| GET | `/api/eventos/:id/asistencias` | Sí | 200 `{ total, asistencias: [asistencia] }` | 401, 404 |
| POST | `/api/asistencias` | No | 201 nueva, o 200 si el `uuid` ya existía | 400, 404 `token_invalido`, 409 `ya_registrado` |
| GET | `/api/asistencias?matricula=X` | No | 200 `[asistencia + evento_nombre]` | 400 si falta `matricula` |
| DELETE | `/api/asistencias/:id` | Sí | 204 | 401, 404 `asistencia_no_encontrada` |

**Cuerpo de evento (POST/PUT):** `nombre`, `inicio`, `fin`, `latitud` y `longitud` son obligatorios. `descripcion`, `lugar` y `radio_m` son opcionales (`radio_m` vale 100 por defecto). El evento es válido si `fin > inicio`, `latitud ∈ [-90, 90]`, `longitud ∈ [-180, 180]` y `radio_m > 0`. PUT reemplaza los campos editables y no regenera el token.

**Cuerpo de asistencia (POST):**

```js
{
  uuid: "b3c1...",              // obligatorio, lo genera el celular
  token: "K7P2QX",              // obligatorio
  matricula: "UTP0123456",      // obligatorio
  nombre: "Ana López",          // obligatorio
  latitud: 19.04, longitud: -98.2, precision: 25,   // opcionales (los tres o ninguno)
  capturadaEn: "2026-11-28T16:05:00.000Z",          // obligatorio, ISO 8601
  offline: false                // opcional
}
```

**Orden de evaluación al registrar una asistencia:**

1. Se valida el cuerpo. Si falla → 400 `datos_invalidos`.
2. Si el `uuid` ya existe → 200 `{ asistencia, duplicado: true }` sin insertar nada (idempotencia).
3. Se busca el evento por `token`. Si no existe → 404 `token_invalido`.
4. Si ya existe un registro con ese `(evento_id, matricula)` → 409 `{ error: "ya_registrado", asistencia }`.
5. Se calcula `distancia_m` si viene ubicación. Luego se asigna `estado`, y gana el primero que se cumpla:
   - `fuera_de_horario` si `capturadaEn < inicio − 10 min` o `capturadaEn > fin`.
   - `sin_ubicacion` si no viene ubicación.
   - `fuera_de_rango` si `distancia_m − min(precision, 100) > radio_m`.
   - `valida` en cualquier otro caso.
6. Se inserta con `recibida_en = ahora` → 201 `{ asistencia, evento: { id, nombre } }`.

### Datos de prueba (`server/seed.js`)

Solo se insertan si `SELECT COUNT(*) FROM eventos` devuelve 0:

- **"Tutoría Grupal 5A"**: `inicio = ahora − 30 min`, `fin = ahora + 2 h`, `radio_m = 150`.
- **"Conferencia de IA"**: `inicio = mañana a las 16:00 UTC` (10:00 en Puebla), `fin = inicio + 2 h`, `radio_m = 150`.
- Coordenadas: `SEED_LAT` y `SEED_LNG` si están definidas. Si no, se usan coordenadas aproximadas de Puebla escritas en `seed.js`. Antes de la demo hay que ajustarlas (`Planeacion.md` §8).

---

## Plan de implementación

1. **Esqueleto del proyecto.** Crear `package.json` (CommonJS, con los scripts `start: node --env-file-if-exists=.env server/index.js` y `test: node --test`), `.gitignore` (`node_modules/`, `.env`, `server/data/*.db`) y `.env.example`. Instalar `express`, `better-sqlite3` y `qrcode`, y `supertest` como dependencia de desarrollo. Prueba manual: `npm install` termina sin errores.
2. **Servidor mínimo.** Crear `server/config.js`, `server/app.js` (función `crearApp({ db })` que monta `express.json()`, `express.static('public')` y un `GET /api/salud` → `{ ok: true }`) y `server/index.js` (abre la BD y hace `listen`). Crear `public/index.html` provisional. Prueba manual: `npm start` y abrir `http://localhost:3000/api/salud`.
3. **Base de datos.** Crear `server/db.js` con `abrirBD(ruta)`, que crea la carpeta si no existe, activa `foreign_keys` y ejecuta el esquema. Conectarlo en `index.js`. Prueba manual: tras arrancar existe `server/data/asistqr.db` con las dos tablas.
4. **Utilidades.** Crear `server/lib/token.js` (`generarToken()`) y `server/lib/distancia.js` (`distanciaMetros(lat1, lng1, lat2, lng2)` con Haversine). Escribir `test/lib.test.js`: el token mide 6 y solo usa el alfabeto permitido, y la distancia entre dos puntos conocidos es correcta con ±1 % de margen.
5. **Datos de prueba.** Crear `server/seed.js` con `sembrar(db)` y llamarlo desde `index.js` después de `abrirBD`. Prueba manual: al primer arranque hay 2 eventos, y al segundo arranque sigue habiendo 2.
6. **Middleware de PIN.** Crear `server/middleware/pin.js` (`requierePin`), que compara `req.get('X-PIN')` con `config.ORGANIZADOR_PIN` y responde 401 `pin_invalido` si no coinciden. Crear `test/helpers.js` con `crearAppPrueba()` (BD `:memory:` y app lista).
7. **Eventos: lectura.** Crear `server/rutas/eventos.js` con `GET /api/eventos` y `GET /api/eventos/:id`, que nunca seleccionan `token`. Montarlo en `app.js`. Escribir los tests de lectura y de 404 en `test/eventos.test.js`.
8. **Eventos: escritura.** Agregar `POST`, `PUT` y `DELETE` con `requierePin` y validación del cuerpo. Tests: 401 sin PIN, 400 con datos inválidos, 201/200/204 en el caso correcto, y que el borrado elimine en cascada las asistencias.
9. **Eventos: QR.** Agregar `GET /api/eventos/:id/qr` con `requierePin`, que genera la imagen con `QRCode.toDataURL(token)`. Test: la respuesta tiene `token` de 6 caracteres y un `qr` que empieza con `data:image/png;base64,`.
10. **Asistencias: registro.** Crear `server/rutas/asistencias.js` con `POST /api/asistencias` siguiendo los 6 pasos del orden de evaluación. Tests en `test/asistencias.test.js`, un caso por resultado: 400, 200 por uuid repetido, 404 por token inválido, 409 por ya registrado, y 201 con cada uno de los 4 estados.
11. **Asistencias: consultas y borrado.** Agregar `GET /api/asistencias?matricula=`, `GET /api/eventos/:id/asistencias` (PIN) y `DELETE /api/asistencias/:id` (PIN). Tests: el historial solo trae la matrícula pedida e incluye `evento_nombre`, el endpoint del evento devuelve `total` y el borrado responde 204 y luego 404.

---

## Criterios de aceptación

- [ ] `npm install` y `npm start` funcionan en Windows con Node 22.12 sin compilar nada a mano.
- [ ] `GET http://localhost:3000/` sirve `public/index.html`.
- [ ] Al primer arranque se crea `server/data/asistqr.db` con las tablas `eventos` y `asistencias`.
- [ ] Al primer arranque existen exactamente 2 eventos de prueba. Al reiniciar el servidor siguen siendo 2.
- [ ] Ninguna respuesta de `GET /api/eventos` ni de `GET /api/eventos/:id` contiene la propiedad `token`.
- [ ] Toda petición a un endpoint con PIN sin el header `X-PIN` correcto responde 401 `pin_invalido`.
- [ ] Crear, modificar y eliminar un evento con PIN responde 201, 200 y 204, respectivamente.
- [ ] Eliminar un evento elimina también sus asistencias.
- [ ] `GET /api/eventos/:id/qr` devuelve un token de 6 caracteres del alfabeto permitido y un data URL PNG.
- [ ] Registrar una asistencia con token en minúsculas funciona igual que con mayúsculas.
- [ ] Repetir un POST con el mismo `uuid` responde 200 `duplicado: true` y no crea una fila nueva.
- [ ] Un token inexistente responde 404 `token_invalido`.
- [ ] La misma matrícula en el mismo evento con otro `uuid` responde 409 `ya_registrado` e incluye el registro existente.
- [ ] Una captura 11 minutos antes del inicio o después del fin queda como `fuera_de_horario`.
- [ ] Un registro sin ubicación dentro del horario queda como `sin_ubicacion`.
- [ ] Un registro a más de `radio_m + min(precision, 100)` metros queda como `fuera_de_rango`.
- [ ] Un registro dentro del horario y del radio queda como `valida`.
- [ ] `GET /api/asistencias?matricula=X` devuelve solo registros de X, cada uno con `evento_nombre`.
- [ ] `npm test` pasa todos los tests sin errores.

---

## Decisiones

- **Sí:** separar la vista SSR en la SPEC 02. Mantiene esta spec chica y verificable solo con tests.
- **Sí:** `better-sqlite3`. Su API síncrona es simple y tiene binarios precompilados para Windows y Node 22.
- **No:** `node:sqlite`. En Node 22.12 necesita `--experimental-sqlite`.
- **No:** `sqlite3`. Sus callbacks hacen el código más verboso sin ningún beneficio en este caso.
- **Sí:** PIN en la variable de entorno `ORGANIZADOR_PIN`, enviado en el header `X-PIN`. Se puede cambiar sin tocar código, y la validación ocurre en el servidor.
- **No:** PIN fijo en el código ni un PIN por evento. El primero es rígido. El segundo agrega una columna y complica el flujo.
- **Sí:** token corto de 6 caracteres, y el QR contiene solo el token. Se puede escribir a mano si se niega la cámara, y el servidor encuentra el evento con él.
- **No:** QR con prefijo e id ni QR con URL. Son incómodos para escribirlos a mano.
- **Sí:** el endpoint QR devuelve JSON `{ token, qr }`. El organizador puede dictar el token, y el token nunca aparece en endpoints públicos.
- **Sí:** CommonJS con la estructura `server/` + `public/`. Es el estilo más común en los ejemplos de Express y deja `public/` listo para la PWA.
- **Sí:** `crearApp({ db })` separado de `index.js`. Permite que los tests usen una BD `:memory:` sin abrir puertos.
- **Sí:** tests automáticos con `node:test` y `supertest`. `node:test` es nativo y `npm test` sirve como criterio de aceptación objetivo.
- **No:** archivo `.http` manual en esta spec. Las capturas de la evidencia 6 se pueden tomar después.
- **Sí:** cuarto estado `sin_ubicacion`. Cumple lo de "queda marcado" y permite que la SSR lo cuente por separado.
- **Sí:** los registros fuera de rango u horario se guardan con su estado (201). El organizador los ve y decide, y la SSR los cuenta.
- **Sí:** `fuera_de_horario` tiene prioridad sobre los demás estados. Si se escaneó fuera de horario, la ubicación ya no importa.
- **Sí:** la precisión del GPS se descuenta de la distancia con un tope de 100 m. Compensa el GPS impreciso en interiores sin que una precisión enorme valide cualquier ubicación.
- **Sí:** se revisa el `uuid` antes que el token. Un reintento de sincronización siempre recibe éxito, aunque el evento haya cambiado después.
- **Sí:** 409 con el registro existente cuando la matrícula ya está registrada. El cliente lo saca de la cola y puede informar al alumno.
- **Sí:** `ON DELETE CASCADE`. Es simple, y el borrado ya está protegido con PIN.
- **No:** bloquear el borrado si hay asistencias. Le agrega un paso extra al organizador sin aportar nada.
- **Sí:** fechas en ISO 8601 UTC. Las comparaciones son confiables, y el cliente convierte a hora local.
- **Sí:** `--env-file-if-exists` nativo de Node. Evita la dependencia `dotenv`.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `better-sqlite3` no encuentra un binario precompilado e intenta compilar | Usar Node 22 LTS x64. Si falla, instalar las "Desktop development with C++" build tools o actualizar Node a la última 22.x. |
| El reloj del celular está mal y `capturadaEn` queda fuera de horario | Se acepta como limitación. El organizador puede eliminar y volver a registrar, y el riesgo se documenta en el PDF. |
| Las coordenadas de los datos de prueba no coinciden con el lugar de la demo | `SEED_LAT` y `SEED_LNG` en `.env`, o editar el evento por la API antes de la demo. |
| El PIN por defecto `1234` queda en producción | `.env.example` lo marca como valor a cambiar. Para una demo académica es aceptable. |

---

## Lo que **no** está en esta spec

- Vista SSR de la lista de asistencia (SPEC 02).
- Interfaz de la PWA, manifest e íconos.
- Service Worker, cachés, cola offline y sincronización.
- Notificaciones.
- Cámara, geolocalización y vibración en el cliente.
- ngrok y las pruebas en un celular real.
- Login de usuarios o una tabla de alumnos.

Cada uno de estos puntos, si se hace, va en su propia spec.
