// Vista Formulario de evento: crea (#/nuevo-evento) o edita (#/eventos/:id/editar) un evento.
import { crearEvento, editarEvento, mensajeDeError, obtenerEvento } from '../api.js';
import { isoALocal, localAIso } from '../formato.js';
import { obtenerUbicacion, ubicacionSoportada } from '../ubicacion.js';

const CLASES_CAMPO =
  'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-marca focus:ring-2 focus:ring-marca/30 focus:outline-none aria-invalid:border-red-500';

/** Campo con su etiqueta y el párrafo donde aparece su error. */
function campo(nombre, etiqueta, control) {
  return `
    <label class="block">
      <span class="text-sm font-medium">${etiqueta}</span>
      ${control}
      <span data-error-campo="${nombre}" hidden class="mt-1 block text-sm text-red-700"></span>
    </label>
  `;
}

/** Pinta el formulario. En modo edición primero carga el evento. */
export function pintar(contenedor, { parametros }) {
  const id = parametros.id ?? null;
  contenedor.innerHTML = `
    <form novalidate class="mx-auto max-w-xl space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      <h2 class="text-xl font-bold">${id ? 'Editar evento' : 'Nuevo evento'}</h2>

      ${campo('nombre', 'Nombre *', `<input name="nombre" autocomplete="off" class="${CLASES_CAMPO}">`)}
      ${campo('descripcion', 'Descripción', `<textarea name="descripcion" rows="3" class="${CLASES_CAMPO}"></textarea>`)}
      ${campo('lugar', 'Lugar', `<input name="lugar" autocomplete="off" class="${CLASES_CAMPO}">`)}

      <div class="grid gap-5 sm:grid-cols-2">
        ${campo('inicio', 'Inicio *', `<input name="inicio" type="datetime-local" class="${CLASES_CAMPO}">`)}
        ${campo('fin', 'Fin *', `<input name="fin" type="datetime-local" class="${CLASES_CAMPO}">`)}
      </div>

      <fieldset data-ubicacion class="space-y-3 rounded-xl border border-slate-200 p-4">
        <legend class="px-1 text-sm font-medium">Ubicación del evento</legend>
        <div>
          <button type="button" data-gps
                  class="rounded-lg border border-marca px-4 py-2 font-semibold text-marca hover:bg-marca/5 disabled:opacity-60">
            📍 Usar mi ubicación
          </button>
          <p data-gps-estado aria-live="polite" class="mt-2 text-sm text-slate-600"></p>
        </div>
        <div class="grid gap-5 sm:grid-cols-2">
          ${campo('latitud', 'Latitud *', `<input name="latitud" type="number" step="any" inputmode="decimal" class="${CLASES_CAMPO}">`)}
          ${campo('longitud', 'Longitud *', `<input name="longitud" type="number" step="any" inputmode="decimal" class="${CLASES_CAMPO}">`)}
        </div>
        ${campo('radio_m', 'Radio permitido (metros)', `<input name="radio_m" type="number" min="1" step="1" inputmode="numeric" class="${CLASES_CAMPO}">`)}
      </fieldset>

      <div data-error role="alert" hidden class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        <p data-error-texto></p>
        <ul data-error-detalles class="mt-1 list-disc pl-5"></ul>
        <a data-error-enlace hidden class="mt-1 inline-block font-semibold underline"></a>
      </div>

      <button type="submit"
              class="w-full rounded-lg bg-marca px-4 py-3 font-semibold text-white hover:bg-marca/90 disabled:opacity-60">
        Guardar
      </button>
    </form>
  `;

  const form = contenedor.querySelector('form');
  prepararUbicacion(form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    guardar(form, id);
  });

  if (!id) {
    form.radio_m.value = '100';
    return;
  }
  precargar(form, id);
}

const MENSAJES_UBICACION = {
  negado: 'Permiso de ubicación negado. Escribe las coordenadas o actívalo en la configuración del navegador.',
  no_disponible: 'No se pudo obtener la ubicación. Escribe las coordenadas a mano.',
  tiempo_agotado: 'La ubicación tardó demasiado. Intenta de nuevo o escribe las coordenadas.',
  no_soportado: 'La ubicación automática requiere HTTPS.',
};

/** Botón "Usar mi ubicación": llena latitud y longitud, que siguen editables a mano. */
function prepararUbicacion(form) {
  const boton = form.querySelector('[data-gps]');
  const estado = form.querySelector('[data-gps-estado]');

  if (!ubicacionSoportada()) {
    boton.hidden = true;
    estado.textContent = MENSAJES_UBICACION.no_soportado;
    return;
  }

  boton.addEventListener('click', async () => {
    boton.disabled = true;
    estado.className = 'mt-2 text-sm text-slate-600';
    estado.textContent = 'Obteniendo ubicación…';

    const ubicacion = await obtenerUbicacion();
    if (!form.isConnected) return;
    boton.disabled = false;

    if (!ubicacion.ok) {
      estado.className = 'mt-2 text-sm text-red-700';
      estado.textContent = MENSAJES_UBICACION[ubicacion.error];
      return;
    }
    form.latitud.value = ubicacion.latitud.toFixed(6);
    form.longitud.value = ubicacion.longitud.toFixed(6);
    estado.textContent = `Precisión ±${Math.round(ubicacion.precision)} m`;
  });
}

