# AsistQR — Planeación del proyecto

> **Producto 02: Aplicación Web Progresiva con base en un caso de estudio**
> Universidad Tecnológica de Puebla · Tecnologías de la Información · Aplicaciones Web Progresivas
>
> Documento de planeación y justificación. No contiene código: describe **qué** se va a construir, **cómo** se cubre cada criterio de la rúbrica y **por qué** se tomó cada decisión.

---

## 1. Caso de estudio

### 1.1 Problemática

En la UTP, la asistencia a tutorías, asesorías, conferencias y eventos académicos se registra en listas de papel o pasando lista de viva voz. Esto provoca:

- **Pérdida de tiempo:** pasar lista consume varios minutos de cada sesión.
- **Suplantación:** un compañero puede firmar por otro que no asistió.
- **Errores y pérdida de información:** las hojas se extravían o se capturan mal después.
- **Conectividad inestable:** en auditorios, laboratorios y espacios abiertos del campus la señal de Internet falla, así que una solución que solo funcione en línea no es confiable.

### 1.2 Solución propuesta

**AsistQR** es una PWA en la que:

1. El **organizador** crea un evento (nombre, lugar, horario y ubicación) y proyecta un **código QR**.
2. El **alumno** escanea el QR con la **cámara** de su celular, y la app toma su **ubicación GPS** para comprobar que está físicamente en el lugar.
3. La asistencia se envía al servidor. **Si no hay conexión, se guarda en el dispositivo y se sincroniza automáticamente** cuando regresa la señal.
4. El organizador consulta una **lista de asistencia generada en el servidor**, lista para imprimir o guardar en PDF.
5. La app **notifica** los eventos importantes: asistencia registrada, guardada sin conexión, sincronizada, evento próximo, etc.

### 1.3 Usuarios

| Rol | Funciones |
|---|---|
| **Organizador** (docente o tutor) | Crear, editar y eliminar eventos; mostrar el QR con un contador de asistentes en vivo; consultar e imprimir la lista; eliminar registros erróneos. |
| **Alumno** | Registrar su perfil (matrícula y nombre); escanear el QR; consultar su historial de asistencias, también sin conexión. |

**Decisión:** no habrá inicio de sesión con contraseña. El perfil se guarda en el dispositivo y las acciones del organizador se protegen con un **PIN**.
**Justificación:** la rúbrica no evalúa autenticación, y un sistema de login consumiría tiempo que se necesita para los requisitos que sí se califican. El PIN basta para que un alumno no pueda crear ni borrar eventos.

---

## 2. Tecnologías y justificación

| Parte | Tecnología elegida | Justificación |
|---|---|---|
| Interfaz de la PWA | HTML, CSS y **JavaScript puro** | Es lo visto en clase (proyecto EJEMPLOPWA). No depende de frameworks, es más ligero y permite demostrar el manejo directo del DOM, del Service Worker y de las APIs del navegador. |
| Funcionamiento offline | **Service Worker propio** | Requisito explícito del documento. Escribirlo a mano, en vez de generarlo con una herramienta, permite explicar cada estrategia de caché en la documentación. |
| Datos locales | **LocalStorage** | El documento acepta "IndexedDB o LocalStorage". Es lo visto en clase, es simple de usar y de inspeccionar en DevTools, y el volumen de datos (perfil, historial, unas cuantas asistencias pendientes) es pequeño. |
| Servidor | **Node.js con Express** | Permite tener en un solo proyecto la entrega de la PWA, la API y la vista del servidor. Usa JavaScript, el mismo lenguaje del cliente. |
| Base de datos | **SQLite** | Es un archivo dentro del proyecto: no requiere instalar ni configurar un servidor de base de datos ni crear cuentas externas. Los datos persisten mientras el proyecto exista. |
| Vista del servidor | **EJS** (motor de plantillas) | Se integra directamente con Express y su sintaxis es HTML con marcas para insertar datos. Además, escapa automáticamente los datos para evitar inyección de HTML. |
| Lectura de QR | Librería **html5-qrcode** | Resuelve el acceso a la cámara y la decodificación del QR. Se guarda dentro del proyecto (no por CDN) para que funcione sin conexión. |
| Generación de QR | Librería **qrcode** en el servidor | El QR contiene un código secreto del evento que solo el servidor conoce, así que debe generarse ahí. |
| HTTPS para pruebas | **ngrok** | La cámara, la geolocalización y el Service Worker solo funcionan con HTTPS (o en localhost). ngrok da una dirección HTTPS temporal para probar desde el celular sin desplegar. |

