# SPEC 04 — Vistas del organizador

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02, SPEC 03
> **Fecha:** 2026-11-26
> **Objetivo:** Reemplazar las vistas "En construcción" del organizador por vistas con datos de la API: Mis eventos, formulario para crear y editar, QR con contador en vivo, asistentes y acceso a la lista SSR.

---

## Por qué existe esta spec

La SPEC 03 dejó la cáscara de la app con las vistas del organizador como "En construcción". Esta spec las llena con datos reales de la API de la SPEC 01. Cubre la mayor parte del criterio "Vistas del lado del cliente" de la rúbrica: interfaz construida con JavaScript, peticiones asíncronas y un contador que cambia solo mientras los alumnos escanean.

Se empieza por el organizador porque sin eventos creados y un QR proyectado el alumno no tiene nada que escanear. Las vistas del alumno (Eventos, Escanear QR, Mi historial) van en la siguiente spec.

---

## Alcance

**Dentro:**

- Router con parámetros en la ruta (`#/eventos/:id/qr`) y una función de limpieza por vista.
- Funciones de la API para eventos y asistencias, con manejo uniforme de errores (sin conexión, PIN inválido, no encontrado, datos inválidos).
- **Mis eventos** (`#/mis-eventos`): tarjetas con nombre, lugar, horario y estado (Próximo / En curso / Terminado), y las acciones QR, Asistentes, Editar y Eliminar.
- Último listado de eventos guardado en `asistqr:eventos`, que se muestra sin conexión con el aviso "Datos guardados".
- **Formulario de evento** para crear (`#/nuevo-evento`) y editar (`#/eventos/:id/editar`), con validación en el cliente.
- Botón "Usar mi ubicación" en el formulario (geolocalización), con los campos de latitud y longitud editables a mano.
- **QR del evento** (`#/eventos/:id/qr`): imagen del QR, token y contador de asistentes que se actualiza cada 5 s, con un botón de pantalla completa para proyectar.
- **Asistentes** (`#/eventos/:id/asistentes`): lista de registros que se actualiza cada 5 s, con botón para eliminar cada registro.
- **Lista de asistencia** (`#/listas`): selector de evento que abre la vista SSR en otra pestaña enviando el PIN guardado.
- Confirmación con `confirm()` antes de eliminar un evento o un registro.
- Estados cargando, sin datos, error y datos guardados en cada vista.
- Tests de entrega de los módulos nuevos y actualización del README.

**Fuera de alcance (para specs futuras):**

- Vistas del alumno: Eventos con filtro, Escanear QR, Mi historial.
- Cámara, vibración y la geolocalización del alumno.
- Service Worker, cachés, página offline e instalación.
- Cola offline. Crear, editar o eliminar sin conexión no se encola: se bloquea con un mensaje.
- Notificaciones, incluida "Nuevo asistente" para el organizador.
- Mapa para elegir la ubicación del evento.
- Borrar el perfil o "cerrar sesión".
- Cambios en la API o en la vista SSR del servidor.
- Tests automáticos del código del cliente.

---

## Modelo de datos

Esta spec no cambia la base de datos ni la API. Usa el contrato de la SPEC 01 y la vista SSR de la SPEC 02.

### LocalStorage

| Clave | Contenido | Ejemplo |
|---|---|---|
| `asistqr:eventos` | JSON con el último listado de `GET /api/eventos` y cuándo se descargó | `{"guardadoEn":"2026-11-26T18:00:00.000Z","eventos":[…]}` |

```js
// asistqr:eventos
{
  guardadoEn: '2026-11-26T18:00:00.000Z',
  eventos: [
    { id: 1, nombre: 'Tutoría Grupal 5A', descripcion: '…', lugar: 'Edificio C, aula 12',
      inicio: '…', fin: '…', latitud: 19.0, longitud: -98.2, radio_m: 150, creado_en: '…' },
  ],
}
```

- Se sobrescribe en cada `GET /api/eventos` correcto.
- Al eliminar un evento con éxito, también se quita de `asistqr:eventos`.
- Un valor ilegible cuenta como "sin datos guardados".
- La spec del alumno reutilizará esta misma clave.

