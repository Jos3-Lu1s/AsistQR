# SPEC 03 — Esqueleto de la PWA

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-11-26
> **Objetivo:** Construir la cáscara de la PWA: un splash que prepara la app, un perfil guardado en LocalStorage, un home por rol y la navegación entre vistas, con manifest e íconos.

---

## Por qué existe esta spec

Las vistas con datos (eventos, historial, escáner, QR del organizador) necesitan primero una app donde vivir: saber quién es el usuario, a qué puede acceder y cómo se navega. Esta spec construye esa estructura, que cubre el criterio "Splash y Home" de la rúbrica, y deja cada vista futura como "En construcción", lista para que otra spec la reemplace.

El splash sigue el patrón visto en clase (una página `splash.html` aparte que redirige a `index.html`), pero en lugar de un `setTimeout` fijo espera tareas de arranque reales.

---

## Alcance

**Dentro:**

- Logotipo en SVG (un QR estilizado con una palomita) e íconos PNG de 192 y 512 px, generados una sola vez con `npx`.
- `manifest.json` con nombre, colores, íconos y `start_url` en `/splash.html`.
- `splash.html`: logo, "AsistQR" y el lema "Tu asistencia en un escaneo", con animación de entrada. Espera las tareas de arranque y como mínimo 1 s, y luego redirige.
- `index.html` como app de una sola página: barra superior (título, botón volver, indicador de conexión) y un contenedor donde se pintan las vistas.
- Router con hash (`#/inicio`, `#/perfil`…) con reglas de acceso por rol.
- Perfil en LocalStorage. El alumno guarda matrícula y nombre. El organizador guarda nombre y un PIN verificado con el servidor.
- Endpoint nuevo `GET /api/pin` para verificar el PIN.
- Home con saludo y tarjetas de acceso según el rol.
- Vistas "En construcción" para los accesos que se construyen en specs futuras.
- Indicador de conexión (En línea / Sin conexión) que cambia en tiempo real.
- Diseño responsivo pensado primero para celular, con Tailwind (la hoja compilada de la SPEC 02).
- Tests del servidor para `GET /api/pin` y para la entrega de los archivos de la PWA.

**Fuera de alcance (para specs futuras):**

- Service Worker, cachés, página offline e instalación como app.
- Vistas con datos: eventos, historial, escáner QR, formulario de evento, QR con contador y lista de asistencia.
- Contador de asistencias pendientes y cola offline.
- Botón y permiso de notificaciones.
- Cámara, geolocalización y vibración.
- Borrar el perfil o "cerrar sesión".
- Tests automáticos del código del cliente.

---

## Modelo de datos

### LocalStorage

| Clave | Contenido | Ejemplo |
|---|---|---|
| `asistqr:perfil` | JSON con el perfil | `{"rol":"alumno","nombre":"Ana López","matricula":"UTP0123456"}` |
| `asistqr:pin` | Texto con el PIN verificado (solo organizador) | `"1234"` |

```js
// Perfil de alumno
{ rol: 'alumno', nombre: 'Ana López', matricula: 'UTP0123456' }

// Perfil de organizador (sin matrícula; el PIN va en su propia clave)
{ rol: 'organizador', nombre: 'Mtra. Ruiz' }
```

- El prefijo `asistqr:` evita choques con otros proyectos servidos en el mismo origen (`localhost:3000`).
- Las specs futuras usarán `asistqr:eventos`, `asistqr:historial`, `asistqr:cola` y `asistqr:ultimaSync`.
- `nombre` y `matricula` se guardan con `trim()`. No se valida el formato de la matrícula.
- Si el perfil cambia a `alumno`, se borra `asistqr:pin`.
- Un perfil ilegible (JSON inválido o sin `rol`) cuenta como si no hubiera perfil.

### Endpoint nuevo

| Método | Ruta | Respuesta correcta | Errores |
|---|---|---|---|
| GET | `/api/pin` | 204 sin cuerpo | 401 `pin_invalido` |

