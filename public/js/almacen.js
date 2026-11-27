// Datos del usuario guardados en LocalStorage.

const CLAVE_PERFIL = 'asistqr:perfil';
const CLAVE_PIN = 'asistqr:pin';
const CLAVE_EVENTOS = 'asistqr:eventos';
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
