const turnoRepo = require('../../repos/turno.repo');
const institucionRepo = require('../../repos/institucion.repo');

const getTurnos = async (req, res) => {
    const [institucion, turnos] = await Promise.all([
        institucionRepo.obtenerPorId(req.session.institucionActivaId),
        turnoRepo.obtenerPorInstitucion(req.session.institucionActivaId)
    ]);
    res.render('pages/admin/turnos', { institucion, turnos });
};

const postTurno = async (req, res) => {
    const institucionId = req.session.institucionActivaId;
    const { nombre, clave } = req.body;
    await turnoRepo.crear({ institucionId, nombre, clave });
    req.flash('success', 'Turno creado.');
    res.redirect('/admin/turnos');
};

const getTurnoDetalle = async (req, res) => {
    const institucion = await institucionRepo.obtenerPorClave(req.params.institucionClave);
    if (!institucion) return res.redirect('/admin/turnos');

    const turno = await turnoRepo.obtenerPorClave(institucion._id, req.params.turnoClave);
    if (!turno) return res.redirect('/admin/turnos');

    res.render('pages/admin/turnoDetalle', { turno });
};

const postModulo = async (req, res) => {
    const institucion = await institucionRepo.obtenerPorClave(req.params.institucionClave);
    if (!institucion) return res.redirect('/admin/turnos');

    const turno = await turnoRepo.obtenerPorClave(institucion._id, req.params.turnoClave);
    if (!turno) return res.redirect('/admin/turnos');

    const { nombre, horaInicio, horaFin, tipo } = req.body;
    await turnoRepo.agregarModulo(turno._id, { nombre, horaInicio, horaFin, tipo });
    req.flash('success', 'Módulo agregado.');
    res.redirect(`/admin/instituciones/${req.params.institucionClave}/turnos/${req.params.turnoClave}`);
};

module.exports = { getTurnos, postTurno, getTurnoDetalle, postModulo };
