// Vista QR del evento: imagen del QR, token y contador de asistentes en vivo, con pantalla completa.
import { abrirLista, listarAsistentes, mensajeDeError, obtenerEvento, obtenerQr } from '../api.js';
import { formatearHora, formatearHorario } from '../formato.js';
import { iniciarSondeo } from '../sondeo.js';

const INTERVALO_MS = 5000;

/** "1 asistente" / "12 asistentes" */
const textoTotal = (total) => `${total} ${total === 1 ? 'asistente' : 'asistentes'}`;

/** Pinta el estado de carga, carga el evento y su QR, y arranca el contador. Devuelve la limpieza. */
export function pintar(contenedor, { parametros }) {
  const { id } = parametros;
  contenedor.innerHTML = '<p class="py-8 text-center text-slate-500">Cargando QR…</p>';

  // La limpieza existe desde el inicio aunque el sondeo arranque después de la carga.
  const estado = { detenerSondeo: null, limpiado: false };
  cargar(contenedor, id, estado);

  return () => {
    estado.limpiado = true;
    estado.detenerSondeo?.();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
}

/** Pide el evento y el QR a la vez. Si algo falla, muestra el error y no arranca el sondeo. */
async function cargar(contenedor, id, estado) {
  const [evento, qr] = await Promise.all([obtenerEvento(id), obtenerQr(id)]);
  if (estado.limpiado) return;

  const fallo = [evento, qr].find((resultado) => !resultado.ok);
  if (fallo) return pintarError(contenedor, fallo);

  pintarQr(contenedor, id, evento.datos, qr.datos);
  estado.detenerSondeo = iniciarSondeo(() => actualizarContador(contenedor, id, estado), INTERVALO_MS);
}

/** Error al entrar. Sin conexión el QR no se puede mostrar porque no se guarda localmente. */
function pintarError(contenedor, resultado) {
  const { texto, enlace } =
    resultado.error === 'sin_conexion'
      ? { texto: 'Se necesita conexión para mostrar el QR.' }
      : mensajeDeError(resultado);

  contenedor.innerHTML = `
    <div class="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
      <p class="text-5xl" aria-hidden="true">⚠️</p>
      <p data-texto role="alert" class="mt-3 font-semibold text-red-700"></p>
      <a data-enlace hidden
         class="mt-5 inline-block rounded-lg bg-marca px-5 py-3 font-semibold text-white hover:bg-marca/90"></a>
    </div>
  `;
  contenedor.querySelector('[data-texto]').textContent = texto;
  const a = contenedor.querySelector('[data-enlace]');
  const destino = enlace ?? { href: '#/mis-eventos', texto: 'Ir a Mis eventos' };
  a.href = destino.href;
  a.textContent = destino.texto;
  a.hidden = false;
}

/** Pinta el QR. El bloque [data-proyeccion] es lo único que se ve en pantalla completa. */
function pintarQr(contenedor, id, evento, qr) {
  contenedor.innerHTML = `
    <section class="mx-auto max-w-xl space-y-4">
      <div data-proyeccion
           class="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center shadow-sm">
        <h2 data-nombre class="text-2xl font-bold break-words"></h2>
        <img data-qr alt="Código QR del evento" class="aspect-square w-full max-w-xs [image-rendering:pixelated]">
        <p class="text-sm text-slate-500">Código manual</p>
        <p data-token class="font-mono text-3xl font-bold tracking-[0.3em]"></p>
        <p data-total aria-live="polite" class="text-xl font-semibold text-marca">—</p>
        <p data-conexion hidden class="text-sm text-amber-700"></p>
        <button type="button" data-salir hidden
                class="mt-2 rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50">
          Salir de pantalla completa
        </button>
      </div>

      <div class="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm">
        <p data-lugar></p>
        <p data-horario class="mt-1"></p>
      </div>

      <div class="grid gap-3 sm:grid-cols-3">
        <button type="button" data-completa
                class="rounded-lg bg-marca px-4 py-3 font-semibold text-white hover:bg-marca/90">
          ⛶ Pantalla completa
        </button>
        <a href="#/eventos/${id}/asistentes"
           class="rounded-lg border border-slate-300 bg-white px-4 py-3 text-center font-semibold hover:bg-slate-50">
          👥 Ver asistentes
        </a>
        <button type="button" data-lista
                class="rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold hover:bg-slate-50">
          🧾 Lista de asistencia
        </button>
      </div>
    </section>
  `;

  contenedor.querySelector('[data-nombre]').textContent = evento.nombre;
  contenedor.querySelector('[data-qr]').src = qr.qr;
  contenedor.querySelector('[data-token]').textContent = qr.token;
  contenedor.querySelector('[data-lugar]').textContent = evento.lugar ? `📍 ${evento.lugar}` : '📍 Sin lugar';
  contenedor.querySelector('[data-horario]').textContent = `🕒 ${formatearHorario(evento.inicio, evento.fin)}`;

  contenedor.querySelector('[data-lista]').addEventListener('click', () => abrirLista(id));
  prepararPantallaCompleta(contenedor);
}

// Selector → [clase normal, clase en pantalla completa].
const TAMANOS = {
  '[data-nombre]': ['text-2xl', 'text-5xl'],
  '[data-token]': ['text-3xl', 'text-6xl'],
  '[data-total]': ['text-xl', 'text-4xl'],
  '[data-qr]': ['max-w-xs', 'max-w-[min(65vh,90vw)]'],
};

/** Botón de pantalla completa. Se oculta si el navegador no tiene la API (Safari en iPhone). */
function prepararPantallaCompleta(contenedor) {
  const proyeccion = contenedor.querySelector('[data-proyeccion]');
  const boton = contenedor.querySelector('[data-completa]');
  const salir = contenedor.querySelector('[data-salir]');

  if (!proyeccion.requestFullscreen) {
    boton.hidden = true;
    return;
  }

  boton.addEventListener('click', () => proyeccion.requestFullscreen().catch(() => {}));
  salir.addEventListener('click', () => document.exitFullscreen().catch(() => {}));

  // Esc también sale; este evento cubre ambos casos.
  proyeccion.addEventListener('fullscreenchange', () => {
    const activa = document.fullscreenElement === proyeccion;
    salir.hidden = !activa;
    proyeccion.classList.toggle('justify-center', activa);
    for (const [selector, [normal, grande]] of Object.entries(TAMANOS)) {
      const elemento = proyeccion.querySelector(selector);
      elemento.classList.toggle(normal, !activa);
      elemento.classList.toggle(grande, activa);
    }
  });
}

/** Una vuelta del sondeo: actualiza el total o indica que se perdió la conexión. */
async function actualizarContador(contenedor, id, estado) {
  const resultado = await listarAsistentes(id);
  if (estado.limpiado) return;

  const total = contenedor.querySelector('[data-total]');
  const conexion = contenedor.querySelector('[data-conexion]');
  if (!total) return;

  if (resultado.ok) {
    total.textContent = textoTotal(resultado.datos.total);
    conexion.hidden = true;
    estado.ultimoDato = new Date().toISOString();
    return;
  }

  if (resultado.error === 'evento_no_encontrado') {
    // El evento se eliminó mientras se proyectaba.
    estado.detenerSondeo?.();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    return pintarError(contenedor, resultado);
  }

  // Se conserva el último valor y se sigue intentando.
  conexion.textContent =
    resultado.error === 'sin_conexion'
      ? `Sin conexión · último dato ${estado.ultimoDato ? formatearHora(estado.ultimoDato) : '—'}`
      : mensajeDeError(resultado).texto;
  conexion.hidden = false;
}