### Resultado de las peticiones (`public/js/api.js`)

Todas las funciones nuevas devuelven el mismo tipo de resultado:

```js
{ ok: true, datos }                     // datos: JSON de la respuesta, o null si es 204
{ ok: false, error: 'sin_conexion' }    // fetch falló (no hay red o el servidor no responde)
{ ok: false, error: 'pin_invalido', mensaje }            // 401
{ ok: false, error: 'evento_no_encontrado', mensaje }    // y demás códigos del servidor
```

| Función | Petición | PIN |
|---|---|---|
| `listarEventos()` | `GET /api/eventos` | No |
| `obtenerEvento(id)` | `GET /api/eventos/:id` | No |
| `crearEvento(datos)` | `POST /api/eventos` | Sí |
| `editarEvento(id, datos)` | `PUT /api/eventos/:id` | Sí |
| `eliminarEvento(id)` | `DELETE /api/eventos/:id` | Sí |
| `obtenerQr(id)` | `GET /api/eventos/:id/qr` | Sí |
| `listarAsistentes(id)` | `GET /api/eventos/:id/asistencias` | Sí |
| `eliminarAsistencia(id)` | `DELETE /api/asistencias/:id` | Sí |
| `abrirLista(id)` | `POST /eventos/:id/lista` en una pestaña nueva | Sí (campo `pin`) |

- El PIN se toma de `leerPin()` y va en el header `X-PIN`.
- `abrirLista(id)` crea un `<form method="post" target="_blank">` con un `<input type="hidden" name="pin">`, lo envía y lo quita del DOM. Se llama siempre desde un clic, así que el navegador no bloquea la pestaña.
- Mensajes que ve el usuario según el error:

| Error | Mensaje |
|---|---|
| `sin_conexion` | "Se necesita conexión para esta acción." |
| `pin_invalido` | "Tu PIN ya no es válido. Actualízalo en Perfil." (con enlace a `#/perfil`) |
| `evento_no_encontrado` | "El evento ya no existe." (con enlace a `#/mis-eventos`) |
| `datos_invalidos` | El `mensaje` del servidor |
| Cualquier otro | "Ocurrió un error inesperado. Intenta de nuevo." |

### Rutas del cliente

| Hash | Vista | Roles | Título de la barra |
|---|---|---|---|
| `#/mis-eventos` | Mis eventos | organizador | Mis eventos |
| `#/nuevo-evento` | Formulario (crear) | organizador | Nuevo evento |
| `#/eventos/:id/editar` | Formulario (editar) | organizador | Editar evento |
| `#/eventos/:id/qr` | QR del evento | organizador | QR del evento |
| `#/eventos/:id/asistentes` | Asistentes | organizador | Asistentes |
| `#/listas` | Lista de asistencia | organizador | Lista de asistencia |

Las rutas del alumno (`#/escanear`, `#/historial`, `#/eventos`) siguen en "En construcción".

**Cambios al router:**

1. Una ruta puede tener un segmento `:id`. Coincide solo con un entero positivo (`/^[1-9]\d*$/`). Con cualquier otro valor la ruta no existe y se aplica la regla 2 de la SPEC 03 (redirigir a `#/inicio`).
2. La vista recibe `{ perfil, titulo, parametros }`, donde `parametros` es `{ id: 12 }` (número) o `{}`.
3. `pintar()` puede devolver una función de limpieza. El router la llama antes de pintar la siguiente vista. Así se detienen el sondeo y la pantalla completa al salir.
4. Las rutas exactas de la SPEC 03 se siguen resolviendo igual.

### Estado del evento (`public/js/formato.js`)

| Estado | Condición (con `ahora`) | Etiqueta |
|---|---|---|
| `proximo` | `ahora < inicio` | Próximo |
| `en_curso` | `inicio ≤ ahora ≤ fin` | En curso |
| `terminado` | `ahora > fin` | Terminado |