Reutiliza el middleware `requierePin` de la SPEC 01 y no tiene otra lógica.

### Rutas del cliente

| Hash | Vista | Roles | Título de la barra |
|---|---|---|---|
| `#/inicio` | Home | alumno, organizador | AsistQR |
| `#/perfil` | Perfil | alumno, organizador, sin perfil | Perfil |
| `#/escanear` | En construcción | alumno | Escanear QR |
| `#/historial` | En construcción | alumno | Mi historial |
| `#/eventos` | En construcción | alumno | Eventos |
| `#/mis-eventos` | En construcción | organizador | Mis eventos |
| `#/nuevo-evento` | En construcción | organizador | Nuevo evento |
| `#/listas` | En construcción | organizador | Lista de asistencia |

**Reglas del router** (se evalúan en cada cambio de hash y al cargar la página):

1. Si no hay perfil, toda ruta distinta de `#/perfil` redirige a `#/perfil`.
2. Una ruta que no existe, o que no corresponde al rol del perfil, redirige a `#/inicio`.
3. Un hash vacío equivale a `#/inicio`.

El botón "←" de la barra lleva a `#/inicio`. Se oculta en `#/inicio` y en `#/perfil` cuando todavía no hay perfil.

### Tarjetas del home

- **Alumno:** Escanear QR, Mi historial, Eventos, Perfil.
- **Organizador:** Mis eventos, Nuevo evento, Lista de asistencia, Perfil.

### Manifest (`public/manifest.json`)

```json
{
  "name": "AsistQR",
  "short_name": "AsistQR",
  "description": "Tu asistencia en un escaneo",
  "lang": "es",
  "start_url": "/splash.html",
  "scope": "/",
  "display": "standalone",
  "background_color": "#1a73e8",
  "theme_color": "#1a73e8",
  "icons": [
    { "src": "/img/icono-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/img/icono-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/img/icono-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- El logo tiene fondo azul a sangre y el glifo blanco dentro del 80 % central (la zona segura de los íconos maskable). Por eso el mismo PNG sirve como `any` y como `maskable`.

### Archivos

```
public/
  manifest.json
  splash.html                 ← página de arranque (start_url)
  index.html                  ← app de una sola página (reemplaza la provisional)
  img/
    logo.svg                  ← logo fuente
    icono-192.png             ← generado con npx a partir de logo.svg
    icono-512.png             ← generado con npx a partir de logo.svg
  js/
    almacen.js                ← leer/guardar perfil y PIN en LocalStorage
    api.js                    ← verificarPin(pin) → GET /api/pin
    conexion.js               ← indicador En línea / Sin conexión
    router.js                 ← tabla de rutas, reglas de acceso, pintado de vistas
    app.js                    ← arranque de index.html
    splash.js                 ← tareas de arranque y redirección
    vistas/
      inicio.js
      perfil.js
      en-construccion.js
server/
  rutas/pin.js                ← GET /api/pin
  estilos/entrada.css         ← + animación de entrada del splash
test/pwa.test.js
```

- Cada vista exporta una función `pintar(contenedor, contexto)`, que recibe el elemento `<main>` donde se dibuja y `{ perfil, titulo }`.
- Todo el JavaScript del cliente son módulos ES (`<script type="module">`) y no se compila.

---

## Plan de implementación

1. **Logo e íconos.**
   - Crear `public/img/logo.svg`: un QR estilizado con una palomita, glifo blanco sobre fondo `#1a73e8`, dentro de la zona segura del 80 %.
   - Generar los PNG una sola vez con `npx --yes sharp-cli -i public/img/logo.svg -o public/img/icono-512.png resize 512 512`, y lo mismo con `192 192` para `icono-192.png`.
   - Prueba manual: los dos PNG existen, miden lo indicado y se ven correctos.
