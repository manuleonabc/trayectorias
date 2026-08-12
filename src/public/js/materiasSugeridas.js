// Modal para elegir las materias de una inscripcion. El checklist se carga con fetch
// (lectura, GET /estudiantes/materias-sugeridas/:institucionClave/:cursoClave), pero el
// guardado sigue siendo el POST tradicional del form que contiene el modal - los
// checkboxes viajan con el resto.
function initMateriasSugeridas(opts) {
    const boton = document.querySelector(opts.boton);
    const modalEl = document.querySelector(opts.modal);
    if (!boton || !modalEl) return;

    const listaPrecargadas = modalEl.querySelector('[data-lista="precargadas"]');
    const bloqueAtrasadas = modalEl.querySelector('[data-bloque="atrasadas"]');
    const listaAtrasadas = modalEl.querySelector('[data-lista="atrasadas"]');
    const modal = new bootstrap.Modal(modalEl);

    function fila(asignatura, checked) {
        const div = document.createElement('div');
        div.className = 'form-check';
        const id = 'materia-' + asignatura._id + '-' + Math.random().toString(36).slice(2, 7);
        div.innerHTML =
            '<input class="form-check-input" type="checkbox" name="materiaIds" value="' + asignatura._id + '" id="' + id + '"' + (checked ? ' checked' : '') + '>' +
            '<label class="form-check-label" for="' + id + '">' + asignatura.nombre + '</label>';
        return div;
    }

    boton.addEventListener('click', async function () {
        const cursoClave = typeof opts.cursoClave === 'function' ? opts.cursoClave() : opts.cursoClave;
        const institucionClave = typeof opts.institucionClave === 'function' ? opts.institucionClave() : opts.institucionClave;
        const cicloLectivoEl = document.querySelector(opts.cicloLectivoSelector);
        const cicloLectivo = cicloLectivoEl ? cicloLectivoEl.value : '';
        const estudianteIdEl = opts.estudianteIdSelector ? document.querySelector(opts.estudianteIdSelector) : null;
        const estudianteId = estudianteIdEl ? estudianteIdEl.value : '';

        if (!cursoClave || !institucionClave || !cicloLectivo) {
            alert('Elegí curso y ciclo lectivo antes de armar el checklist de materias.');
            return;
        }

        listaPrecargadas.innerHTML = '<p class="text-muted mb-0">Cargando...</p>';
        listaAtrasadas.innerHTML = '';
        bloqueAtrasadas.style.display = 'none';

        const url = '/estudiantes/materias-sugeridas/' + institucionClave + '/' + cursoClave + (estudianteId ? '?estudianteId=' + estudianteId : '');
        const respuesta = await fetch(url);
        const datos = await respuesta.json();

        listaPrecargadas.innerHTML = '';
        if (datos.precargadas.length === 0) {
            listaPrecargadas.innerHTML = '<p class="text-muted mb-0">No hay materias cargadas para este año/orientación todavía.</p>';
        } else {
            datos.precargadas.forEach(function (asignatura) {
                listaPrecargadas.appendChild(fila(asignatura, true));
            });
        }

        if (datos.atrasadas.length > 0) {
            bloqueAtrasadas.style.display = '';
            datos.atrasadas.forEach(function (asignatura) {
                listaAtrasadas.appendChild(fila(asignatura, false));
            });
        }

        modal.show();
    });
}
