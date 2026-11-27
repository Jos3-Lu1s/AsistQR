// Vista Mi historial: asistencias guardadas en el dispositivo, completadas con las del servidor.
import { EVENTO_COLA, guardarHistorial, leerCola, leerHistorial, leerUltimaSync } from '../almacen.js';
import { listarHistorial } from '../api.js';
import { ETIQUETAS_ASISTENCIA, formatearFechaCorta } from '../formato.js';
import { sincronizarCola } from '../sincronizacion.js';

// Etiqueta y colores de una entrada que no se ha enviado o que el servidor rechazó.
const ETIQUETAS_LOCALES = {
  pendiente: { texto: 'Pendiente de envío', clases: 'bg-sky-100 text-sky-800' },
  token_invalido: { texto: 'Rechazada: código inválido', clases: 'bg-red-100 text-red-800' },
  ya_registrado: { texto: 'Ya registrada', clases: 'bg-slate-200 text-slate-700' },
  datos_invalidos: { texto: 'Rechazada: datos inválidos', clases: 'bg-red-100 text-red-800' },
};

const CLASES_BOTON =
  'rounded-lg bg-marca px-4 py-2 font-semibold text-white hover:bg-marca/90 disabled:bg-slate-300 disabled:text-slate-600';

/** Pinta lo guardado en el dispositivo, lo completa con el servidor y devuelve la limpieza. */
export function pintar(contenedor, { perfil }) {
  contenedor.innerHTML = `
    <section class="mx-auto max-w-3xl">
      <h2 class="text-2xl font-bold">Mi historial</h2>
      <p data-ultima class="mt-1 mb-4 text-sm text-slate-600"></p>

      <div data-cola hidden class="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <p data-por-enviar class="flex-1 font-semibold"></p>
        <button type="button" data-enviar class="${CLASES_BOTON}"></button>
      </div>

      <div data-aviso hidden class="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <p data-aviso-texto class="flex-1"></p>
        <button type="button" data-reintentar hidden class="font-semibold underline">Reintentar</button>
      </div>

      <div data-lista></div>
    </section>
  `;

  const seccion = contenedor.querySelector('section');
  const aviso = seccion.querySelector('[data-aviso]');
  const botonEnviar = seccion.querySelector('[data-enviar]');
  const botonReintentar = seccion.querySelector('[data-reintentar]');
  let enviando = false;

  function mostrarAviso(texto, { reintentar = false } = {}) {
    seccion.querySelector('[data-aviso-texto]').textContent = texto;
    botonReintentar.hidden = !reintentar;
    aviso.hidden = false;
  }

  /** Última sincronización, recuadro de pendientes y filas: todo sale del dispositivo. */
  function pintarLocal() {
    const ultima = leerUltimaSync();
    seccion.querySelector('[data-ultima]').textContent = ultima
      ? `Última sincronización: ${formatearFechaCorta(ultima)}`
      : 'Aún no se ha sincronizado';

    const total = leerCola().length;
    seccion.querySelector('[data-cola]').hidden = total === 0;
    seccion.querySelector('[data-por-enviar]').textContent = `${total} por enviar`;
    botonEnviar.disabled = enviando || !navigator.onLine;
    botonEnviar.textContent = navigator.onLine ? (enviando ? 'Enviando…' : 'Enviar ahora') : 'Se necesita conexión';

    pintarFilas(seccion.querySelector('[data-lista]'), leerHistorial().filter((e) => e.matricula === perfil.matricula));
  }

  /** Pide el historial al servidor y lo une con el local. */
  async function actualizar() {
    aviso.hidden = true;
    if (!navigator.onLine) {
      mostrarAviso('Sin conexión · mostrando lo guardado en el dispositivo');
      return;
    }
    const respuesta = await listarHistorial(perfil.matricula);
    if (!seccion.isConnected) return; // El usuario ya cambió de vista.

    if (respuesta.ok) {
      guardarHistorial(unir(leerHistorial(), respuesta.datos, perfil.matricula));
      pintarLocal();
    } else if (respuesta.error === 'sin_conexion') {
      mostrarAviso('Sin conexión · mostrando lo guardado en el dispositivo');
    } else {
      mostrarAviso('No se pudo actualizar el historial', { reintentar: true });
    }
  }

  botonEnviar.addEventListener('click', async () => {
    enviando = true;
    pintarLocal();
    await sincronizarCola();
    enviando = false;
    if (seccion.isConnected) pintarLocal();
  });
  botonReintentar.addEventListener('click', actualizar);

  // La cola cambia al encolar o al sincronizar en segundo plano; la conexión cambia el botón y el aviso.
  const alCambiarConexion = () => {
    pintarLocal();
    actualizar();
  };
  window.addEventListener(EVENTO_COLA, pintarLocal);
  window.addEventListener('online', alCambiarConexion);
  window.addEventListener('offline', alCambiarConexion);

  pintarLocal();
  actualizar();

  return () => {
    window.removeEventListener(EVENTO_COLA, pintarLocal);
    window.removeEventListener('online', alCambiarConexion);
    window.removeEventListener('offline', alCambiarConexion);
  };
}

