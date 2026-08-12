// services/auth.service.js
const { OAuth2Client } = require('google-auth-library');
const cargoRepo = require('../repositories/cargoRepo'); // Tu capa de datos para buscar/crear usuarios

// Configuración del cliente con tus variables de entorno
const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI // Ej: http://localhost:3000/auth/google/callback
);

const getGoogleAuthUrl = (isAdmin) => {
    // Usamos el parámetro 'state' para pasar el flag 'admin' de manera segura a través de Google
    const state = encodeURIComponent(JSON.stringify({ isAdmin }));

    return oauth2Client.generateAuthUrl({
        access_type: 'offline', // Permite obtener un refresh token si fuera necesario
        scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email'
        ],
        state: state
    });
};

const loginWithGoogle = async (code, isAdmin) => {
    // 1. Intercambiar el código que nos dio el front/Google por tokens de acceso
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // 2. Obtener la información del perfil del usuario usando el token id_token
    const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    
    // Datos útiles que te da Google:
    const { email, name, picture, sub: googleId } = payload;

    // 3. Lógica de tu modelo/base de datos usando tu repositorio (cargoRepo)
    // Buscamos si el usuario ya existe por su email o googleId
    let user = await cargoRepo.findUserByEmail(email);

    if (!user) {
        // Si no existe, lo creamos asignándole el rol correspondiente según el flag original
        user = await cargoRepo.createUser({
            email,
            name,
            avatar: picture,
            googleId,
            role: isAdmin ? 'admin' : 'user'
        });
    }

    // 4. Generar la estrategia de sesión de tu app (ej: generar un token JWT propio)
    // const tuTokenApp = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);

    return {
        user,
        token: tokens.access_token // O el JWT de tu propia aplicación si decidís implementarlo
    };
};

module.exports = {
    getGoogleAuthUrl,
    loginWithGoogle
};