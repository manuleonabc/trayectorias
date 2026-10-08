// Aviso en vivo de posible duplicado para estudiantes SIN documento (pedido explicito del
// usuario) - contra GET /estudiantes/verificar-nombre, mismo criterio que
// /js/verificarDocumento.js: no bloquea nada, solo avisa con link a la ficha de quien ya
// existe. Si el estudiante tiene numero de documento, el chequeo lo hace
// verificarDocumento (por documento, mucho mas confiable que por nombre). El aviso se
// inserta solo, debajo de la columna del campo "nombre" del form.
function initVerificarNombre(selectorForm) {
    const form = document.querySelector(selectorForm);
    if (!form) return;
    const campo = (nombre) => form.querySelector('[name="' + nombre + '"]');
    const apellido = campo('apellido');
    const nombre = campo('nombre');
    const fechaNacimiento = campo('fechaNacimiento');
    const numeroDocumento = campo('numeroDocumento');
    const tipoDocumento = campo('tipoDocumento');
    if (!apellido || !nombre) return;

    const aviso = document.createElement('div');
    aviso.className = 'col-12 d-none';
    const alerta = document.createElement('div');
    alerta.className = 'alert alert-warning py-2 px-3 mb-0';
    alerta.setAttribute('role', 'alert');
    aviso.appendChild(alerta);
    const columnaNombre = nombre.closest('[class*="col-"]') || nombre.parentElement;
    columnaNombre.after(aviso);

    function ocultar() { aviso.classList.add('d-none'); }

    function sinDocumento() {
        if (tipoDocumento && tipoDocumento.value === 'Sin documento') return true;
        return !numeroDocumento || !numeroDocumento.value.trim();
    }

    function mostrar(coincidencias) {
        alerta.replaceChildren();
        const titulo = document.createElement('div');
        titulo.className = 'fw-bold mb-1';
        titulo.textContent = coincidencias.length === 1
            ? 'Ya hay un estudiante con este apellido y nombre:'
            : 'Ya hay ' + coincidencias.length + ' estudiantes con este apellido y nombre:';
        alerta.appendChild(titulo);

        const lista = document.createElement('ul');
        lista.className = 'mb-1 ps-3';
        coincidencias.forEach(function (c) {
            const item = document.createElement('li');
            const partes = [c.nombreCompleto, c.documento];
            if (c.fechaNacimiento) partes.push('nac. ' + c.fechaNacimiento.split('-').reverse().join('/'));
            item.appendChild(document.createTextNode(partes.join(' · ') + ' '));
            if (c.mismaFecha) {
                const badge = document.createElement('span');
                badge.className = 'badge text-bg-danger me-1';
                badge.textContent = 'misma fecha de nacimiento';
                item.appendChild(badge);
            }
            const link = document.createElement('a');
            link.href = '/estudiantes/' + encodeURIComponent(c.clave);
            link.target = '_blank';
            link.textContent = 'Ver ficha';
            item.appendChild(link);
            lista.appendChild(item);
        });
        alerta.appendChild(lista);

        const pie = document.createElement('div');
        pie.className = 'small';
        pie.textContent = 'Si es la misma persona, no la cargues de nuevo: abrí su ficha o buscala en "Reubicaciones" del curso.';
        alerta.appendChild(pie);
        aviso.classList.remove('d-none');
    }

    let debounceId;
    function verificar() {
        clearTimeout(debounceId);
        const a = apellido.value.trim();
        const n = nombre.value.trim();
        if (!sinDocumento() || a.length < 2 || n.length < 2) { ocultar(); return; }
        debounceId = setTimeout(function () {
            const params = new URLSearchParams({ apellido: a, nombre: n });
            if (fechaNacimiento && fechaNacimiento.value) params.set('fechaNacimiento', fechaNacimiento.value);
            fetch('/estudiantes/verificar-nombre?' + params.toString())
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (!data.coincidencias || data.coincidencias.length === 0) { ocultar(); return; }
                    mostrar(data.coincidencias);
                })
                .catch(ocultar);
        }, 500);
    }

    [apellido, nombre, fechaNacimiento, numeroDocumento].forEach(function (el) {
        if (el) el.addEventListener('input', verificar);
    });
    if (tipoDocumento) tipoDocumento.addEventListener('change', verificar);
}
