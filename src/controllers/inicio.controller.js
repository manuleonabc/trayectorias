const cargoRepo = require('../repos/cargo.repo');

// Dashboard de 3 bloques (Estudiantes / Curso / Docentes) para cargos con nivelAcceso
// 'total' (jerarquicos: Director, Vicedirector, Secretario, EMATP, etc. - ver Rol.js).
// Reemplaza el aterrizaje directo a /estudiantes que sigue usando cualquier otro cargo.
const getInicio = async (req, res) => {
    if (!req.session.cargoActivoId) return res.redirect('/estudiantes');

    const cargo = await cargoRepo.obtenerPorId(req.session.cargoActivoId);
    if (!cargo || !cargo.rolId || cargo.rolId.nivelAcceso !== 'total') {
        return res.redirect('/estudiantes');
    }

    res.render('pages/inicio', { cargo });
};

module.exports = { getInicio };
