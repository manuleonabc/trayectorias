// controllers/auth.controller.js
const authService = require('../services/auth.service');

const redirectToGoogle = (req, res) => {
    try {
        // Capturamos el flag 'admin' que viene por query (por defecto false si no viene)
        const isAdmin = req.query.admin === 'true';
        
        // Obtenemos la URL de consentimiento de Google pasándole este estado
        const url = authService.getGoogleAuthUrl(isAdmin);
        
        // Redirigimos al usuario a la pantalla de login de Google
        return res.redirect(url);
    } catch (error) {
        console.error('Error al redirigir a Google:', error);
        return res.status(500).send('Error interno del servidor');
    }
};

const handleGoogleCallback = async (req, res) => {
    try {
        const { code, state } = req.query;
        
        if (!code) {
            return res.status(400).send('Código de autorización no provisto por Google.');
        }

        // El 'state' nos va a devolver si era admin o no tras el viaje de ida y vuelta
        const stateData = state ? JSON.parse(decodeURIComponent(state)) : { isAdmin: false };

        // Procesamos el login en el servicio (intercambio de tokens y persistencia/búsqueda del usuario)
        const sessionData = await authService.loginWithGoogle(code, stateData.isAdmin);

        // Aquí manejás tu sesión. Por ejemplo, si usas JWT se lo enviás al front, 
        // o si usas cookies de sesión las seteás acá.
        // Ejemplo genérico devolviendo un JSON o redirigiendo al home logueado:
        return res.json({
            message: 'Login exitoso',
            ...sessionData
        });

    } catch (error) {
        console.error('Error en el callback de Google:', error);
        return res.status(500).send('Error en la autenticación.');
    }
};

module.exports = {
    redirectToGoogle,
    handleGoogleCallback
};