const cargoRepo = require('../../repos/cargo.repo');
const designacionRepo = require('../../repos/designacion.repo');
const licenciaRepo = require('../../repos/licencia.repo');
const cargoCursoRepo = require('../../repos/cargoCurso.repo');
const solicitudCargoRepo = require('../../repos/solicitudCargo.repo');
const usuarioRepo = require('../../repos/usuario.repo');
const cursoRepo = require('../../repos/curso.repo');
const turnoRepo = require('../../repos/turno.repo');
const rolRepo = require('../../repos/rol.repo');
const institucionRepo = require('../../repos/institucion.repo');
const auditoriaRepo = require('../../repos/auditoria.repo');
const Persona = require('../../models/Persona');
const { compararCargos } = require('../../utils/ordenCargos');
const hechoPor = require('../../utils/hechoPor');

const getCargos = async (req, res) => {
    const [institucion, cargos, turnos, roles] = await Promise.all([
        institucionRepo.obtenerPorId(req.session.institucionActivaId),
        cargoRepo.obtenerPorInstitucion(req.session.institucionActivaId),
        turnoRepo.obtenerPorInstitucion(req.session.institucionActivaId),
        rolRepo.obtenerTodos()
    ]);

    // Para cada cargo, quien lo ejerce hoy (si alguien) - para mostrar en el listado.
    const activas = await Promise.all(cargos.map((cargo) => designacionRepo.obtenerActivaPorCargo(cargo._id)));
    const cargosConActiva = cargos.map((cargo, i) => ({ cargo, activa: activas[i] })).sort(compararCargos);

    res.render('pages/admin/cargos', { institucion, cargosConActiva, turnos, roles });
};

const postCargo = async (req, res) => {
    const institucionId = req.session.institucionActivaId;
    const { cupof, rolId, turnoId, clave } = req.body;

    const rol = await rolRepo.obtenerPorId(rolId);
    if (!rol) {
        req.flash('error', 'Rol invalido.');
        return res.redirect('/admin/cargos');
    }

    const claveFinal = clave || rol.clave;
    const duplicado = await cargoRepo.obtenerPorClave(institucionId, claveFinal);
    if (duplicado) {
        req.flash('error', `Ya hay un cargo con la clave "${claveFinal}" en esta institución - elegí otra.`);
        return res.redirect('/admin/cargos');
    }

    await cargoRepo.crear({
        cupof: cupof || undefined,
        clave: claveFinal,
        institucionId,
        rolId,
        turnoId: turnoId || undefined
    });

    req.flash('success', 'Cargo creado.');
    res.redirect('/admin/cargos');
};

// Edicion de la clave de un Cargo ya existente - identificado por su _id de Mongo (no por
// clave, que es justo el campo que puede faltar todavia en cargos viejos, mismo motivo
// por el que institucionController usa "cue" en vez de "clave" para este mismo caso).
const getEditarCargo = async (req, res) => {
    const cargo = await cargoRepo.obtenerPorId(req.params.id);
    if (!cargo) return res.redirect('/admin/cargos');
    res.render('pages/admin/cargoEditar', { cargo });
};

const postEditarCargo = async (req, res) => {
    const cargo = await cargoRepo.obtenerPorId(req.params.id);
    if (!cargo) return res.redirect('/admin/cargos');

    const { clave } = req.body;
    const duplicado = await cargoRepo.obtenerPorClave(cargo.institucionId._id, clave);
    if (duplicado && String(duplicado._id) !== String(cargo._id)) {
        req.flash('error', 'Ya hay otro cargo con esa clave en esta institución.');
        return res.redirect(`/admin/cargos/${cargo._id}/editar`);
    }

    await cargoRepo.actualizarClave(cargo._id, clave);
    req.flash('success', 'Clave actualizada.');
    res.redirect('/admin/cargos');
};

// Resuelve institucion+cargo desde los dos segmentos de clave de la URL anidada
// (/admin/instituciones/:institucionClave/cargos/:cargoClave).
const resolverCargo = async (req) => {
    const institucion = await institucionRepo.obtenerPorClave(req.params.institucionClave);
    if (!institucion) return null;
    return await cargoRepo.obtenerPorClave(institucion._id, req.params.cargoClave);
};

const urlCargo = (req) => `/admin/instituciones/${req.params.institucionClave}/cargos/${req.params.cargoClave}`;

