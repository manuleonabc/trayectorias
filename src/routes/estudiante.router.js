const express = require('express');
const router = express.Router();
const estudianteController = require('../controllers/estudiante.controller');

// Este router cuelga de /estudiantes con requireAuth solo (accesible a cualquier usuario,
// a proposito - ver app.js) - la baja real es la unica accion de aca que necesita ser
// ademas admin, por eso el chequeo va puntual en esta ruta y no en todo el router. Ademas
// de admin, requiere nivelPoder 'total' (no cualquier admin puede hacer baja real - ver
// Usuario.nivelPoder) y modoGestion activo en la sesion (ver auth.router.js/app.js - un
// admin que entro con su cargo normal no puede hacer esto hasta volver a loguearse con el
// switch activado).
const requireAdmin = (req, res, next) => {
    if (req.user.rol === 'admin' && req.user.nivelPoder === 'total' && req.session.modoGestion) return next();
    res.redirect('/estudiantes');
};

router.get('/', estudianteController.getEstudiantes);
router.post('/', estudianteController.postEstudiante);
router.get('/materias-sugeridas/:institucionClave/:cursoClave', estudianteController.getMateriasSugeridas);
router.get('/verificar-documento', estudianteController.getVerificarDocumento);
router.get('/verificar-nombre', estudianteController.getVerificarNombre);
router.get('/:clave', estudianteController.getEstudianteDetalle);
router.post('/:clave/editar', estudianteController.postEditarEstudiante);
router.post('/:clave/eliminar', requireAdmin, estudianteController.postEliminarEstudiante);
router.post('/:clave/inscripciones/:inscripcionId/baja', estudianteController.postBajaInscripcion);
router.get('/:clave/cursada/editar', estudianteController.getCursadaEditar);
router.post('/:clave/cursada/editar', estudianteController.postCursadaEditar);
router.post('/:clave/cursada/materias', estudianteController.postCursadaMaterias);
router.post('/:clave/cursadas', estudianteController.postCursada);
router.post('/:clave/cursadas/:cursadaId/aprobar', estudianteController.postAprobarCursada);
router.post('/:clave/responsables', estudianteController.postResponsable);
router.post('/:clave/responsables/:estudianteResponsableId/eliminar', estudianteController.postQuitarResponsable);

module.exports = router;
