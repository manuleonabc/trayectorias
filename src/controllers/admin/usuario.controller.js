const usuarioRepo = require('../../repos/usuario.repo');

// Aprobar/rechazar cuentas nuevas (Usuario.estado 'pendiente' -> 'aprobado'/'rechazado') -
// hasta ahora no habia ninguna ruta que hiciera esto, quedaba solo editando Mongo a mano
// (ver usuarioService.putEstadoUsuario, codigo muerto que llamaba a metodos del repo que
// no existian - no se reutiliza, esta version es nueva y directa contra el repo).
const getUsuarios = async (req, res) => {
    const [pendientes, resueltos] = await Promise.all([
        usuarioRepo.obtenerPendientes(),
        usuarioRepo.obtenerResueltos()
    ]);
    res.render('pages/admin/usuarios', { pendientes, resueltos });
};

const postAprobar = async (req, res) => {
    const usuario = await usuarioRepo.obtenerPorId(req.params.id);
    if (!usuario) return res.redirect('/admin/usuarios');

    await usuarioRepo.actualizarEstado(usuario._id, 'aprobado');
    req.flash('success', `Cuenta de ${usuario.email} aprobada.`);
    res.redirect('/admin/usuarios');
};

const postRechazar = async (req, res) => {
    const usuario = await usuarioRepo.obtenerPorId(req.params.id);
    if (!usuario) return res.redirect('/admin/usuarios');

    await usuarioRepo.actualizarEstado(usuario._id, 'rechazado');
    req.flash('success', `Cuenta de ${usuario.email} rechazada.`);
    res.redirect('/admin/usuarios');
};

module.exports = { getUsuarios, postAprobar, postRechazar };
