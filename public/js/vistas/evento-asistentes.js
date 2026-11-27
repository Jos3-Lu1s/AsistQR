// Vista Asistentes: registros de un evento, actualizados en vivo, con opción de eliminar cada uno.
import { abrirLista, eliminarAsistencia, listarAsistentes, mensajeDeError, obtenerEvento } from '../api.js';
import { ETIQUETAS_ASISTENCIA, formatearHora } from '../formato.js';
import { iniciarSondeo } from '../sondeo.js';

const INTERVALO_MS = 5000;

const CLASES_ESTADO = {
  valida: 'bg-green-100 text-green-800',
  fuera_de_rango: 'bg-amber-100 text-amber-800',
  fuera_de_horario: 'bg-red-100 text-red-800',
  sin_ubicacion: 'bg-slate-200 text-slate-700',
};

/** Pinta el estado de carga y arranca la vista. Devuelve la limpieza. */
export function pintar(contenedor, { parametros }) {
  const { id } = parametros;
  contenedor.innerHTML = '<p class="py-8 text-center text-slate-500">Cargando asistentes…</p>';

  // eliminando: ids con DELETE en curso, para que el sondeo no los vuelva a pintar.
  const estado = { detenerSondeo: null, limpiado: false, eliminando: new Set(), ultimoDato: null };
  cargar(contenedor, id, estado);

  return () => {
    estado.limpiado = true;
    estado.detenerSondeo?.();
  };
}

/** Pide el evento y, si existe, arranca el sondeo de asistentes. */
async function cargar(contenedor, id, estado) {
  const evento = await obtenerEvento(id);
  if (estado.limpiado) return;
  if (!evento.ok) return pintarError(contenedor, evento);

  pintarEstructura(contenedor, id, evento.datos);
  estado.detenerSondeo = iniciarSondeo(() => actualizar(contenedor, id, estado), INTERVALO_MS);
}

/** Error que reemplaza toda la vista. */
function pintarError(contenedor, resultado) {
  const { texto, enlace } = mensajeDeError(resultado);
  contenedor.innerHTML = `
    <div class="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
      <p class="text-5xl" aria-hidden="true">⚠️</p>
      <p data-texto role="alert" class="mt-3 font-semibold text-red-700"></p>
      <a data-enlace
         class="mt-5 inline-block rounded-lg bg-marca px-5 py-3 font-semibold text-white hover:bg-marca/90"></a>
    </div>
  `;
  contenedor.querySelector('[data-texto]').textContent = texto;
  const destino = enlace ?? { href: '#/mis-eventos', texto: 'Ir a Mis eventos' };
  const a = contenedor.querySelector('[data-enlace]');
  a.href = destino.href;
  a.textContent = destino.texto;
}

/** Encabezado con el nombre del evento y el total, y el contenedor de la lista. */
function pintarEstructura(contenedor, id, evento) {
  contenedor.innerHTML = `
    <section class="mx-auto max-w-3xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 data-nombre class="text-2xl font-bold break-words"></h2>
          <p data-total aria-live="polite" class="text-slate-600">—</p>
        </div>
        <div data-acciones class="flex flex-wrap gap-2">
          <a href="#/eventos/${id}/qr"
             class="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-50">🔳 Ver QR</a>
          <button type="button" data-lista
                  class="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-50">
            🧾 Lista de asistencia
          </button>
        </div>
      </div>
      <p data-aviso hidden class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"></p>
      <ul data-lista class="space-y-3"></ul>
      <div data-vacio hidden class="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p class="text-5xl" aria-hidden="true">🕒</p>
        <p class="mt-3 font-semibold">Todavía no hay asistentes</p>
        <a href="#/eventos/${id}/qr"
           class="mt-5 inline-block rounded-lg bg-marca px-5 py-3 font-semibold text-white hover:bg-marca/90">
          Proyectar el QR
        </a>
      </div>
    </section>
  `;
  contenedor.querySelector('[data-nombre]').textContent = evento.nombre;
  contenedor.querySelector('[data-lista]').addEventListener('click', () => abrirLista(id));
}