`formato.js` también da formato a fechas y horas con `Intl.DateTimeFormat('es-MX')` (por ejemplo "jue 26 nov · 10:00–12:00"), convierte entre ISO y el valor de un `<input type="datetime-local">`, y traduce el estado de una asistencia:

| `estado` de asistencia | Etiqueta |
|---|---|
| `valida` | Válida |
| `fuera_de_rango` | Fuera de rango |
| `fuera_de_horario` | Fuera de horario |
| `sin_ubicacion` | Sin ubicación |

### Formulario de evento

| Campo | Control | Obligatorio | Validación en el cliente |
|---|---|---|---|
| `nombre` | texto | Sí | No vacío tras `trim()` |
| `descripcion` | área de texto | No | — |
| `lugar` | texto | No | — |
| `inicio` | `datetime-local` | Sí | — |
| `fin` | `datetime-local` | Sí | Posterior a `inicio` |
| `latitud` | número (`step="any"`) | Sí | Entre −90 y 90 |
| `longitud` | número (`step="any"`) | Sí | Entre −180 y 180 |
| `radio_m` | número | No (100 por defecto) | Entero mayor que 0 |

- Las fechas se envían como `new Date(valorLocal).toISOString()`. Al editar, el ISO del servidor se convierte a la hora local del dispositivo.
- Los errores se muestran junto a su campo y no se envía nada hasta corregirlos.
- Mientras se guarda, el botón dice "Guardando…" y queda deshabilitado.
- Al crear lleva a `#/eventos/:id/qr` del evento nuevo. Al editar lleva a `#/mis-eventos`.

### Geolocalización (`public/js/ubicacion.js`)

- `obtenerUbicacion()` envuelve `navigator.geolocation.getCurrentPosition` con `enableHighAccuracy: true`, `timeout: 15000` y `maximumAge: 0`.
- Devuelve `{ ok: true, latitud, longitud, precision }` o `{ ok: false, error }`, con `error` igual a `'negado'`, `'no_disponible'`, `'tiempo_agotado'` o `'no_soportado'`.
- El botón "Usar mi ubicación" muestra "Obteniendo ubicación…" y luego llena los campos con 6 decimales y muestra "Precisión ±25 m".
- Si el permiso se niega, muestra: "Permiso de ubicación negado. Escribe las coordenadas o actívalo en la configuración del navegador."
- Sin `navigator.geolocation` o fuera de un contexto seguro, el botón se oculta y queda una nota: "La ubicación automática requiere HTTPS."
- La spec del alumno reutilizará este módulo.

### Sondeo en vivo

- QR y Asistentes piden `GET /api/eventos/:id/asistencias` al entrar y luego cada **5 s**.
- Se usa `setTimeout` encadenado: la siguiente petición se programa cuando termina la anterior, así nunca se acumulan.
- Con `document.hidden` el sondeo se pausa. Al volver a la pestaña se pide de inmediato y se reanuda.
- Si una petición falla, se conserva el último dato y aparece "Sin conexión · último dato 10:42". Se sigue intentando cada 5 s.
- Al salir de la vista, la función de limpieza cancela el temporizador y quita el listener de `visibilitychange`.

### Vistas

**Mis eventos**
- Botón "Nuevo evento" arriba.
- Una tarjeta por evento, en el orden que devuelve la API (por `inicio`): nombre, lugar, horario, etiqueta de estado y los botones QR, Asistentes, Editar y Eliminar.
- Cuadrícula de 1, 2 o 3 columnas según el ancho, igual que el home.
- Estados:
  - **Cargando:** "Cargando eventos…".
  - **Sin datos:** "Aún no hay eventos" con un botón "Crear el primero".
  - **Error:** el mensaje correspondiente con un botón "Reintentar".
  - **Datos guardados:** sin conexión y con `asistqr:eventos`, aviso "Sin conexión · datos guardados el 26/11 18:00". QR, Asistentes, Editar y Eliminar quedan deshabilitados.
- Eliminar pide `confirm('¿Eliminar «Tutoría Grupal 5A»? También se eliminarán sus asistencias.')`. Si se acepta y el servidor responde 204, la tarjeta desaparece sin recargar.