### ¿Por qué un servidor propio y no jsonplaceholder?
En clase se usó jsonplaceholder como API de ejemplo, pero **no guarda los datos de verdad** (solo simula la respuesta) y **no permite generar vistas en el servidor**. El proyecto necesita persistencia real (las asistencias deben quedar registradas) y una vista SSR, así que un servidor propio es indispensable.

---

## 3. Arquitectura general

```
┌────────────────────── Celular / navegador ──────────────────────┐
│                                                                  │
│   Interfaz PWA (HTML + CSS + JS)  ◄──►  LocalStorage             │
│              │                          (perfil, historial,     │
│              ▼                           eventos, cola offline) │
│        Service Worker                                            │
│   (caché estático + caché dinámico + sincronización)            │
└──────────────┬───────────────────────────────────────────────────┘
               │ HTTPS (ngrok)
               ▼
┌──────────────────────── Servidor Node.js + Express ─────────────┐
│   • Entrega los archivos de la PWA                               │
│   • API REST  (/api/eventos, /api/asistencias)                   │
│   • Vista SSR (/eventos/:id/lista) con EJS                       │
│              │                                                   │
│              ▼                                                   │
│        SQLite (asistqr.db)                                       │
└──────────────────────────────────────────────────────────────────┘
```

**Decisión:** la PWA y la API se sirven desde **el mismo servidor y el mismo dominio**.
**Justificación:** el Service Worker solo controla las peticiones de su propio origen. Si todo está en el mismo dominio, el caché y la sincronización son más sencillos y no hace falta configurar CORS.

---

## 4. Modelo de datos

### 4.1 Base de datos del servidor

Dos tablas con relación **uno a muchos**: un evento tiene muchas asistencias.

**Tabla `eventos`**

| Campo | Descripción |
|---|---|
| id | Identificador |
| nombre, descripción, lugar | Datos del evento |
| inicio, fin | Horario en que se acepta asistencia |
| latitud, longitud | Ubicación del evento |
| radio en metros | Distancia máxima permitida (100 m por defecto) |
| token | Código secreto que va dentro del QR; nunca se envía a los alumnos |
| fecha de creación | — |

**Tabla `asistencias`**

| Campo | Descripción |
|---|---|
| id | Identificador |
| uuid | Identificador único que genera el celular |
| evento | Referencia al evento |
| matrícula, nombre | Quién asistió |
| latitud, longitud, precisión | Dónde estaba al escanear |
| distancia | Distancia al evento, calculada por el servidor |
| hora de captura | Momento exacto del escaneo |
| hora de recepción | Momento en que llegó al servidor |
| offline | Indica si llegó por sincronización |
| estado | Válida, fuera de rango o fuera de horario |

Regla: un alumno solo puede registrarse **una vez por evento**.

**Decisiones clave y su justificación:**

