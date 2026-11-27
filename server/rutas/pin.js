const express = require('express');
const { requierePin } = require('../middleware/pin');

const router = express.Router();

// Verifica el PIN del organizador sin hacer nada más: 204 si es correcto, 401 si no.
router.get('/', requierePin, (req, res) => {
  res.status(204).end();
});

module.exports = router;
