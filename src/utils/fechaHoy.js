// 'YYYY-MM-DD' de hoy en hora local del servidor - para precargar por defecto inputs
// type="date" (ej. fecha de alta al matricular). No usar toISOString().slice(0,10): convierte
// a UTC primero, lo que puede correr la fecha un dia si el servidor no esta en UTC.
const fechaHoy = () => {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
};

module.exports = fechaHoy;