**QR del evento**
- Nombre, lugar y horario del evento (`obtenerEvento`).
- Imagen del QR grande y el token en letra monoespaciada, para escribirlo a mano.
- Contador "12 asistentes" que cambia con el sondeo.
- Botones: "Pantalla completa", "Ver asistentes" y "Lista de asistencia".
- "Pantalla completa" llama `requestFullscreen()` sobre un contenedor con solo el nombre, el QR, el token y el contador en grande. Esc o el botón "Salir" vuelven a la vista. Si el navegador no tiene `requestFullscreen` (Safari en iPhone), el botón no aparece.
- Sin conexión al entrar, muestra "Se necesita conexión para mostrar el QR". El QR no se guarda localmente.

**Asistentes**
- Encabezado con el nombre del evento y el total.
- Una fila por registro, en el orden de la API (`capturada_en`): nombre, matrícula, hora de captura, etiqueta de estado, distancia en metros si existe, y la marca "Sincronizado" si `offline` es verdadero.
- Botón eliminar por fila. Pide `confirm('¿Eliminar el registro de Ana López?')`. Con 204, la fila desaparece al instante y el total baja en 1.
- Sin datos: "Todavía no hay asistentes". Botones para ir al QR y a la lista.

**Lista de asistencia**
- Lista de eventos, la misma fuente que Mis eventos, cada uno con el botón "Abrir lista", que llama `abrirLista(id)`.
- Sin conexión: los eventos guardados se muestran y el botón queda deshabilitado con el texto "Se necesita conexión".

### Archivos

```
public/js/
  api.js                       ← + pedir() interno y las funciones de la tabla
  almacen.js                   ← + leerEventos(), guardarEventos(eventos), quitarEvento(id)
  formato.js                   ← fechas, estado del evento, etiquetas de estado de asistencia
  ubicacion.js                 ← obtenerUbicacion()
  sondeo.js                    ← iniciarSondeo(funcion, ms) → detener()
  router.js                    ← parámetros :id, función de limpieza, rutas nuevas
  vistas/
    mis-eventos.js
    evento-formulario.js       ← crear y editar
    evento-qr.js
    evento-asistentes.js
    listas.js
test/pwa.test.js               ← + entrega de los módulos nuevos
README.md                      ← + sección de las vistas del organizador
```

- Todo texto que viene del servidor o del usuario se inserta con `textContent`, nunca con `innerHTML`.
- La colección de Postman no cambia porque la API no cambia.

---

## Plan de implementación

1. **Router con parámetros y limpieza.**
   - En `router.js`, reconocer los patrones con `:id`, pasar `parametros` a la vista y llamar la función de limpieza de la vista anterior.
   - Registrar las 6 rutas del organizador. Por ahora apuntan a `en-construccion.js`.
   - Prueba manual: `#/eventos/3/qr` muestra "En construcción" con el título "QR del evento". `#/eventos/abc/qr` y `#/eventos/0/qr` redirigen a `#/inicio`. Un alumno en `#/eventos/3/qr` es redirigido a `#/inicio`.
2. **Capa de datos.**
   - En `api.js`, agregar `pedir()` y las funciones de lectura (`listarEventos`, `obtenerEvento`, `obtenerQr`, `listarAsistentes`).
   - En `almacen.js`, agregar `leerEventos`, `guardarEventos` y `quitarEvento`.
   - Crear `formato.js`.
   - Prueba manual desde la consola: `listarEventos()` devuelve `{ ok: true, datos: [...] }`, y en modo Offline devuelve `sin_conexion`.
3. **Mis eventos (lectura).**
   - Crear `vistas/mis-eventos.js` con los estados cargando, sin datos, error y datos guardados.
   - Conectarla a `#/mis-eventos`.
   - Prueba manual: se ven los 2 eventos de prueba. En modo Offline se ve el aviso de datos guardados.
