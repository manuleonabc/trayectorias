// Chequeo en vivo (debounce) de si ya existe una Persona con el numero de documento que
// se esta tipeando, contra GET /estudiantes/verificar-documento - solo para el alta de
// ESTUDIANTE (ver documentoFields.ejs). No bloquea el tipeo, solo avisa: el chequeo duro
// real sigue estando en el submit del form (ver postEstudiante/postEstudianteNuevo).
function initVerificarDocumento(selectores) {
    const input = document.querySelector(selectores.input);
    const avisoWrap = document.querySelector(selectores.avisoWrap);
    const avisoTexto = document.querySelector(selectores.avisoTexto);
    const avisoLink = document.querySelector(selectores.avisoLink);
    if (!input) return;

    function ocultar() {
        avisoWrap.classList.add('d-none');
        avisoLink.classList.add('d-none');
    }

    let debounceId;
    function verificar() {
        clearTimeout(debounceId);
        const numeroDocumento = input.value.trim();
        if (numeroDocumento.length < 6) { ocultar(); return; }
        debounceId = setTimeout(function () {
            fetch('/estudiantes/verificar-documento?numeroDocumento=' + encodeURIComponent(numeroDocumento))
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (!data.existe) { ocultar(); return; }
                    if (data.esEstudiante) {
                        avisoTexto.textContent = 'Ya existe un estudiante registrado con ese número de documento (' + data.nombreCompleto + ').';
                        avisoLink.href = '/estudiantes/' + encodeURIComponent(data.clave);
                        avisoLink.classList.remove('d-none');
                    } else {
                        avisoTexto.textContent = 'Ya existe una persona registrada con ese número de documento (' + data.nombreCompleto + '), pero no es un estudiante.';
                        avisoLink.classList.add('d-none');
                    }
                    avisoWrap.classList.remove('d-none');
                })
                .catch(function () { ocultar(); });
        }, 400);
    }

    input.addEventListener('input', verificar);
}
