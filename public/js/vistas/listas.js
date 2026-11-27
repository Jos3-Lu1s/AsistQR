// Vista Lista de asistencia: elige un evento y abre su lista generada en el servidor.
import { abrirLista, mensajeDeError } from '../api.js';
import { formatearFechaCorta, formatearHorario } from '../formato.js';
import { cargarEventos } from './mis-eventos.js';

/** Pinta el encabezado y empieza la carga de eventos. */
export function pintar(contenedor) {
  contenedor.innerHTML = `
    <section class="mx-auto max-w-3xl">
      <h2 class="text-2xl font-bold">Lista de asistencia</h2>
      <p class="mt-1 mb-4 text-slate-600">Se abre en otra pestaña, lista para imprimir o guardar en PDF.</p>
      <p data-aviso hidden class="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"></p>
      <div data-contenido></div>
    </section>
  `;
  cargar(contenedor.querySelector('section'));
}

/** Carga los eventos (o los guardados sin conexión) y pinta el estado que corresponda. */
async function cargar(seccion) {
  const contenido = seccion.querySelector('[data-contenido]');
  const aviso = seccion.querySelector('[data-aviso]');
  aviso.hidden = true;
  contenido.innerHTML = '<p class="py-8 text-center text-slate-500">Cargando eventos…</p>';

  const carga = await cargarEventos();
  if (!seccion.isConnected) return; // El usuario ya cambió de vista.

  if (carga.estado === 'error') {
    contenido.innerHTML = `
      <div class="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p data-texto role="alert" class="font-semibold text-red-700"></p>
        <button type="button" data-reintentar
                class="mt-5 rounded-lg bg-marca px-5 py-3 font-semibold text-white hover:bg-marca/90">Reintentar</button>
      </div>
    `;
    contenido.querySelector('[data-texto]').textContent = mensajeDeError(carga.resultado).texto;
    contenido.querySelector('[data-reintentar]').addEventListener('click', () => cargar(seccion));
    return;
  }

  const sinConexion = carga.estado === 'guardados';
  if (sinConexion) {
    aviso.textContent = `Sin conexión · datos guardados el ${formatearFechaCorta(carga.guardadoEn)}`;
    aviso.hidden = false;
  }

  if (carga.eventos.length === 0) {
    contenido.innerHTML = `
      <div class="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p class="font-semibold">Aún no hay eventos</p>
        <a href="#/nuevo-evento"
           class="mt-5 inline-block rounded-lg bg-marca px-5 py-3 font-semibold text-white hover:bg-marca/90">
          Crear el primero
        </a>
      </div>
    `;
    return;
  }

  const lista = document.createElement('ul');
  lista.className = 'space-y-3';
  for (const evento of carga.eventos) lista.append(crearFila(evento, sinConexion));
  contenido.replaceChildren(lista);
}

/** Fila con el evento y el botón "Abrir lista" (deshabilitado sin conexión). */
function crearFila(evento, sinConexion) {
  const fila = document.createElement('li');
  fila.className = 'flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm';
  fila.innerHTML = `
    <div class="min-w-0 flex-1">
      <p data-nombre class="font-semibold break-words"></p>
      <p data-horario class="text-sm text-slate-600"></p>
    </div>
    <button type="button"
            class="rounded-lg bg-marca px-4 py-2 font-semibold text-white hover:bg-marca/90 disabled:bg-slate-300 disabled:text-slate-600">
    </button>
  `;
  fila.querySelector('[data-nombre]').textContent = evento.nombre;
  fila.querySelector('[data-horario]').textContent = formatearHorario(evento.inicio, evento.fin);

  const boton = fila.querySelector('button');
  boton.textContent = sinConexion ? 'Se necesita conexión' : '🧾 Abrir lista';
  boton.disabled = sinConexion;
  boton.addEventListener('click', () => abrirLista(evento.id));
  return fila;
}
