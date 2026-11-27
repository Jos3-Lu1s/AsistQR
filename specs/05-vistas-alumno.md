# SPEC 05 — Vistas del alumno

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 03, SPEC 04
> **Fecha:** 2026-11-26
> **Objetivo:** Reemplazar las vistas "En construcción" del alumno por Escanear QR (cámara, GPS y vibración), Mi historial y Eventos, guardando cada asistencia en el dispositivo antes de enviarla y reenviando las pendientes al reconectar.

---

## Por qué existe esta spec

La SPEC 04 dejó al organizador creando eventos y proyectando el QR. Falta la otra mitad del caso de estudio: que el alumno escanee y su asistencia llegue al servidor. Esta spec cubre los recursos físicos del dispositivo (cámara, geolocalización y vibración) y la parte de datos locales del criterio offline: cada escaneo se guarda primero en LocalStorage y se envía después.

El Service Worker, los cachés y Background Sync quedan para la SPEC 06. Aquí el reenvío de la cola depende de la página: se dispara con el evento `online` y al abrir la app. Así la SPEC 06 solo agrega un segundo disparador sobre una cola que ya funciona.

---

## Alcance

**Dentro:**

- **Escanear QR** (`#/escanear`): botón "Activar cámara", lectura del QR con jsQR y campo para escribir el código a mano.
- Ubicación del alumno al registrar con `obtenerUbicacion()` de la SPEC 04. Si falla, el registro se envía sin ubicación.
- Vibración al leer el QR y al mostrar el resultado, con patrones distintos para éxito, aviso y error.
- Tarjeta de resultado según la respuesta del servidor o el guardado sin conexión.
- Historial local `asistqr:historial` y cola `asistqr:cola`. Cada registro se guarda en ambos antes de enviarse.
- Reenvío de la cola con el evento `online`, al abrir la app y con el botón "Enviar ahora".
- Fecha de la última sincronización en `asistqr:ultima-sync`.
- **Mi historial** (`#/historial`): lo guardado en el dispositivo al instante, completado con `GET /api/asistencias?matricula=X` cuando hay conexión.
- **Eventos** (`#/eventos`): tarjetas con filtro Todos / En curso / Próximos / Terminados y botón "Escanear" en los eventos en curso.
- Contador de pendientes en la barra superior y en la tarjeta Mi historial de Inicio.
- jsQR como devDependency, copiado a `public/vendor/jsQR.js`.
- Eliminar `vistas/en-construccion.js`, que ya no usa ninguna ruta.
- Tests de entrega de los módulos nuevos y actualización del README.

**Fuera de alcance (para specs futuras):**

- Service Worker, caché estático y dinámico, página offline e instalación.
- Background Sync.
- Notificaciones, incluidas "Asistencia registrada" y "Se sincronizaron N asistencias".
- `BarcodeDetector` nativo.
- Vista de detalle de un evento para el alumno.
- Cancelar o borrar un registro pendiente desde el historial.
- Cambios en la API, en la vista SSR o en las vistas del organizador.
- Tests automáticos del código del cliente.

---

## Modelo de datos

Esta spec no cambia la base de datos ni la API. Usa `POST /api/asistencias` y `GET /api/asistencias?matricula=X` de la SPEC 01, y la clave `asistqr:eventos` de la SPEC 04.

### LocalStorage

| Clave | Contenido |
|---|---|
| `asistqr:cola` | Lista de cuerpos de `POST /api/asistencias` pendientes de enviar |
| `asistqr:historial` | Lista de asistencias que ve el alumno, con su estado de sincronización |
| `asistqr:ultima-sync` | Fecha ISO de la última vez que la cola quedó vacía tras enviar al menos un registro |

```js
// asistqr:cola — el cuerpo exacto que se envía
[
  { uuid: '3f2c…', token: 'K7M3QX', matricula: 'UTP0123456', nombre: 'Ana López',
    capturadaEn: '2026-11-28T16:05:00.000Z',
    latitud: 19.0415, longitud: -98.2062, precision: 12,   // o los tres ausentes
    offline: false },
]

// asistqr:historial — del escaneo más reciente al más antiguo
[
  { uuid: '3f2c…', matricula: 'UTP0123456', codigo: 'K7M3QX',
    capturada_en: '2026-11-28T16:05:00.000Z',
    sincronizacion: 'pendiente',        // 'pendiente' | 'enviada' | 'rechazada'
    motivo: null,                       // si es rechazada: 'token_invalido' | 'ya_registrado' | 'datos_invalidos'
    evento_id: null, evento_nombre: null,   // se llenan con la respuesta del servidor
    estado: null, distancia_m: null,        // estado de la SPEC 01: valida, fuera_de_rango, …
    offline: false },
]
```

