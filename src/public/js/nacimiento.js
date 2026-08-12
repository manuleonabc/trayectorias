// Cascada Provincia -> Distrito -> Localidad para "Lugar de nacimiento", contra la API
// de Georef (https://apis.datos.gob.ar/georef), solo cuando el lugar elegido es
// Argentina. Si no, se muestra un campo de texto libre en su lugar - ese input y el
// select de localidad comparten name="nacimientoLocalidad" (uno u otro llega en el POST,
// nunca los dos: el que esta oculto queda "disabled" y no se envia).
//
// selectores.provinciaInicial/distritoInicial/localidadInicial (opcionales, strings): para
// edicion, precargan la cascada con los valores ya guardados en vez de arrancar vacia.
const GEOREF_URL = 'https://apis.datos.gob.ar/georef/api/v2.0';

function initNacimiento(selectores) {
    const lugarSelect = document.querySelector(selectores.lugarSelect);
    const nacionalidadInput = document.querySelector(selectores.nacionalidadInput);
    const extranjeroWrap = document.querySelector(selectores.extranjeroWrap);
    const extranjeroInput = document.querySelector(selectores.extranjeroInput);
    const provinciaWrap = document.querySelector(selectores.provinciaWrap);
    const provinciaSelect = document.querySelector(selectores.provinciaSelect);
    const distritoWrap = document.querySelector(selectores.distritoWrap);
    const distritoSelect = document.querySelector(selectores.distritoSelect);
    const localidadWrap = document.querySelector(selectores.localidadWrap);
    const localidadSelect = document.querySelector(selectores.localidadSelect);
    if (!lugarSelect) return;

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

    function cargarProvincias(valorInicial) {
        reiniciar(provinciaSelect, 'Cargando...');
        fetch(GEOREF_URL + '/provincias?campos=id,nombre&orden=nombre&max=30')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                llenar(provinciaSelect, data.provincias, 'Seleccionar...', valorInicial);
                if (valorInicial) cargarDistritos(idSeleccionado(provinciaSelect), selectores.distritoInicial);
            })
            .catch(function () { reiniciar(provinciaSelect, 'No se pudo cargar, reintentar'); });
    }

    function cargarDistritos(provinciaId, valorInicial) {
        reiniciar(localidadSelect, 'Seleccionar distrito primero');
        if (!provinciaId) { reiniciar(distritoSelect, 'Seleccionar provincia primero'); return; }
        reiniciar(distritoSelect, 'Cargando...');
        fetch(GEOREF_URL + '/departamentos?provincia=' + provinciaId + '&campos=id,nombre&orden=nombre&max=200')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                llenar(distritoSelect, data.departamentos, 'Seleccionar...', valorInicial);
                if (valorInicial) cargarLocalidades(idSeleccionado(distritoSelect), selectores.localidadInicial);
            })
            .catch(function () { reiniciar(distritoSelect, 'No se pudo cargar, reintentar'); });
    }

    function cargarLocalidades(distritoId, valorInicial) {
        if (!distritoId) { reiniciar(localidadSelect, 'Seleccionar distrito primero'); return; }
        reiniciar(localidadSelect, 'Cargando...');
        fetch(GEOREF_URL + '/localidades?departamento=' + distritoId + '&campos=id,nombre&orden=nombre&max=500')
            .then(function (r) { return r.json(); })
            .then(function (data) { llenar(localidadSelect, data.localidades, 'Seleccionar...', valorInicial); })
            .catch(function () { reiniciar(localidadSelect, 'No se pudo cargar, reintentar'); });
    }

    function actualizarLugar() {
        const esArgentina = lugarSelect.value === 'Argentina';

        if (esArgentina && nacionalidadInput && !nacionalidadInput.value) nacionalidadInput.value = 'Argentina';

        extranjeroWrap.style.display = esArgentina ? 'none' : '';
        extranjeroInput.disabled = esArgentina;

        [provinciaWrap, distritoWrap, localidadWrap].forEach(function (wrap) {
            wrap.style.display = esArgentina ? '' : 'none';
        });
        provinciaSelect.disabled = !esArgentina;
        distritoSelect.disabled = !esArgentina;
        localidadSelect.disabled = !esArgentina;

        if (esArgentina && provinciaSelect.options.length <= 1) cargarProvincias(selectores.provinciaInicial);
    }

    lugarSelect.addEventListener('change', actualizarLugar);
    provinciaSelect.addEventListener('change', function () { cargarDistritos(idSeleccionado(provinciaSelect)); });
    distritoSelect.addEventListener('change', function () { cargarLocalidades(idSeleccionado(distritoSelect)); });

    actualizarLugar();
}
