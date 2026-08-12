// Carga por AJAX la lista de asignaturas y docentes designados de un curso (ver
// misCursos.controller.js::getAsignaturasDocentes) - a pedido, con un boton (NO se dispara
// solo al entrar a la pagina - pedido explicito del usuario). "Ver detalles" es un simple
// toggle client-side (los datos ya vinieron todos en la misma respuesta, no hace falta un
// segundo pedido). "Agregar calificación" linkea a /valoraciones/asignatura/<cargoId>
// (cualquier asignatura del curso, sin campo de observacion - eso es exclusivo del
// profesor cargando la suya, ver valoracion.controller.js).
function initAsignaturasDocentes({ contenedor, boton, url }) {
    const contenedorEl = document.querySelector(contenedor);
    const botonEl = document.querySelector(boton);
    if (!contenedorEl || !botonEl) return;

    function escapar(texto) {
        const div = document.createElement('div');
        div.textContent = texto == null ? '' : String(texto);
        return div.innerHTML;
    }

    function nombreCompleto(persona) {
        return persona ? (escapar(persona.apellido) + ', ' + escapar(persona.nombre)) : null;
    }

    function cargar() {
        botonEl.disabled = true;
        botonEl.textContent = 'Cargando...';

        fetch(url)
            .then(function (respuesta) { return respuesta.json(); })
            .then(function (datos) {
                botonEl.classList.add('d-none');

                if (!datos.asignaturas || datos.asignaturas.length === 0) {
                    contenedorEl.innerHTML = '<p class="text-muted p-3 mb-0">Este curso todavía no tiene cargos de profesor generados.</p>';
                    return;
                }

                const filas = datos.asignaturas.map(function (item, indice) {
                    const titular = item.titular
                        ? nombreCompleto(item.titular) + ' <span class="badge text-bg-secondary">' + escapar(item.titular.situacionRevista) + '</span>'
                        : '<span class="text-muted">Vacante</span>';
                    const suplente = item.suplente ? nombreCompleto(item.suplente) : null;
                    const detalleId = 'detalleAsignatura' + indice;

                    return (
                        '<tr>' +
                            '<td>' + escapar(item.asignatura) + '</td>' +
                            '<td>' + titular + '</td>' +
                            '<td class="text-end">' +
                                '<button type="button" class="btn btn-outline-secondary btn-sm btn-ver-detalle" data-target="' + detalleId + '">Ver detalles</button> ' +
                                '<a href="/valoraciones/asignatura/' + escapar(item.cargoId) + '" class="btn btn-outline-primary btn-sm">Agregar calificación</a>' +
                            '</td>' +
                        '</tr>' +
                        '<tr id="' + detalleId + '" class="d-none">' +
                            '<td colspan="3" class="bg-body-tertiary small">' +
                                '<strong>Titular:</strong> ' + titular + '<br>' +
                                (suplente ? '<strong>Suplente actual:</strong> ' + suplente + '<br>' : '') +
                                '<strong>Carga horaria:</strong> ' + (item.cargaHoraria != null ? escapar(item.cargaHoraria) + ' hs' : '—') +
                            '</td>' +
                        '</tr>'
                    );
                }).join('');

                contenedorEl.innerHTML =
                    '<div class="table-responsive">' +
                    '<table class="table table-hover mb-0">' +
                        '<thead><tr><th>Asignatura</th><th>Docente</th><th></th></tr></thead>' +
                        '<tbody>' + filas + '</tbody>' +
                    '</table>' +
                    '</div>';

                contenedorEl.querySelectorAll('.btn-ver-detalle').forEach(function (botonDetalle) {
                    botonDetalle.addEventListener('click', function () {
                        const fila = document.getElementById(botonDetalle.dataset.target);
                        if (fila) fila.classList.toggle('d-none');
                    });
                });
            })
            .catch(function () {
                botonEl.classList.add('d-none');
                contenedorEl.innerHTML = '<p class="text-danger p-3 mb-0">No se pudo cargar la información de asignaturas y docentes.</p>';
            });
    }

    botonEl.addEventListener('click', cargar);
}