2. **Endpoint `GET /api/pin`.**
   - Crear `server/rutas/pin.js` con `requierePin`, que responde 204, y montarlo en `app.js` en `/api/pin`.
   - Tests en `test/pwa.test.js`: con PIN correcto responde 204, y sin PIN o con PIN incorrecto responde 401 `pin_invalido`.
3. **Cáscara de `index.html`.**
   - Reemplazar `public/index.html`: `<head>` con viewport, `theme-color`, `/css/estilos.css` y favicon SVG; barra superior con botón "←", título e indicador de conexión; `<main id="vista">`; y `<script type="module" src="/js/app.js">`.
   - Crear `public/js/conexion.js` (escucha `online`/`offline` y actualiza el indicador) y `public/js/app.js` (lo inicializa).
   - Prueba manual: con DevTools en "Offline" el indicador cambia a "Sin conexión" sin recargar.
4. **Almacén y router.**
   - Crear `public/js/almacen.js` con `leerPerfil()`, `guardarPerfil(perfil)`, `leerPin()`, `guardarPin(pin)` y `borrarPin()`.
   - Crear `public/js/vistas/en-construccion.js`.
   - Crear `public/js/router.js` con la tabla de rutas y las 3 reglas. Por ahora todas las rutas, incluidas `#/inicio` y `#/perfil`, usan la vista "En construcción".
   - Arrancar el router desde `app.js`.
   - Prueba manual: sin perfil, cualquier hash termina en `#/perfil`. Con un perfil de alumno escrito a mano en LocalStorage, `#/mis-eventos` redirige a `#/inicio`.
5. **Vista Perfil.**
   - Crear `public/js/api.js` con `verificarPin(pin)`, que devuelve `'ok'`, `'incorrecto'` o `'sin_conexion'`.
   - Crear `public/js/vistas/perfil.js`: selector de rol, campos según el rol, validación de obligatorios, estado "Verificando…" mientras se verifica el PIN, y mensajes de error ("PIN incorrecto" / "Se necesita conexión para verificar el PIN").
   - Al guardar, escribe en LocalStorage y navega a `#/inicio`. Si el perfil ya existe, el formulario aparece precargado.
   - Conectar la vista a `#/perfil` en el router.
6. **Vista Inicio.**
   - Crear `public/js/vistas/inicio.js`: saludo "Hola, {nombre}", etiqueta del rol y cuadrícula de tarjetas según el rol (1, 2 o 3 columnas según el ancho de pantalla), cada una con su enlace a la ruta.
   - Conectar la vista a `#/inicio`.
7. **Splash.**
   - Agregar a `server/estilos/entrada.css` la animación de entrada (`@keyframes` y `--animate-entrada` en `@theme`).
   - Crear `public/splash.html`: fondo `#1a73e8`, logo, "AsistQR" y el lema, con la animación activa solo si `motion-safe`.
   - Crear `public/js/splash.js`, que espera a la vez las tareas de arranque (leer el perfil) y un mínimo de 1 s, y luego hace `location.replace` a `/index.html#/inicio`, o a `/index.html#/perfil` si no hay perfil.
8. **Manifest.**
   - Crear `public/manifest.json`.
   - Enlazarlo desde `index.html` y `splash.html`, junto con `apple-touch-icon` (`icono-192.png`).
   - Tests en `test/pwa.test.js`: `/manifest.json` responde JSON con `start_url` `/splash.html` y los íconos de 192 y 512; `/splash.html`, `/img/icono-192.png` e `/img/icono-512.png` responden 200 con el tipo correcto; `/` incluye el enlace al manifest.

---

## Criterios de aceptación

