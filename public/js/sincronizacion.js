// Reenvío de la cola de asistencias pendientes cuando hay conexión.
import { guardarUltimaSync, leerCola } from './almacen.js';
import { registrarAsistencia } from './api.js';
import { aplicarRespuesta } from './registro.js';

// Evita dos sincronizaciones a la vez, que enviarían el mismo registro en paralelo.
let enCurso = false;

/**
 * Envía la cola en orden, de uno en uno, marcada como offline.
 * Se detiene en el primer sin_conexion. Devuelve cuántos registros obtuvieron respuesta definitiva.
 */
export async function sincronizarCola() {
  if (enCurso) return 0;
  enCurso = true;
  let enviados = 0;
  try {
    for (const cuerpo of leerCola()) {
      const respuesta = await registrarAsistencia({ ...cuerpo, offline: true });
      if (!respuesta.ok && respuesta.error === 'sin_conexion') break;
      if (aplicarRespuesta(cuerpo, respuesta).resultado !== 'pendiente') enviados++;
    }
    if (enviados > 0 && leerCola().length === 0) guardarUltimaSync();
  } finally {
    enCurso = false;
  }
  return enviados;
}

/** Sincroniza al recuperar la conexión y, si hay pendientes, al abrir la app. */
export function iniciarSincronizacion() {
  window.addEventListener('online', () => sincronizarCola());
  if (navigator.onLine && leerCola().length > 0) sincronizarCola();
}
