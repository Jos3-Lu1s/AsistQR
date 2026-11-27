// Arranque de la app (index.html).
import { iniciarIndicadorConexion } from './conexion.js';
import { iniciarIndicadorPendientes } from './pendientes.js';
import { iniciarRouter } from './router.js';
import { iniciarSincronizacion } from './sincronizacion.js';

iniciarIndicadorConexion(document.getElementById('conexion'));
iniciarIndicadorPendientes(document.getElementById('pendientes'));
iniciarSincronizacion();

iniciarRouter({
  contenedor: document.getElementById('vista'),
  titulo: document.getElementById('titulo'),
  volver: document.getElementById('volver'),
});
