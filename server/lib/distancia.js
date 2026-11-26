const RADIO_TIERRA_M = 6371000; // Radio medio de la Tierra.

// Grados a radianes.
const aRad = (grados) => (grados * Math.PI) / 180;

/** Distancia en metros entre dos coordenadas (fórmula de Haversine). */
function distanciaMetros(lat1, lng1, lat2, lng2) {
  const dLat = aRad(lat2 - lat1);
  const dLng = aRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRad(lat1)) * Math.cos(aRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(a));
}

module.exports = { distanciaMetros };
