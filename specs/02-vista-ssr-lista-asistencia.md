# SPEC 02 — Vista SSR de la lista de asistencia

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-11-26
> **Objetivo:** Generar en el servidor, con EJS y Tailwind, la lista de asistencia de un evento protegida con PIN, con totales calculados y lista para imprimir.

---

## Por qué existe esta spec

La rúbrica pide una vista generada en el servidor con procesamiento de datos. La lista de asistencia es el documento "oficial" del evento: tiene que llegar completa en el HTML, sin depender del JavaScript del cliente, y poder imprimirse tal cual. Se separó de la SPEC 01 para que esa spec quedara verificable solo con la API.

Esta spec también **cambia una decisión de la planeación**: en lugar de CSS puro, el proyecto usará **Tailwind CSS v4** compilado con su CLI. Se configura aquí una sola vez, y la PWA de las specs siguientes usará la misma hoja de estilos.

---

## Alcance

**Dentro:**

- Tailwind CSS v4 con `@tailwindcss/cli`. La entrada es `server/estilos/entrada.css` y la salida `public/css/estilos.css`, que se genera y está en `.gitignore`.
- Scripts `build:css`, `dev:css` (con `--watch`) y `prestart`, que compila el CSS antes de `npm start`.
- Motor de plantillas EJS configurado en Express, con las vistas en `server/vistas/`.
- `GET /eventos/:id/lista`: formulario de PIN.
- `POST /eventos/:id/lista`: valida el PIN y genera la lista completa.
- Con PIN incorrecto se vuelve a mostrar el formulario con un error (401). Si el evento no existe se muestra una página de error en HTML (404).
- Cálculos en el servidor: total, válidas, fuera de rango, fuera de horario, sin ubicación y llegadas offline.
- Tabla con matrícula, nombre, hora de escaneo, hora de recepción, estado, distancia, precisión GPS y marca offline, en orden alfabético por nombre.
- Encabezado con los datos del evento y la fecha y hora de generación.
- Horas formateadas en la zona `ZONA_HORARIA` (por defecto `America/Mexico_City`).
- Botón "Imprimir" (`window.print()`) y estilos de impresión con las variantes `print:` de Tailwind.
- Tests con `supertest` sobre el HTML generado.

**Fuera de alcance (para specs futuras):**

- Interfaz de la PWA (splash, home, vistas del cliente), incluido el enlace a esta lista desde la app.
- Aplicar Tailwind a `public/index.html`, la página provisional.
- Página offline y caché del Service Worker para esta vista.
- Exportar a PDF desde el servidor. Se hace con "Guardar como PDF" en el diálogo de impresión del navegador.
- Recordar el PIN entre visitas (cookies o sesión).
- Editar o borrar asistencias desde esta vista.

---

## Modelo de datos

Esta spec no agrega tablas ni columnas. Lee `eventos` y `asistencias` tal como las define la SPEC 01.

### Configuración nueva (`server/config.js`)

| Variable | Valor por defecto | Uso |
|---|---|---|
| `ZONA_HORARIA` | `America/Mexico_City` | Zona en la que se formatean las horas de la vista |

### Datos que recibe la plantilla `lista.ejs`

```js
{
  evento: { id, nombre, descripcion, lugar, inicio, fin, radio_m },  // sin token
  horario: '28/11/2026, 10:00 – 12:00',      // ya formateado
  generadaEn: '26/11/2026, 16:45',           // ya formateado
  resumen: {
    total: 12,
    valida: 9,
    fuera_de_rango: 1,
    fuera_de_horario: 1,
    sin_ubicacion: 1,
    offline: 3,
  },
  asistencias: [
    {
      matricula, nombre, estado, offline,     // offline: booleano
      capturada: '10:05:12',                  // ya formateado
      recibida: '11:30:40',                   // ya formateado
      distancia: '35 m' | '—',
      precision: '20 m' | '—',
    },
  ],
}
```

- Los cálculos y el formato se hacen en el servidor. La plantilla solo pinta lo que recibe.
- El orden alfabético se hace en JavaScript con `localeCompare(…, 'es', { sensitivity: 'base' })`, para que los acentos y las mayúsculas ordenen bien. `ORDER BY` de SQLite no maneja acentos.

### Etiquetas y colores por estado

| `estado` | Etiqueta | Color |
|---|---|---|
| `valida` | Válida | Verde |
| `fuera_de_rango` | Fuera de rango | Rojo |
| `fuera_de_horario` | Fuera de horario | Rojo |
| `sin_ubicacion` | Sin ubicación | Ámbar |

### Rutas nuevas

| Método | Ruta | Respuesta correcta | Errores |
|---|---|---|---|
| GET | `/eventos/:id/lista` | 200, HTML con el formulario de PIN | 404, HTML `error.ejs` |
| POST | `/eventos/:id/lista` (cuerpo `pin` en `application/x-www-form-urlencoded`) | 200, HTML con la lista | 401, formulario con "PIN incorrecto"; 404, HTML `error.ejs` |

- La respuesta con la lista lleva `Cache-Control: no-store`.

### Archivos

