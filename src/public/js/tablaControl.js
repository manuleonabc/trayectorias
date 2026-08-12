// Buscador + orden por columna para una tabla ya renderizada - todo client-side sobre las
// filas que ya estan en el DOM, sin fetch (no hace falta: la tabla ya tiene todos los datos
// que va a mostrar). Las columnas ordenables se marcan en el <th> con data-orden="texto" o
// data-orden="numero"; si una celda necesita un valor de orden distinto al texto visible
// (ej. una fecha formateada), se le puede poner data-valor="<valor real>" a la <td>.
function initTablaControl({ tabla, buscador }) {
    const tablaEl = document.querySelector(tabla);
    if (!tablaEl) return;
    const tbody = tablaEl.querySelector('tbody');
    if (!tbody) return;

    function filas() {
        return Array.from(tbody.querySelectorAll('tr'));
    }

    if (buscador) {
        const buscadorEl = document.querySelector(buscador);
        if (buscadorEl) {
            buscadorEl.addEventListener('input', function () {
                const texto = buscadorEl.value.trim().toLowerCase();
                filas().forEach(function (fila) {
                    const coincide = fila.textContent.toLowerCase().includes(texto);
                    fila.classList.toggle('d-none', !coincide);
                });
            });
        }
    }

    const encabezados = Array.from(tablaEl.querySelectorAll('th[data-orden]'));
    encabezados.forEach(function (th) {
        th.style.cursor = 'pointer';
        th.classList.add('user-select-none');
        let ascendente = true;

        th.addEventListener('click', function () {
            const tipo = th.dataset.orden;
            const columnaIndex = Array.from(th.parentNode.children).indexOf(th);

            const ordenadas = filas().sort(function (a, b) {
                const celdaA = a.children[columnaIndex];
                const celdaB = b.children[columnaIndex];
                const valorA = (celdaA.dataset.valor != null ? celdaA.dataset.valor : celdaA.textContent).trim();
                const valorB = (celdaB.dataset.valor != null ? celdaB.dataset.valor : celdaB.textContent).trim();

                let comparacion;
                if (tipo === 'numero') {
                    comparacion = (parseFloat(valorA) || 0) - (parseFloat(valorB) || 0);
                } else {
                    comparacion = valorA.localeCompare(valorB, 'es');
                }
                return ascendente ? comparacion : -comparacion;
            });

            ordenadas.forEach(function (fila) { tbody.appendChild(fila); });

            encabezados.forEach(function (otro) {
                otro.classList.remove('text-warning');
                otro.querySelectorAll('.bi-caret-up-fill, .bi-caret-down-fill').forEach(function (icono) { icono.remove(); });
            });
            th.classList.add('text-warning');
            const icono = document.createElement('i');
            icono.className = ascendente ? 'bi bi-caret-up-fill ms-1' : 'bi bi-caret-down-fill ms-1';
            th.appendChild(icono);

            ascendente = !ascendente;
        });
    });
}