4. **Eliminar evento.**
   - Agregar `eliminarEvento` a `api.js` y el botón Eliminar con `confirm()` en Mis eventos.
   - Prueba manual: al eliminar, la tarjeta desaparece y `asistqr:eventos` ya no lo contiene.
5. **Formulario de evento.**
   - Agregar `crearEvento` y `editarEvento` a `api.js`.
   - Crear `vistas/evento-formulario.js` con validación, conversión de fechas y redirección al guardar.
   - Conectarla a `#/nuevo-evento` y `#/eventos/:id/editar`.
   - Prueba manual: crear un evento lleva a su ruta de QR (todavía "En construcción"). Editarlo y guardar lleva a Mis eventos con los datos nuevos.
6. **Ubicación del evento.**
   - Crear `ubicacion.js` y el botón "Usar mi ubicación" en el formulario.
   - Prueba manual: en `localhost` el botón llena latitud y longitud. Al negar el permiso aparece el mensaje y los campos siguen editables.
7. **Sondeo y QR del evento.**
   - Crear `sondeo.js`.
   - Crear `vistas/evento-qr.js` con QR, token, contador en vivo y pantalla completa.
   - Conectarla a `#/eventos/:id/qr`.
   - Prueba manual: registrar una asistencia desde Postman hace que el contador suba en ≤ 5 s sin tocar nada. En la pestaña Red de DevTools no hay peticiones nuevas después de salir de la vista.
8. **Asistentes.**
   - Agregar `eliminarAsistencia` a `api.js`.
   - Crear `vistas/evento-asistentes.js` con las filas, el sondeo y el botón eliminar.
   - Conectarla a `#/eventos/:id/asistentes`.
9. **Lista de asistencia.**
   - Agregar `abrirLista(id)` a `api.js`.
   - Crear `vistas/listas.js` y conectarla a `#/listas`.
   - Conectar el botón "Lista de asistencia" de las vistas QR y Asistentes.
10. **Tests y documentación.**
    - En `test/pwa.test.js`, comprobar que cada módulo nuevo responde 200 con un tipo JavaScript.
    - Documentar en `README.md` las vistas del organizador, sus rutas y la clave `asistqr:eventos`.

---

## Criterios de aceptación