const getCargoDetalle = async (req, res) => {
    const cargo = await resolverCargo(req);
    if (!cargo) return res.redirect('/admin/cargos');

    const [{ base, suplentesVigentes }, historial, personas, cursosDelCargo, cursosDeLaInstitucion, solicitudesPendientes] = await Promise.all([
        designacionRepo.obtenerCadenaPorCargo(cargo._id),
        designacionRepo.obtenerHistorialPorCargo(cargo._id),
        usuarioRepo.obtenerPersonasConCuenta(),
        cargoCursoRepo.obtenerPorCargo(cargo._id),
        cursoRepo.obtenerPorInstitucion(cargo.institucionId._id),
        solicitudCargoRepo.obtenerPendientesPorCargo(cargo._id)
    ]);

    // El suplente vigente mas nuevo ejerce hoy; si hay uno anterior (o la base, si solo
    // hay un nivel de suplencia), es a quien esta cubriendo, y tiene una licencia vigente
    // que lo explica.
    const activa = suplentesVigentes.length ? suplentesVigentes[suplentesVigentes.length - 1] : base;
    const cubiertaPorActiva = suplentesVigentes.length > 1
        ? suplentesVigentes[suplentesVigentes.length - 2]
        : (suplentesVigentes.length === 1 ? base : null);
    const [licenciaDeCubierta, licenciaVigenteDeActiva] = await Promise.all([
        cubiertaPorActiva ? licenciaRepo.obtenerVigentePorDesignacion(cubiertaPorActiva._id) : null,
        activa ? licenciaRepo.obtenerVigentePorDesignacion(activa._id) : null
    ]);

    res.render('pages/admin/cargoDetalle', {
        cargo, historial, personas, activa, cubiertaPorActiva, licenciaDeCubierta, licenciaVigenteDeActiva,
        cursosDelCargo, cursosDeLaInstitucion, anioActual: new Date().getFullYear(), solicitudesPendientes
    });
};

const postDesignacionBase = async (req, res) => {
    const cargo = await resolverCargo(req);
    if (!cargo) return res.redirect('/admin/cargos');

    const { personaId, situacionRevista, fechaAlta } = req.body;
    try {
        await designacionRepo.altaBase({
            cargoId: cargo._id,
            personaId,
            situacionRevista,
            fechaAlta: new Date(fechaAlta)
        });
        // Si habia solicitudes pendientes de este cargo (ver SolicitudCargo), quedarian
        // huerfanas - el cargo ya no esta vacante, no se designo a partir de ninguna de
        // ellas (fue directo desde este form).
        await solicitudCargoRepo.rechazarPendientesDelCargo(cargo._id, 'El cargo fue cubierto por otra vía.');

        const persona = await Persona.findById(personaId);
        await auditoriaRepo.registrar({
            accion: 'alta_designacion',
            descripcion: `${persona.apellido}, ${persona.nombre} — ${cargo.clave} (${situacionRevista})`,
            hechoPor: hechoPor(req)
        });

        req.flash('success', 'Designación creada.');
    } catch (error) {
        req.flash('error', error.message);
    }
    res.redirect(urlCargo(req));
};

const postSuplente = async (req, res) => {
    const cargo = await resolverCargo(req);
    if (!cargo) return res.redirect('/admin/cargos');

    const { personaId, fechaAlta, licenciaId, motivoLicencia, fechaInicioLicencia } = req.body;
    try {
        await designacionRepo.altaSuplente({
            cargoId: cargo._id,
            personaId,
            fechaAlta: new Date(fechaAlta),
            licenciaId: licenciaId || undefined,
            licencia: { motivo: motivoLicencia, fechaInicio: fechaInicioLicencia ? new Date(fechaInicioLicencia) : undefined }
        });

        const persona = await Persona.findById(personaId);
        await auditoriaRepo.registrar({
            accion: 'alta_designacion',
            descripcion: `${persona.apellido}, ${persona.nombre} — suplente en ${cargo.clave}`,
            hechoPor: hechoPor(req)
        });

        req.flash('success', 'Suplente designado.');
    } catch (error) {
        req.flash('error', error.message);
    }
    res.redirect(urlCargo(req));
};

const postBaja = async (req, res) => {
    const { fechaBaja, motivoBaja } = req.body;

    // Se busca (con personaId poblado) antes de la baja, para poder describir la
    // auditoria - despues de darDeBaja sigue teniendo los mismos datos, pero es mas claro
    // dejar la lectura antes de la escritura.
    const designacion = await designacionRepo.obtenerPorId(req.params.designacionId);
    await designacionRepo.darDeBaja(req.params.designacionId, {
        fecha: new Date(fechaBaja),
        motivoBaja
    });

    if (designacion) {
        await auditoriaRepo.registrar({
            accion: 'baja_designacion',
            descripcion: `${designacion.personaId.apellido}, ${designacion.personaId.nombre} — ${req.params.cargoClave}`,
            hechoPor: hechoPor(req)
        });
    }

    req.flash('success', 'Baja registrada.');
    res.redirect(urlCargo(req));
};

const postCursoCargo = async (req, res) => {
    const cargo = await resolverCargo(req);
    if (!cargo) return res.redirect('/admin/cargos');

    const { cursoId, anioLectivo } = req.body;

    const duplicado = await cargoCursoRepo.buscarDuplicado(cargo._id, cursoId, Number(anioLectivo));
    if (duplicado) {
        req.flash('error', 'Este cargo ya tiene ese curso asignado en ese año lectivo.');
        return res.redirect(urlCargo(req));
    }

    await cargoCursoRepo.crear({ cargoId: cargo._id, cursoId, anioLectivo: Number(anioLectivo) });
    req.flash('success', 'Curso asignado.');
    res.redirect(urlCargo(req));
};

const postQuitarCursoCargo = async (req, res) => {
    await cargoCursoRepo.eliminar(req.params.cargoCursoId);
    req.flash('success', 'Curso desasignado.');
    res.redirect(urlCargo(req));
};

module.exports = {
    getCargos, postCargo, getEditarCargo, postEditarCargo, getCargoDetalle, postDesignacionBase,
    postSuplente, postBaja, postCursoCargo, postQuitarCursoCargo
};
