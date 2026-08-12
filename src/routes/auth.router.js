const express  = require('express');
const router   = express.Router();
const passport = require('../config/passport');
const designacionRepo = require('../repos/designacion.repo');
const institucionRepo = require('../repos/institucion.repo');
const { fijarCargoActivo } = require('../utils/cargoActivo');

// Redirige al flujo de consentimiento de Google. El switch "Ingresar como Gestion/Admin"
// de index.ejs manda ?admin=true/false aca - se guarda en sesion para leerlo despues del
// login real, en el callback (que necesita keepSessionInfo para que este dato sobreviva
// al regenerate() que hace Passport al loguearse - ver comentario en el callback). Ojo:
// esto NUNCA decide el rol del usuario - eso sigue viniendo unicamente de Usuario.rol en
// Mongo via Passport. Solo dice si, EN CASO de que el login resulte ser de un admin de
// verdad, esa persona quiere activar el modo gestion para esta sesion o entrar con su
// cargo normal.
router.get('/google', (req, res, next) => {
    req.session.modoGestionSolicitado = req.query.admin === 'true';
    next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google redirige aquí tras el login del usuario
router.get(
    '/google/callback',
    // keepSessionInfo: true - sin esto, Passport regenera la sesion al loguearse (buena
    // practica contra session fixation, ver node_modules/passport/lib/sessionmanager.js)
    // y eso borra el modoGestionSolicitado seteado en /google ANTES del login - siempre
    // quedaba undefined aca, sin importar el switch. keepSessionInfo hace que Passport
    // mergee la sesion vieja de vuelta despues de regenerar, en vez de descartarla.
    passport.authenticate('google', { failureRedirect: '/?error=acceso_denegado', keepSessionInfo: true }),
    async (req, res) => {
        console.log('Usuario autenticado:', req.user);
        if (req.user && !req.user.autorizado) return res.redirect('/alta')
        if (req.user.estado !== 'aprobado') {
            req.flash('warning', `Su estado actual es: ${req.user.estado}. Debe esperar la aprobación del administrador.`);
            return res.redirect('/');
        }

        // Se revalida SIEMPRE contra req.user.rol (ya autenticado por Passport, viene de
        // Mongo) - lo pedido en /google (arriba) es solo una preferencia del cliente, no
        // alcanza por si sola para activar nada.
        req.session.modoGestion = req.user.rol === 'admin' && req.session.modoGestionSolicitado === true;
        delete req.session.modoGestionSolicitado;

        // Admin en modo gestion: elige institucion en vez de cargo (son caminos
        // alternativos - un admin gestionando no necesita su cargo docente activo). Ver
        // /seleccionar-institucion. alcance.tipo === 'institucion' restringe la lista;
        // cualquier otro caso (incluido alcance sin configurar, que es el estado de todo
        // admin hoy) se trata como "sin restriccion" para no dejar bloqueado a nadie que
        // nunca configuro ese campo.
        if (req.session.modoGestion) {
            // Caminos alternativos: si por una sesion anterior (misma cookie, ver
            // keepSessionInfo mas arriba) quedo un cargoActivoId de cuando esta persona
            // entro sin modo gestion, no debe filtrarse aca - el admin en modo gestion no
            // opera con cargo activo, y el nav no deberia mostrar links de docente.
            delete req.session.cargoActivoId;
            delete req.session.nivelAccesoActivo;
            delete req.session.cargoActivoNombre;
            delete req.session.escuelaActivaClave;

            const alcance = req.user.alcance;
            const instituciones = (alcance && alcance.tipo === 'institucion')
                ? await institucionRepo.obtenerPorIds(alcance.instituciones)
                : await institucionRepo.obtenerTodos();

            if (instituciones.length === 0) {
                req.flash('warning', 'No tenés instituciones asignadas para gestionar. Contactá a otro administrador.');
                return res.redirect('/');
            }
            if (instituciones.length === 1) {
                req.session.institucionActivaId = instituciones[0]._id;
                req.session.institucionActivaNombre = instituciones[0].nombre;
                req.session.escuelaActivaClave = instituciones[0].clave;
                return res.redirect('/estudiantes');
            }
            return res.redirect('/seleccionar-institucion');
        }

        // Las instituciones no tienen cargos, entran directo.
        if (req.user.tipo !== 'personal') return res.redirect('/estudiantes');

        const designaciones = await designacionRepo.obtenerActivasPorPersona(req.user.entidadId);

        // Un admin puede entrar aunque todavía no tenga un cargo propio asignado.
        if (designaciones.length === 0 && req.user.rol !== 'admin') {
            req.flash('warning', 'Todavía no tenés un cargo asignado. Contactá al administrador.');
            return res.redirect('/');
        }

        if (designaciones.length === 1) {
            const destino = await fijarCargoActivo(req, designaciones[0].cargoId._id);
            return res.redirect(destino);
        }

        if (designaciones.length > 1) return res.redirect('/seleccionar-cargo');

        res.redirect('/estudiantes');
    }
);

// Cierra la sesión y vuelve al inicio
router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

module.exports = router;
