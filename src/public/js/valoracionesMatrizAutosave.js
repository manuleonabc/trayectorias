// Autoguardado por CELDA en la matriz "por curso" (ver valoracion.controller.js::getPorCurso).
// Mismo criterio que /js/valoracionesAutosave.js (autoguardado por fila en "por asignatura")
// pero cada celda es su propia unidad de guardado, con su propio cargoId (varia por
// columna/asignatura) - por eso es un archivo aparte y no una generalizacion del otro.
// Nunca manda observacion (esa pantalla no la muestra, ver getPorCurso).
function initValoracionesMatrizAutosave({ tabla, url, cicloLectivo, periodo }) {
    const tablaEl = document.querySelector(tabla);
    if (!tablaEl) return;

    function leerCelda(celda) {
        const valoracionEl = celda.querySelector('[data-campo="valoracion"]');
        const notaEl = celda.querySelector('[data-campo="nota"]');
        const recuperoEl = celda.querySelector('[data-campo="recupero"]');
        return {
            cargoId: celda.dataset.cargoId,
            cursadaAsignaturaId: celda.dataset.cursadaId,
            cicloLectivo: cicloLectivo,
            periodo: periodo,
            valoracion: valoracionEl ? valoracionEl.value : '',
            nota: notaEl ? notaEl.value : '',
            recuperoSaberesC1: recuperoEl ? recuperoEl.checked : false
        };
    }

    // Mismo criterio que valoracionesAutosave.js: check verde se borra solo, alerta
    // amarilla se queda hasta el proximo intento.
    function marcarIndicador(celda, estado) {
        const indicador = celda.querySelector('[data-indicador]');
        if (!indicador) return;
        clearTimeout(indicador._ocultarTimeout);
        indicador.classList.remove('d-none', 'bi-check-circle-fill', 'text-success', 'bi-exclamation-triangle-fill', 'text-warning');
        if (estado === 'ok') {
            indicador.classList.add('bi-check-circle-fill', 'text-success');
            indicador._ocultarTimeout = setTimeout(function () {
                indicador.classList.add('d-none');
            }, 2500);
        } else {
            indicador.classList.add('bi-exclamation-triangle-fill', 'text-warning');
        }
    }

    async function guardarCelda(celda) {
        const datos = leerCelda(celda);
        if (!datos.cursadaAsignaturaId) return;
        // Celda sin nada cargado (se entro y salio sin escribir) - no mandar un guardado vacio.
        if (!datos.valoracion && !datos.nota) return;

        try {
            const respuesta = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            });
            const resultado = await respuesta.json();
            marcarIndicador(celda, resultado.ok ? 'ok' : 'error');
        } catch (error) {
            marcarIndicador(celda, 'error');
        }
    }

    tablaEl.querySelectorAll('tbody td[data-cursada-id]').forEach(function (celda) {
        if (!celda.dataset.cursadaId) return;
        celda.querySelectorAll('[data-campo]').forEach(function (campo) {
            const evento = (campo.tagName === 'SELECT' || campo.type === 'checkbox') ? 'change' : 'blur';
            campo.addEventListener(evento, function () {
                guardarCelda(celda);
            });
        });
    });
}
