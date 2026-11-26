const config = require('../config');

/**
 * Protege las acciones del organizador: exige el header X-PIN
 * con el valor de ORGANIZADOR_PIN. Si no coincide, responde 401.
 */
function requierePin(req, res, next) {
  if (req.get('X-PIN') !== config.ORGANIZADOR_PIN) {
    return res.status(401).json({
      error: 'pin_invalido',
      mensaje: 'PIN de organizador incorrecto o ausente.',
    });
  }
  next();
}

module.exports = { requierePin };