- [x] `#/eventos/abc/qr`, `#/eventos/0/qr` y `#/eventos/3/xyz` redirigen a `#/inicio`.
- [x] Un alumno que escribe `#/eventos/1/qr` o `#/mis-eventos` es redirigido a `#/inicio`.
- [x] Mis eventos muestra los eventos de `GET /api/eventos` con nombre, lugar, horario y la etiqueta Próximo, En curso o Terminado correcta.
- [x] Con la base sin eventos, Mis eventos muestra "Aún no hay eventos" y el botón "Crear el primero".
- [x] Después de abrir Mis eventos con conexión, `asistqr:eventos` contiene el listado y `guardadoEn`.
- [x] Con DevTools en Offline, Mis eventos muestra los eventos guardados, el aviso "Sin conexión · datos guardados el …" y los botones de acción deshabilitados.
- [x] Offline y sin `asistqr:eventos`, Mis eventos muestra el error de conexión y el botón "Reintentar".
- [x] Cancelar el `confirm()` de eliminar no borra nada.
- [x] Aceptar el `confirm()` elimina el evento en el servidor, quita su tarjeta sin recargar y lo quita de `asistqr:eventos`.
- [x] Guardar el formulario sin nombre, con `fin` anterior a `inicio` o con latitud fuera de rango muestra el error junto al campo y no hace ninguna petición.
- [x] Crear un evento válido responde 201 y lleva a `#/eventos/:id/qr` del evento nuevo.
- [x] `#/eventos/:id/editar` aparece precargado con los datos del evento y la hora local correcta.
- [x] Editar y guardar lleva a `#/mis-eventos` con los datos actualizados.
- [x] Un evento creado a las 10:00 locales se muestra a las 10:00 en Mis eventos y en el formulario de edición.
- [x] "Usar mi ubicación" llena latitud y longitud con 6 decimales y muestra la precisión.
- [x] Al negar el permiso de ubicación aparece el mensaje de permiso negado y los campos siguen editables.
- [x] Con un PIN guardado incorrecto, crear, editar, eliminar o ver el QR muestra "Tu PIN ya no es válido. Actualízalo en Perfil." con el enlace.
- [x] Sin conexión, guardar el formulario muestra "Se necesita conexión para esta acción." y no guarda nada.
- [x] La vista QR muestra la imagen del QR, el token de 6 caracteres y el contador de asistentes.
- [x] Registrar una asistencia desde Postman hace que el contador del QR suba en 5 s o menos sin recargar.
- [x] Con la pestaña oculta, la pestaña Red de DevTools no muestra peticiones a `/asistencias`. Al volver, se pide de inmediato.
- [x] Después de salir de la vista QR o de Asistentes no se hacen más peticiones a `/asistencias`.
- [x] Si se corta la conexión en la vista QR, el contador conserva el último valor y aparece "Sin conexión · último dato …". Al reconectar se actualiza solo.
- [x] "Pantalla completa" muestra solo el nombre, el QR, el token y el contador. Esc regresa a la vista normal.
- [x] Asistentes lista cada registro con nombre, matrícula, hora, etiqueta de estado y la marca "Sincronizado" cuando `offline` es verdadero.
- [x] Eliminar un registro tras el `confirm()` lo quita de la lista al instante y el total baja en 1.
- [x] Abrir el QR de un evento eliminado muestra "El evento ya no existe." con el enlace a Mis eventos.
- [x] En `#/listas`, "Abrir lista" abre en otra pestaña la lista SSR del evento sin pedir el PIN.
- [x] Los botones "Lista de asistencia" de las vistas QR y Asistentes abren la misma lista SSR.
- [x] Un evento cuyo nombre es `<b>x</b>` se muestra como texto literal en todas las vistas.
- [x] Las vistas Mis eventos, QR y Asistentes se ven sin desplazamiento horizontal a 375 px, 768 px y 1280 px.
- [x] La consola del navegador no muestra errores al recorrer todas las rutas del organizador.
- [x] `npm test` pasa todos los tests: los anteriores y los nuevos de `test/pwa.test.js`.

---

## Decisiones

