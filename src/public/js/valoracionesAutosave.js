// Autoguardado por fila en la carga de valoraciones (ver
// valoracion.controller.js::postGuardarFila) - unica excepcion de ESCRITURA por AJAX del
// proyecto (todo lo demas va por POST+redirect+flash). Cada fila de la tabla es una unidad
// de guardado: al tocar cualquier campo de un estudiante, se manda TODA la fila, no solo
// el campo que cambio - una Valoracion es un solo documento con varios campos juntos,
// mandar de a uno pisaria los demas con vacio en el upsert del servidor.
function initValoracionesAutosave({ tabla, url, cargoId, cicloLectivo, periodo }) {
    const tablaEl = document.querySelector(tabla);
    if (!tablaEl) return;

    function leerFila(fila) {
        const valoracionEl = fila.querySelector('[data-campo="valoracion"]');
        const notaEl = fila.querySelector('[data-campo="nota"]');
        const observacionEl = fila.querySelector('[data-campo="observacion"]');
        const recuperoEl = fila.querySelector('[data-campo="recupero"]');
        return {
            cargoId: cargoId,
            cursadaAsignaturaId: fila.dataset.cursadaId,
            cicloLectivo: cicloLectivo,
            periodo: periodo,
            valoracion: valoracionEl ? valoracionEl.value : '',
            nota: notaEl ? notaEl.value : '',
            observacion: observacionEl ? observacionEl.value : '',
            recuperoSaberesC1: recuperoEl ? recuperoEl.checked : false
        };
    }

    // Check verde: aparece y se borra solo a los pocos segundos. Alerta amarilla: aparece
    // y se queda ahi hasta el proximo intento (exitoso o no) - pedido explicito, un error
    // no debe pasar desapercibido.
    function marcarIndicador(fila, estado) {
        const indicador = fila.querySelector('[data-indicador]');
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

    async function guardarFila(fila) {
        const datos = leerFila(fila);
        // Fila sin nada cargado (se entro y salio de un campo sin escribir nada) - no
        // mandar un guardado vacio.
        if (!datos.valoracion && !datos.nota) return;

        try {
            const respuesta = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            });
            const resultado = await respuesta.json();
            marcarIndicador(fila, resultado.ok ? 'ok' : 'error');
        } catch (error) {
            marcarIndicador(fila, 'error');
        }
    }

    tablaEl.querySelectorAll('tbody tr[data-cursada-id]').forEach(function (fila) {
        fila.querySelectorAll('[data-campo]').forEach(function (campo) {
            const evento = (campo.tagName === 'SELECT' || campo.type === 'checkbox') ? 'change' : 'blur';
            campo.addEventListener(evento, function () {
                guardarFila(fila);
            });
        });
    });
}