```
server/
  estilos/entrada.css        ← @import "tailwindcss" y @source de vistas y public
  lib/formato.js             ← formatearFechaHora, formatearHora, formatearMetros
  lib/resumen.js             ← calcularResumen(asistencias)
  rutas/vistas.js            ← GET y POST /eventos/:id/lista
  vistas/
    parciales/encabezado.ejs ← <!doctype>, <head> con estilos.css, apertura de <body>
    parciales/pie.ejs        ← cierre de <body> y </html>
    pin.ejs                  ← formulario de PIN (con mensaje de error opcional)
    lista.ejs                ← encabezado del evento, totales y tabla
    error.ejs                ← página de error (título + mensaje)
public/css/estilos.css       ← generado por build:css (ignorado por git)
test/vistas.test.js
```

---

## Plan de implementación

1. **Tailwind.**
   - Instalar `tailwindcss` y `@tailwindcss/cli` como dependencias de desarrollo.
   - Crear `server/estilos/entrada.css` con `@import "tailwindcss";` y `@source` apuntando a `server/vistas` y `public`.
   - Agregar los scripts `build:css` (`tailwindcss -i server/estilos/entrada.css -o public/css/estilos.css --minify`), `dev:css` (lo mismo con `--watch`) y `prestart` (`npm run build:css`).
   - Agregar `public/css/estilos.css` a `.gitignore`.
   - Prueba manual: `npm run build:css` genera el archivo sin errores.
2. **Formato.**
   - Agregar `ZONA_HORARIA` a `server/config.js`.
   - Crear `server/lib/formato.js` con `formatearFechaHora(iso)`, `formatearHora(iso)` (con segundos) y `formatearMetros(valor)` (redondea y devuelve `'—'` si es `null`). Usa `Intl.DateTimeFormat('es-MX', { timeZone })`.
   - Agregar tests a `test/lib.test.js`: una fecha UTC conocida se formatea en hora de Ciudad de México, y `formatearMetros(null)` devuelve `'—'`.
3. **Resumen.**
   - Crear `server/lib/resumen.js` con `calcularResumen(asistencias)`, que devuelve los 6 totales del modelo de datos.
   - Agregar tests a `test/lib.test.js`: una lista vacía da todos los totales en 0, y una lista mixta da los conteos correctos.
4. **EJS y página de error.**
   - Instalar `ejs`.
   - En `server/app.js`: `app.set('view engine', 'ejs')`, `app.set('views', …/server/vistas)` y `express.urlencoded({ extended: false })`.
   - Crear `parciales/encabezado.ejs`, `parciales/pie.ejs` y `error.ejs`.
   - Crear `server/rutas/vistas.js` con `GET /eventos/:id/lista`: responde 404 con `error.ejs` si el evento no existe, y si existe, el formulario `pin.ejs` con el nombre del evento. Montarlo en `app.js` en `/eventos`.
   - Tests en `test/vistas.test.js`: el GET de un evento existente responde 200 HTML con un `<form method="post">` y un campo `pin`, y el de uno inexistente responde 404 HTML.
5. **POST con PIN.**
   - Agregar `POST /eventos/:id/lista`. Con PIN incorrecto o ausente responde 401 y vuelve a mostrar `pin.ejs` con "PIN incorrecto". Con evento inexistente responde 404 con `error.ejs`. Con PIN correcto genera `lista.ejs` con el encabezado del evento (nombre, lugar, horario y radio) y la fecha de generación.
   - Tests: 401 sin datos de alumnos en el HTML, 404, y 200 con el nombre del evento.
6. **Tabla, totales e impresión.**
   - Completar el POST: leer las asistencias, ordenarlas por nombre, formatear cada fila, calcular el resumen y enviar `Cache-Control: no-store`.
   - Completar `lista.ejs`: tarjetas de totales, tabla con las 8 columnas, etiquetas de color por estado, marca offline, mensaje "Sin asistentes registrados" si la lista está vacía, y botón "Imprimir" con `print:hidden`.
   - Tests: el HTML contiene los nombres y las matrículas; los totales coinciden; el orden es alfabético con acentos (por ejemplo, "Álvaro" antes que "Beatriz"); un nombre con `<script>` sale escapado; la lista vacía muestra el mensaje; el header `Cache-Control` es `no-store`.

---

## Criterios de aceptación

