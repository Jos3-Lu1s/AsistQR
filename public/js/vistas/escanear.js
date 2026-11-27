// Vista Escanear QR: registra la asistencia leyendo el QR con la cámara o escribiendo el código.
import { camaraSoportada, iniciarEscaner } from '../escaner.js';
import { obtenerUbicacion } from '../ubicacion.js';
import { codigoValido, normalizarCodigo, registrar } from '../registro.js';
import { vibrar } from '../vibracion.js';

const CLASES_CAMPO =
  'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-2xl tracking-[0.4em] uppercase text-center focus:border-marca focus:ring-2 focus:ring-marca/30 focus:outline-none';

// Mensaje según el error de getUserMedia.
const ERRORES_CAMARA = {
  NotAllowedError: 'Permiso de cámara negado. Escribe el código o activa la cámara en la configuración del navegador.',
  NotFoundError: 'No se encontró una cámara. Escribe el código.',
};

// Colores de la tarjeta según el tono del resultado.
const CLASES_TONO = {
  exito: 'bg-green-50 text-green-800',
  aviso: 'bg-amber-50 text-amber-800',
  error: 'bg-red-50 text-red-700',
};

/** Pinta la vista y devuelve su función de limpieza. */
export function pintar(contenedor, { perfil }) {
  contenedor.innerHTML = `
    <section class="mx-auto max-w-md space-y-4">
      <div data-entrada class="space-y-4">
        <div class="space-y-4 rounded-2xl bg-white p-6 text-center shadow-sm">
          <p class="text-sm text-slate-600">Usaremos la cámara solo para leer el QR del evento.</p>
          <div data-visor hidden class="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-black">
            <video muted playsinline class="size-full object-cover"></video>
            <div class="pointer-events-none absolute inset-[15%] rounded-xl border-4 border-white/80" aria-hidden="true"></div>
          </div>
          <button type="button" data-activar
                  class="w-full rounded-lg bg-marca px-4 py-3 font-semibold text-white hover:bg-marca/90 disabled:opacity-60">
            📷 Activar cámara
          </button>
          <button type="button" data-detener hidden
                  class="w-full rounded-lg bg-white px-4 py-3 font-semibold text-marca ring-1 ring-marca hover:bg-marca/5">
            Detener cámara
          </button>
          <p data-error-camara role="alert" hidden class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"></p>
          <p data-sin-camara hidden class="text-sm text-slate-500">La cámara requiere HTTPS. Escribe el código.</p>
        </div>

        <form data-formulario novalidate class="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
          <label class="block">
            <span class="text-sm font-medium">Código del evento</span>
            <input name="codigo" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false"
                   class="${CLASES_CAMPO}">
          </label>
          <p data-error role="alert" hidden class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"></p>
          <button type="submit"
                  class="w-full rounded-lg bg-marca px-4 py-3 font-semibold text-white hover:bg-marca/90 disabled:opacity-60">
            Registrar
          </button>
        </form>
      </div>

      <p data-progreso role="status" hidden class="py-4 text-center font-medium text-slate-600"></p>
      <p data-aviso-ubicacion hidden class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"></p>

      <div data-resultado hidden class="rounded-2xl p-6 text-center shadow-sm">
        <p data-mensaje role="alert" class="text-lg font-semibold break-words"></p>
        <div class="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" data-otro
                  class="rounded-lg bg-marca px-5 py-3 font-semibold text-white hover:bg-marca/90">Escanear otro</button>
          <a href="#/historial"
             class="rounded-lg bg-white px-5 py-3 font-semibold text-marca ring-1 ring-marca hover:bg-marca/5">Ver mi historial</a>
        </div>
      </div>
    </section>
  `;

  const seccion = contenedor.querySelector('section');
  const formulario = seccion.querySelector('[data-formulario]');
  const campo = formulario.elements.codigo;
  const error = seccion.querySelector('[data-error]');
  const progreso = seccion.querySelector('[data-progreso]');
  const avisoUbicacion = seccion.querySelector('[data-aviso-ubicacion]');
  const tarjeta = seccion.querySelector('[data-resultado]');
  const visor = seccion.querySelector('[data-visor]');
  const video = visor.querySelector('video');
  const botonActivar = seccion.querySelector('[data-activar]');
  const botonDetener = seccion.querySelector('[data-detener]');
  const errorCamara = seccion.querySelector('[data-error-camara]');
  let ocupado = false;
  let detenerCamara = null;

  /** Muestra u oculta el visor y alterna los botones de la cámara. */
  function mostrarCamara(si) {
    visor.hidden = !si;
    botonDetener.hidden = !si;
    botonActivar.hidden = si;
  }

  function apagarCamara() {
    if (detenerCamara) detenerCamara();
    detenerCamara = null;
    mostrarCamara(false);
  }

  async function encenderCamara() {
    errorCamara.hidden = true;
    botonActivar.disabled = true;
    try {
      const detener = await iniciarEscaner(video, (texto) => {
        detenerCamara = null; // El escáner ya apagó la cámara al leer.
        mostrarCamara(false);
        registrarCodigo(texto);
      });
      if (!seccion.isConnected) return detener(); // Se salió de la vista mientras se pedía el permiso.
      detenerCamara = detener;
      mostrarCamara(true);
    } catch (error) {
      errorCamara.textContent = ERRORES_CAMARA[error.name] ?? 'No se pudo abrir la cámara. Escribe el código.';
      errorCamara.hidden = false;
    } finally {
      botonActivar.disabled = false;
    }
  }

  if (camaraSoportada()) {
    botonActivar.addEventListener('click', encenderCamara);
    botonDetener.addEventListener('click', apagarCamara);
  } else {
    botonActivar.hidden = true;
    seccion.querySelector('[data-sin-camara]').hidden = false;
  }

  /** Habilita o deshabilita todos los controles de entrada. */
  function bloquear(si) {
    for (const control of seccion.querySelectorAll('[data-entrada] input, [data-entrada] button')) {
      control.disabled = si;
    }
  }

  function mostrarProgreso(texto) {
    progreso.textContent = texto;
    progreso.hidden = !texto;
  }

  /** Muestra la tarjeta de resultado en lugar de los controles de entrada. */
  function mostrarResultado({ texto, tono }) {
    seccion.querySelector('[data-entrada]').hidden = true;
    tarjeta.className = `rounded-2xl p-6 text-center shadow-sm ${CLASES_TONO[tono]}`;
    tarjeta.querySelector('[data-mensaje]').textContent = texto; // Puede traer el nombre del evento.
    tarjeta.hidden = false;
    vibrar(tono);
  }

  /** Valida el código, pide la ubicación y registra. Lo usan el formulario y la cámara. */
  async function registrarCodigo(texto) {
    if (ocupado) return;
    const codigo = normalizarCodigo(texto);
    error.hidden = true;
    if (!codigoValido(codigo)) {
      error.textContent = 'Código inválido. Revisa los 6 caracteres.';
      error.hidden = false;
      vibrar('error');
      return;
    }

    ocupado = true;
    apagarCamara(); // Por si se escribió el código con la cámara encendida.
    bloquear(true);
    const capturadaEn = new Date().toISOString(); // Hora del escaneo, antes de esperar al GPS.

    mostrarProgreso('Obteniendo ubicación…');
    const ubicacion = await obtenerUbicacion();
    if (!seccion.isConnected) return; // El usuario ya cambió de vista.
    if (!ubicacion.ok) {
      avisoUbicacion.textContent = 'No se pudo obtener tu ubicación. Se registrará sin ubicación.';
      avisoUbicacion.hidden = false;
    }

    mostrarProgreso('Registrando…');
    const respuesta = await registrar({ codigo, perfil, capturadaEn, ubicacion });
    if (!seccion.isConnected) return;

    mostrarProgreso('');
    mostrarResultado(describir(respuesta));
    ocupado = false;
    bloquear(false);
  }

  campo.addEventListener('input', () => {
    campo.value = campo.value.toUpperCase();
  });

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    registrarCodigo(campo.value);
  });

  // Regresa a los controles de entrada para un registro nuevo.
  tarjeta.querySelector('[data-otro]').addEventListener('click', () => {
    tarjeta.hidden = true;
    avisoUbicacion.hidden = true;
    campo.value = '';
    seccion.querySelector('[data-entrada]').hidden = false;
    campo.focus();
  });

  // Al salir de la vista se apaga la cámara.
  return apagarCamara;
}

