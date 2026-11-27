// Fechas, estados y etiquetas que se muestran en las vistas. Todo en la hora local del dispositivo.

const LOCALE = 'es-MX';

const fmtSemana = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
const fmtMes = new Intl.DateTimeFormat(LOCALE, { month: 'short' });
const fmtHora = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDiaMes = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit' });

/** "jue 26 nov". Se arma por partes porque es-MX agrega "de" y puntos a las abreviaturas. */
function dia(fecha) {
  const sinPunto = (texto) => texto.replace(/\./g, '');
  return `${sinPunto(fmtSemana.format(fecha))} ${fecha.getDate()} ${sinPunto(fmtMes.format(fecha))}`;
}

/** "10:42" */
export function formatearHora(iso) {
  return fmtHora.format(new Date(iso));
}

/** "26/11 18:00" */
export function formatearFechaCorta(iso) {
  const fecha = new Date(iso);
  return `${fmtDiaMes.format(fecha)} ${fmtHora.format(fecha)}`;
}

/** "jue 26 nov · 10:00–12:00", o con ambos días si el evento cruza la medianoche. */
export function formatearHorario(inicioIso, finIso) {
  const inicio = new Date(inicioIso);
  const fin = new Date(finIso);
  if (inicio.toDateString() === fin.toDateString()) {
    return `${dia(inicio)} · ${fmtHora.format(inicio)}–${fmtHora.format(fin)}`;
  }
  return `${dia(inicio)} ${fmtHora.format(inicio)} – ${dia(fin)} ${fmtHora.format(fin)}`;
}

/** 'proximo', 'en_curso' o 'terminado' según la hora actual. */
export function estadoEvento(evento, ahora = new Date()) {
  if (ahora < new Date(evento.inicio)) return 'proximo';
  if (ahora > new Date(evento.fin)) return 'terminado';
  return 'en_curso';
}

export const ETIQUETAS_EVENTO = {
  proximo: 'Próximo',
  en_curso: 'En curso',
  terminado: 'Terminado',
};

export const ETIQUETAS_ASISTENCIA = {
  valida: 'Válida',
  fuera_de_rango: 'Fuera de rango',
  fuera_de_horario: 'Fuera de horario',
  sin_ubicacion: 'Sin ubicación',
};

const dos = (n) => String(n).padStart(2, '0');

/** ISO del servidor → valor de <input type="datetime-local"> en hora local ("2026-11-26T10:00"). */
export function isoALocal(iso) {
  const f = new Date(iso);
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}T${dos(f.getHours())}:${dos(f.getMinutes())}`;
}

/** Valor de <input type="datetime-local"> → ISO UTC. Devuelve null si está vacío o es inválido. */
export function localAIso(valor) {
  if (!valor) return null;
  const fecha = new Date(valor); // Sin zona, el navegador lo interpreta como hora local.
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}
