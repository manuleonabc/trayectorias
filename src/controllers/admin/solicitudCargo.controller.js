const solicitudCargoRepo = require('../../repos/solicitudCargo.repo');
const designacionRepo = require('../../repos/designacion.repo');

const getSolicitudesCargoAdmin = async (req, res) => {
    const solicitudes = await solicitudCargoRepo.obtenerTodasPendientes();
    res.render('pages/admin/solicitudesCargo', { solicitudes });
};

// Aprobar = crear la Designacion en el mismo paso (altaBase, mismo metodo que ya usa el
// alta manual de cargoDetalle.ejs). Orden importa: solo se marca la solicitud como
// resuelta DESPUES de que altaBase confirma que el cargo sigue vacante - si alguien se
// adelanto (condicion de carrera), la solicitud sigue pendiente en vez de quedar en un
// estado inconsistente, y gestion la rechaza a mano si corresponde.
const postAprobarSolicitud = async (req, res) => {
    const solicitud = await solicitudCargoRepo.obtenerPorId(req.params.id);
    const volver = req.body.volver || '/admin/solicitudes-cargo';

    if (!solicitud || solicitud.estado !== 'pendiente') {
        req.flash('error', 'Esa solicitud ya fue resuelta.');
        return res.redirect(volver);
    }

    const { situacionRevista, fechaAlta } = req.body;
    try {
        const designacion = await designacionRepo.altaBase({
            cargoId: solicitud.cargoId._id,
            personaId: solicitud.personaId._id,
            situacionRevista,
            fechaAlta: new Date(fechaAlta)
        });
        await solicitudCargoRepo.marcarResuelta(solicitud._id, {
            estado: 'aprobada',
            fechaResolucion: new Date(),
            resueltoPor: req.user._id,
            designacionId: designacion._id
        });
        // Cualquier otra solicitud pendiente de este mismo cargo queda huerfana si no se
        // resuelve aca - el cargo ya no esta vacante, volver a intentar aprobarla fallaria
        // en altaBase sin que nadie se entere.
        await solicitudCargoRepo.rechazarPendientesDelCargo(
            solicitud.cargoId._id,
            'El cargo fue cubierto por otra persona.',
            solicitud._id
        );
        req.flash('success', 'Solicitud aprobada y designación creada.');
    } catch (error) {
        req.flash('error', error.message);
    }
    res.redirect(volver);
};

const postRechazarSolicitud = async (req, res) => {
    const solicitud = await solicitudCargoRepo.obtenerPorId(req.params.id);
    const volver = req.body.volver || '/admin/solicitudes-cargo';

    if (!solicitud || solicitud.estado !== 'pendiente') {
        req.flash('error', 'Esa solicitud ya fue resuelta.');
        return res.redirect(volver);
    }

    await solicitudCargoRepo.marcarResuelta(solicitud._id, {
        estado: 'rechazada',
        fechaResolucion: new Date(),
        resueltoPor: req.user._id,
        motivoRechazo: req.body.motivoRechazo
    });
    req.flash('success', 'Solicitud rechazada.');
    res.redirect(volver);
};

module.exports = { getSolicitudesCargoAdmin, postAprobarSolicitud, postRechazarSolicitud };