/** Actualiza el texto del total y muestra el estado "sin datos" si no queda nadie. */
function pintarTotal(contenedor) {
  const filas = contenedor.querySelector('[data-lista]').childElementCount;
  contenedor.querySelector('[data-total]').textContent = `${filas} ${filas === 1 ? 'asistente' : 'asistentes'}`;
  contenedor.querySelector('[data-vacio]').hidden = filas > 0;
}

/** Una vuelta del sondeo: vuelve a pintar las filas, o avisa que se perdió la conexión. */
async function actualizar(contenedor, id, estado) {
  const resultado = await listarAsistentes(id);
  if (estado.limpiado) return;

  const aviso = contenedor.querySelector('[data-aviso]');
  if (!aviso) return;

  if (!resultado.ok) {
    if (resultado.error === 'evento_no_encontrado') {
      estado.detenerSondeo?.();
      return pintarError(contenedor, resultado);
    }
    // Se conserva la última lista y se sigue intentando.
    aviso.textContent =
      resultado.error === 'sin_conexion'
        ? `Sin conexión · último dato ${estado.ultimoDato ? formatearHora(estado.ultimoDato) : '—'}`
        : mensajeDeError(resultado).texto;
    aviso.hidden = false;
    return;
  }

  aviso.hidden = true;
  estado.ultimoDato = new Date().toISOString();
  const filas = resultado.datos.asistencias
    .filter((asistencia) => !estado.eliminando.has(asistencia.id))
    .map((asistencia) => crearFila(contenedor, asistencia, estado));
  contenedor.querySelector('[data-lista]').replaceChildren(...filas);
  pintarTotal(contenedor);
}

/** Fila de un registro. Los datos del alumno se insertan con textContent. */
function crearFila(contenedor, asistencia, estado) {
  const fila = document.createElement('li');
  fila.className = 'flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm';
  fila.innerHTML = `
    <div class="min-w-0 flex-1">
      <p data-nombre class="font-semibold break-words"></p>
      <p data-detalle class="text-sm text-slate-600"></p>
      <div class="mt-1 flex flex-wrap gap-1.5">
        <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold ${CLASES_ESTADO[asistencia.estado] ?? ''}">
          ${ETIQUETAS_ASISTENCIA[asistencia.estado] ?? asistencia.estado}
        </span>
        ${asistencia.offline
          ? '<span class="rounded-full bg-marca/10 px-2.5 py-0.5 text-xs font-semibold text-marca">Sincronizado</span>'
          : ''}
      </div>
      <p data-error role="alert" hidden class="mt-2 text-sm text-red-700"></p>
    </div>
    <button type="button"
            class="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
      Eliminar
    </button>
  `;
  fila.querySelector('[data-nombre]').textContent = asistencia.nombre;
  const partes = [asistencia.matricula, formatearHora(asistencia.capturada_en)];
  if (asistencia.distancia_m !== null) partes.push(`a ${Math.round(asistencia.distancia_m)} m`);
  fila.querySelector('[data-detalle]').textContent = partes.join(' · ');

  const boton = fila.querySelector('button');
  boton.addEventListener('click', () => confirmarEliminar(contenedor, asistencia, fila, boton, estado));
  return fila;
}

/** Pide confirmación, elimina en el servidor y quita la fila al instante. */
async function confirmarEliminar(contenedor, asistencia, fila, boton, estado) {
  if (!confirm(`¿Eliminar el registro de ${asistencia.nombre}?`)) return;

  const error = fila.querySelector('[data-error]');
  error.hidden = true;
  boton.disabled = true;
  boton.textContent = 'Eliminando…';
  estado.eliminando.add(asistencia.id);

  const resultado = await eliminarAsistencia(asistencia.id);
  estado.eliminando.delete(asistencia.id);
  if (estado.limpiado) return;

  // 404: alguien más ya lo eliminó; el resultado para la vista es el mismo.
  if (resultado.ok || resultado.error === 'asistencia_no_encontrada') {
    fila.remove();
    pintarTotal(contenedor);
    return;
  }

  boton.disabled = false;
  boton.textContent = 'Eliminar';
  error.textContent = mensajeDeError(resultado).texto;
  error.hidden = false;
}