| Decisión | Justificación |
|---|---|
| Guardar la **hora de captura** (cuando se escaneó) y no solo la hora de llegada | Si el alumno escanea sin conexión a las 10:05 y su celular se sincroniza a las 11:30, cuando el evento ya terminó, su asistencia debe seguir siendo válida. Se valida con la hora real del escaneo. |
| Cada registro lleva un **uuid** generado en el celular | Si la sincronización falla a medias y se reintenta, el servidor reconoce el registro y no lo duplica (idempotencia). |
| El **token** del QR nunca se envía a los alumnos | Evita que un alumno obtenga el código desde la API y registre asistencia sin estar en el lugar. |
| La **distancia** la calcula el servidor | El cliente podría manipularse; la validación debe hacerse donde el usuario no tiene control. |
| No hay tabla de alumnos | Se evita el registro de usuarios; matrícula y nombre se guardan en cada asistencia. Cumple el caso de estudio con menos complejidad. |

### 4.2 Datos locales (LocalStorage)

| Dato | Contenido | Para qué |
|---|---|---|
| Perfil | Matrícula, nombre y rol | Identificar al usuario sin login |
| Eventos | Último listado descargado | Consultarlos sin conexión |
| Historial | Asistencias del alumno, marcadas como sincronizadas o pendientes | Ver el historial sin conexión |
| Cola | Lista de asistencias pendientes de enviar | Sincronización posterior |
| PIN | PIN del organizador | Autorizar sus acciones |
| Última sincronización | Fecha | Mostrarla en la interfaz |

**Decisión:** la cola es una **lista** de registros.
**Justificación:** en el ejemplo de clase se guardaba un solo objeto, y cada registro nuevo sobrescribía al anterior. Con una lista no se pierde ninguna asistencia aunque se hagan varias sin conexión.

---

## 5. API del servidor

| Operación | Recurso | Quién la usa |
|---|---|---|
| Consultar todos / uno | Eventos | Todos |
| Crear | Evento | Organizador (PIN) |
| Modificar | Evento | Organizador (PIN) |
| Eliminar | Evento | Organizador (PIN) |
| Obtener imagen del QR | Evento | Organizador (PIN) |
| Consultar asistentes | Asistencias de un evento | Organizador (contador en vivo) |
| Registrar | Asistencia | Alumno |
| Consultar historial | Asistencias por matrícula | Alumno |
| Eliminar registro erróneo | Asistencia | Organizador (PIN) |

**Validaciones al registrar una asistencia:**
1. El token del QR coincide con el del evento; si no, se rechaza.
2. La hora de captura está dentro del horario del evento (con 10 minutos de tolerancia antes del inicio).
3. La distancia entre el alumno y el evento es menor o igual al radio permitido, considerando la precisión del GPS.
4. Si el uuid ya existe, se responde como éxito sin duplicar.
5. Si el alumno ya tenía registro en ese evento, se informa que ya está registrado.

**Justificación:** cubre las cuatro operaciones que pide el documento (consulta, registro, modificación y eliminación), y la validación en el servidor es la que realmente resuelve el problema de la suplantación.

---

## 6. Cobertura de la rúbrica

### 6.1 Pantalla Splash y Home (10 %)

**Splash:**
- Logotipo, nombre "AsistQR" y lema "Tu asistencia en un escaneo", con una animación de entrada.
- Se muestra **mientras la app realmente se prepara**: registro del Service Worker, lectura del perfil y carga de eventos. No es un retraso artificial.
- El manifest define nombre, colores e íconos de 192 y 512 px, para que el sistema muestre también su splash nativo al abrir la app instalada.

**Home:**
- Saludo con el nombre del usuario. Si no hay perfil, se pide primero.
- Indicador de conexión (en línea / sin conexión) que cambia en tiempo real.
- Contador de asistencias pendientes de sincronizar.
- Botón para activar notificaciones.
- Accesos según el rol:
  - **Alumno:** Escanear QR, Mi historial, Eventos, Perfil.
  - **Organizador:** Mis eventos, Nuevo evento, Lista de asistencia, Perfil.

**Diseño responsivo:** pensado primero para celular y adaptado a tablet y escritorio, con botones de tamaño táctil.

