// Ubicación del dispositivo con la API de geolocalización.

// Códigos de GeolocationPositionError → error propio.
const ERRORES = { 1: 'negado', 2: 'no_disponible', 3: 'tiempo_agotado' };

/** true si el navegador puede dar la ubicación (requiere HTTPS o localhost). */
export function ubicacionSoportada() {
  return window.isSecureContext && 'geolocation' in navigator;
}

/**
 * Pide la ubicación actual.
 * Devuelve { ok: true, latitud, longitud, precision } o
 * { ok: false, error: 'negado' | 'no_disponible' | 'tiempo_agotado' | 'no_soportado' }.
 */
export function obtenerUbicacion() {
  if (!ubicacionSoportada()) return Promise.resolve({ ok: false, error: 'no_soportado' });

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ ok: true, latitud: coords.latitude, longitud: coords.longitude, precision: coords.accuracy }),
      (error) => resolve({ ok: false, error: ERRORES[error.code] ?? 'no_disponible' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
