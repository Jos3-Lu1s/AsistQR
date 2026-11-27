// Navegación por hash (#/inicio, #/perfil…) con reglas de acceso por rol.
import { leerPerfil } from './almacen.js';
import * as enConstruccion from './vistas/en-construccion.js';
import * as vistaInicio from './vistas/inicio.js';
import * as vistaPerfil from './vistas/perfil.js';

const ALUMNO = 'alumno';
const ORGANIZADOR = 'organizador';
const AMBOS = [ALUMNO, ORGANIZADOR];

// Ruta → título de la barra, roles que pueden entrar y vista que la pinta.
const RUTAS = {
  '/inicio': { titulo: 'AsistQR', roles: AMBOS, vista: vistaInicio },
  '/perfil': { titulo: 'Perfil', roles: AMBOS, vista: vistaPerfil },
  '/escanear': { titulo: 'Escanear QR', roles: [ALUMNO], vista: enConstruccion },
  '/historial': { titulo: 'Mi historial', roles: [ALUMNO], vista: enConstruccion },
  '/eventos': { titulo: 'Eventos', roles: [ALUMNO], vista: enConstruccion },
  '/mis-eventos': { titulo: 'Mis eventos', roles: [ORGANIZADOR], vista: enConstruccion },
  '/nuevo-evento': { titulo: 'Nuevo evento', roles: [ORGANIZADOR], vista: enConstruccion },
  '/listas': { titulo: 'Lista de asistencia', roles: [ORGANIZADOR], vista: enConstruccion },
};

/** Cambia de ruta sin dejar la ruta rechazada en el historial (Atrás no regresa a ella). */
function redirigir(ruta) {
  location.replace(`#${ruta}`);
}

/** Aplica las reglas de acceso y pinta la vista de la ruta actual. */
function resolver({ contenedor, titulo, volver }) {
  const ruta = location.hash.slice(1);
  const perfil = leerPerfil();

  if (ruta === '') return redirigir('/inicio');
  if (!perfil && ruta !== '/perfil') return redirigir('/perfil');

  const destino = RUTAS[ruta];
  if (!destino || (perfil && !destino.roles.includes(perfil.rol))) return redirigir('/inicio');

  titulo.textContent = destino.titulo;
  document.title = ruta === '/inicio' ? 'AsistQR' : `${destino.titulo} · AsistQR`;
  volver.hidden = ruta === '/inicio' || !perfil; // Sin perfil no hay inicio al cual volver.

  contenedor.replaceChildren();
  destino.vista.pintar(contenedor, { perfil, titulo: destino.titulo });
  window.scrollTo(0, 0);
}

/** Pinta la ruta actual y vuelve a hacerlo cada vez que cambia el hash. */
export function iniciarRouter(elementos) {
  window.addEventListener('hashchange', () => resolver(elementos));
  resolver(elementos);
}
