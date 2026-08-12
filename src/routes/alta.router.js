const express = require('express');
const router  = express.Router();
const altaController = require('../controllers/alta.controller');

const requireSession = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
};

router.get('/',           requireSession, altaController.getAlta);
router.get('/pendiente',  requireSession, altaController.getPendiente);
router.post('/institucion', requireSession, altaController.postAltaInstitucion);
router.post('/agente',    requireSession, altaController.postAltaAgente);

module.exports = router;
