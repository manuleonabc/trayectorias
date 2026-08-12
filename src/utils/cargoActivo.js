const cargoRepo = require('../repos/cargo.repo');

// Fija el cargo activo en sesion (id + nivelAcceso y nombreCorto de su Rol, cacheados para
// no tener que resolver el cargo en cada request solo para mostrar el nav - ver
// app.js/res.locals.nivelAccesoActivo y cargoActivoNombre) y devuelve a donde redirigir
// segun ese nivelAcceso - 'total' (jerarquicos: Director/Vicedirector/Secretario/EMATP,
// etc.) va al dashboard de 3 bloques, 'preceptor' va directo a sus cursos designados,
// cualquier otro caso ('profesor'/'ninguno') sigue yendo a /estudiantes sin pantalla
// especial (ver Fase 3 pendiente).
const fijarCargoActivo = async (req, cargoId) => {
    req.session.cargoActivoId = cargoId;
    const cargo = await cargoRepo.obtenerPorId(cargoId);
    const nivelAcceso = cargo && cargo.rolId ? cargo.rolId.nivelAcceso : null;
    req.session.nivelAccesoActivo = nivelAcceso;
    // nombreCorto pensado justo para esto (ver Rol.js) - ej "Prece", "Profe", "EMATP".
    req.session.cargoActivoNombre = cargo && cargo.rolId ? (cargo.rolId.nombreCorto || cargo.rolId.nombre) : null;
    // Mismo campo que usa el admin en modo gestion al elegir institucion (ver
    // seleccionarInstitucion.controller.js) - asi el nav muestra "la escuela en la que
    // estoy parado" sin importar si es por un cargo o por una eleccion de admin.
    req.session.escuelaActivaClave = cargo && cargo.institucionId ? cargo.institucionId.clave : null;

    if (nivelAcceso === 'total') return '/inicio';
    if (nivelAcceso === 'preceptor') return '/mis-cursos';
    return '/estudiantes';
};

module.exports = { fijarCargoActivo };