- `uuid` se genera con `crypto.randomUUID()`. Si no existe, se arma un UUID v4 con `crypto.getRandomValues()`.
- `capturadaEn` es el momento en que se leyó el QR o se pulsó "Registrar", antes de pedir la ubicación.
- `offline` va en `false` en el primer envío. Cada reenvío desde la cola lo manda en `true`.
- Un valor ilegible en cualquiera de las tres claves cuenta como lista vacía o sin fecha.
- Cada cambio en `asistqr:cola` dispara el evento `asistqr:cola-cambiada` en `window`. La barra superior, Inicio y Mi historial lo escuchan.

### Resultado de las peticiones (`public/js/api.js`)

| Función | Petición | PIN |
|---|---|---|
| `registrarAsistencia(cuerpo)` | `POST /api/asistencias` | No |
| `listarHistorial(matricula)` | `GET /api/asistencias?matricula=X` | No |

- Mismo formato `{ ok, datos | error }` de la SPEC 04.
- Cambio a `pedir()`: los errores con JSON incluyen también `datos` con el cuerpo de la respuesta. Lo necesita el 409, que trae la `asistencia` existente.

### Aplicar la respuesta de un envío (`public/js/registro.js`)

| Respuesta | Cola | Historial |
|---|---|---|
| `201` | Se quita | `enviada`, con `estado`, `distancia_m`, `evento_id` y `evento_nombre` de la respuesta |
| `200` con `duplicado: true` | Se quita | `enviada`, con `estado`, `distancia_m` y `evento_id` de la respuesta |
| `409 ya_registrado` | Se quita | `rechazada`, motivo `ya_registrado`, con `evento_id` de la `asistencia` de la respuesta |
| `404 token_invalido` | Se quita | `rechazada`, motivo `token_invalido` |
| `400 datos_invalidos` | Se quita | `rechazada`, motivo `datos_invalidos` |
| `sin_conexion` o cualquier otro error | Se queda | Sigue `pendiente` |

### Registro de una asistencia

1. Se normaliza el código: sin espacios y en mayúsculas.
2. Si no son 6 caracteres del alfabeto del token (sin 0, O, 1 ni I), se muestra "Código inválido. Revisa los 6 caracteres." con vibración de error y no se guarda nada.
3. Se toma `capturadaEn`.
4. Se muestra "Obteniendo ubicación…" y se llama `obtenerUbicacion()`. Si falla, aparece "No se pudo obtener tu ubicación. Se registrará sin ubicación." y se continúa.
5. Se guarda el registro en `asistqr:historial` (`pendiente`) y en `asistqr:cola`.
6. Si `navigator.onLine` es falso, no se envía.
7. Si hay conexión, se envía y se aplica la respuesta según la tabla anterior.
8. Se muestra la tarjeta de resultado y se vibra.

### Tarjeta de resultado y vibración (`public/js/vibracion.js`)

| Caso | Mensaje | Vibración |
|---|---|---|
| `valida` | "✅ Asistencia registrada en «Tutoría Grupal 5A»" | éxito |
| `fuera_de_rango` | "⚠️ Registrada, pero fuera del rango del evento (230 m)" | aviso |
| `fuera_de_horario` | "⚠️ Registrada fuera del horario del evento" | aviso |
| `sin_ubicacion` | "⚠️ Registrada sin ubicación" | aviso |
| Se queda en la cola | "📴 Guardada sin conexión. Se enviará automáticamente al reconectar." | aviso |
| `ya_registrado` | "Ya tenías asistencia registrada en este evento." | aviso |
| `token_invalido` | "❌ El código no corresponde a ningún evento." | error |
| `datos_invalidos` | El `mensaje` del servidor | error |

| Patrón | `navigator.vibrate(…)` |
|---|---|
| lectura (QR detectado) | `50` |
| éxito | `200` |
| aviso | `[100, 100, 100]` |
| error | `400` |