- [ ] `public/img/icono-192.png` mide 192×192 e `icono-512.png` mide 512×512.
- [ ] `package.json` no gana dependencias para generar los íconos.
- [ ] `GET /api/pin` con el PIN correcto responde 204. Sin PIN o con PIN incorrecto responde 401 `pin_invalido`.
- [ ] DevTools → Application → Manifest muestra nombre "AsistQR", color `#1a73e8`, los íconos de 192 y 512 y ningún error del manifest.
- [ ] Abrir `/splash.html` muestra el logo, "AsistQR" y "Tu asistencia en un escaneo" con animación de entrada.
- [ ] El splash dura al menos 1 s y luego redirige a `/index.html#/inicio` si hay perfil, o a `#/perfil` si no hay.
- [ ] El botón Atrás del navegador no regresa al splash (se usa `location.replace`).
- [ ] Sin perfil guardado, cualquier ruta (incluso `#/inicio` o `#/mis-eventos`) termina en `#/perfil`.
- [ ] Guardar un perfil de alumno sin matrícula o sin nombre muestra un error y no guarda nada.
- [ ] Guardar un perfil de alumno escribe `asistqr:perfil` con `rol`, `nombre` y `matricula`, y lleva a `#/inicio`.
- [ ] Guardar un perfil de organizador con PIN incorrecto muestra "PIN incorrecto" y no guarda nada.
- [ ] Guardar un perfil de organizador sin conexión muestra "Se necesita conexión para verificar el PIN" y no guarda nada.
- [ ] Guardar un perfil de organizador con el PIN correcto escribe `asistqr:perfil` (sin matrícula) y `asistqr:pin`.
- [ ] Cambiar un perfil de organizador a alumno borra `asistqr:pin`.
- [ ] El home de alumno saluda con su nombre y muestra Escanear QR, Mi historial, Eventos y Perfil.
- [ ] El home de organizador muestra Mis eventos, Nuevo evento, Lista de asistencia y Perfil.
- [ ] Un alumno que escribe `#/mis-eventos` en la barra es redirigido a `#/inicio`.
- [ ] Una ruta inexistente (`#/xyz`) redirige a `#/inicio`.
- [ ] Cada tarjeta lleva a su ruta, que muestra "En construcción" con su título en la barra y un botón para volver.
- [ ] El botón Atrás del navegador regresa a la vista anterior dentro de la app.
- [ ] Recargar en `#/perfil` o en una vista "En construcción" mantiene esa vista.
- [ ] El indicador cambia entre "En línea" y "Sin conexión" al activar o desactivar "Offline" en DevTools, sin recargar.
- [ ] El home se ve en 1 columna a 375 px de ancho, en 2 columnas a 768 px y en 3 columnas a 1280 px, sin desplazamiento horizontal.
- [ ] Los datos del perfil siguen ahí al cerrar y volver a abrir el navegador.
- [ ] La consola del navegador no muestra errores al recorrer todas las rutas.
- [ ] `npm test` pasa todos los tests: los anteriores y los de `test/pwa.test.js`.

---

## Decisiones