- [x] `npm run build:css` genera `public/css/estilos.css` sin errores en Windows con Node 22.12.
- [x] `npm start` compila el CSS antes de arrancar (`prestart`).
- [x] `public/css/estilos.css` no aparece en `git status` (está en `.gitignore`).
- [x] `GET /eventos/:id/lista` de un evento existente muestra un formulario de PIN y ningún dato de alumnos.
- [x] `GET` o `POST` de un evento inexistente responde 404 con una página HTML que dice que el evento no existe.
- [x] `POST` con PIN incorrecto o vacío responde 401, vuelve a mostrar el formulario con "PIN incorrecto" y no incluye matrículas ni nombres.
- [x] `POST` con el PIN correcto responde 200 y el HTML ya contiene el nombre, la matrícula y el estado de cada asistente.
- [x] Los totales mostrados (total, válidas, fuera de rango, fuera de horario, sin ubicación y offline) coinciden con los registros del evento.
- [x] Los asistentes aparecen en orden alfabético por nombre, con acentos considerados.
- [x] Las horas aparecen en hora de Ciudad de México: una captura en `2026-11-28T16:05:00.000Z` se muestra como `10:05:00`.
- [x] Las filas sin ubicación muestran `—` en distancia y precisión.
- [x] Los registros offline tienen una marca visible.
- [x] Un nombre que contiene `<script>` aparece escapado (`&lt;script&gt;`) en el HTML.
- [x] Un evento sin asistencias muestra "Sin asistentes registrados" y todos los totales en 0.
- [x] La respuesta con la lista lleva `Cache-Control: no-store`.
- [x] El botón "Imprimir" abre el diálogo de impresión, y en la vista previa no aparece el botón.
- [x] "Ver código fuente" de la lista muestra los nombres de los alumnos escritos en el HTML.
- [x] El token del evento no aparece en ningún HTML generado.
- [x] `npm test` pasa todos los tests, los de la SPEC 01 y los nuevos.

---

## Decisiones

- **Sí:** formulario de PIN con POST. El PIN no queda en la URL, el historial ni los logs, y la vista sigue siendo 100 % SSR.
- **No:** PIN en la URL (`?pin=`). Queda expuesto en el historial y la barra de direcciones.
- **No:** lista pública. Expondría nombres y matrículas que la API sí protege.
- **No:** recordar el PIN con cookie o sesión. Agrega estado en el servidor para una vista que se consulta pocas veces.
- **Sí:** con PIN incorrecto se vuelve a mostrar el formulario con un error (401). Es el flujo más corto para reintentar.
- **Sí:** página `error.ejs` para el 404, reutilizable en cualquier error de las vistas SSR.
- **Sí:** orden alfabético por nombre, con `localeCompare` en español. Así se leen las listas oficiales, y SQLite no ordena bien los acentos.
- **No:** orden por hora de escaneo. Ese orden ya lo tiene el contador en vivo de la API.
- **Sí:** zona horaria fija y configurable (`ZONA_HORARIA = America/Mexico_City`). La lista sale igual sin importar dónde corra el servidor.
- **No:** usar la zona del servidor. Cambia según la máquina.
- **Sí:** Tailwind CSS v4 con su CLI, para todo el proyecto. **Esto sustituye el "CSS puro" de la planeación.** Funciona sin conexión, solo incluye las clases usadas y el Service Worker podrá cachearlo.
- **No:** Tailwind por CDN (Play CDN). Necesita internet, no está pensado para producción y no se puede cachear bien para usarlo offline.
- **Sí:** el CSS se genera (`prestart`) y está en `.gitignore`. El repo queda sin archivos generados.
- **No:** subir el CSS compilado al repo. Obliga a acordarse de recompilarlo antes de cada commit.
- **Sí:** botón "Imprimir" más variantes `print:`. La lista se imprime o se guarda en PDF sin el botón.
- **Sí:** las 8 columnas (matrícula, nombre, hora de escaneo, hora de recepción, estado, distancia, precisión y offline). La hora de recepción junto a la marca offline muestra el retraso de la sincronización.
- **Sí:** colores por estado: verde para válida, rojo para fuera de rango u horario, y ámbar para sin ubicación. Sigue la identidad visual de la planeación (rojo para errores, ámbar para avisos).
- **Sí:** `Cache-Control: no-store` en la lista. Contiene datos personales y siempre debe reflejar el estado actual.
- **Sí:** cálculos y formato en el servidor, y la plantilla solo pinta. Es lo que demuestra el "procesamiento de datos" del lado del servidor, y deja la plantilla simple.
- **Sí:** el PIN del formulario se compara con `config.ORGANIZADOR_PIN`, el mismo PIN de la API. No se reutiliza `requierePin` porque ese middleware lee el header `X-PIN`, no el cuerpo del formulario.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Tailwind v4 usa binarios nativos (`@tailwindcss/oxide`, `lightningcss`) que podrían fallar en Windows, como pasó con `better-sqlite3` 13 | Verificarlo en el paso 1 antes de seguir. Si falla, probar otra versión menor de la v4 y registrarlo. |
| `prestart` falla y `npm start` no arranca | Se puede ejecutar `node --env-file-if-exists=.env server/index.js` directo. La lista se ve sin estilos, pero funciona. |
| Tailwind no detecta clases usadas en las plantillas y las omite del CSS | `@source` explícito hacia `server/vistas` en `entrada.css`. |
| Los tests no compilan el CSS | Los tests solo revisan el HTML. El CSS se verifica a mano con `build:css`. |

---

## Lo que **no** está en esta spec

- Interfaz de la PWA y enlace a la lista desde la app.
- Tailwind en `public/index.html`.
- Service Worker y página offline.
- Exportación a PDF desde el servidor.
- Recordar el PIN entre visitas.
- Editar o borrar asistencias desde la vista.

Cada uno de estos puntos, si se hace, va en su propia spec.