- Sin `navigator.vibrate` (iOS) no se vibra y no se muestra ningún aviso.
- La tarjeta trae los botones "Escanear otro" y "Ver mi historial".

### Sincronización (`public/js/sincronizacion.js`)

- `sincronizarCola()` envía la cola en orden, de uno en uno, con `offline: true`, y aplica cada respuesta con `registro.js`.
- Se detiene en el primer `sin_conexion` y deja el resto para el siguiente intento.
- Si ya hay una sincronización en curso, la llamada no hace nada. Así un mismo registro nunca se envía dos veces a la vez.
- Al terminar, si envió al menos uno y la cola quedó vacía, guarda `asistqr:ultima-sync`.
- Se dispara con el evento `online`, al abrir la app (si hay conexión y cola) y con "Enviar ahora" en Mi historial.
- Corre con cualquier rol: cada cuerpo ya lleva la matrícula y el nombre del momento del escaneo.

### Escáner (`public/js/escaner.js`)

- `iniciarEscaner(video, alLeer)` pide `getUserMedia({ video: { facingMode: 'environment' } })` y devuelve `detener()`.
- Cada cuadro se dibuja en un `<canvas>` que no se muestra y se pasa a `jsQR(datos, ancho, alto, { inversionAttempts: 'dontInvert' })`.
- Al leer un QR: vibración de lectura, se detiene la cámara y se llama `alLeer(texto)`.
- `detener()` cancela el `requestAnimationFrame` y detiene todas las pistas del `MediaStream`.
- Errores que ve el usuario:

| Error | Mensaje |
|---|---|
| `NotAllowedError` | "Permiso de cámara negado. Escribe el código o activa la cámara en la configuración del navegador." |
| `NotFoundError` | "No se encontró una cámara. Escribe el código." |
| Sin `getUserMedia` o sin contexto seguro | El botón se oculta y queda la nota "La cámara requiere HTTPS. Escribe el código." |
| Cualquier otro | "No se pudo abrir la cámara. Escribe el código." |

### Mi historial: unión con el servidor

Al entrar se pinta `asistqr:historial` filtrado por la matrícula del perfil. Con conexión se pide `listarHistorial(matricula)` y se une así:

1. Cada registro del servidor reemplaza o agrega la entrada local con el mismo `uuid`, como `enviada`.
2. Las entradas locales `enviada` que el servidor ya no devuelve se quitan (el organizador las eliminó).
3. Las entradas `rechazada` con motivo `ya_registrado` se quitan si el servidor devuelve un registro del mismo `evento_id`.
4. Las `pendiente` y las demás `rechazada` se conservan.
5. El resultado se ordena por `capturada_en` descendente y se guarda en `asistqr:historial`.

Las entradas de otra matrícula no se tocan ni se muestran.

### Rutas del cliente

| Hash | Vista | Roles | Título de la barra |
|---|---|---|---|
| `#/escanear` | Escanear QR | alumno | Escanear QR |
| `#/historial` | Mi historial | alumno | Mi historial |
| `#/eventos` | Eventos | alumno | Eventos |

### Vistas

**Escanear QR**
- Texto "Usaremos la cámara solo para leer el QR del evento." y botón "Activar cámara". El permiso se pide al tocarlo.
- Video `playsinline muted` con un marco guía y botón "Detener cámara".
- Debajo, siempre visible: campo "Código del evento" (`maxlength="6"`, `autocomplete="off"`, en mayúsculas al escribir) y botón "Registrar".
- Mientras se registra, los controles quedan deshabilitados.
- Al salir de la vista, la función de limpieza detiene la cámara.

**Mi historial**
- Encabezado "Última sincronización: 26/11 18:05" o "Aún no se ha sincronizado".
- Si hay cola: "2 por enviar" y el botón "Enviar ahora". Sin conexión, el botón queda deshabilitado con el texto "Se necesita conexión".
- Una fila por entrada: nombre del evento (o "Código K7M3QX" si aún no se conoce), fecha y hora de captura, distancia si existe y una etiqueta:

