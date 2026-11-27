// Peticiones a la API del servidor.

/**
 * Verifica el PIN del organizador con el servidor.
 * Devuelve 'ok', 'incorrecto' o 'sin_conexion' (también si el servidor no responde como se espera).
 */
export async function verificarPin(pin) {
  try {
    const respuesta = await fetch('/api/pin', { headers: { 'X-PIN': pin } });
    if (respuesta.status === 204) return 'ok';
    if (respuesta.status === 401) return 'incorrecto';
    return 'sin_conexion';
  } catch {
    return 'sin_conexion'; // fetch falla cuando no hay red.
  }
}
