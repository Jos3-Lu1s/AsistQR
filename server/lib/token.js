const crypto = require('node:crypto');

// Sin 0/O/1/I para que el token se pueda dictar y escribir a mano sin confusiones.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LONGITUD = 6;

/** Genera un token aleatorio de 6 caracteres del alfabeto permitido. */
function generarToken() {
  let token = '';
  for (let i = 0; i < LONGITUD; i++) {
    token += ALFABETO[crypto.randomInt(ALFABETO.length)];
  }
  return token;
}

/** Normaliza un token recibido del cliente: sin espacios y en mayúsculas. */
function normalizarToken(token) {
  return String(token).trim().toUpperCase();
}

module.exports = { ALFABETO, LONGITUD, generarToken, normalizarToken };
