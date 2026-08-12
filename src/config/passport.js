// passport.js

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const usuarioService = require('../services/usuario.service');
const { admin } = require('googleapis/build/src/apis/admin');

// MUDANZA: Passport sabe cómo manejar al usuario
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
        // 1. Verificación ultra-segura del email
        //console.log('Perfil recibido de Google:', profile);
        const emails = profile.emails || [];
        if (emails.length === 0) {
            return done(null, false, { message: 'No se pudo obtener el email de Google' });
        }
        const email = emails[0].value.toLowerCase();

        // 2. Verificación del dominio (con guardas para evitar el null)
        const dominio = profile._json && profile._json.hd ? profile._json.hd : 'personal';

        if (dominio !== 'abc.gob.ar') {
            console.log(`Acceso denegado para dominio: ${dominio}`);
            return done(null, false, { message: 'Solo se permiten cuentas @abc.gob.ar' });
        }

        // 3. Buscamos en MongoDB (ya no en Sheets)
        const usuarioRegistrado = await usuarioService.verificarPermiso(email);
        //console.log('============>>>>>>>>>:', profile);
        const usuarioGoogle = {
            id: profile.id,
            email: email,
            nombre: profile.name?.givenName || 'Sin nombre',
            apellido: profile.name?.familyName || 'Sin apellido',
            foto: profile._json?.picture,
            hd: dominio
        };

        // 4. Lógica de autorización (usando tu variable usuarioRegistrado)
        // 4. Lógica de autorización
        if (usuarioRegistrado) {
            return done(null, {
                ...usuarioRegistrado.toObject(),
                ...usuarioGoogle,
                autorizado: true
            });
        } else {
            // CASO: USUARIO NUEVO (No está en Atlas)
            let tipoSugerido = 'personal';
            let modelSugerido = 'Persona';
            let datosExtra = {};

            // Detección y formateo de Institución (las cuentas de Google de escuelas
            // arrancan su nombre con "Escuela", eso es una convención del dominio, no del modelo)
            if (usuarioGoogle.nombre.startsWith('Escuela')) {
                tipoSugerido = 'institucion';
                modelSugerido = 'Institucion';

                const matchNumeros = email.match(/\d+/);
                const numeros = matchNumeros ? matchNumeros[0] : "";
                
                const distrito = numeros.substring(0, 3);
                const sede = numeros.length > 3 ? numeros.substring(3) : "00";
                const region = usuarioGoogle.apellido ? usuarioGoogle.apellido.replace(/\D/g, '') : "";

                datosExtra = {
                    clave: `escuela${numeros}`,
                    distrito,
                    sede,
                    region,
                    aprobado: 'pendiente' // Las Escuelas siempre arrancan pendientes
                };
            }

            return done(null, {
                ...usuarioGoogle,
                ...datosExtra,
                autorizado: false, // Sigue siendo false para que pasen por el formulario de /alta
                tipo: tipoSugerido,
                tipoModel: modelSugerido
            });
        }

    } catch (error) {
        console.error('Error en la estrategia de Passport:', error);
        return done(error);
    }
  }
));

module.exports = passport;