**Justificación:** el home muestra el estado de la conexión y las tareas pendientes porque son la información más relevante en un caso donde la señal es inestable. Separar opciones por rol mantiene la navegación simple.

### 6.2 Vistas del lado del cliente (10 %)

La app funciona como una sola página: las pantallas se muestran y ocultan con JavaScript, sin recargar. Cada vista se construye modificando el DOM con datos obtenidos de la API de forma asíncrona.

| Vista | Qué muestra | Interacción dinámica |
|---|---|---|
| Eventos | Tarjetas con los eventos | Filtro por próximos, activos y pasados |
| Mi historial | Asistencias del alumno | Las pendientes se marcan y se actualizan al sincronizar |
| Formulario de evento | Crear o editar | Se guarda sin recargar y la lista se actualiza |
| QR del evento | Imagen del QR | **Contador de asistentes en vivo** que se actualiza cada pocos segundos |
| Asistentes | Lista de quienes registraron | Eliminar un registro lo quita de la pantalla al instante |

Cada vista contempla los estados **cargando**, **sin datos**, **error** y **mostrando datos guardados** (sin conexión).

**Justificación:** el contador en vivo es la demostración más clara de interfaz dinámica con peticiones asíncronas: la pantalla cambia sola mientras los alumnos escanean.

### 6.3 Vista del lado del servidor (10 %)

**Lista de asistencia de un evento**, generada por el servidor con EJS:
- El servidor consulta la base de datos y **calcula**: total de registros, válidos, fuera de rango, fuera de horario y cuántos llegaron por sincronización offline.
- Envía al navegador el **HTML completo**, con la tabla y los totales ya escritos.
- Incluye la fecha de generación y un formato apto para impresión.

**Cómo se demuestra:** al abrir "Ver código fuente" aparecen los nombres de los alumnos escritos en el HTML. En las vistas del cliente no aparecen, porque se insertan después con JavaScript.

**Justificación:** la lista es el documento "oficial" del evento. Generarla en el servidor garantiza que se muestre completa de inmediato, que se pueda imprimir tal cual y que no dependa de la lógica del cliente. Es el caso en el que el renderizado en servidor tiene más sentido.

### 6.4 Administración de datos locales (10 %)

- El perfil, los eventos consultados, el historial y la cola se guardan en LocalStorage.
- Cada asistencia se guarda localmente **antes** de intentar enviarla, y se marca como sincronizada cuando el servidor la confirma.
- Los datos persisten al cerrar y volver a abrir la app, y pueden consultarse sin conexión.

**Justificación:** guardar primero y enviar después garantiza que ninguna asistencia se pierda, aunque la conexión se caiga justo en el momento del envío.

### 6.5 Administración de datos remotos (10 %)

- La PWA consume la API del servidor con peticiones asíncronas.
- Usa las cuatro operaciones: consulta, registro, modificación y eliminación (sección 5).
- Las respuestas se procesan y se muestran en la interfaz, y cada error tiene un mensaje claro: QR inválido, ya registrado, sin conexión, evento inexistente.

### 6.6 Funcionamiento offline (10 %)

**Service Worker con dos cachés:**

| Caché | Qué guarda | Cuándo |
|---|---|---|
| **Estático** | Los archivos esenciales: páginas, estilos, scripts, íconos, librería QR y página offline | Al instalarse el Service Worker |
| **Dinámico** | Lo que se va consultando: respuestas de la API, imágenes y otros recursos | Durante el uso de la app |

**Estrategias por tipo de recurso:**

| Recurso | Estrategia | Justificación |
|---|---|---|
| Archivos de la app | **Caché primero**, red si no está | Cargan al instante y funcionan sin conexión. |
| Consultas a la API | **Red primero**, caché si no hay red | Con internet los datos siempre están actualizados; sin internet se muestran los últimos guardados. |
| Páginas no guardadas (como la lista SSR) | Red; si falla, **página offline** | El usuario ve un mensaje claro en vez de un error del navegador. |
| Envíos de datos (registrar, editar, eliminar) | No se guardan en caché | Los maneja la cola de sincronización. |

