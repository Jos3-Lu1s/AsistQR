const config = require('./config');
const { abrirBD } = require('./db');
const { sembrar } = require('./seed');
const { crearApp } = require('./app');

// Punto de entrada: abre la BD, crea los datos de prueba si hace falta y escucha.
const db = abrirBD(config.DB_PATH);

const sembrados = sembrar(db);
if (sembrados > 0) console.log(`Datos de prueba: se crearon ${sembrados} eventos.`);

const app = crearApp({ db });

app.listen(config.PORT, () => {
  console.log(`AsistQR escuchando en http://localhost:${config.PORT}`);
  console.log(`Base de datos: ${config.DB_PATH}`);
});
