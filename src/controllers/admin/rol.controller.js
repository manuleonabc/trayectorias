const rolRepo = require('../../repos/rol.repo');
const Rol = require('../../models/Rol');

const getRoles = async (req, res) => {
    const roles = await rolRepo.obtenerTodos();
    res.render('pages/admin/roles', { roles });
};

const postRol = async (req, res) => {
    const { nombre, nombreCorto, clave, jerarquia, cargaHoraria, nivelAcceso } = req.body;
    await rolRepo.crear({
        nombre,
        nombreCorto,
        clave,
        jerarquia: Number(jerarquia),
        // Vacio para roles como Profesor, cuya carga horaria depende de la asignatura.
        cargaHoraria: cargaHoraria ? Number(cargaHoraria) : undefined,
        nivelAcceso: nivelAcceso || undefined
    });
    req.flash('success', 'Rol creado.');
    res.redirect('/admin/roles');
};

// Edicion de un Rol ya existente - hace falta sobre todo para los roles que fueron creados
// antes de que nivelAcceso existiera (quedaron en 'ninguno' por default, sin forma de
// corregirlos hasta ahora - ver rolRepo.actualizar). Identificado por clave (a diferencia
// de Institucion/Cargo, Rol.clave existe desde el arranque del modelo, no es un campo
// agregado despues - no hay problema de bootstrap aca).
const getEditarRol = async (req, res) => {
    const rol = await rolRepo.obtenerPorClave(req.params.clave);
    if (!rol) return res.redirect('/admin/roles');
    res.render('pages/admin/rolEditar', { rol });
};

const postEditarRol = async (req, res) => {
    const rol = await rolRepo.obtenerPorClave(req.params.clave);
    if (!rol) return res.redirect('/admin/roles');

    const { nombre, nombreCorto, clave, jerarquia, cargaHoraria, nivelAcceso } = req.body;

    const duplicado = await Rol.findOne({
        _id: { $ne: rol._id },
        $or: [{ nombre }, { nombreCorto }, { clave }]
    });
    if (duplicado) {
        req.flash('error', 'Ya hay otro rol con ese nombre, nombre corto o clave.');
        return res.redirect(`/admin/roles/${req.params.clave}/editar`);
    }

    await rolRepo.actualizar(rol._id, {
        nombre,
        nombreCorto,
        clave,
        jerarquia: Number(jerarquia),
        cargaHoraria: cargaHoraria ? Number(cargaHoraria) : undefined,
        nivelAcceso: nivelAcceso || 'ninguno'
    });
    req.flash('success', 'Rol actualizado.');
    res.redirect('/admin/roles');
};

module.exports = { getRoles, postRol, getEditarRol, postEditarRol };