/** Carga el evento a editar y llena los campos con .value (nunca como HTML). */
async function precargar(form, id) {
  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;
  boton.textContent = 'Cargando…';

  const resultado = await obtenerEvento(id);
  if (!form.isConnected) return;

  if (!resultado.ok) {
    // Sin el evento no hay nada que editar: se deja solo el mensaje.
    for (const elemento of form.querySelectorAll('label, fieldset, button')) elemento.hidden = true;
    mostrarError(form, resultado);
    return;
  }

  const evento = resultado.datos;
  form.nombre.value = evento.nombre;
  form.descripcion.value = evento.descripcion ?? '';
  form.lugar.value = evento.lugar ?? '';
  form.inicio.value = isoALocal(evento.inicio);
  form.fin.value = isoALocal(evento.fin);
  form.latitud.value = evento.latitud;
  form.longitud.value = evento.longitud;
  form.radio_m.value = evento.radio_m;
  boton.disabled = false;
  boton.textContent = 'Guardar';
}

/** Valida igual que el servidor. Devuelve { datos } o { errores: { campo: texto } }. */
function validar(form) {
  const errores = {};
  const nombre = form.nombre.value.trim();
  const inicio = localAIso(form.inicio.value);
  const fin = localAIso(form.fin.value);
  const latitud = form.latitud.value === '' ? NaN : Number(form.latitud.value);
  const longitud = form.longitud.value === '' ? NaN : Number(form.longitud.value);
  const radioTexto = form.radio_m.value.trim();
  const radio = Number(radioTexto);

  if (!nombre) errores.nombre = 'Escribe el nombre del evento.';
  if (!inicio) errores.inicio = 'Indica la fecha y hora de inicio.';
  if (!fin) errores.fin = 'Indica la fecha y hora de fin.';
  else if (inicio && fin <= inicio) errores.fin = 'El fin debe ser posterior al inicio.';
  if (!(latitud >= -90 && latitud <= 90)) errores.latitud = 'La latitud debe estar entre −90 y 90.';
  if (!(longitud >= -180 && longitud <= 180)) errores.longitud = 'La longitud debe estar entre −180 y 180.';
  if (radioTexto && !(Number.isInteger(radio) && radio > 0)) {
    errores.radio_m = 'El radio debe ser un número entero mayor que 0.';
  }

  if (Object.keys(errores).length > 0) return { errores };

  const datos = {
    nombre,
    descripcion: form.descripcion.value.trim(),
    lugar: form.lugar.value.trim(),
    inicio,
    fin,
    latitud,
    longitud,
  };
  if (radioTexto) datos.radio_m = radio; // Vacío: el servidor usa 100.
  return { datos };
}

/** Marca cada campo con su error, o lo limpia. */
function mostrarErroresDeCampos(form, errores) {
  for (const aviso of form.querySelectorAll('[data-error-campo]')) {
    const nombre = aviso.dataset.errorCampo;
    const texto = errores[nombre];
    aviso.textContent = texto ?? '';
    aviso.hidden = !texto;
    if (texto) form.elements[nombre].setAttribute('aria-invalid', 'true');
    else form.elements[nombre].removeAttribute('aria-invalid');
  }
}

/** Muestra el error general de una petición, con los detalles del servidor si los hay. */
function mostrarError(form, resultado) {
  const caja = form.querySelector('[data-error]');
  if (!resultado) {
    caja.hidden = true;
    return;
  }
  const { texto, enlace } = mensajeDeError(resultado);
  caja.querySelector('[data-error-texto]').textContent = texto;

  const detalles = caja.querySelector('[data-error-detalles]');
  detalles.replaceChildren(
    ...(resultado.detalles ?? []).map((detalle) => {
      const li = document.createElement('li');
      li.textContent = detalle;
      return li;
    }),
  );

  const a = caja.querySelector('[data-error-enlace]');
  a.hidden = !enlace;
  if (enlace) {
    a.href = enlace.href;
    a.textContent = enlace.texto;
  }
  caja.hidden = false;
}

/** Valida, envía y redirige: al QR si es nuevo, a Mis eventos si se editó. */
async function guardar(form, id) {
  mostrarError(form, null);
  const { datos, errores } = validar(form);
  mostrarErroresDeCampos(form, errores ?? {});
  if (errores) {
    form.querySelector('[aria-invalid]')?.focus();
    return;
  }

  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;
  boton.textContent = 'Guardando…';

  const resultado = id ? await editarEvento(id, datos) : await crearEvento(datos);
  if (!form.isConnected) return;

  if (resultado.ok) {
    location.hash = id ? '#/mis-eventos' : `#/eventos/${resultado.datos.id}/qr`;
    return;
  }
  boton.disabled = false;
  boton.textContent = 'Guardar';
  mostrarError(form, resultado);
}