| Entrada | Etiqueta |
|---|---|
| `enviada` | La del `estado` (Válida, Fuera de rango, Fuera de horario, Sin ubicación) |
| `pendiente` | Pendiente de envío |
| `rechazada` / `token_invalido` | Rechazada: código inválido |
| `rechazada` / `ya_registrado` | Ya registrada |
| `rechazada` / `datos_invalidos` | Rechazada: datos inválidos |

- Estados:
  - **Sin datos:** "Aún no tienes asistencias" con el botón "Escanear QR".
  - **Sin conexión:** aviso "Sin conexión · mostrando lo guardado en el dispositivo".
  - **Error al consultar el servidor:** se queda lo local y aparece "No se pudo actualizar el historial" con "Reintentar".
- Se repinta con `asistqr:cola-cambiada`, así una sincronización en segundo plano cambia las filas sin recargar.

**Eventos**
- Botones de filtro: Todos, En curso, Próximos y Terminados, cada uno con su número ("En curso (1)"). Abre en Todos.
- Tarjetas en el orden de la API: nombre, lugar, descripción, horario y etiqueta de estado (de `formato.js`).
- Las tarjetas En curso traen el botón "Escanear", que lleva a `#/escanear`.
- Misma fuente y mismos estados que Mis eventos: cargando, sin datos ("No hay eventos por ahora"), error con "Reintentar" y datos guardados con el aviso "Sin conexión · datos guardados el …".
- Un filtro sin resultados muestra "No hay eventos en curso" (o próximos, o terminados).
- Sin conexión, "Escanear" sigue habilitado: el registro se guarda en la cola.

**Barra superior e Inicio**
- Junto al indicador de conexión aparece "2 pendientes" ("1 pendiente" en singular) mientras `asistqr:cola` tenga registros. Sin cola no se muestra nada.
- En Inicio, la tarjeta Mi historial agrega "2 por enviar" cuando hay cola.

### Archivos

```
public/vendor/jsQR.js           ← copia de node_modules/jsqr/dist/jsQR.js (se sube al repo)
public/index.html               ← + <span id="pendientes"> en la barra
public/js/
  api.js                        ← + registrarAsistencia, listarHistorial; datos en los errores
  almacen.js                    ← + cola, historial y última sincronización
  registro.js                   ← armar, guardar, enviar y aplicar la respuesta
  sincronizacion.js             ← sincronizarCola(), iniciarSincronizacion()
  escaner.js                    ← iniciarEscaner(video, alLeer) → detener()
  vibracion.js                  ← vibrar('lectura' | 'exito' | 'aviso' | 'error')
  pendientes.js                 ← iniciarIndicadorPendientes(elemento)
  app.js                        ← + indicador de pendientes y sincronización al arrancar
  router.js                     ← 3 rutas del alumno conectadas; sin en-construccion.js
  vistas/
    escanear.js
    historial.js
    eventos.js
    inicio.js                   ← + "N por enviar" en Mi historial
    en-construccion.js          ← se elimina
package.json                    ← + jsqr en devDependencies
test/pwa.test.js                ← + entrega de los módulos nuevos y de /vendor/jsQR.js
README.md                       ← + vistas del alumno, claves nuevas y comando de copia de jsQR
```

- `jsQR.js` se carga con `<script src="vendor/jsQR.js">` en `index.html`, antes de los módulos, y expone `window.jsQR`.
- Todo texto que viene del servidor o del usuario se inserta con `textContent`, nunca con `innerHTML`.
- La colección de Postman no cambia porque la API no cambia.

---

## Plan de implementación

1. **jsQR.**
   - `npm i -D jsqr` y copiar `node_modules/jsqr/dist/jsQR.js` a `public/vendor/jsQR.js`.
   - Cargarlo en `index.html` y agregar a `test/pwa.test.js` que `/vendor/jsQR.js` responde 200 con tipo JavaScript.
   - Prueba manual: en la consola, `typeof jsQR` es `'function'`.
2. **Datos locales y API.**
   - En `almacen.js`, agregar lectura y escritura de `asistqr:cola`, `asistqr:historial` y `asistqr:ultima-sync`, con el evento `asistqr:cola-cambiada`.
   - En `api.js`, agregar `registrarAsistencia` y `listarHistorial`, y `datos` en los errores de `pedir()`.
   - Prueba manual desde la consola: `listarHistorial('UTP0123456')` devuelve `{ ok: true, datos: [...] }`.
