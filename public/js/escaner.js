// Lectura de códigos QR con la cámara trasera y jsQR (cargado en index.html como window.jsQR).
import { vibrar } from './vibracion.js';

// Ancho máximo del cuadro que se analiza: más pequeño es más rápido y jsQR sigue leyendo bien.
const ANCHO_MAXIMO = 640;

/** true si se puede usar la cámara: requiere HTTPS (o localhost), getUserMedia y jsQR. */
export function camaraSoportada() {
  return window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia) && typeof window.jsQR === 'function';
}

/**
 * Enciende la cámara en el <video> y busca un QR en cada cuadro.
 * Al leer uno, vibra, apaga la cámara y llama alLeer(texto).
 * Devuelve una promesa con detener(); se rechaza con el error de getUserMedia (NotAllowedError…).
 */
export async function iniciarEscaner(video, alLeer) {
  const flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  const lienzo = document.createElement('canvas'); // No se agrega al DOM.
  const contexto = lienzo.getContext('2d', { willReadFrequently: true });
  let cuadro = null;
  let activo = true;

  function detener() {
    if (!activo) return;
    activo = false;
    cancelAnimationFrame(cuadro);
    for (const pista of flujo.getTracks()) pista.stop();
    video.srcObject = null;
  }

  function analizar() {
    if (!activo) return;
    if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
      const escala = Math.min(1, ANCHO_MAXIMO / video.videoWidth);
      lienzo.width = Math.round(video.videoWidth * escala);
      lienzo.height = Math.round(video.videoHeight * escala);
      contexto.drawImage(video, 0, 0, lienzo.width, lienzo.height);
      const imagen = contexto.getImageData(0, 0, lienzo.width, lienzo.height);
      const codigo = window.jsQR(imagen.data, imagen.width, imagen.height, { inversionAttempts: 'dontInvert' });
      if (codigo?.data) {
        vibrar('lectura');
        detener();
        alLeer(codigo.data);
        return;
      }
    }
    cuadro = requestAnimationFrame(analizar);
  }

  video.setAttribute('playsinline', ''); // Safari en iPhone no abre el video a pantalla completa.
  video.muted = true;
  video.srcObject = flujo;
  try {
    await video.play();
  } catch (error) {
    detener();
    throw error;
  }
  cuadro = requestAnimationFrame(analizar);
  return detener;
}