/** Texto y tono de la tarjeta según el resultado del registro. */
function describir({ resultado, entrada, mensaje }) {
  if (resultado === 'pendiente') {
    return { texto: '📴 Guardada sin conexión. Se enviará automáticamente al reconectar.', tono: 'aviso' };
  }

  if (resultado === 'rechazada') {
    switch (entrada.motivo) {
      case 'ya_registrado':
        return { texto: 'Ya tenías asistencia registrada en este evento.', tono: 'aviso' };
      case 'token_invalido':
        return { texto: '❌ El código no corresponde a ningún evento.', tono: 'error' };
      default:
        return { texto: mensaje ?? 'Los datos de la asistencia no son válidos.', tono: 'error' };
    }
  }

  switch (entrada.estado) {
    case 'valida':
      return { texto: `✅ Asistencia registrada en «${entrada.evento_nombre ?? entrada.codigo}»`, tono: 'exito' };
    case 'fuera_de_rango': {
      const distancia = entrada.distancia_m === null ? '' : ` (${Math.round(entrada.distancia_m)} m)`;
      return { texto: `⚠️ Registrada, pero fuera del rango del evento${distancia}`, tono: 'aviso' };
    }
    case 'fuera_de_horario':
      return { texto: '⚠️ Registrada fuera del horario del evento', tono: 'aviso' };
    default:
      return { texto: '⚠️ Registrada sin ubicación', tono: 'aviso' };
  }
}
