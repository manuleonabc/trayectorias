const usuarioService = require('../services/usuario.service');

const getAlta = (req, res) => {
    const usuario = req.user;

    if (usuario.autorizado) return res.redirect('/estudiantes');

    if (usuario.tipo === 'institucion') {
        return res.render('pages/alta/formInstitucion', { usuario, mensajes: '' });
    }
    return res.render('pages/alta/formAgente', { usuario, mensajes: '' });
};

const getPendiente = (req, res) => {
    const usuario = req.user;
    if (!usuario) return res.redirect('/');
    return res.render('pages/alta/pendiente', { usuario, mensajes: '' });
};

const postAltaInstitucion = async (req, res) => {
    try {
        await usuarioService.postUsuario(req.body, req.user);
        return res.redirect('/alta/pendiente');
    } catch (error) {
        console.error('Error en postAltaInstitucion:', error);
        const mensajes = { error: 'Error al registrar la institución. Verificá los datos e intentá nuevamente.' };
        return res.render('pages/alta/formInstitucion', { usuario: req.user, mensajes });
    }
};

const postAltaAgente = async (req, res) => {
    try {
        await usuarioService.postUsuario(req.body, req.user);
        return res.redirect('/alta/pendiente');
    } catch (error) {
        console.error('Error en postAltaAgente:', error);
        const mensajes = { error: 'Error al registrar el usuario. Verificá los datos e intentá nuevamente.' };
        return res.render('pages/alta/formAgente', { usuario: req.user, mensajes });
    }
};

module.exports = { getAlta, getPendiente, postAltaInstitucion, postAltaAgente };