3. **Registro con código manual.**
   - Crear `vibracion.js` y `registro.js`.
   - Crear `vistas/escanear.js` solo con el campo de código, la ubicación y la tarjeta de resultado, y conectarla a `#/escanear`.
   - Prueba manual: con el token de un evento en curso (de la vista QR del organizador) aparece "✅ Asistencia registrada" y el registro sale en la vista Asistentes del organizador.
4. **Cámara.**
   - Crear `escaner.js` y agregar a Escanear el botón "Activar cámara", el video y la limpieza al salir.
   - Prueba manual: al apuntar la cámara de la laptop al QR proyectado en otra pantalla se registra la asistencia.
5. **Cola y sincronización.**
   - Crear `sincronizacion.js` y `pendientes.js`, e iniciarlos en `app.js`.
   - Agregar `<span id="pendientes">` en `index.html` y "N por enviar" en Inicio.
   - Prueba manual: con DevTools en Offline, registrar un código guarda el registro y aparece "1 pendiente". Al volver a Online, el contador desaparece y el registro llega al servidor con `offline: true`.
6. **Mi historial.**
   - Crear `vistas/historial.js` con la unión con el servidor, el botón "Enviar ahora" y el repintado con `asistqr:cola-cambiada`, y conectarla a `#/historial`.
   - Prueba manual: tras borrar `asistqr:historial` en la consola, al entrar con conexión se recuperan los registros del servidor.
7. **Eventos.**
   - Crear `vistas/eventos.js` con el filtro y el botón "Escanear", y conectarla a `#/eventos`.
8. **Limpieza, tests y documentación.**
   - Eliminar `vistas/en-construccion.js` y su import en `router.js`.
   - En `test/pwa.test.js`, comprobar que cada módulo nuevo responde 200 con tipo JavaScript y quitar la comprobación de `en-construccion.js`.
   - Documentar en `README.md` las vistas del alumno, las claves `asistqr:cola`, `asistqr:historial` y `asistqr:ultima-sync`, y el comando para copiar jsQR.

---

## Criterios de aceptación

- [x] `/vendor/jsQR.js` responde 200 y `typeof jsQR` es `'function'` en la app.
- [x] Un organizador que escribe `#/escanear`, `#/historial` o `#/eventos` es redirigido a `#/inicio`.
- [x] Escanear no pide permiso de cámara hasta tocar "Activar cámara".
- [x] Con la cámara activa, apuntar al QR de un evento en curso registra la asistencia y muestra "✅ Asistencia registrada en «…»".
- [x] Al negar el permiso de cámara aparece el mensaje de permiso negado y el campo de código sigue funcionando.
- [x] Salir de Escanear con la cámara activa apaga la cámara (se apaga la luz o el indicador del navegador).
- [x] Escribir `k7m3qx` registra igual que `K7M3QX`.
- [x] Escribir `ABC` o `K7M3Q0` muestra "Código inválido. Revisa los 6 caracteres." y no hace ninguna petición.
- [x] Un código bien formado que no existe muestra "❌ El código no corresponde a ningún evento." y en el historial queda "Rechazada: código inválido".
- [x] Registrar dos veces en el mismo evento muestra "Ya tenías asistencia registrada en este evento.".
- [x] Al negar el permiso de ubicación, el registro se envía, el servidor lo guarda como `sin_ubicacion` y aparece "⚠️ Registrada sin ubicación".
- [x] Desde un punto a más del radio del evento, la tarjeta muestra "fuera del rango del evento" con la distancia en metros.
- [x] En un celular Android, leer un QR vibra, y una asistencia válida y un código inexistente vibran distinto.
- [x] Con DevTools en Offline, registrar un código muestra "📴 Guardada sin conexión…", agrega una entrada a `asistqr:cola` y una `pendiente` a `asistqr:historial`.
- [x] Tres registros sin conexión en eventos distintos quedan como tres entradas en `asistqr:cola`.
- [x] Con cola, la barra superior muestra "N pendientes" y la tarjeta Mi historial de Inicio dice "N por enviar". Sin cola no aparece nada.
- [x] Al volver a Online, la cola se envía sola sin recargar, el contador desaparece y los registros llegan al servidor con `offline: true`.
- [x] Un registro hecho sin conexión durante el evento y enviado después de que el evento terminó queda como `valida`, no como `fuera_de_horario`.
- [x] Cerrar la pestaña con cola y abrir la app con conexión envía la cola al arrancar.
- [x] Si la sincronización se dispara dos veces seguidas, el servidor recibe cada `uuid` una sola vez.
- [x] Al vaciarse la cola, Mi historial muestra "Última sincronización: …" con la hora del envío.
- [x] Mi historial se ve sin conexión con lo guardado y el aviso "Sin conexión · mostrando lo guardado en el dispositivo".
- [x] Con `asistqr:historial` borrado, entrar a Mi historial con conexión recupera los registros del servidor con el nombre del evento.
- [x] Un registro eliminado por el organizador desaparece de Mi historial al entrar con conexión.
- [x] Una entrada pendiente se muestra como "Pendiente de envío" con "Código K7M3QX" y cambia a la etiqueta de su estado al sincronizarse, sin recargar.
- [x] Mi historial solo muestra las entradas de la matrícula del perfil actual.
- [x] Eventos muestra los filtros con su número, abre en Todos y cada filtro muestra solo sus eventos.
- [x] Las tarjetas En curso traen "Escanear" y lleva a `#/escanear`. Las demás no lo traen.
- [x] Con DevTools en Offline, Eventos muestra los eventos de `asistqr:eventos` con el aviso de datos guardados.
- [x] Un evento cuyo nombre es `<b>x</b>` se muestra como texto literal en Eventos, en la tarjeta de resultado y en Mi historial.
- [x] Escanear, Mi historial y Eventos se ven sin desplazamiento horizontal a 375 px, 768 px y 1280 px.
- [x] `public/js/vistas/en-construccion.js` ya no existe y ninguna ruta lo usa.
- [x] La consola del navegador no muestra errores al recorrer todas las rutas del alumno.
- [x] `npm test` pasa todos los tests: los anteriores y los nuevos de `test/pwa.test.js`.

