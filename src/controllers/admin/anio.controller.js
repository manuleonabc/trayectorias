const anioRepo = require('../../repos/anio.repo');
const asignaturaRepo = require('../../repos/asignatura.repo');
const orientacionRepo = require('../../repos/orientacion.repo');
const Orientacion = require('../../models/Orientacion');

const nombreCampoDuplicado = (existente, datos) => {
    if (existente.clave === datos.clave) return 'clave';
    if (existente.nombre === datos.nombre) return 'nombre';
    if (existente.nombreCorto === datos.nombreCorto) return 'nombre corto';
    if (existente.orden === datos.orden) return 'orden';
    return 'dato';
};

// La plantilla no tiene orientacion (URL corta); una orientacion vuelve a su propia pantalla.
const urlDeFila = (anioClave, fila, orientacion) => (orientacion
    ? `/admin/anios/${anioClave}/orientaciones/${orientacion.clave}`
    : `/admin/anios/${anioClave}`);

const urlEditarFila = (anioClave, orientacion, filaClave) => (orientacion
    ? `/admin/anios/${anioClave}/orientaciones/${orientacion.clave}/filas/${filaClave}/editar`
    : `/admin/anios/${anioClave}/filas/${filaClave}/editar`);

const getAnios = async (req, res) => {
    const anios = await anioRepo.obtenerTodos();
    res.render('pages/admin/anios', { anios });
};

const postAnio = async (req, res) => {
    const { clave, nombre, ciclo, grado } = req.body;
    await anioRepo.crear({ clave, nombre, ciclo, grado: grado || undefined });
    req.flash('success', 'Año creado.');
    res.redirect('/admin/anios');
};

const getAnioDetalle = async (req, res) => {
    const anio = await anioRepo.obtenerPorClave(req.params.clave);
    if (!anio) return res.redirect('/admin/anios');

    const plantilla = await asignaturaRepo.obtenerPlantilla(anio._id);

    let orientacionesUsadas = [];
    let orientacionesDisponibles = [];
    if (anio.ciclo === 'superior') {
        const idsUsados = await asignaturaRepo.obtenerOrientacionesUsadas(anio._id);
        [orientacionesUsadas, orientacionesDisponibles] = await Promise.all([
            Orientacion.find({ _id: { $in: idsUsados } }).sort({ nombre: 1 }),
            Orientacion.find({ _id: { $nin: idsUsados } }).sort({ nombre: 1 })
        ]);
    }

    res.render('pages/admin/anioDetalle', { anio, plantilla, orientacionesUsadas, orientacionesDisponibles });
};

const postFilaPlantilla = async (req, res) => {
    const anio = await anioRepo.obtenerPorClave(req.params.clave);
    if (!anio) return res.redirect('/admin/anios');

    const { nombre, nombreCorto, clave, cargaHoraria, orden } = req.body;
    const datos = { nombre, nombreCorto, clave, orden: Number(orden) };

    const duplicado = await asignaturaRepo.buscarDuplicado(anio._id, null, datos);
    if (duplicado) {
        req.flash('error', `Ya hay una materia con ese ${nombreCampoDuplicado(duplicado, datos)} en este año.`);
        return res.redirect(`/admin/anios/${req.params.clave}`);
    }

    await asignaturaRepo.crear({
        anioId: anio._id,
        orientacionId: null,
        nombre,
        nombreCorto,
        clave,
        cargaHoraria: Number(cargaHoraria),
        orden: datos.orden
    });
    req.flash('success', 'Materia agregada.');
    res.redirect(`/admin/anios/${req.params.clave}`);
};

const postOrientacionParaAnio = async (req, res) => {
    const anio = await anioRepo.obtenerPorClave(req.params.clave);
    if (!anio) return res.redirect('/admin/anios');

    const { orientacionId } = req.body;
    const orientacion = await Orientacion.findById(orientacionId);
    if (!orientacion) return res.redirect(`/admin/anios/${req.params.clave}`);

    await asignaturaRepo.clonarPlantilla(anio._id, orientacion._id);
    req.flash('success', 'Orientación agregada, con las materias comunes ya cargadas.');
    res.redirect(`/admin/anios/${req.params.clave}/orientaciones/${orientacion.clave}`);
};

const getOrientacionDetalle = async (req, res) => {
    const anio = await anioRepo.obtenerPorClave(req.params.clave);
    const orientacion = await orientacionRepo.obtenerPorClave(req.params.orientacionClave);
    if (!anio || !orientacion) return res.redirect('/admin/anios');

    const filas = await asignaturaRepo.obtenerPorAnioYOrientacion(anio._id, orientacion._id);
    res.render('pages/admin/orientacionDetalle', { anio, orientacion, filas });
};

const postFilaOrientacion = async (req, res) => {
    const anio = await anioRepo.obtenerPorClave(req.params.clave);
    const orientacion = await orientacionRepo.obtenerPorClave(req.params.orientacionClave);
    if (!anio || !orientacion) return res.redirect('/admin/anios');

    const { nombre, nombreCorto, clave, cargaHoraria, orden } = req.body;
    const datos = { nombre, nombreCorto, clave, orden: Number(orden) };
    const urlVolver = `/admin/anios/${req.params.clave}/orientaciones/${req.params.orientacionClave}`;

    const duplicado = await asignaturaRepo.buscarDuplicado(anio._id, orientacion._id, datos);
    if (duplicado) {
        req.flash('error', `Ya hay una materia con ese ${nombreCampoDuplicado(duplicado, datos)} en este año.`);
        return res.redirect(urlVolver);
    }

    await asignaturaRepo.crear({
        anioId: anio._id,
        orientacionId: orientacion._id,
        nombre,
        nombreCorto,
        clave,
        cargaHoraria: Number(cargaHoraria),
        orden: datos.orden
    });
    req.flash('success', 'Materia agregada.');
    res.redirect(urlVolver);
};

