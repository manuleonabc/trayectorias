const express = require('express');
const router = express.Router();
const valoracionController = require('../controllers/valoracion.controller');

// "Por asignatura" (sin cargoId): la propia materia de un profesor. Con :cargoId:
// cualquier asignatura de un curso, para preceptor/EMATP/jerarquicos (ver
// resolverContexto en el controller) - se llega aca desde el boton "Agregar calificación"
// de la seccion "Asignaturas y docentes" en misCursoDetalle.ejs.
router.get('/asignatura', valoracionController.getPorAsignatura);
router.get('/asignatura/:cargoId', valoracionController.getPorAsignatura);
// Autoguardado por fila, AJAX (ver /js/valoracionesAutosave.js) - devuelve JSON. Reusado
// tambien por la matriz "por curso" (cada celda manda su propio cargoId).
router.post('/asignatura/fila', valoracionController.postGuardarFila);

// "Por curso": matriz de todas las asignaturas x todos los estudiantes, para
// nivelAcceso 'total'/'preceptor' - se llega desde el boton "Calificaciones" del header
// de misCursoDetalle.ejs.
router.get('/curso/:cursoClave', valoracionController.getPorCurso);

module.exports = router;