- **Sí:** una sola spec para todo el esqueleto. Todas las piezas son la "cáscara" de la app y se prueban juntas.
- **No:** separar manifest y splash del perfil y el home. La primera parte sola casi no tendría nada que mostrar.
- **Sí:** router con hash. El botón Atrás funciona, se puede recargar sin perder la vista, y el Service Worker solo tendrá que cachear `index.html`.
- **No:** mostrar y ocultar vistas sin cambiar la URL. El botón Atrás cerraría la app y recargar siempre regresaría al inicio.
- **Sí:** módulos ES en `public/js/`, sin compilar. Cada archivo tiene una responsabilidad y es fácil de explicar en el documento técnico.
- **No:** un solo script clásico como en el ejemplo de clase. Crecería demasiado con las vistas, la cola offline y las notificaciones.
- **Sí:** splash en una página aparte (`splash.html` como `start_url`), siguiendo el patrón de clase. Se reemplaza el `setTimeout` fijo de 3 s por las tareas reales más un mínimo de 1 s.
- **Sí:** mínimo de 1 s en el splash. Es una desviación consciente de la planeación ("no es un retraso artificial"): sin el mínimo, el splash solo parpadearía mientras no existan el Service Worker y la carga de eventos. Lo que dure más de 1 s es trabajo real.
- **No:** splash como capa dentro de `index.html`. Se aleja del patrón de clase.
- **Sí:** `location.replace` para salir del splash. El botón Atrás no regresa al splash.
- **Sí:** logo SVG propio y PNG generados una sola vez con `npx --yes sharp-cli`, subidos al repo. El proyecto no gana dependencias nativas.
- **No:** `sharp` como devDependency con un script en el repo. Agrega un binario nativo para algo que se hace una vez.
- **No:** solo SVG en el manifest. Algunos Android e iOS mostrarían un ícono genérico.
- **Sí:** el mismo PNG de 512 px como `any` y `maskable`, porque el glifo respeta la zona segura del 80 %.
- **Sí:** fondo azul `#1a73e8` con el logo en blanco en el splash, y `background_color` igual. El splash nativo de Android y el de la app se ven continuos.
- **Sí:** el rol se elige en el perfil, y el PIN del organizador se verifica con `GET /api/pin` antes de guardarse. Un alumno no puede convertirse en organizador sin conocer el PIN.
- **No:** guardar el PIN sin validarlo. El error aparecería tarde, al crear un evento.
- **No:** pedir el PIN en cada acción. Habría que escribirlo muchas veces durante la demo.
- **Sí:** el alumno guarda matrícula y nombre, y el organizador nombre y PIN. Cada rol guarda solo lo que usa.
- **Sí:** al editar un perfil de organizador, el campo PIN vacío conserva el PIN ya guardado. Solo se pide y verifica si no hay PIN guardado o si el rol cambia a organizador.
- **Sí:** claves de LocalStorage con el prefijo `asistqr:`. Evitan choques con otros proyectos de clase en `localhost`.
- **Sí:** vistas "En construcción" para los accesos futuros. La navegación completa se puede probar desde ya, y cada spec futura solo reemplaza su vista.
- **Sí:** barra superior con botón volver más tarjetas grandes en el home. Funciona igual en celular y escritorio y deja espacio libre para la vista del QR.
- **No:** barra de pestañas inferior. Se ve rara en escritorio y ocupa espacio.
- **Sí:** verificar el cliente a mano con criterios concretos, y probar con supertest solo el servidor (`/api/pin` y la entrega de archivos). No se agrega infraestructura de pruebas de navegador.
- **No:** tests unitarios del cliente. Necesitarían un `package.json` con `"type": "module"` publicado dentro de `public/js/`.
- **No:** validar el formato de la matrícula. No se conoce un formato oficial, y se guarda tal como la escribe el alumno (sin espacios en los extremos).

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `sharp-cli` usa un binario nativo que podría fallar en Windows, como pasó con `better-sqlite3` 13 | Solo se ejecuta una vez y no queda en el proyecto. Si falla, exportar los PNG desde el navegador (abrir el SVG y convertirlo con un `<canvas>`) o con cualquier editor, y registrarlo. |
| Sin Service Worker, Chrome podría no ofrecer "Instalar app" | La instalación queda fuera de esta spec. Aquí solo se valida que el manifest no tenga errores. |
| El JSON de `asistqr:perfil` se corrompe (por ejemplo, editado a mano) | `leerPerfil()` lo trata como "sin perfil" y el usuario lo vuelve a capturar. |
| La caché del navegador sirve versiones viejas de los módulos JS durante el desarrollo | Recargar sin caché (Ctrl+Shift+R) o "Disable cache" en DevTools. El versionado de cachés llega con el Service Worker. |
| Si el PIN del servidor cambia, el PIN guardado deja de servir | Las acciones del organizador fallarán con 401 en specs futuras. El usuario lo actualiza desde Perfil. |

---

## Lo que **no** está en esta spec

- Service Worker, cachés, página offline e instalación.
- Vistas con datos (eventos, historial, escáner, formulario, QR, lista).
- Cola offline y contador de pendientes.
- Notificaciones.
- Cámara, GPS y vibración.
- Borrar el perfil.
- Tests automáticos del cliente.

Cada uno de estos puntos, si se hace, va en su propia spec.
