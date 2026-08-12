// Setter de Mongoose para guardar datos de texto en mayúsculas (estándar habitual en
// registros administrativos: nombres, domicilios). No se usa en campos con formato
// propio como DNI/CUIL (son códigos, no texto) ni en genero (enum de valores exactos,
// mayusculizarlo rompería la validacion) ni en email (se guarda como se escribe).
module.exports = (valor) => (typeof valor === 'string' ? valor.toUpperCase() : valor);
