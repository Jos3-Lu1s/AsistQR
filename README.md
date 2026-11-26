# AsistQR

PWA de control de asistencia con código QR y geolocalización. El organizador proyecta el QR de un evento; el alumno lo escanea y el servidor valida horario y ubicación.

**Stack:** Node.js 22 · Express 5 · SQLite (better-sqlite3) · EJS · Tailwind CSS v4

## Requisitos

- Node.js **22.9** o superior

## Instalación y uso

```bash
npm install
cp .env.example .env   # opcional: ajusta los valores
npm start              # compila el CSS y arranca en http://localhost:3000
```

Al primer arranque se crean dos eventos de prueba: uno activo y otro para mañana.

| Comando | Qué hace |
|---|---|
| `npm start` | Compila el CSS y arranca el servidor |
| `npm run dev:css` | Recompila el CSS al guardar cambios |
| `npm test` | Ejecuta las pruebas |

## Configuración (`.env`)

| Variable | Defecto | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `DB_PATH` | `server/data/asistqr.db` | Archivo SQLite (se crea solo) |
| `ORGANIZADOR_PIN` | `1234` | PIN de las acciones del organizador |
| `ZONA_HORARIA` | `America/Mexico_City` | Zona de las horas en las vistas |
| `SEED_LAT` / `SEED_LNG` | Centro de Puebla | Coordenadas de los eventos de prueba |

> Cambia `ORGANIZADOR_PIN` antes de una demo real.

## API

Todas las respuestas son JSON. Las rutas marcadas con 🔒 requieren el header `X-PIN`.

### Eventos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/eventos` | Lista de eventos, del más próximo al más lejano |
| `GET` | `/api/eventos/:id` | Detalle de un evento |
| `POST` | `/api/eventos` 🔒 | Crea un evento |
| `PUT` | `/api/eventos/:id` 🔒 | Modifica un evento |
| `DELETE` | `/api/eventos/:id` 🔒 | Elimina el evento y sus asistencias |
| `GET` | `/api/eventos/:id/qr` 🔒 | Token del evento y QR en data URL |
| `GET` | `/api/eventos/:id/asistencias` 🔒 | Asistentes del evento y total |

Cuerpo de `POST` / `PUT`:

```json
{
  "nombre": "Tutoría Grupal 5A",
  "descripcion": "",
  "lugar": "Aula 5A",
  "inicio": "2026-11-28T16:00:00Z",
  "fin": "2026-11-28T18:00:00Z",
  "latitud": 19.0414,
  "longitud": -98.2063,
  "radio_m": 100
}
```

`nombre`, `inicio`, `fin`, `latitud` y `longitud` son obligatorios. `radio_m` vale 100 por defecto.

### Asistencias

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/asistencias` | Registra una asistencia con el token del QR |
| `GET` | `/api/asistencias?matricula=X` | Historial de un alumno |
| `DELETE` | `/api/asistencias/:id` 🔒 | Elimina un registro erróneo |

Cuerpo de `POST /api/asistencias`:

```json
{
  "uuid": "generado-en-el-cliente",
  "token": "K7M3QX",
  "matricula": "UTP0123456",
  "nombre": "Ana López",
  "capturadaEn": "2026-11-28T16:05:00Z",
  "latitud": 19.0415,
  "longitud": -98.2062,
  "precision": 12,
  "offline": false
}
```

- La ubicación (`latitud`, `longitud`, `precision`) es opcional, pero va completa o no va.
- Reenviar el mismo `uuid` devuelve `200` con `duplicado: true`: los reintentos offline no duplican registros.
- Un alumno solo se registra una vez por evento (`409 ya_registrado`).

**Estado de la asistencia** (en este orden de prioridad):

| Estado | Condición |
|---|---|
| `fuera_de_horario` | Escaneo más de 10 min antes del inicio o después del fin |
| `sin_ubicacion` | No se envió ubicación |
| `fuera_de_rango` | Distancia menos precisión GPS (máx. 100 m) supera `radio_m` |
| `valida` | Cumple todo lo anterior |

El horario se valida con `capturadaEn` (hora del escaneo), no con la hora de llegada al servidor.

### Errores

```json
{ "error": "datos_invalidos", "mensaje": "...", "detalles": ["..."] }
```

| Código | `error` |
|---|---|
| 400 | `datos_invalidos` |
| 401 | `pin_invalido` |
| 404 | `evento_no_encontrado`, `token_invalido`, `asistencia_no_encontrada` |
| 409 | `ya_registrado` |

### Otros

- `GET /api/salud` → `{ "ok": true }`

### Postman

Importa `postman/AsistQR.postman_collection.json`. Ajusta las variables `baseUrl` y `pin` de la colección. Para seguir el flujo, ejecuta en orden **Crear evento → Obtener QR → Registrar asistencia**: cada paso guarda `eventoId`, `token` y `asistenciaId` para las peticiones siguientes.

## Lista de asistencia (vista del servidor)

`/eventos/:id/lista` pide el PIN del organizador y genera en el servidor la lista del evento: resumen por estado y tabla de asistentes ordenada por nombre, lista para imprimir o guardar en PDF.

## Estructura

```
server/
  index.js        Punto de entrada
  app.js          Aplicación Express
  config.js       Variables de entorno
  db.js           Esquema SQLite
  seed.js         Eventos de prueba
  rutas/          API (eventos, asistencias) y vistas
  middleware/     Validación del PIN
  lib/            Token, distancia (Haversine), formato, resumen
  vistas/         Plantillas EJS
  estilos/        Entrada de Tailwind
public/           Archivos de la PWA
test/             Pruebas (node:test + supertest)
specs/            Especificaciones por fase
```

## Pruebas

```bash
npm test
```

Usan una base de datos en memoria; no tocan `server/data/`.

## Probar desde el celular

La cámara, el GPS y el Service Worker exigen HTTPS. Expón el servidor con [ngrok](https://ngrok.com):

```bash
ngrok http 3000
```
