// Vista Mis eventos: tarjetas con los eventos del servidor, o los guardados si no hay conexión.
import { guardarEventos, leerEventos, quitarEvento } from '../almacen.js';
import { eliminarEvento, listarEventos, mensajeDeError } from '../api.js';
import { ETIQUETAS_EVENTO, estadoEvento, formatearFechaCorta, formatearHorario } from '../formato.js';

const CLASES_ESTADO = {
  proximo: 'bg-marca/10 text-marca',
  en_curso: 'bg-green-100 text-green-800',
  terminado: 'bg-slate-200 text-slate-600',
};

const CLASES_ACCION =
  'rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-medium hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

/**
 * Pide los eventos al servidor y los guarda. Sin conexión usa los guardados.
 * Devuelve { estado: 'ok' | 'guardados' | 'error', eventos?, guardadoEn?, resultado? }.
 */
export async function cargarEventos() {
  const resultado = await listarEventos();
  if (resultado.ok) {
    guardarEventos(resultado.datos);
    return { estado: 'ok', eventos: resultado.datos };
  }
  const guardado = resultado.error === 'sin_conexion' ? leerEventos() : null;
  if (guardado) return { estado: 'guardados', eventos: guardado.eventos, guardadoEn: guardado.guardadoEn };
  return { estado: 'error', resultado };
}

/** Pinta el encabezado y empieza la carga de eventos. */
export function pintar(contenedor) {
  contenedor.innerHTML = `
    <section>
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="text-2xl font-bold">Mis eventos</h2>
        <a href="#/nuevo-evento"
           class="rounded-lg bg-marca px-4 py-2 font-semibold text-white hover:bg-marca/90">➕ Nuevo evento</a>
      </div>
      <p data-aviso hidden class="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"></p>
      <div data-contenido></div>
    </section>
  `;
  const seccion = contenedor.querySelector('section');
  cargar(seccion);
}

/** Carga los eventos y pinta el estado que corresponda. */
async function cargar(seccion) {
  const contenido = seccion.querySelector('[data-contenido]');
  const aviso = seccion.querySelector('[data-aviso]');
  aviso.hidden = true;
  contenido.innerHTML = '<p class="py-8 text-center text-slate-500">Cargando eventos…</p>';

  const carga = await cargarEventos();
  if (!seccion.isConnected) return; // El usuario ya cambió de vista.

  if (carga.estado === 'error') return pintarError(seccion, carga.resultado);

  if (carga.estado === 'guardados') {
    aviso.textContent = `Sin conexión · datos guardados el ${formatearFechaCorta(carga.guardadoEn)}`;
    aviso.hidden = false;
  }

  if (carga.eventos.length === 0) {
    contenido.innerHTML = `
      <div class="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p class="text-5xl" aria-hidden="true">📭</p>
        <p class="mt-3 font-semibold">Aún no hay eventos</p>
        <a href="#/nuevo-evento"
           class="mt-5 inline-block rounded-lg bg-marca px-5 py-3 font-semibold text-white hover:bg-marca/90">
          Crear el primero
        </a>
      </div>
    `;
    return;
  }

  const lista = document.createElement('div');
  lista.className = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';
  const sinConexion = carga.estado === 'guardados';
  // Al eliminar el último evento se muestra el estado "sin datos".
  const alEliminar = () => {
    if (lista.childElementCount === 0) cargar(seccion);
  };
  for (const evento of carga.eventos) lista.append(crearTarjeta(evento, sinConexion, alEliminar));
  contenido.replaceChildren(lista);
}

/** Mensaje de error con botón "Reintentar" (y el enlace sugerido, si hay). */
function pintarError(seccion, resultado) {
  const { texto, enlace } = mensajeDeError(resultado);
  const contenido = seccion.querySelector('[data-contenido]');
  contenido.innerHTML = `
    <div class="rounded-2xl bg-white p-8 text-center shadow-sm">
      <p class="text-5xl" aria-hidden="true">⚠️</p>
      <p data-texto role="alert" class="mt-3 font-semibold text-red-700"></p>
      <div class="mt-5 flex justify-center gap-3">
        <button type="button" data-reintentar
                class="rounded-lg bg-marca px-5 py-3 font-semibold text-white hover:bg-marca/90">Reintentar</button>
        <a data-enlace hidden class="rounded-lg border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-50"></a>
      </div>
    </div>
  `;
  contenido.querySelector('[data-texto]').textContent = texto;
  if (enlace) {
    const a = contenido.querySelector('[data-enlace]');
    a.href = enlace.href;
    a.textContent = enlace.texto;
    a.hidden = false;
  }
  contenido.querySelector('[data-reintentar]').addEventListener('click', () => cargar(seccion));
}

/** Tarjeta de un evento. Sin conexión, las acciones quedan deshabilitadas. */
function crearTarjeta(evento, sinConexion, alEliminar) {
  const estado = estadoEvento(evento);
  const tarjeta = document.createElement('article');
  tarjeta.className = 'flex flex-col rounded-2xl bg-white p-5 shadow-sm';
  tarjeta.innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <h3 data-nombre class="text-lg font-semibold break-words"></h3>
      <span class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${CLASES_ESTADO[estado]}">
        ${ETIQUETAS_EVENTO[estado]}
      </span>
    </div>
    <p data-lugar class="mt-1 text-sm text-slate-600"></p>
    <p data-horario class="mt-1 text-sm text-slate-600"></p>
    <div data-acciones class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"></div>
    <p data-error role="alert" hidden class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"></p>
  `;
  tarjeta.querySelector('[data-nombre]').textContent = evento.nombre;
  tarjeta.querySelector('[data-lugar]').textContent = evento.lugar ? `📍 ${evento.lugar}` : '📍 Sin lugar';
  tarjeta.querySelector('[data-horario]').textContent = `🕒 ${formatearHorario(evento.inicio, evento.fin)}`;

  const acciones = tarjeta.querySelector('[data-acciones]');
  for (const [texto, ruta] of [['QR', 'qr'], ['Asistentes', 'asistentes'], ['Editar', 'editar']]) {
    const enlace = document.createElement('a');
    enlace.className = CLASES_ACCION;
    enlace.textContent = texto;
    if (sinConexion) {
      enlace.setAttribute('aria-disabled', 'true');
    } else {
      enlace.href = `#/eventos/${evento.id}/${ruta}`;
    }
    acciones.append(enlace);
  }

  const eliminar = document.createElement('button');
  eliminar.type = 'button';
  eliminar.className =
    'rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50';
  eliminar.textContent = 'Eliminar';
  eliminar.disabled = sinConexion;
  eliminar.addEventListener('click', () => confirmarEliminar(evento, tarjeta, eliminar, alEliminar));
  acciones.append(eliminar);
  return tarjeta;
}

/** Pide confirmación, elimina en el servidor y quita la tarjeta sin recargar. */
async function confirmarEliminar(evento, tarjeta, boton, alEliminar) {
  if (!confirm(`¿Eliminar «${evento.nombre}»? También se eliminarán sus asistencias.`)) return;

  const error = tarjeta.querySelector('[data-error]');
  error.hidden = true;
  boton.disabled = true;
  boton.textContent = 'Eliminando…';

  const resultado = await eliminarEvento(evento.id);
  if (resultado.ok) {
    quitarEvento(evento.id);
    tarjeta.remove();
    alEliminar();
    return;
  }

  boton.disabled = false;
  boton.textContent = 'Eliminar';
  error.textContent = mensajeDeError(resultado).texto;
  error.hidden = false;
}
