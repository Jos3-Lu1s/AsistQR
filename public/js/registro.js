// Registro de una asistencia: se guarda en el dispositivo, se envía y se aplica la respuesta.
import { actualizarEnHistorial, agregarACola, agregarAlHistorial, leerHistorial, quitarDeCola } from './almacen.js';
import { registrarAsistencia } from './api.js';

// 6 caracteres del alfabeto del token (sin 0, O, 1 ni I).
const FORMATO_CODIGO = /^[A-HJ-NP-Z2-9]{6}$/;

// Rechazos definitivos: reintentar no cambiaría la respuesta, así que salen de la cola.
const RECHAZOS = ['token_invalido', 'ya_registrado', 'datos_invalidos'];

/** Quita los espacios y pasa a mayúsculas. */
export function normalizarCodigo(texto) {
  return String(texto).replace(/\s/g, '').toUpperCase();
}

export function codigoValido(codigo) {
  return FORMATO_CODIGO.test(codigo);
}

/** UUID v4. Fuera de un contexto seguro no existe randomUUID, pero sí getRandomValues. */
function generarUuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Versión 4.
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variante RFC 4122.
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Aplica la respuesta de un envío al historial y a la cola.
 * Devuelve { resultado: 'enviada' | 'rechazada' | 'pendiente', entrada, mensaje? },
 * donde entrada es la del historial ya actualizada.
 */
export function aplicarRespuesta(cuerpo, respuesta) {
  let resultado = 'pendiente';

  if (respuesta.ok) {
    const { asistencia, evento } = respuesta.datos;
    const cambios = {
      sincronizacion: 'enviada',
      motivo: null,
      estado: asistencia.estado,
      distancia_m: asistencia.distancia_m,
      evento_id: asistencia.evento_id,
      offline: asistencia.offline,
    };
    if (evento) cambios.evento_nombre = evento.nombre; // Un duplicado (200) no trae el evento.
    actualizarEnHistorial(cuerpo.uuid, cambios);
    resultado = 'enviada';
  } else if (RECHAZOS.includes(respuesta.error)) {
    actualizarEnHistorial(cuerpo.uuid, {
      sincronizacion: 'rechazada',
      motivo: respuesta.error,
      evento_id: respuesta.datos?.asistencia?.evento_id ?? null,
    });
    resultado = 'rechazada';
  }

  // Se quita de la cola al final: el aviso de cambio llega con el historial ya actualizado.
  if (resultado !== 'pendiente') quitarDeCola(cuerpo.uuid);

  return {
    resultado,
    entrada: leerHistorial().find((entrada) => entrada.uuid === cuerpo.uuid),
    mensaje: respuesta.mensaje,
  };
}

/**
 * Guarda el registro en el historial y en la cola, y lo envía si hay conexión.
 * ubicacion es el resultado de obtenerUbicacion(); sin ok, el registro va sin ubicación.
 * Devuelve lo mismo que aplicarRespuesta.
 */
export async function registrar({ codigo, perfil, capturadaEn, ubicacion }) {
  const cuerpo = {
    uuid: generarUuid(),
    token: codigo,
    matricula: perfil.matricula,
    nombre: perfil.nombre,
    capturadaEn,
    offline: false,
  };
  if (ubicacion.ok) {
    cuerpo.latitud = ubicacion.latitud;
    cuerpo.longitud = ubicacion.longitud;
    cuerpo.precision = ubicacion.precision;
  }

  // Primero se guarda: si el envío falla a la mitad, el registro no se pierde.
  agregarAlHistorial({
    uuid: cuerpo.uuid,
    matricula: cuerpo.matricula,
    codigo,
    capturada_en: capturadaEn,
    sincronizacion: 'pendiente',
    motivo: null,
    evento_id: null,
    evento_nombre: null,
    estado: null,
    distancia_m: null,
    offline: false,
  });
  agregarACola(cuerpo);

  if (!navigator.onLine) {
    return { resultado: 'pendiente', entrada: leerHistorial().find((e) => e.uuid === cuerpo.uuid) };
  }
  return aplicarRespuesta(cuerpo, await registrarAsistencia(cuerpo));
}