Al activarse una versión nueva del Service Worker se **eliminan los cachés viejos**, para que los usuarios reciban siempre la versión actual.

**Sincronización de operaciones offline:**
1. El alumno escanea el QR y la app arma el registro con su ubicación y la hora del escaneo.
2. Si hay conexión, se envía de inmediato.
3. Si no hay conexión, o el envío falla, se guarda en la cola y se solicita una sincronización en segundo plano (Background Sync).
4. Cuando regresa la conexión, se envían todos los pendientes. Los confirmados, o los que el servidor reporta como ya registrados, se quitan de la cola.
5. Se notifica al usuario cuántas asistencias se sincronizaron.

**Decisiones y su justificación:**
- **Doble mecanismo de sincronización:** Background Sync, más un respaldo con el evento de reconexión del navegador. Background Sync solo existe en navegadores basados en Chrome, y el respaldo garantiza que funcione también en Firefox y Safari.
- **El Service Worker avisa a la página para que ella haga el envío:** el Service Worker no puede leer LocalStorage, así que la página, que sí puede, es la que envía la cola.

**Mejoras respecto al ejemplo de clase** (conviene mencionarlas en la documentación):
1. En el ejemplo, el Service Worker respondía **solo desde el caché**, así que cualquier recurso no guardado fallaba aun con internet. Ahora se consulta la red cuando hace falta.
2. En el ejemplo, la función de sincronización estaba en el archivo de la página pero se llamaba desde el Service Worker, donde no existe, así que los datos nunca se enviaban. Ahora el Service Worker y la página se comunican con mensajes.
3. En el ejemplo, la instalación no esperaba a que terminara el guardado en caché. Ahora sí espera.
4. En el ejemplo había un solo caché. Ahora hay uno estático y uno dinámico, como pide la rúbrica.

### 6.7 Notificaciones (10 %)

- El permiso se solicita **con un botón**, explicando para qué sirve, y no de forma automática al abrir la app.
- Si el usuario lo niega, se le explica cómo reactivarlo.
- Las notificaciones se muestran a través del Service Worker, para que funcionen también en Android y en la app instalada.

| Evento | Para quién | Ejemplo |
|---|---|---|
| Asistencia registrada | Alumno | "✅ Asistencia registrada en Tutoría Grupal 5A" |
| Registro fuera de rango u horario | Alumno | "⚠️ Tu registro quedó fuera del rango del evento" |
| Guardada sin conexión | Alumno | "📴 Se enviará automáticamente al reconectar" |
| Sincronización completa | Alumno | "🔄 Se enviaron 2 asistencias pendientes" |
| Evento próximo (15 minutos antes) | Alumno | "⏰ Conferencia de IA empieza a las 10:00" |
| Nuevo asistente | Organizador | "👤 Ana López registró asistencia (12)" |

**Justificación:** la rúbrica pide notificaciones "relacionadas con la problemática". Cada una responde a una duda real del usuario: ¿quedó registrada mi asistencia?, ¿se envió lo que hice sin señal?, ¿cuándo empieza mi evento?
**Extra opcional:** notificaciones push (con la app cerrada) para avisar de eventos nuevos.

### 6.8 Acceso a recursos físicos del dispositivo (10 %)

Se integran **tres** recursos, todos con una función real en el caso:

| Recurso | Uso | Si el usuario niega el permiso |
|---|---|---|
| **Cámara** | Escanear el QR del evento | Puede escribir el código manualmente |
| **Geolocalización** | Comprobar que el alumno está en el lugar; el organizador la usa para fijar la ubicación del evento | El registro se envía sin ubicación, queda marcado y se avisa al usuario |
| **Vibración** | Confirmar el escaneo (vibración corta) o avisar de un error (patrón distinto) | Se omite en dispositivos que no la soportan (iOS) |

