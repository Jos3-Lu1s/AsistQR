const ESTADOS = ['valida', 'fuera_de_rango', 'fuera_de_horario', 'sin_ubicacion'];

/**
 * Cuenta las asistencias de un evento: total, una cifra por estado
 * y cuántas llegaron por sincronización offline.
 */
function calcularResumen(asistencias) {
  const resumen = { total: asistencias.length, offline: 0 };
  for (const estado of ESTADOS) resumen[estado] = 0;

  for (const a of asistencias) {
    resumen[a.estado] += 1;
    if (a.offline) resumen.offline += 1; // Acepta 1/0 de la BD o true/false.
  }
  return resumen;
}

module.exports = { calcularResumen };
