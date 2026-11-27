// Indicador "En línea / Sin conexión" de la barra superior.

/** Pinta el estado actual de la conexión dentro del elemento. */
function pintarEstado(elemento) {
  const enLinea = navigator.onLine;
  elemento.innerHTML = `
    <span class="size-2 rounded-full ${enLinea ? 'bg-green-300' : 'bg-amber-300'}" aria-hidden="true"></span>
    ${enLinea ? 'En línea' : 'Sin conexión'}
  `;
}

/** Muestra el estado de la conexión y lo actualiza en cuanto cambia, sin recargar. */
export function iniciarIndicadorConexion(elemento) {
  pintarEstado(elemento);
  window.addEventListener('online', () => pintarEstado(elemento));
  window.addEventListener('offline', () => pintarEstado(elemento));
}
