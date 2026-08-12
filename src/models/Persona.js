const mongoose = require('mongoose');
const aMayusculas = require('../utils/mayusculas');

const PersonaSchema = new mongoose.Schema({
    // No siempre se conoce (ej. estudiantes menores de edad al momento del alta) -
    // sparse porque unique+required chocaba entre los que todavia no lo tienen.
    cuil: { type: String, unique: true, sparse: true, trim: true },
    // Que tipo de documento tiene - mismas categorias que la planilla de inscripcion
    // (DNI / CPI mientras se tramita el DNI / documento de otro pais / directamente
    // indocumentado). Default DNI porque es el caso mas comun.
    tipoDocumento: {
        type: String,
        enum: ['DNI', 'CPI', 'Documento extranjero', 'Sin documento'],
        default: 'DNI'
    },
    // El numero del documento, sea cual sea tipoDocumento (DNI o extranjero - CPI no
    // tiene numero propio en la planilla, y "Sin documento" no tiene nada que cargar
    // aca). No siempre se conoce (puede ser indocumentado) - sparse porque unique+
    // required chocaba entre los que todavia no lo tienen. Cuando no hay numeroDocumento,
    // Estudiante.legajo hace de clave en las URLs - ver estudiante.repo.js.
    numeroDocumento: { type: String, unique: true, sparse: true, trim: true },
    // Solo tiene sentido cuando tipoDocumento === 'DNI': la planilla distingue si ya lo
    // tiene en mano fisicamente o todavia esta en tramite.
    estadoDni: {
        type: String,
        enum: ['Tiene el DNI físico', 'En trámite', 'No tiene el DNI físico y no está en trámite']
    },
    // Solo tiene sentido cuando tipoDocumento === 'Documento extranjero' (ej.
    // "Pasaporte", "Cédula de identidad boliviana") - la planilla lo deja como texto
    // libre, no es un catalogo cerrado.
    documentoExtranjeroTipo: { type: String, set: aMayusculas, trim: true },
    apellido: { type: String, required: true, set: aMayusculas, trim: true },
    nombre: { type: String, required: true, set: aMayusculas, trim: true },
    fecha_nacimiento: { type: Date },
    // Mismas categorias que usa la planilla de inscripcion provincial. No se pasa por
    // aMayusculas: son valores de enum exactos, mayusculizarlos rompería la validacion.
    genero: {
        type: String,
        enum: ['Mujer', 'Mujer trans / travesti', 'Varón', 'Varón trans / masculinidad trans', 'No binario', 'Otra', 'No desea responder']
    },
    // "Lugar de nacimiento" + "Nacionalidad" de la planilla - provincia/distrito
    // solo tienen sentido si lugar === 'Argentina' (cargados con selects encadenados
    // contra la API de Georef, ver /js/nacimiento.js). Si lugar !== 'Argentina',
    // "localidad" pasa a ser un campo de texto libre en vez de la localidad de esa
    // cascada. Se dejan sueltos sin condicionar en el schema, igual que domicilio.
    nacimiento: {
        lugar: { type: String, enum: ['Argentina', 'Extranjero'] },
        nacionalidad: { type: String, set: aMayusculas, trim: true },
        provincia: { type: String, set: aMayusculas, trim: true },
        distrito: { type: String, set: aMayusculas, trim: true },
        localidad: { type: String, set: aMayusculas, trim: true }
    },
    // Estructurado en vez de un campo libre unico: permite filtrar/reportar por
    // localidad o partido mas adelante, y espeja como esta la planilla oficial.
    domicilio: {
        calle: { type: String, set: aMayusculas, trim: true },
        numero: { type: String, set: aMayusculas, trim: true },
        piso: { type: String, set: aMayusculas, trim: true },
        depto: { type: String, set: aMayusculas, trim: true },
        entreCalles: { type: String, set: aMayusculas, trim: true },
        provincia: { type: String, set: aMayusculas, trim: true },
        localidad: { type: String, set: aMayusculas, trim: true },
        partido: { type: String, set: aMayusculas, trim: true }
    },
    // Puede haber mas de uno (fijo, celular, de un familiar, etc) y conviene saber de
    // quien es cada uno (ej. "Mamá", "Vecina") para saber a quien se esta llamando.
    telefonos: [{
        descripcion: { type: String, set: aMayusculas, trim: true },
        numero: { type: String, required: true, trim: true }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Persona', PersonaSchema);
