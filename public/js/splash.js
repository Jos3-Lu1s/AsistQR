// Arranque de la app: hace las tareas de preparación y luego abre index.html.
import { leerPerfil } from './almacen.js';

// Tiempo mínimo en pantalla para que la animación de entrada termine.
const MINIMO_MS = 1000;

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/** Tareas reales de arranque. Aquí se suman el registro del Service Worker y la carga de eventos. */
async function prepararApp() {
  return { perfil: leerPerfil() };
}

// Espera lo que tarde más: las tareas o el mínimo de 1 s.
const [{ perfil }] = await Promise.all([prepararApp(), esperar(MINIMO_MS)]);

// replace: el botón Atrás no regresa al splash.
location.replace(perfil ? '/index.html#/inicio' : '/index.html#/perfil');
