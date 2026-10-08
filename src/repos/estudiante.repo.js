const Estudiante = require('../models/Estudiante');
const Persona = require('../models/Persona');

// Para armar el prefijo de un legajo con caracteres que podrian tener significado en
// una regex (aunque una clave de institucion normal no debería traer ninguno).
const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class EstudianteRepo {
    // session opcional (ver crearEstudianteEnCurso en estudiante.controller.js) - para que
    // el alta de Persona+Estudiante+Inscripcion+CursadaAsignatura sea atomica: si algo
    // falla a mitad de camino, no debe quedar ni la Persona ni el Estudiante a medias.
    async crear(personaId, legajo, session) {
        const nuevoEstudiante = new Estudiante({ personaId, legajo });
        return await nuevoEstudiante.save({ session });
    }

    // "{clave institucion}-{siguiente numero en esa institucion}" - se calcula contando
    // los legajos ya asignados con ese mismo prefijo, no hace falta un contador aparte.
    async generarLegajo(institucionClave, session) {
        const prefijo = `${institucionClave}-`;
        const cantidad = await Estudiante.countDocuments({ legajo: new RegExp('^' + escaparRegex(prefijo)) }).session(session);
        return `${prefijo}${cantidad + 1}`;
    }

    async obtenerTodos() {
        const estudiantes = await Estudiante.find({}).populate('personaId');
        return estudiantes.sort((a, b) => a.personaId.apellido.localeCompare(b.personaId.apellido));
    }

    async obtenerPorId(id) {
        return await Estudiante.findById(id).populate('personaId');
    }

    // El numero de documento de su Persona identifica al estudiante en la URL cuando lo tiene.
    async obtenerPorNumeroDocumento(numeroDocumento) {
        const persona = await Persona.findOne({ numeroDocumento });
        if (!persona) return null;
        return await Estudiante.findOne({ personaId: persona._id }).populate('personaId');
    }

    // Clave de la URL: el numero de documento si lo tiene, o su legajo si es indocumentado.
    async obtenerPorClave(clave) {
        const porDocumento = await this.obtenerPorNumeroDocumento(clave);
        if (porDocumento) return porDocumento;
        return await Estudiante.findOne({ legajo: clave }).populate('personaId');
    }

    // Buscador acotado (ver reubicacion.controller.js) - en vez de listar a TODOS los
    // estudiantes del sistema en un <select>: por numero de documento o legajo exacto, o
    // por apellido que empiece con el texto (apellido se guarda en mayusculas, ver
    // Persona.js). Devuelve como mucho `limite` resultados.
    async buscar(texto, limite = 20) {
        const q = texto.trim();
        if (q.length < 3) return [];
        const personas = await Persona.find({
            $or: [{ numeroDocumento: q }, { apellido: new RegExp('^' + escaparRegex(q.toUpperCase())) }]
        }, '_id').limit(limite);
        const estudiantes = await Estudiante.find({
            $or: [{ personaId: { $in: personas.map((p) => p._id) } }, { legajo: q }]
        }).populate('personaId').limit(limite);
        return estudiantes.sort((a, b) => a.personaId.apellido.localeCompare(b.personaId.apellido, 'es')
            || a.personaId.nombre.localeCompare(b.personaId.nombre, 'es'));
    }

    // Posibles duplicados por nombre (ver getVerificarNombre en estudiante.controller.js) -
    // mismo apellido+nombre exactos (en mayusculas, como se guardan), solo entre personas
    // que son estudiantes.
    async buscarPorNombreExacto(apellido, nombre, limite = 5) {
        const personas = await Persona.find({ apellido, nombre }, '_id').limit(limite);
        if (personas.length === 0) return [];
        return await Estudiante.find({ personaId: { $in: personas.map((p) => p._id) } }).populate('personaId');
    }

    // Baja real (ver postEliminarEstudiante) - solo borra este documento, no su Persona
    // (eso lo maneja el controller, que tambien limpia Inscripcion/CursadaAsignatura/
    // EstudianteResponsable relacionados antes de llegar aca).
    async eliminar(id) {
        return await Estudiante.findByIdAndDelete(id);
    }
}

module.exports = new EstudianteRepo();
