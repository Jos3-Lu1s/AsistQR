// Contador de asistencias pendientes de enviar en la barra superior.
import { EVENTO_COLA, leerCola } from './almacen.js';

/** "1 pendiente", "2 pendientes"… */
export function textoPendientes(total) {
  return `${total} ${total === 1 ? 'pendiente' : 'pendientes'}`;
}

/** Muestra cuántos registros hay en la cola; sin cola el elemento se oculta. */
function pintar(elemento) {
  const total = leerCola().length;
  elemento.textContent = textoPendientes(total);
  elemento.hidden = total === 0;
}

/** Pinta el contador y lo actualiza cada vez que cambia la cola (también desde otra pestaña). */
export function iniciarIndicadorPendientes(elemento) {
  pintar(elemento);
  window.addEventListener(EVENTO_COLA, () => pintar(elemento));
  window.addEventListener('storage', () => pintar(elemento));
}
