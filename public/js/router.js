// Navegación por hash (#/inicio, #/eventos/12/qr…) con reglas de acceso por rol.
import { leerPerfil } from './almacen.js';
import * as enConstruccion from './vistas/en-construccion.js';
import * as vistaAsistentes from './vistas/evento-asistentes.js';
import * as vistaFormulario from './vistas/evento-formulario.js';
import * as vistaQr from './vistas/evento-qr.js';
import * as vistaInicio from './vistas/inicio.js';
import * as vistaListas from './vistas/listas.js';
import * as vistaMisEventos from './vistas/mis-eventos.js';
import * as vistaPerfil from './vistas/perfil.js';

const ALUMNO = 'alumno';
const ORGANIZADOR = 'organizador';
const AMBOS = [ALUMNO, ORGANIZADOR];

// Un segmento :id solo acepta enteros positivos.
const ID_VALIDO = /^[1-9]\d*$/;

// Ruta → título de la barra, roles que pueden entrar y vista que la pinta.
const RUTAS = {
  '/inicio': { titulo: 'AsistQR', roles: AMBOS, vista: vistaInicio },
  '/perfil': { titulo: 'Perfil', roles: AMBOS, vista: vistaPerfil },
  '/escanear': { titulo: 'Escanear QR', roles: [ALUMNO], vista: enConstruccion },
  '/historial': { titulo: 'Mi historial', roles: [ALUMNO], vista: enConstruccion },
  '/eventos': { titulo: 'Eventos', roles: [ALUMNO], vista: enConstruccion },
  '/mis-eventos': { titulo: 'Mis eventos', roles: [ORGANIZADOR], vista: vistaMisEventos },
  '/nuevo-evento': { titulo: 'Nuevo evento', roles: [ORGANIZADOR], vista: vistaFormulario },
  '/eventos/:id/editar': { titulo: 'Editar evento', roles: [ORGANIZADOR], vista: vistaFormulario },
  '/eventos/:id/qr': { titulo: 'QR del evento', roles: [ORGANIZADOR], vista: vistaQr },
  '/eventos/:id/asistentes': { titulo: 'Asistentes', roles: [ORGANIZADOR], vista: vistaAsistentes },
  '/listas': { titulo: 'Lista de asistencia', roles: [ORGANIZADOR], vista: vistaListas },
};

// Limpieza que devolvió la vista actual (detener sondeos, salir de pantalla completa…).
let limpiarVista = null;

/** Cambia de ruta sin dejar la ruta rechazada en el historial (Atrás no regresa a ella). */
function redirigir(ruta) {
  location.replace(`#${ruta}`);
}

/** Busca la ruta que coincide con el hash. Devuelve { destino, parametros } o null. */
function buscarRuta(ruta) {
  if (RUTAS[ruta]) return { destino: RUTAS[ruta], parametros: {} };

  const segmentos = ruta.split('/');
  for (const [patron, destino] of Object.entries(RUTAS)) {
    const partes = patron.split('/');
    if (!partes.includes(':id') || partes.length !== segmentos.length) continue;

    const parametros = {};
    const coincide = partes.every((parte, i) => {
      if (parte !== ':id') return parte === segmentos[i];
      if (!ID_VALIDO.test(segmentos[i])) return false;
      parametros.id = Number(segmentos[i]);
      return true;
    });
    if (coincide) return { destino, parametros };
  }
  return null;
}

/** Aplica las reglas de acceso y pinta la vista de la ruta actual. */
function resolver({ contenedor, titulo, volver }) {
  const ruta = location.hash.slice(1);
  const perfil = leerPerfil();

  if (ruta === '') return redirigir('/inicio');
  if (!perfil && ruta !== '/perfil') return redirigir('/perfil');

  const encontrada = buscarRuta(ruta);
  if (!encontrada || (perfil && !encontrada.destino.roles.includes(perfil.rol))) {
    return redirigir('/inicio');
  }
  const { destino, parametros } = encontrada;

  // La vista anterior se limpia antes de pintar la nueva.
  if (limpiarVista) limpiarVista();
  limpiarVista = null;

  titulo.textContent = destino.titulo;
  document.title = ruta === '/inicio' ? 'AsistQR' : `${destino.titulo} · AsistQR`;
  volver.hidden = ruta === '/inicio' || !perfil; // Sin perfil no hay inicio al cual volver.

  contenedor.replaceChildren();
  const limpieza = destino.vista.pintar(contenedor, { perfil, titulo: destino.titulo, parametros });
  if (typeof limpieza === 'function') limpiarVista = limpieza;
  window.scrollTo(0, 0);
}

/** Pinta la ruta actual y vuelve a hacerlo cada vez que cambia el hash. */
export function iniciarRouter(elementos) {
  window.addEventListener('hashchange', () => resolver(elementos));
  resolver(elementos);
}
