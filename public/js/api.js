// Peticiones a la API del servidor.
import { leerPin } from './almacen.js';

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

/**
 * Hace una petición a la API y la convierte a un resultado uniforme:
 * { ok: true, datos } o { ok: false, error, mensaje?, detalles? }.
 */
async function pedir(ruta, { metodo = 'GET', cuerpo, conPin = false } = {}) {
  const headers = {};
  if (conPin) headers['X-PIN'] = leerPin() ?? '';
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';

  let respuesta;
  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    return { ok: false, error: 'sin_conexion' };
  }

  if (respuesta.status === 204) return { ok: true, datos: null };

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    // Una respuesta sin JSON válido (p. ej. un proxy caído) se trata como error inesperado.
    return { ok: false, error: 'inesperado' };
  }

  if (respuesta.ok) return { ok: true, datos };
  return {
    ok: false,
    error: datos?.error ?? 'inesperado',
    mensaje: datos?.mensaje,
    detalles: datos?.detalles,
  };
}

export const listarEventos = () => pedir('/api/eventos');

export const obtenerEvento = (id) => pedir(`/api/eventos/${id}`);

export const crearEvento = (datos) => pedir('/api/eventos', { metodo: 'POST', cuerpo: datos, conPin: true });

export const editarEvento = (id, datos) =>
  pedir(`/api/eventos/${id}`, { metodo: 'PUT', cuerpo: datos, conPin: true });

export const eliminarEvento =(id) => pedir(`/api/eventos/${id}`, { metodo: 'DELETE', conPin: true });

export const obtenerQr =(id) => pedir(`/api/eventos/${id}/qr`, { conPin: true });

export const listarAsistentes = (id) => pedir(`/api/eventos/${id}/asistencias`, { conPin: true });

export const eliminarAsistencia = (id) =>
  pedir(`/api/asistencias/${id}`, { metodo: 'DELETE', conPin: true });

/**
 * Abre la lista de asistencia SSR en otra pestaña enviando el PIN guardado por POST.
 * Debe llamarse desde un clic para que el navegador no bloquee la pestaña nueva.
 */
export function abrirLista(id) {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = `/eventos/${id}/lista`;
  form.target = '_blank';
  form.hidden = true;

  const pin = document.createElement('input');
  pin.type = 'hidden';
  pin.name = 'pin';
  pin.value = leerPin() ?? '';
  form.append(pin);

  document.body.append(form);
  form.submit();
  form.remove();
}

/**
 * Texto para el usuario según el error de un resultado.
 * Devuelve { texto, enlace? }, donde enlace es { href, texto } cuando hay una acción sugerida.
 */
export function mensajeDeError(resultado) {
  switch (resultado.error) {
    case 'sin_conexion':
      return { texto: 'Se necesita conexión para esta acción.' };
    case 'pin_invalido':
      return {
        texto: 'Tu PIN ya no es válido. Actualízalo en Perfil.',
        enlace: { href: '#/perfil', texto: 'Ir a Perfil' },
      };
    case 'evento_no_encontrado':
      return {
        texto: 'El evento ya no existe.',
        enlace: { href: '#/mis-eventos', texto: 'Ir a Mis eventos' },
      };
    case 'datos_invalidos':
      return { texto: resultado.mensaje ?? 'Los datos no son válidos.' };
    default:
      return { texto: 'Ocurrió un error inesperado. Intenta de nuevo.' };
  }
}
