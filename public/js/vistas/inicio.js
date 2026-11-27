// Vista Inicio: saludo y accesos según el rol.
import { EVENTO_COLA, leerCola } from '../almacen.js';

// Tarjetas de acceso de cada rol, en el orden en que se muestran.
const ACCESOS = {
  alumno: [
    { ruta: '#/escanear', icono: '📷', titulo: 'Escanear QR', texto: 'Registra tu asistencia con la cámara.' },
    { ruta: '#/historial', icono: '🗂️', titulo: 'Mi historial', texto: 'Tus asistencias, también sin conexión.' },
    { ruta: '#/eventos', icono: '📅', titulo: 'Eventos', texto: 'Próximos, activos y pasados.' },
    { ruta: '#/perfil', icono: '👤', titulo: 'Perfil', texto: 'Tu nombre y matrícula.' },
  ],
  organizador: [
    { ruta: '#/mis-eventos', icono: '📋', titulo: 'Mis eventos', texto: 'Edita tus eventos y proyecta el QR.' },
    { ruta: '#/nuevo-evento', icono: '➕', titulo: 'Nuevo evento', texto: 'Crea un evento con tu ubicación.' },
    { ruta: '#/listas', icono: '🧾', titulo: 'Lista de asistencia', texto: 'Consulta e imprime la lista.' },
    { ruta: '#/perfil', icono: '👤', titulo: 'Perfil', texto: 'Tu nombre y PIN.' },
  ],
};

const ETIQUETA_ROL = { alumno: 'Alumno', organizador: 'Organizador' };

/** Pinta el saludo y la cuadrícula de accesos (1, 2 o 3 columnas según el ancho). */
export function pintar(contenedor, { perfil }) {
  contenedor.innerHTML = `
    <section class="mb-6">
      <h2 class="text-2xl font-bold">Hola, <span data-nombre></span></h2>
      <span class="mt-2 inline-block rounded-full bg-marca/10 px-3 py-1 text-xs font-semibold text-marca">
        ${ETIQUETA_ROL[perfil.rol]}
      </span>
    </section>

    <nav aria-label="Accesos" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      ${ACCESOS[perfil.rol].map((acceso) => `
        <a href="${acceso.ruta}"
           class="flex min-h-24 items-center gap-4 rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-marca focus-visible:outline-none active:scale-[0.98]">
          <span class="text-4xl" aria-hidden="true">${acceso.icono}</span>
          <span>
            <span class="block text-lg font-semibold">${acceso.titulo}</span>
            <span class="block text-sm text-slate-600">${acceso.texto}</span>
            ${acceso.ruta === '#/historial'
              ? '<span data-por-enviar hidden class="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"></span>'
              : ''}
          </span>
        </a>
      `).join('')}
    </nav>
  `;
  contenedor.querySelector('[data-nombre]').textContent = perfil.nombre; // Dato del usuario: nunca como HTML.

  // "N por enviar" en la tarjeta Mi historial (solo existe para el alumno).
  const porEnviar = contenedor.querySelector('[data-por-enviar]');
  if (!porEnviar) return;
  const pintarPorEnviar = () => {
    const total = leerCola().length;
    porEnviar.textContent = `${total} por enviar`;
    porEnviar.hidden = total === 0;
  };
  pintarPorEnviar();
  window.addEventListener(EVENTO_COLA, pintarPorEnviar);
  return () => window.removeEventListener(EVENTO_COLA, pintarPorEnviar);
}