const postAjustar = async (req, res) => {
    const anio = await anioRepo.obtenerPorClave(req.params.clave);
    const orientacion = await orientacionRepo.obtenerPorClave(req.params.orientacionClave);
    if (!anio || !orientacion) return res.redirect('/admin/anios');

    const fila = await asignaturaRepo.obtenerPorClave(anio._id, orientacion._id, req.params.filaClave);
    if (!fila) return res.redirect('/admin/anios');

    const urlVolver = `/admin/anios/${req.params.clave}/orientaciones/${req.params.orientacionClave}`;
    await asignaturaRepo.actualizar(fila._id, { cargaHoraria: Number(req.body.cargaHoraria) });
    req.flash('success', 'Carga horaria actualizada.');
    res.redirect(urlVolver);
};

// El orden ya no se escribe a mano en ningun lado: solo se mueve con subir/bajar,
// que intercambia con la fila vecina y por eso nunca puede chocar con otra. Sirven tanto
// para la plantilla (sin orientacionClave en la URL) como para una orientacion.
const postSubir = async (req, res) => {
    const anio = await anioRepo.obtenerPorClave(req.params.clave);
    if (!anio) return res.redirect('/admin/anios');
    const orientacion = req.params.orientacionClave
        ? await orientacionRepo.obtenerPorClave(req.params.orientacionClave)
        : null;

    const fila = await asignaturaRepo.obtenerPorClave(anio._id, orientacion ? orientacion._id : null, req.params.filaClave);
    if (!fila) return res.redirect('/admin/anios');

    await asignaturaRepo.subir(fila._id);
    res.redirect(urlDeFila(req.params.clave, fila, orientacion));
};

const postBajar = async (req, res) => {
    const anio = await anioRepo.obtenerPorClave(req.params.clave);
    if (!anio) return res.redirect('/admin/anios');
    const orientacion = req.params.orientacionClave
        ? await orientacionRepo.obtenerPorClave(req.params.orientacionClave)
        : null;

    const fila = await asignaturaRepo.obtenerPorClave(anio._id, orientacion ? orientacion._id : null, req.params.filaClave);
    if (!fila) return res.redirect('/admin/anios');

    await asignaturaRepo.bajar(fila._id);
    res.redirect(urlDeFila(req.params.clave, fila, orientacion));
};

const postQuitar = async (req, res) => {
    const anio = await anioRepo.obtenerPorClave(req.params.clave);
    const orientacion = await orientacionRepo.obtenerPorClave(req.params.orientacionClave);
    if (!anio || !orientacion) return res.redirect('/admin/anios');

    const fila = await asignaturaRepo.obtenerPorClave(anio._id, orientacion._id, req.params.filaClave);
    if (fila) await asignaturaRepo.eliminar(fila._id);

    req.flash('success', 'Materia quitada de esta orientación.');
    res.redirect(`/admin/anios/${req.params.clave}/orientaciones/${req.params.orientacionClave}`);
};

const getEditarFila = async (req, res) => {
    const anio = await anioRepo.obtenerPorClave(req.params.clave);
    if (!anio) return res.redirect('/admin/anios');
    const orientacion = req.params.orientacionClave
        ? await orientacionRepo.obtenerPorClave(req.params.orientacionClave)
        : null;

    const fila = await asignaturaRepo.obtenerPorClave(anio._id, orientacion ? orientacion._id : null, req.params.filaClave);
    if (!fila) return res.redirect('/admin/anios');

    res.render('pages/admin/filaEditar', { anio, orientacion, fila });
};

const postEditarFila = async (req, res) => {
    const anio = await anioRepo.obtenerPorClave(req.params.clave);
    if (!anio) return res.redirect('/admin/anios');
    const orientacion = req.params.orientacionClave
        ? await orientacionRepo.obtenerPorClave(req.params.orientacionClave)
        : null;

    const fila = await asignaturaRepo.obtenerPorClave(anio._id, orientacion ? orientacion._id : null, req.params.filaClave);
    if (!fila) return res.redirect('/admin/anios');

    // El orden no se toca aca: se mueve solo con subir/bajar.
    const { nombre, nombreCorto, clave, cargaHoraria } = req.body;
    const datos = { nombre, nombreCorto, clave, orden: fila.orden };
    const urlVolver = urlDeFila(req.params.clave, fila, orientacion);

    const duplicado = await asignaturaRepo.buscarDuplicado(anio._id, orientacion ? orientacion._id : null, datos, fila._id);
    if (duplicado) {
        req.flash('error', `Ya hay otra materia con ese ${nombreCampoDuplicado(duplicado, datos)} en este año.`);
        return res.redirect(urlEditarFila(req.params.clave, orientacion, req.params.filaClave));
    }

    await asignaturaRepo.actualizar(fila._id, {
        nombre,
        nombreCorto,
        clave,
        cargaHoraria: Number(cargaHoraria)
    });
    req.flash('success', 'Materia actualizada.');
    res.redirect(urlVolver);
};

module.exports = {
    getAnios,
    postAnio,
    getAnioDetalle,
    postFilaPlantilla,
    postOrientacionParaAnio,
    getOrientacionDetalle,
    postFilaOrientacion,
    postAjustar,
    postSubir,
    postBajar,
    postQuitar,
    getEditarFila,
    postEditarFila
};
