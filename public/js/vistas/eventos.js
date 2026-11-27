// Vista Eventos del alumno: tarjetas de solo lectura con filtro por estado.
import { mensajeDeError } from '../api.js';
import { ETIQUETAS_EVENTO, estadoEvento, formatearFechaCorta, formatearHorario } from '../formato.js';
import { cargarEventos } from './mis-eventos.js';

const CLASES_ESTADO = {
  proximo: 'bg-marca/10 text-marca',
  en_curso: 'bg-green-100 text-green-800',
  terminado: 'bg-slate-200 text-slate-600',
};

// Filtros en el orden en que se muestran: valor, texto del botón y mensaje si no hay eventos.
const FILTROS = [
  { valor: 'todos', texto: 'Todos', vacio: 'No hay eventos por ahora' },
  { valor: 'en_curso', texto: 'En curso', vacio: 'No hay eventos en curso' },
  { valor: 'proximo', texto: 'Próximos', vacio: 'No hay eventos próximos' },
  { valor: 'terminado', texto: 'Terminados', vacio: 'No hay eventos terminados' },
];

/** Pinta el encabezado y empieza la carga de eventos. */
export function pintar(contenedor) {
  contenedor.innerHTML = `
    <section>
      <h2 class="mb-4 text-2xl font-bold">Eventos</h2>
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
        <p class="text-5xl" aria-hidden="true">⚠️</p>
        <p data-texto role="alert" class="mt-3 font-semibold text-red-700"></p>
        <button type="button" data-reintentar
                class="mt-5 rounded-lg bg-marca px-5 py-3 font-semibold text-white hover:bg-marca/90">Reintentar</button>
      </div>
    `;
    contenido.querySelector('[data-texto]').textContent = mensajeDeError(carga.resultado).texto;
    contenido.querySelector('[data-reintentar]').addEventListener('click', () => cargar(seccion));
    return;
  }

  if (carga.estado === 'guardados') {
    aviso.textContent = `Sin conexión · datos guardados el ${formatearFechaCorta(carga.guardadoEn)}`;
    aviso.hidden = false;
  }

  if (carga.eventos.length === 0) {
    contenido.innerHTML = `
      <div class="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p class="text-5xl" aria-hidden="true">📭</p>
        <p class="mt-3 font-semibold">No hay eventos por ahora</p>
      </div>
    `;
    return;
  }

  // El estado se calcula una vez para que el número de cada filtro coincida con sus tarjetas.
  const eventos = carga.eventos.map((evento) => ({ evento, estado: estadoEvento(evento) }));
  pintarFiltrado(contenido, eventos, 'todos');
}

/** Botones de filtro con su número y las tarjetas del filtro elegido. */
function pintarFiltrado(contenido, eventos, filtro) {
  const delFiltro = (valor) => (valor === 'todos' ? eventos : eventos.filter((e) => e.estado === valor));

  const botones = document.createElement('div');
  botones.className = 'mb-4 flex flex-wrap gap-2';
  botones.setAttribute('role', 'group');
  botones.setAttribute('aria-label', 'Filtrar eventos');
  for (const { valor, texto } of FILTROS) {
    const boton = document.createElement('button');
    boton.type = 'button';
    const activo = valor === filtro;
    boton.className = activo
      ? 'rounded-full bg-marca px-4 py-2 text-sm font-semibold text-white'
      : 'rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50';
    boton.setAttribute('aria-pressed', String(activo));
    boton.textContent = `${texto} (${delFiltro(valor).length})`;
    boton.addEventListener('click', () => pintarFiltrado(contenido, eventos, valor));
    botones.append(boton);
  }

  const visibles = delFiltro(filtro);
  let cuerpo;
  if (visibles.length === 0) {
    cuerpo = document.createElement('p');
    cuerpo.className = 'rounded-2xl bg-white p-8 text-center font-semibold shadow-sm';
    cuerpo.textContent = FILTROS.find((f) => f.valor === filtro).vacio;
  } else {
    cuerpo = document.createElement('div');
    cuerpo.className = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';
    for (const { evento, estado } of visibles) cuerpo.append(crearTarjeta(evento, estado));
  }
  contenido.replaceChildren(botones, cuerpo);
}

/** Tarjeta de solo lectura. Las de eventos en curso llevan a Escanear (también sin conexión). */
function crearTarjeta(evento, estado) {
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
    <p data-descripcion hidden class="mt-2 text-sm break-words"></p>
    <p data-horario class="mt-1 text-sm text-slate-600"></p>
  `;
  // Datos del servidor: siempre con textContent.
  tarjeta.querySelector('[data-nombre]').textContent = evento.nombre;
  tarjeta.querySelector('[data-lugar]').textContent = evento.lugar ? `📍 ${evento.lugar}` : '📍 Sin lugar';
  tarjeta.querySelector('[data-horario]').textContent = `🕒 ${formatearHorario(evento.inicio, evento.fin)}`;
  if (evento.descripcion) {
    const descripcion = tarjeta.querySelector('[data-descripcion]');
    descripcion.textContent = evento.descripcion;
    descripcion.hidden = false;
  }

  if (estado === 'en_curso') {
    const escanear = document.createElement('a');
    escanear.href = '#/escanear';
    escanear.className = 'mt-4 rounded-lg bg-marca px-4 py-2 text-center font-semibold text-white hover:bg-marca/90';
    escanear.textContent = '📷 Escanear';
    tarjeta.append(escanear);
  }
  return tarjeta;
}
