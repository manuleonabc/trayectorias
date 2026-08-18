const express  = require('express');
const path     = require('path');
const session  = require('express-session');
const passport = require('./config/passport');
const flash    = require('connect-flash');
const paisesNacionalidad = require('./data/paisesNacionalidad');
const authRouter       = require('./routes/auth.router');
const altaRouter       = require('./routes/alta.router');
const estudianteRouter = require('./routes/estudiante.router');
const cargoRouter      = require('./routes/cargo.router');
const seleccionarInstitucionRouter = require('./routes/seleccionarInstitucion.router');
const solicitudCargoRouter = require('./routes/solicitudCargo.router');
const inicioRouter     = require('./routes/inicio.router');
const misCursosRouter  = require('./routes/misCursos.router');
const misCargosRouter  = require('./routes/misCargos.router');
const valoracionRouter = require('./routes/valoracion.router');
const adminCargoRouter = require('./routes/admin/cargo.router');
const adminSolicitudCargoRouter = require('./routes/admin/solicitudCargo.router');
const adminTurnoRouter = require('./routes/admin/turno.router');
const adminOrientacionRouter = require('./routes/admin/orientacion.router');
const adminAnioRouter = require('./routes/admin/anio.router');
const adminRolRouter = require('./routes/admin/rol.router');
const adminUsuarioRouter = require('./routes/admin/usuario.router');
const adminCursoRouter = require('./routes/admin/curso.router');
const adminInstitucionRouter = require('./routes/admin/institucion.router');
const institucionCursoRouter = require('./routes/admin/institucionCurso.router');
const institucionTurnoRouter = require('./routes/admin/institucionTurno.router');
const institucionCargoRouter = require('./routes/admin/institucionCargo.router');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret:            process.env.SESSION_SECRET || 'cambiar-en-produccion',
    resave:            false,
    saveUninitialized: false,
    cookie:            { maxAge: 8 * 60 * 60 * 1000 } // 8 horas
}));
app.use(flash());
app.use((req, res, next) => {
    const flashMessage = (type) => req.flash(type).join(' ');
    res.locals.mensajes = {
        error: flashMessage('error'),
        info: flashMessage('info'),
        success: flashMessage('success'),
        warning: flashMessage('warning')
    };
    res.locals.error = req.query.error || false;
    // Global para partials/nacionalidadSelect.ejs - es un catalogo estatico (paises no
    // cambian), no depende de nada por request, asi no hay que pasarlo desde cada
    // controller que renderiza un form con ese campo.
    res.locals.paises = paisesNacionalidad;
    next();
});
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
    res.locals.usuario = req.user || null;
    // Si sos admin, tenes que haber activado el modo gestion al loguearte (switch en
    // index.ejs) para que se te trate como tal - por default entras con tu cargo normal,
    // aunque tu Usuario.rol sea 'admin'. Ver auth.router.js (donde se fija en la sesion,
    // siempre revalidando contra req.user.rol, nunca confiando en lo que pide el cliente).
    res.locals.modoGestion = !!(req.session && req.session.modoGestion);
    // Solo el nombre (no un query a Mongo en cada request) - se guarda junto con el id al
    // elegir institucion, ver auth.router.js/seleccionarInstitucion.controller.js.
    res.locals.institucionActiva = (req.session && req.session.institucionActivaNombre) || null;
    // nivelAcceso del Rol del cargo activo (ver utils/cargoActivo.js) - cacheado en sesion
    // junto con cargoActivoId al elegirlo, para que el nav pueda decidir que links de
    // docente mostrar (Inicio/Cursos/Docentes para 'total', Mis cursos para 'preceptor')
    // sin resolver el cargo en cada request.
    res.locals.nivelAccesoActivo = (req.session && req.session.nivelAccesoActivo) || null;
    // nombreCorto del Rol del cargo activo (ej. "Prece", "Profe", "EMATP") - cacheado junto
    // con lo de arriba, para mostrarlo en el nav sin resolver el cargo en cada request.
    res.locals.cargoActivoNombre = (req.session && req.session.cargoActivoNombre) || null;
    // Clave de la institucion en la que esta parado ahora mismo (por su cargo, o por la
    // institucion elegida en modo gestion - ver utils/cargoActivo.js) - se muestra en el
    // nav antes del nombre del cargo.
    res.locals.escuelaActivaClave = (req.session && req.session.escuelaActivaClave) || null;
    next();
});

app.use('/auth', authRouter);
app.use('/alta', altaRouter);

// Middleware de protección: redirige al inicio si no hay sesión activa.
const requireAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
};

// Solo deja pasar a usuarios con rol admin Y que hayan activado el modo gestion en esta
// sesion (ver nota de arriba) - asumido despues de requireAuth.
const requireAdmin = (req, res, next) => {
    if (req.user.rol === 'admin' && req.session.modoGestion) return next();
    res.redirect('/');
};

app.get('/', (req, res) => res.render('pages/index'));

app.use('/estudiantes', requireAuth, estudianteRouter);
app.use('/seleccionar-cargo', requireAuth, cargoRouter);
app.use('/seleccionar-institucion', requireAuth, seleccionarInstitucionRouter);
app.use('/solicitudes-cargo', requireAuth, solicitudCargoRouter);
app.use('/inicio', requireAuth, inicioRouter);
app.use('/mis-cursos', requireAuth, misCursosRouter);
app.use('/mis-cargos', requireAuth, misCargosRouter);
app.use('/valoraciones', requireAuth, valoracionRouter);
app.use('/admin/cargos', requireAuth, requireAdmin, adminCargoRouter);
app.use('/admin/solicitudes-cargo', requireAuth, requireAdmin, adminSolicitudCargoRouter);
app.use('/admin/turnos', requireAuth, requireAdmin, adminTurnoRouter);
app.use('/admin/orientaciones', requireAuth, requireAdmin, adminOrientacionRouter);
app.use('/admin/anios', requireAuth, requireAdmin, adminAnioRouter);
app.use('/admin/roles', requireAuth, requireAdmin, adminRolRouter);
app.use('/admin/usuarios', requireAuth, requireAdmin, adminUsuarioRouter);
app.use('/admin/cursos', requireAuth, requireAdmin, adminCursoRouter);
app.use('/admin/instituciones/:institucionClave/cursos', requireAuth, requireAdmin, institucionCursoRouter);
app.use('/admin/instituciones/:institucionClave/turnos', requireAuth, requireAdmin, institucionTurnoRouter);
app.use('/admin/instituciones/:institucionClave/cargos', requireAuth, requireAdmin, institucionCargoRouter);
app.use('/admin/instituciones', requireAuth, requireAdmin, adminInstitucionRouter);

module.exports = app;
