// Orden comun para listados de Cargo - usado por admin/cargo.controller.js (listado
// completo, con acciones) y misCargos.controller.js (directorio de solo lectura para
// nivelAcceso 'total'). Menor jerarquia = mas alto rango (Director 1, Vicedirector 2...
// Profesor 100, ver Rol.js) - los cargos sin rol (no deberia pasar, rolId es required)
// quedan al final. Turno se ordena alfabeticamente por nombre; los cargos sin turno fijo,
// al final.
const compararCargos = (a, b) => {
    const jerarquiaA = a.cargo.rolId ? a.cargo.rolId.jerarquia : Infinity;
    const jerarquiaB = b.cargo.rolId ? b.cargo.rolId.jerarquia : Infinity;
    if (jerarquiaA !== jerarquiaB) return jerarquiaA - jerarquiaB;

    const turnoA = a.cargo.turnoId ? a.cargo.turnoId.nombre : null;
    const turnoB = b.cargo.turnoId ? b.cargo.turnoId.nombre : null;
    if (!turnoA && !turnoB) return 0;
    if (!turnoA) return 1;
    if (!turnoB) return -1;
    return turnoA.localeCompare(turnoB);
};

module.exports = { compararCargos };
