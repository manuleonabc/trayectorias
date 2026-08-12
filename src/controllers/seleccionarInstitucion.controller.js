const institucionRepo = require('../repos/institucion.repo');

// Misma logica de resolucion de instituciones disponibles que el branch de modo gestion
// en auth.router.js - si el usuario vuelve a esta pantalla (ej. para cambiar de
// institucion a mitad de sesion), tiene que ver las mismas opciones que vio al loguearse.
const getSeleccionarInstitucion = async (req, res) => {
    const alcance = req.user.alcance;
    const instituciones = (alcance && alcance.tipo === 'institucion')
        ? await institucionRepo.obtenerPorIds(alcance.instituciones)
        : await institucionRepo.obtenerTodos();

    res.render('pages/seleccionarInstitucion', { instituciones });
};

const postSeleccionarInstitucion = async (req, res) => {
    const institucion = await institucionRepo.obtenerPorId(req.body.institucionId);
    if (!institucion) {
        req.flash('error', 'Institución inválida.');
        return res.redirect('/seleccionar-institucion');
    }
    req.session.institucionActivaId = institucion._id;
    req.session.institucionActivaNombre = institucion.nombre;
    // Ver utils/cargoActivo.js - mismo campo que usa el path de docente para mostrar la
    // clave de la escuela en el nav, asi el nav no necesita saber si sos admin o docente.
    req.session.escuelaActivaClave = institucion.clave;
    res.redirect('/estudiantes');
};

module.exports = { getSeleccionarInstitucion, postSeleccionarInstitucion };
