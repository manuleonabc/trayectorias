// Cascada Provincia -> Distrito -> Localidad para el domicilio, con Buenos Aires / La
// Matanza como valores por defecto (la mayoria de los estudiantes son del distrito, pero
// se pueden cambiar). Ademas, autocompletado de calle contra Georef con <datalist> - deja
// escribir una calle que no este en la lista, no es una restriccion. Misma API que
// /js/nacimiento.js (https://apis.datos.gob.ar/georef).
//
// selectores.provinciaInicial/distritoInicial/localidadInicial (opcionales, strings): para
// edicion, remplazan los valores por defecto de arriba por lo que ya tenia guardado.
const GEOREF_URL_DOMICILIO = 'https://apis.datos.gob.ar/georef/api/v2.0';
const DOMICILIO_PROVINCIA_DEFECTO = 'Buenos Aires';
const DOMICILIO_DISTRITO_DEFECTO = 'La Matanza';

function initDomicilio(selectores) {
    const provinciaSelect = document.querySelector(selectores.provinciaSelect);
    const distritoSelect = document.querySelector(selectores.distritoSelect);
    const localidadSelect = document.querySelector(selectores.localidadSelect);
    const calleInput = document.querySelector(selectores.calleInput);
    const calleList = document.querySelector(selectores.calleList);
    if (!provinciaSelect) return;

    function reiniciar(select, placeholder) {
        select.innerHTML = '';
        const vacia = document.createElement('option');
        vacia.value = '';
        vacia.textContent = placeholder;
        select.appendChild(vacia);
    }

    function llenar(select, opciones, placeholder, valorPorDefecto) {
        reiniciar(select, placeholder);
        opciones.forEach(function (o) {
            const option = document.createElement('option');
            option.value = o.nombre;
            option.dataset.id = o.id;
            option.textContent = o.nombre;
            select.appendChild(option);
        });
        if (valorPorDefecto) select.value = valorPorDefecto;
    }

    function idSeleccionado(select) {
        const opcion = select.selectedOptions[0];
        return opcion ? opcion.dataset.id : undefined;
    }

    function cargarLocalidades(distritoId, valorInicial) {
        if (!distritoId) { reiniciar(localidadSelect, 'Seleccionar distrito primero'); return; }
        reiniciar(localidadSelect, 'Cargando...');
        fetch(GEOREF_URL_DOMICILIO + '/localidades?departamento=' + distritoId + '&campos=id,nombre&orden=nombre&max=500')
            .then(function (r) { return r.json(); })
            .then(function (data) { llenar(localidadSelect, data.localidades, 'Seleccionar...', valorInicial); })
            .catch(function () { reiniciar(localidadSelect, 'No se pudo cargar, reintentar'); });
    }

    function cargarDistritos(provinciaId, distritoPorDefecto, localidadPorDefecto) {
        reiniciar(localidadSelect, 'Seleccionar distrito primero');
        if (!provinciaId) { reiniciar(distritoSelect, 'Seleccionar provincia primero'); return; }
        reiniciar(distritoSelect, 'Cargando...');
        fetch(GEOREF_URL_DOMICILIO + '/departamentos?provincia=' + provinciaId + '&campos=id,nombre&orden=nombre&max=200')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                llenar(distritoSelect, data.departamentos, 'Seleccionar...', distritoPorDefecto);
                cargarLocalidades(idSeleccionado(distritoSelect), localidadPorDefecto);
            })
            .catch(function () { reiniciar(distritoSelect, 'No se pudo cargar, reintentar'); });
    }

    function cargarProvincias() {
        reiniciar(provinciaSelect, 'Cargando...');
        const provinciaPorDefecto = selectores.provinciaInicial || DOMICILIO_PROVINCIA_DEFECTO;
        const distritoPorDefecto = selectores.distritoInicial || DOMICILIO_DISTRITO_DEFECTO;
        const localidadPorDefecto = selectores.localidadInicial;
        fetch(GEOREF_URL_DOMICILIO + '/provincias?campos=id,nombre&orden=nombre&max=30')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                llenar(provinciaSelect, data.provincias, 'Seleccionar...', provinciaPorDefecto);
                cargarDistritos(idSeleccionado(provinciaSelect), distritoPorDefecto, localidadPorDefecto);
            })
            .catch(function () { reiniciar(provinciaSelect, 'No se pudo cargar, reintentar'); });
    }

    let debounceId;
    function buscarCalles() {
        clearTimeout(debounceId);
        if (!calleList) return;
        const texto = calleInput.value.trim();
        const distritoId = idSeleccionado(distritoSelect);
        if (!distritoId || texto.length < 3) return;
        debounceId = setTimeout(function () {
            fetch(GEOREF_URL_DOMICILIO + '/calles?nombre=' + encodeURIComponent(texto) + '&departamento=' + distritoId + '&campos=nombre&max=15')
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    calleList.innerHTML = '';
                    data.calles.forEach(function (c) {
                        const option = document.createElement('option');
                        option.value = c.nombre;
                        calleList.appendChild(option);
                    });
                })
                .catch(function () {});
        }, 300);
    }

    provinciaSelect.addEventListener('change', function () { cargarDistritos(idSeleccionado(provinciaSelect)); });
    distritoSelect.addEventListener('change', function () { cargarLocalidades(idSeleccionado(distritoSelect)); });
    if (calleInput) calleInput.addEventListener('input', buscarCalles);

    cargarProvincias();
}
