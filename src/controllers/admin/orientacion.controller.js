const orientacionRepo = require('../../repos/orientacion.repo');
const asignaturaRepo = require('../../repos/asignatura.repo');

const getOrientaciones = async (req, res) => {
    const orientaciones = await orientacionRepo.obtenerTodos();
    res.render('pages/admin/orientaciones', { orientaciones });
};

const postOrientacion = async (req, res) => {
    const { nombre, nombreCorto, clave } = req.body;
    await orientacionRepo.crear({ nombre, nombreCorto, clave });
    req.flash('success', 'Orientación creada.');
    res.redirect('/admin/orientaciones');
};

const getEditarOrientacion = async (req, res) => {
    const orientacion = await orientacionRepo.obtenerPorClave(req.params.clave);
    if (!orientacion) return res.redirect('/admin/orientaciones');
    res.render('pages/admin/orientacionEditar', { orientacion });
};

const postEditarOrientacion = async (req, res) => {
    const orientacion = await orientacionRepo.obtenerPorClave(req.params.clave);
    if (!orientacion) return res.redirect('/admin/orientaciones');

    const { nombre, nombreCorto, clave } = req.body;
    await orientacionRepo.actualizar(orientacion._id, { nombre, nombreCorto, clave });
    req.flash('success', 'Orientación actualizada.');
    res.redirect('/admin/orientaciones');
};

const postEliminarOrientacion = async (req, res) => {
    const orientacion = await orientacionRepo.obtenerPorClave(req.params.clave);
    if (!orientacion) return res.redirect('/admin/orientaciones');

    const enUso = await asignaturaRepo.tieneFilas(orientacion._id);
    if (enUso) {
        req.flash('error', 'No se puede eliminar: ya tiene materias cargadas en algún año. Quitalas primero.');
        return res.redirect('/admin/orientaciones');
    }
    await orientacionRepo.eliminar(orientacion._id);
    req.flash('success', 'Orientación eliminada.');
    res.redirect('/admin/orientaciones');
};

module.exports = {
    getOrientaciones,
    postOrientacion,
    getEditarOrientacion,
    postEditarOrientacion,
    postEliminarOrientacion
};