- Cada permiso se pide **solo cuando se necesita** y con una explicación previa.
- Se verifica que la conexión sea segura (HTTPS), porque el navegador lo exige.

**Justificación:** la rúbrica pide "al menos un" recurso "con utilidad funcional". La cámara y el GPS **son el núcleo de la solución**: sin ellos no habría forma de evitar la suplantación. La vibración mejora la experiencia en un entorno ruidoso como un auditorio.

### 6.9 Documentación técnica (10 %)
Ver la sección 9.

### 6.10 Integración y demostración (10 %)
Ver la sección 10. Todas las decisiones de este documento sirven como la **justificación técnica** que pide este criterio.

---

## 7. Identidad visual

- **Nombre:** AsistQR
- **Lema:** "Tu asistencia en un escaneo"
- **Colores**, tomados del ejemplo de clase para mantener coherencia:
  - Azul principal `#1a73e8`
  - Fondo gris claro `#f0f2f5`
  - Tarjetas blancas
  - Verde para "válida", rojo para errores y ámbar para avisos
- **Logotipo:** un código QR estilizado con una palomita de verificación.
- **Tipografía:** la fuente del sistema, que carga al instante y no depende de Internet.

---

## 8. Datos de prueba

Al arrancar por primera vez, el servidor crea dos eventos:
- **"Tutoría Grupal 5A"**, activo en ese momento, para demostrar el registro.
- **"Conferencia de IA"**, programado para el día siguiente, para mostrar eventos próximos.

Antes de la demostración hay que **ajustar la ubicación** de los eventos a donde se presentará, o crear uno nuevo con "Usar mi ubicación". Para probar distintas ubicaciones desde la computadora se puede simular el GPS en las herramientas de desarrollador del navegador.

---

## 9. Plan de pruebas y evidencias

| # | Prueba | Evidencia para el documento |
|---|---|---|
| 1 | Splash y Home en celular y escritorio | Capturas lado a lado |
| 2 | Instalación de la PWA | Ícono en el celular y app abierta en modo standalone |
| 3 | Vistas del cliente (crear, editar, eliminar eventos) | Pestaña Network mostrando peticiones sin recarga |
| 4 | Vista del servidor | Código fuente con los datos ya escritos en el HTML |
| 5 | Datos locales | Local Storage en DevTools, antes y después de cerrar la app |
| 6 | API | Peticiones de consulta, registro, modificación y eliminación con sus respuestas |
| 7 | Service Worker y cachés | Service Worker activo; cachés estático y dinámico con su contenido |
| 8 | Funcionamiento offline | App navegable en modo sin conexión |
| 9 | Sincronización | Registro en la cola → reconexión → cola vacía → registro en la lista con marca offline |
| 10 | Notificaciones | Solicitud de permiso y cada notificación de la tabla 6.7 |
| 11 | Cámara | Foto o video escaneando el QR |
| 12 | Geolocalización | Un registro "válido" y uno "fuera de rango" |
| 13 | Permisos negados | Funcionamiento de los respaldos |
| 14 | Lighthouse | Reporte de calidad de la PWA |

---

## 10. Estructura del documento técnico (PDF)

1. **Portada:** UTP, Aplicaciones Web Progresivas, "AsistQR — Control de asistencia con QR y geolocalización", integrantes, grupo y fecha.
2. **Introducción:** qué es AsistQR y su propósito.
3. **Planteamiento del problema:** sección 1.
4. **Desarrollo:**
   - Arquitectura (sección 3, con diagrama).
   - Tecnologías y su justificación (sección 2).
   - **Service Worker:** ciclo de vida, cachés, estrategias y mejoras sobre el ejemplo (sección 6.6).
   - **Manejo de datos:** modelo de datos, LocalStorage y flujo de sincronización (secciones 4 y 6.6).
   - Vistas del cliente frente a la vista del servidor.
   - Notificaciones y recursos físicos, con el manejo de permisos.
