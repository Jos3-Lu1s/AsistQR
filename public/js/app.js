// Arranque de la app (index.html).
import { iniciarIndicadorConexion } from './conexion.js';
import { iniciarRouter } from './router.js';

iniciarIndicadorConexion(document.getElementById('conexion'));

iniciarRouter({
  contenedor: document.getElementById('vista'),
  titulo: document.getElementById('titulo'),
  volver: document.getElementById('volver'),
});
