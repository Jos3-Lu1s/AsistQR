// Vista Perfil: crea o edita el perfil guardado en el dispositivo.
import { guardarPerfil, guardarPin, leerPin } from '../almacen.js';
import { verificarPin } from '../api.js';

const MENSAJES_PIN = {
  incorrecto: 'PIN incorrecto',
  sin_conexion: 'Se necesita conexión para verificar el PIN',
};

const CLASES_CAMPO =
  'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-marca focus:ring-2 focus:ring-marca/30 focus:outline-none';

/** Pinta el formulario, precargado si ya hay perfil. */
export function pintar(contenedor, { perfil }) {
  contenedor.innerHTML = `
    <form novalidate class="mx-auto max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <h2 class="text-xl font-bold">${perfil ? 'Editar perfil' : 'Bienvenido a AsistQR'}</h2>
        <p class="mt-1 text-sm text-slate-600">${perfil ? 'Actualiza tus datos.' : 'Cuéntanos quién eres para empezar.'}</p>
      </div>

      <fieldset>
        <legend class="text-sm font-medium">Soy</legend>
        <div class="mt-2 grid grid-cols-2 gap-3">
          <label class="cursor-pointer rounded-xl border-2 border-slate-200 p-3 text-center has-checked:border-marca has-checked:bg-marca/5">
            <input type="radio" name="rol" value="alumno" class="sr-only">
            <span class="block text-2xl" aria-hidden="true">🎓</span>
            <span class="font-semibold">Alumno</span>
          </label>
          <label class="cursor-pointer rounded-xl border-2 border-slate-200 p-3 text-center has-checked:border-marca has-checked:bg-marca/5">
            <input type="radio" name="rol" value="organizador" class="sr-only">
            <span class="block text-2xl" aria-hidden="true">🧑‍🏫</span>
            <span class="font-semibold">Organizador</span>
          </label>
        </div>
      </fieldset>

      <label class="block">
        <span class="text-sm font-medium">Nombre</span>
        <input name="nombre" autocomplete="name" class="${CLASES_CAMPO}">
      </label>

      <label class="block" data-solo="alumno">
        <span class="text-sm font-medium">Matrícula</span>
        <input name="matricula" autocomplete="off" class="${CLASES_CAMPO}">
      </label>

      <label class="block" data-solo="organizador">
        <span class="text-sm font-medium">PIN de organizador</span>
        <input name="pin" type="password" inputmode="numeric" autocomplete="off" class="${CLASES_CAMPO} tracking-widest">
        <span data-ayuda-pin class="mt-1 block text-xs text-slate-500"></span>
      </label>

      <p data-error role="alert" hidden class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"></p>

      <button type="submit"
              class="w-full rounded-lg bg-marca px-4 py-3 font-semibold text-white hover:bg-marca/90 disabled:opacity-60">
        Guardar
      </button>
    </form>
  `;

  const form = contenedor.querySelector('form');
  const error = form.querySelector('[data-error]');
  const boton = form.querySelector('button');
  const pinGuardado = perfil?.rol === 'organizador' ? leerPin() : null;

  // Precarga con .value (nunca como HTML) y elige Alumno si es un perfil nuevo.
  form.rol.value = perfil?.rol ?? 'alumno';
  form.nombre.value = perfil?.nombre ?? '';
  form.matricula.value = perfil?.matricula ?? '';
  form.querySelector('[data-ayuda-pin]').textContent = pinGuardado
    ? 'Déjalo vacío para conservar el PIN actual.'
    : 'Lo verificamos con el servidor; necesitas conexión.';

  /** Muestra solo los campos del rol elegido. */
  const mostrarCamposDelRol = () => {
    for (const campo of form.querySelectorAll('[data-solo]')) {
      campo.hidden = campo.dataset.solo !== form.rol.value;
    }
  };
  form.addEventListener('change', mostrarCamposDelRol);
  mostrarCamposDelRol();

  const mostrarError = (texto) => {
    error.textContent = texto;
    error.hidden = !texto;
  };

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mostrarError('');

    const rol = form.rol.value;
    const nombre = form.nombre.value.trim();
    const matricula = form.matricula.value.trim();
    const pin = form.pin.value.trim();

    if (!nombre) return mostrarError('Escribe tu nombre.');

    if (rol === 'alumno') {
      if (!matricula) return mostrarError('Escribe tu matrícula.');
      guardarPerfil({ rol, nombre, matricula });
      location.hash = '#/inicio';
      return;
    }

    // Organizador: el PIN solo se pide si no hay uno guardado.
    if (!pin && !pinGuardado) return mostrarError('Escribe el PIN de organizador.');
    if (pin) {
      boton.disabled = true;
      boton.textContent = 'Verificando…';
      const resultado = await verificarPin(pin);
      boton.disabled = false;
      boton.textContent = 'Guardar';
      if (resultado !== 'ok') return mostrarError(MENSAJES_PIN[resultado]);
      guardarPin(pin);
    }
    guardarPerfil({ rol, nombre });
    location.hash = '#/inicio';
  });
}