- **Sí:** solo las vistas del organizador en esta spec. Sin eventos creados y un QR proyectado, el alumno no tiene nada que escanear.
- **No:** incluir la vista Eventos del alumno. Comparte las tarjetas, pero su filtro y su flujo pertenecen a la spec del alumno.
- **Sí:** parámetros en la ruta (`#/eventos/:id/qr`). Las URL son legibles y el router solo aprende un patrón.
- **No:** query en el hash (`#/qr?id=12`). Mezcla dos formas de leer la ruta.
- **Sí:** `:id` solo acepta enteros positivos. Una ruta mal escrita se trata como inexistente, sin pedir nada al servidor.
- **Sí:** las vistas pueden devolver una función de limpieza. Es la forma más simple de que el sondeo no siga corriendo en segundo plano.
- **Sí:** QR y Asistentes en vistas separadas. Al proyectar el QR no se ven los nombres ni las matrículas de los alumnos.
- **No:** una sola vista con QR y lista. Expone datos personales en la pantalla del auditorio.
- **Sí:** sondeo cada 5 s con `setTimeout` encadenado. Se nota "en vivo" en la demo, no satura el servidor y las peticiones nunca se enciman.
- **No:** `setInterval`. Si el servidor tarda más de 5 s, las peticiones se acumulan.
- **No:** WebSockets o Server-Sent Events. Agregan infraestructura en el servidor para algo que el sondeo resuelve.
- **Sí:** pausar el sondeo con la pestaña oculta. Ahorra batería y peticiones sin que el usuario lo note.
- **Sí:** botón "Usar mi ubicación" y campos editables. El organizador suele crear el evento en el mismo lugar, y si niega el permiso o el GPS falla todavía puede escribir las coordenadas.
- **No:** mapa con Leaflet. Agrega una librería y teselas externas que no funcionan sin conexión.
- **Sí:** `ubicacion.js` como módulo aparte. La spec del alumno lo reutiliza para el registro de asistencia.
- **Sí:** guardar el último listado en `asistqr:eventos` y mostrarlo sin conexión. Cubre el estado "mostrando datos guardados" y deja la clave lista para el alumno.
- **No:** cola offline para crear, editar o eliminar eventos. Esas acciones se hacen con calma y conexión. Sincronizarlas abriría conflictos que no aportan al caso de estudio.
- **No:** guardar el QR localmente. Contiene el token secreto, y proyectar sin conexión no sirve de nada porque los registros no llegarían al servidor en vivo.
- **Sí:** al crear un evento se va directo a su QR. Lo normal es crearlo y proyectarlo enseguida. Al editar se regresa a Mis eventos.
- **Sí:** pantalla completa con la Fullscreen API. El QR se ve grande al proyectar y no aparecen la barra de la app ni la del navegador.
- **Sí:** ocultar el botón de pantalla completa donde no existe (Safari en iPhone). Es preferible a un botón que no hace nada.
- **Sí:** `confirm()` nativo para eliminar. Basta para evitar borrados accidentales sin código de interfaz extra.
- **No:** diálogo propio ni "deshacer". Más código para el mismo resultado en la demo.
- **Sí:** abrir la lista SSR con un formulario POST que lleva el PIN guardado, en otra pestaña. El organizador no vuelve a escribir el PIN y la lista se puede imprimir aparte.
- **No:** enlace simple a `/eventos/:id/lista`. Obligaría a escribir el PIN cada vez.
- **Sí:** un solo formato de resultado (`{ ok, datos | error }`) para todas las peticiones. Las vistas muestran los errores siempre igual.
- **Sí:** validación en el cliente igual a la del servidor. El usuario ve el error al instante, y el servidor sigue siendo la validación que cuenta.
- **Sí:** fechas en `datetime-local` convertidas con la hora local del dispositivo. El servidor guarda ISO en UTC y cada pantalla muestra la hora local.
- **Sí:** tests del servidor solo para la entrega de los módulos nuevos. El resto se verifica a mano, igual que en la SPEC 03.
- **No:** cambios en la API. Todo lo que necesitan las vistas ya existe desde la SPEC 01, así que la colección de Postman no cambia.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La conversión entre `datetime-local` e ISO corre las horas por la zona horaria | Las conversiones viven solo en `formato.js`. Un criterio de aceptación compara la hora creada con la mostrada. |
| El sondeo sigue corriendo después de salir de la vista | Función de limpieza obligatoria en QR y Asistentes. Un criterio de aceptación lo verifica en la pestaña Red. |
| El GPS es impreciso en interiores al fijar la ubicación del evento | Se muestra la precisión. Los campos se pueden corregir y `radio_m` se puede ampliar (150–200 m). |
| La geolocalización no funciona desde el celular por la IP local (no es HTTPS) | Usar la dirección HTTPS de ngrok. Sin contexto seguro el botón se oculta y se escriben las coordenadas. |
| El navegador bloquea la pestaña nueva de la lista SSR | El formulario se envía dentro del manejador del clic, que cuenta como acción del usuario. |
| La caché del navegador sirve versiones viejas de los módulos JS | Recargar sin caché (Ctrl+Shift+R) mientras no exista el Service Worker. |
| Se elimina un evento mientras otra pestaña muestra su QR | El sondeo recibe 404 y la vista muestra "El evento ya no existe." en lugar del contador. |

---

## Lo que **no** está en esta spec

- Vistas del alumno (Eventos, Escanear QR, Mi historial).
- Cámara, vibración y geolocalización del alumno.
- Service Worker, cachés, página offline e instalación.
- Cola offline, también para las acciones del organizador.
- Notificaciones.
- Mapa para la ubicación del evento.
- Borrar el perfil.
- Cambios en la API o en la vista SSR.
- Tests automáticos del cliente.

Cada uno de estos puntos, si se hace, va en su propia spec.
