// Quien hizo una accion sensible (ver repos/auditoria.repo.js) - el nombre de usuario del
// mail institucional, antes del @ (ej. "juan.perez"), no el _id de Usuario - mismo dato que
// ya se muestra en el nav (ver nav.ejs), pedido explicitamente asi por ser mas legible que
// un ObjectId en un registro que se va a leer a mano.
const hechoPor = (req) => (req.user && req.user.email ? req.user.email.split('@')[0] : null);

module.exports = hechoPor;
