require('dotenv').config(); // Para leer el archivo .env más adelante
const app = require('./src/app');
const conectarDB = require('./src/config/db');

const PUERTO = process.env.PORT || 3000;

// Punto de entrada del proceso: conecta base y levanta servidor HTTP.
async function iniciarServidor() {
    try {
        await conectarDB();
        app.listen(PUERTO, () => {
            console.log(`Servidor listo en: http://localhost:${PUERTO}`);
        });
    } catch (error) {
        console.error('No se pudo iniciar la aplicacion:', error.message);
        process.exit(1);
    }
}

iniciarServidor();