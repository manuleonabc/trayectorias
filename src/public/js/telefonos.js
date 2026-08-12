// Filas de telefono repetibles (agregar/quitar) en los forms de alta de estudiante.
// Cada fila tiene "a quien pertenece" (ej. Mamá, Vecina) + el numero en si.
function initTelefonos(containerSelector, botonSelector) {
    const container = document.querySelector(containerSelector);
    const boton = document.querySelector(botonSelector);
    if (!container || !boton) return;

    function fila() {
        const div = document.createElement('div');
        div.className = 'row g-2 mb-2 align-items-center telefono-fila';
        div.innerHTML =
            '<div class="col-5">' +
                '<input type="text" name="telefonoDescripcion" class="form-control" placeholder="Ej: Mamá, Vecina">' +
            '</div>' +
            '<div class="col-6">' +
                '<div class="input-group">' +
                    '<span class="input-group-text"><i class="bi bi-telephone"></i></span>' +
                    '<input type="tel" name="telefonoNumero" class="form-control" placeholder="Ej: 11 5555-5555" autocomplete="tel">' +
                '</div>' +
            '</div>' +
            '<div class="col-1">' +
                '<button type="button" class="btn btn-outline-danger btn-quitar-telefono" aria-label="Quitar">&times;</button>' +
            '</div>';
        return div;
    }

    container.addEventListener('click', function (e) {
        if (!e.target.classList.contains('btn-quitar-telefono')) return;
        const fila = e.target.closest('.telefono-fila');
        if (container.children.length > 1) {
            fila.remove();
        } else {
            fila.querySelectorAll('input').forEach(function (input) { input.value = ''; });
        }
    });

    boton.addEventListener('click', function () {
        container.appendChild(fila());
    });
}
