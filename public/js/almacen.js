// Datos del usuario guardados en LocalStorage.

const CLAVE_PERFIL = 'asistqr:perfil';
const CLAVE_PIN = 'asistqr:pin';
const CLAVE_EVENTOS = 'asistqr:eventos';
const CLAVE_COLA = 'asistqr:cola';
const CLAVE_HISTORIAL = 'asistqr:historial';
const CLAVE_ULTIMA_SYNC = 'asistqr:ultima-sync';

/** Evento que se dispara en window cada vez que cambia la cola. */
export const EVENTO_COLA = 'asistqr:cola-cambiada';
const ROLES = ['alumno', 'organizador'];

/** Perfil guardado, o null si no hay o si está dañado (JSON inválido o sin rol válido). */
export function leerPerfil() {
  try {
    const perfil = JSON.parse(localStorage.getItem(CLAVE_PERFIL));
    return perfil && ROLES.includes(perfil.rol) ? perfil : null;
  } catch {
    return null;
  }
}

/** Guarda el perfil. Un alumno no conserva el PIN del organizador. */
export function guardarPerfil(perfil) {
  localStorage.setItem(CLAVE_PERFIL, JSON.stringify(perfil));
  if (perfil.rol === 'alumno') borrarPin();
}

/** PIN verificado del organizador, o null. */
export function leerPin() {
  return localStorage.getItem(CLAVE_PIN);
}

export function guardarPin(pin) {
  localStorage.setItem(CLAVE_PIN, pin);
}

export function borrarPin() {
  localStorage.removeItem(CLAVE_PIN);
}

/** Último listado de eventos guardado: { guardadoEn, eventos }, o null si no hay o está dañado. */
export function leerEventos() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_EVENTOS));
    return guardado && Array.isArray(guardado.eventos) ? guardado : null;
  } catch {
    return null;
  }
}

/** Guarda el listado de eventos junto con la fecha de descarga. */
export function guardarEventos(eventos) {
  const guardado = { guardadoEn: new Date().toISOString(), eventos };
  localStorage.setItem(CLAVE_EVENTOS, JSON.stringify(guardado));
}

/** Quita un evento del listado guardado, sin cambiar la fecha de descarga. */
export function quitarEvento(id) {
  const guardado = leerEventos();
  if (!guardado) return;
  guardado.eventos = guardado.eventos.filter((evento) => evento.id !== id);
  localStorage.setItem(CLAVE_EVENTOS, JSON.stringify(guardado));
}

/** Lista guardada en una clave, o [] si no hay o está dañada. */
function leerLista(clave) {
  try {
    const lista = JSON.parse(localStorage.getItem(clave));
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

// --- Cola: cuerpos de POST /api/asistencias pendientes de enviar ---

export function leerCola() {
  return leerLista(CLAVE_COLA);
}

/** Guarda la cola y avisa a quien muestre los pendientes. */
function guardarCola(cola) {
  localStorage.setItem(CLAVE_COLA, JSON.stringify(cola));
  window.dispatchEvent(new CustomEvent(EVENTO_COLA, { detail: { total: cola.length } }));
}

export function agregarACola(cuerpo) {
  guardarCola([...leerCola(), cuerpo]);
}

export function quitarDeCola(uuid) {
  guardarCola(leerCola().filter((cuerpo) => cuerpo.uuid !== uuid));
}

// --- Historial: lo que ve el alumno, del escaneo más reciente al más antiguo ---

export function leerHistorial() {
  return leerLista(CLAVE_HISTORIAL);
}

export function guardarHistorial(historial) {
  localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(historial));
}

export function agregarAlHistorial(entrada) {
  guardarHistorial([entrada, ...leerHistorial()]);
}

/** Mezcla los cambios en la entrada con ese uuid; si no existe, no hace nada. */
export function actualizarEnHistorial(uuid, cambios) {
  guardarHistorial(leerHistorial().map((entrada) => (entrada.uuid === uuid ? { ...entrada, ...cambios } : entrada)));
}

// --- Última sincronización ---

/** Fecha ISO de la última sincronización, o null si no hay o no es una fecha. */
export function leerUltimaSync() {
  const fecha = localStorage.getItem(CLAVE_ULTIMA_SYNC);
  return fecha && !Number.isNaN(Date.parse(fecha)) ? fecha : null;
}

export function guardarUltimaSync(fecha = new Date().toISOString()) {
  localStorage.setItem(CLAVE_ULTIMA_SYNC, fecha);
}
