// Sondeo periódico: repite una función asíncrona cada `ms`, en pausa mientras la pestaña está oculta.

/**
 * Ejecuta `funcion` de inmediato y luego cada `ms` milisegundos.
 * La siguiente ejecución se programa al terminar la anterior, así nunca se acumulan.
 * Devuelve detener(), que cancela el sondeo y quita el listener.
 */
export function iniciarSondeo(funcion, ms) {
  let detenido = false;
  let enCurso = false;
  let temporizador = null;

  async function ejecutar() {
    clearTimeout(temporizador);
    if (detenido || document.hidden) return;
    enCurso = true;
    try {
      await funcion();
    } finally {
      enCurso = false;
    }
    if (!detenido && !document.hidden) temporizador = setTimeout(ejecutar, ms);
  }

  // Al ocultar la pestaña se pausa; al volver se pide de inmediato (si no hay una petición en curso).
  function alCambiarVisibilidad() {
    if (document.hidden) clearTimeout(temporizador);
    else if (!enCurso) ejecutar();
  }

  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  ejecutar();

  return function detener() {
    detenido = true;
    clearTimeout(temporizador);
    document.removeEventListener('visibilitychange', alCambiarVisibilidad);
  };
}