5. **Pruebas:** evidencias de la sección 9, organizadas en online, offline, notificaciones y recursos físicos.
6. **Conclusiones:**
   - Resultados obtenidos.
   - Dificultades: HTTPS necesario para el celular, Background Sync no disponible en todos los navegadores y precisión limitada del GPS en interiores.
   - Aprendizajes.

---

## 11. Guion de demostración (5 minutos)

1. Arrancar el servidor y abrir la app en el celular mediante la dirección HTTPS de ngrok. Se ve el splash y se instala la app.
2. **Organizador** (laptop): crear un evento usando la ubicación actual y mostrar el QR con el contador en vivo.
3. **Alumno** (celular): activar notificaciones y escanear. Vibra, llega la notificación ✅ y el contador de la laptop aumenta.
4. Poner el celular en **modo avión** y escanear otro evento: llega la notificación 📴 y la asistencia aparece como pendiente.
5. Quitar el modo avión: la sincronización es automática, llega la notificación 🔄 y el registro aparece en el servidor.
6. Abrir la **lista de asistencia (SSR)**, mostrar su código fuente e imprimirla.
7. Mostrar en DevTools los cachés, el Local Storage y la navegación sin conexión.

---

## 12. Cronograma (fin de semana)

| Bloque | Actividades |
|---|---|
| **Sábado, mañana** | Servidor: base de datos, API y vista SSR. Datos de prueba. |
| **Sábado, tarde** | Estructura de la PWA: splash, home, navegación entre vistas, estilos responsivos, manifest e íconos. Perfil en LocalStorage. |
| **Sábado, noche** | Vistas de eventos (crear, editar, eliminar) e historial. Escáner QR, geolocalización y vibración. Vista del QR con contador en vivo. |
| **Domingo, mañana** | Service Worker (cachés y página offline). Cola offline y sincronización. |
| **Domingo, tarde** | Notificaciones. Pruebas en un celular real con ngrok. Reporte de Lighthouse. |
| **Domingo, noche** | Captura de evidencias y redacción del documento PDF. |

**Riesgos y cómo mitigarlos:**

| Riesgo | Mitigación |
|---|---|
| La cámara o el GPS no funcionan en el celular | Usar siempre la dirección HTTPS de ngrok, nunca la IP local. |
| El GPS es impreciso en interiores | Radio del evento amplio (150–200 m) y considerar la precisión reportada. |
| Background Sync no existe en el navegador del celular | Respaldo con el evento de reconexión. |
| Cambios en archivos que no se reflejan por el caché | Cambiar la versión del caché en cada modificación y usar "Update on reload" en DevTools. |
| Falta de tiempo | Prioridad: requisitos de la rúbrica primero; push, IndexedDB y extras al final. |

---

## 13. Checklist final contra la rúbrica

- [ ] Splash con identidad visual mientras la app se prepara
- [ ] Home con navegación por rol, indicador de conexión y pendientes
- [ ] Diseño responsivo en celular, tablet y escritorio
- [ ] Vistas generadas con JavaScript y peticiones asíncronas, sin recargar
- [ ] Vista generada en el servidor, con procesamiento de datos
- [ ] Datos locales persistentes y consultables sin conexión
- [ ] API con consulta, registro, modificación y eliminación, consumida por la PWA
- [ ] Service Worker con caché estático y dinámico
- [ ] Página de respaldo sin conexión
- [ ] Cola offline con sincronización automática al reconectar
- [ ] Permiso de notificaciones solicitado con botón
- [ ] Notificaciones ligadas al caso de estudio
- [ ] Cámara, GPS y vibración, con manejo de permisos y respaldos
- [ ] App instalable y probada en un celular real
- [ ] Documento PDF completo con evidencias
- [ ] Decisiones técnicas justificadas en el documento y en la demostración