/**
 * Une el historial local con el del servidor para una matrícula.
 * El servidor manda sobre las enviadas; las pendientes y los rechazos se conservan,
 * salvo un "ya registrada" cuyo evento ya aparece en el servidor. Otras matrículas no se tocan.
 */
export function unir(local, servidor, matricula) {
  const propias = local.filter((e) => e.matricula === matricula);
  const otras = local.filter((e) => e.matricula !== matricula);
  const uuidsServidor = new Set(servidor.map((a) => a.uuid));
  const eventosServidor = new Set(servidor.map((a) => a.evento_id));

  const delServidor = servidor.map((a) => ({
    uuid: a.uuid,
    matricula,
    codigo: propias.find((e) => e.uuid === a.uuid)?.codigo ?? null,
    capturada_en: a.capturada_en,
    sincronizacion: 'enviada',
    motivo: null,
    evento_id: a.evento_id,
    evento_nombre: a.evento_nombre,
    estado: a.estado,
    distancia_m: a.distancia_m,
    offline: a.offline,
  }));

  const conservadas = propias.filter((e) => {
    if (uuidsServidor.has(e.uuid)) return false; // Ya viene del servidor.
    if (e.sincronizacion === 'enviada') return false; // El organizador la eliminó.
    if (e.motivo === 'ya_registrado' && eventosServidor.has(e.evento_id)) return false;
    return true;
  });

  return [...delServidor, ...conservadas, ...otras].sort((a, b) => b.capturada_en.localeCompare(a.capturada_en));
}

/** Filas del historial, o el estado "sin datos". */
function pintarFilas(lista, entradas) {
  if (entradas.length === 0) {
    lista.innerHTML = `
      <div class="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p class="font-semibold">Aún no tienes asistencias</p>
        <a href="#/escanear"
           class="mt-5 inline-block rounded-lg bg-marca px-5 py-3 font-semibold text-white hover:bg-marca/90">Escanear QR</a>
      </div>
    `;
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'space-y-3';
  for (const entrada of entradas) ul.append(crearFila(entrada));
  lista.replaceChildren(ul);
}

/** Etiqueta de la entrada: el estado del servidor si se envió, o su situación local. */
function etiqueta(entrada) {
  if (entrada.sincronizacion === 'enviada') {
    const valida = entrada.estado === 'valida';
    return {
      texto: ETIQUETAS_ASISTENCIA[entrada.estado] ?? entrada.estado,
      clases: valida ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800',
    };
  }
  if (entrada.sincronizacion === 'pendiente') return ETIQUETAS_LOCALES.pendiente;
  return ETIQUETAS_LOCALES[entrada.motivo] ?? ETIQUETAS_LOCALES.datos_invalidos;
}

function crearFila(entrada) {
  const fila = document.createElement('li');
  fila.className = 'flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm';
  fila.innerHTML = `
    <div class="min-w-0 flex-1">
      <p data-nombre class="font-semibold break-words"></p>
      <p data-detalle class="text-sm text-slate-600"></p>
    </div>
    <span data-etiqueta class="rounded-full px-3 py-1 text-xs font-semibold"></span>
  `;
  // Textos del servidor o del usuario: siempre con textContent.
  fila.querySelector('[data-nombre]').textContent = entrada.evento_nombre ?? `Código ${entrada.codigo}`;
  const detalle = [formatearFechaCorta(entrada.capturada_en)];
  if (entrada.distancia_m !== null && entrada.distancia_m !== undefined) detalle.push(`${Math.round(entrada.distancia_m)} m`);
  fila.querySelector('[data-detalle]').textContent = detalle.join(' · ');

  const { texto, clases } = etiqueta(entrada);
  const elemento = fila.querySelector('[data-etiqueta]');
  elemento.textContent = texto;
  elemento.classList.add(...clases.split(' '));
  return fila;
}
