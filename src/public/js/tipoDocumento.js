// Muestra/oculta los subcampos de documento segun el tipo elegido: el numero no aplica
// a CPI ni a "Sin documento", el estado del DNI fisico solo aplica a DNI, y el tipo de
// documento extranjero solo aplica a "Documento extranjero".
function initTipoDocumento(selectSelector, dniWrapSelector, estadoDniWrapSelector, extranjeroWrapSelector) {
    const select = document.querySelector(selectSelector);
    const dniWrap = document.querySelector(dniWrapSelector);
    const estadoDniWrap = document.querySelector(estadoDniWrapSelector);
    const extranjeroWrap = document.querySelector(extranjeroWrapSelector);
    if (!select) return;

    function actualizar() {
        const tipo = select.value;
        if (dniWrap) dniWrap.style.display = (tipo === 'CPI' || tipo === 'Sin documento') ? 'none' : '';
        if (estadoDniWrap) estadoDniWrap.style.display = tipo === 'DNI' ? '' : 'none';
        if (extranjeroWrap) extranjeroWrap.style.display = tipo === 'Documento extranjero' ? '' : 'none';
    }

    select.addEventListener('change', actualizar);
    actualizar();
}
