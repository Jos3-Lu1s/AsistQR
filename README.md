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

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/salud` | `{ "ok": true }` si el servidor responde |
| `GET` | `/api/pin` 🔒 | Verifica el PIN del organizador: `204` si es correcto, `401 pin_invalido` si no |

### Postman

Importa `postman/AsistQR.postman_collection.json`. Ajusta las variables `baseUrl` y `pin` de la colección. Para seguir el flujo, ejecuta en orden **Crear evento → Obtener QR → Registrar asistencia**: cada paso guarda `eventoId`, `token` y `asistenciaId` para las peticiones siguientes.

Además incluye **PIN de organizador** (PIN correcto e incorrecto) y **Archivos de la PWA** (manifest, splash, app e ícono). Cada petición trae pruebas que se ven en la pestaña *Test Results*.

## La PWA

Abre `http://localhost:3000/splash.html` (es el `start_url` del manifest).

1. **Splash:** muestra el logo y el lema mientras la app se prepara (al menos 1 s) y abre la app.
2. **Perfil:** la primera vez pide quién eres. El alumno da su matrícula y nombre; el organizador, su nombre y el PIN, que se verifica con el servidor.
3. **Inicio:** saludo y accesos según el rol.

La app es una sola página (`index.html`) que cambia de vista con el hash de la URL:

| Ruta | Rol | Vista |
|---|---|---|
| `#/inicio` | Ambos | Saludo y accesos |
| `#/perfil` | Ambos | Crear o editar el perfil |
| `#/escanear` | Alumno | Escanear QR *(en construcción)* |
| `#/historial` | Alumno | Mi historial *(en construcción)* |
| `#/eventos` | Alumno | Eventos *(en construcción)* |
| `#/mis-eventos` | Organizador | Mis eventos *(en construcción)* |
| `#/nuevo-evento` | Organizador | Nuevo evento *(en construcción)* |
| `#/listas` | Organizador | Lista de asistencia *(en construcción)* |

- Sin perfil, cualquier ruta lleva a `#/perfil`.
- Una ruta que no existe o que es de otro rol lleva a `#/inicio`.
- La barra superior muestra si hay conexión (**En línea** / **Sin conexión**) y se actualiza sola.

### Datos en el dispositivo (LocalStorage)

| Clave | Contenido |
|---|---|
| `asistqr:perfil` | `{ "rol": "alumno", "nombre": "…", "matricula": "…" }` (el organizador no lleva matrícula) |
| `asistqr:pin` | PIN verificado del organizador (se borra al cambiar a alumno) |

Para empezar de cero, ejecuta `localStorage.clear()` en la consola del navegador.

### Logo e íconos

`public/img/logo.svg` es el logo fuente. Los íconos PNG del manifest se generaron una sola vez a partir de él, sin agregar dependencias al proyecto:

```bash
npx --yes sharp-cli -i public/img/logo.svg -o public/img/icono-512.png resize 512 512
npx --yes sharp-cli -i public/img/logo.svg -o public/img/icono-192.png resize 192 192
```

Vuelve a ejecutarlos si cambias el logo.

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
  rutas/          API (eventos, asistencias, pin) y vistas
  middleware/     Validación del PIN
  lib/            Token, distancia (Haversine), formato, resumen
  vistas/         Plantillas EJS
  estilos/        Entrada de Tailwind (colores de la marca y animación del splash)
public/
  splash.html     Pantalla de arranque
  index.html      App de una sola página
  manifest.json   Manifest de la PWA
  img/            Logo SVG e íconos PNG
  js/             Módulos ES del cliente (router, almacén, API, conexión)
    vistas/       Inicio, Perfil y "En construcción"
  css/            Hoja compilada por Tailwind (generada, no se sube)
test/             Pruebas (node:test + supertest)
specs/            Especificaciones por fase
```

## Pruebas

```bash
npm test
```

Usan una base de datos en memoria; no tocan `server/data/`. Cubren la API, la lista de asistencia y la entrega de los archivos de la PWA (manifest, splash e íconos). La interfaz de la PWA se prueba a mano en el navegador.

## Probar desde el celular

La cámara, el GPS y el Service Worker exigen HTTPS. Expón el servidor con [ngrok](https://ngrok.com):

```bash
ngrok http 3000
```
