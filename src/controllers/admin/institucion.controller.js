const institucionRepo = require('../../repos/institucion.repo');

const getInstituciones = async (req, res) => {
    const instituciones = await institucionRepo.obtenerTodos();
    res.render('pages/admin/instituciones', { instituciones });
};

const getEditarInstitucion = async (req, res) => {
    const institucion = await institucionRepo.obtenerPorCue(req.params.cue);
    if (!institucion) return res.redirect('/admin/instituciones');
    res.render('pages/admin/institucionEditar', { institucion });
};

const postEditarInstitucion = async (req, res) => {
    const { clave } = req.body;

    const duplicada = await institucionRepo.obtenerPorClave(clave);
    if (duplicada && duplicada.cue !== req.params.cue) {
        req.flash('error', 'Ya hay otra institución con esa clave.');
        return res.redirect(`/admin/instituciones/${req.params.cue}/editar`);
    }

    await institucionRepo.actualizarClave(req.params.cue, clave);
    req.flash('success', 'Clave actualizada.');
    res.redirect('/admin/instituciones');
};

module.exports = { getInstituciones, getEditarInstitucion, postEditarInstitucion };
