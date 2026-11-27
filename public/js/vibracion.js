// Patrones de vibración para avisar del resultado sin mirar la pantalla.

const PATRONES = {
  lectura: 50,
  exito: 200,
  aviso: [100, 100, 100],
  error: 400,
};

/** Vibra con el patrón indicado. En dispositivos sin vibración (iOS) no hace nada. */
export function vibrar(tipo) {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(PATRONES[tipo]);
}