---

## Decisiones

- **Sí:** guardar en el historial y en la cola antes de enviar. Si la conexión se cae a la mitad del envío, el registro no se pierde.
- **Sí:** reenvío con el evento `online`, al arrancar y con "Enviar ahora", sin Service Worker. La cola funciona en todos los navegadores desde ya, y la SPEC 06 solo agrega Background Sync como otro disparador.
- **No:** dejar toda la cola para la SPEC 06. El alumno es quien sufre la mala señal del auditorio, y su vista no estaría completa sin poder registrar offline.
- **Sí:** dos claves, `asistqr:cola` y `asistqr:historial`. La cola guarda el cuerpo exacto del envío y el historial lo que ve el alumno. La SPEC 06 solo necesita tocar la cola.
- **No:** una sola clave con la cola como filtro. Mezcla lo que se envía con lo que se muestra.
- **Sí:** sacar de la cola los rechazos definitivos (404, 409, 400) y marcarlos en el historial. Un token inválido se quedaría reintentando para siempre, y el alumno ve qué pasó con su escaneo.
- **Sí:** solo `sin_conexion` y los errores inesperados se quedan en la cola. Son los únicos que pueden salir bien al reintentar.
- **Sí:** `offline: true` en los reenvíos. El organizador ve la marca "Sincronizado" en Asistentes y la lista SSR cuenta los registros offline.
- **Sí:** `capturadaEn` antes de pedir la ubicación. El GPS puede tardar hasta 15 s y la hora que cuenta es la del escaneo.
- **Sí:** una sincronización a la vez, en orden y de uno en uno. Evita envíos duplicados en paralelo. El `uuid` sigue protegiendo en el servidor si algo se repite.
- **Sí:** jsQR copiado en `public/vendor/`. Funciona en Safari de iPhone y en Firefox, es un solo archivo y el Service Worker podrá cachearlo.
- **No:** `BarcodeDetector`. No existe en iOS ni en Firefox, y serían dos caminos que probar.
- **No:** html5-qrcode. Trae su propia interfaz y pesa más.
- **No:** jsQR desde un CDN. No carga sin conexión hasta que exista el Service Worker.
- **Sí:** jsQR como devDependency con un comando de copia en el README. La versión queda registrada en `package.json` sin que el servidor dependa de `node_modules` en producción.
- **Sí:** activar la cámara con un botón y explicar antes para qué es. La planeación pide pedir cada permiso solo cuando se necesita.
- **Sí:** campo de código manual siempre visible. Sirve si se niega la cámara, si no hay HTTPS o si el QR se ve mal en el proyector.
- **Sí:** validar el formato del código en el cliente. Un código mal escrito no ocupa la cola ni hace una petición.
- **Sí:** enviar sin ubicación si el GPS falla. El servidor lo marca `sin_ubicacion` y el organizador decide. Bloquear dejaría sin registro a quien tenga mal GPS en interiores.
- **No:** preguntar con `confirm()` si se envía sin ubicación. Un paso más en el momento en que el alumno quiere terminar rápido.
- **Sí:** tres patrones de vibración (éxito, aviso y error) más una vibración corta al leer. En un auditorio ruidoso el alumno sabe el resultado sin mirar.
- **Sí:** Mi historial local al instante y unido con el servidor por `uuid`. Funciona sin conexión y recupera los registros si se limpió el almacenamiento o se usó otro celular.
- **Sí:** el servidor manda sobre las entradas `enviada`. Si el organizador eliminó un registro, también desaparece del historial del alumno.
- **Sí:** guardar `asistqr:ultima-sync` y mostrarlo en Mi historial. Le confirma al alumno que sus pendientes ya se enviaron.
- **Sí:** contador de pendientes en la barra y en Inicio. La planeación pide los pendientes en el home y la barra los muestra en cualquier vista.
- **Sí:** sincronizar con cualquier rol. Cada cuerpo ya lleva su matrícula, así que cambiar el perfil no deja registros atorados.
- **Sí:** filtro de Eventos con botones y número por filtro, abriendo en Todos. Cubre el "filtro por próximos, activos y pasados" de la planeación.
- **Sí:** botón "Escanear" solo en los eventos en curso. Es el único momento en que el registro puede salir válido.
- **No:** vista de detalle del evento para el alumno. La tarjeta ya muestra todo lo que necesita.
- **Sí:** eliminar `en-construccion.js`. Con esta spec todas las rutas tienen su vista.
- **Sí:** tests del servidor solo para la entrega de los módulos nuevos. El resto se verifica a mano, igual que en las SPEC 03 y 04.
- **No:** cambios en la API. Todo lo que necesita el alumno existe desde la SPEC 01, así que la colección de Postman no cambia.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La cámara y el GPS no funcionan desde el celular con la IP local (no es HTTPS) | Usar la dirección HTTPS de ngrok. Sin contexto seguro el botón de cámara se oculta y queda el código manual. |
| jsQR no lee el QR proyectado por reflejos o baja resolución | El código de 6 caracteres se muestra junto al QR y se escribe a mano. |
| `crypto.randomUUID` no existe fuera de un contexto seguro | Respaldo con `crypto.getRandomValues()`, que sí existe. |
| `navigator.onLine` dice "en línea" pero no hay salida a internet | El envío falla con `sin_conexion`, el registro se queda en la cola y se reintenta en el siguiente disparador. |
| Dos disparadores de sincronización al mismo tiempo (`online` y arranque) | Una sola sincronización a la vez. El `uuid` evita duplicados en el servidor si algo se repite. |
| El GPS tarda o es impreciso en interiores | `capturadaEn` se toma antes del GPS. El servidor descuenta la precisión (máx. 100 m) y el organizador puede ampliar `radio_m`. |
| El alumno cambia su matrícula en Perfil con registros pendientes | Cada cuerpo de la cola conserva la matrícula del escaneo. Mi historial solo muestra la matrícula actual y no borra las demás. |
| La caché del navegador sirve versiones viejas de los módulos JS | Recargar sin caché (Ctrl+Shift+R) mientras no exista el Service Worker. |
| La cámara queda encendida al salir de la vista | Función de limpieza obligatoria en Escanear. Un criterio de aceptación lo verifica. |

---

## Lo que **no** está en esta spec

- Service Worker, cachés, página offline e instalación.
- Background Sync.
- Notificaciones.
- `BarcodeDetector` nativo.
- Detalle de un evento para el alumno.
- Cancelar o borrar registros pendientes.
- Cambios en la API, en la vista SSR o en las vistas del organizador.
- Tests automáticos del cliente.

Cada uno de estos puntos, si se hace, va en su propia spec.
