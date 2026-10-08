// Subir/bajar en la vista de edicion de un curso (ver misCursoEditar.ejs) - unica
// excepcion de escritura por AJAX de esta seccion (pedido explicito del usuario, para no
// refrescar toda la pagina en cada click). El N° de registro ES el orden: subir/bajar
// intercambia el numero con la fila vecina (ver postSubirRegistro/postBajarRegistro en
// misCursos.controller.js), nunca un campo de orden separado.
function initMisCursoEditarOrden({ tabla, cursoClave }) {
    const cuerpo = document.querySelector(tabla + ' tbody');
    if (!cuerpo) return;

    const fila = (inscripcionId) => cuerpo.querySelector('tr[data-inscripcion-id="' + inscripcionId + '"]');

    // Tilde verde que aparece y se borra sola a los 2s - mismo patron que
    // /js/valoracionesAutosave.js.
    function marcarGuardado(filaEl) {
        const indicador = filaEl.querySelector('[data-indicador]');
        if (!indicador) return;
        clearTimeout(indicador._ocultarTimeout);
        indicador.classList.remove('d-none');
        indicador._ocultarTimeout = setTimeout(function () {
            indicador.classList.add('d-none');
        }, 2000);
    }

    // Primera/ultima fila no pueden subir/bajar mas - se recalcula despues de cada
    // intercambio, ya que las filas cambian de posicion.
    function actualizarBotones() {
        const filas = Array.from(cuerpo.querySelectorAll('tr[data-inscripcion-id]'));
        filas.forEach(function (fila, i) {
            const subir = fila.querySelector('[data-accion="subir"]');
            const bajar = fila.querySelector('[data-accion="bajar"]');
            if (subir) subir.disabled = i === 0;
            if (bajar) bajar.disabled = i === filas.length - 1;
        });
    }

    async function mover(inscripcionId, direccion, boton) {
        boton.disabled = true;
        try {
            const respuesta = await fetch('/mis-cursos/' + cursoClave + '/estudiantes/' + inscripcionId + '/' + direccion, {
                method: 'POST'
            });
            const resultado = await respuesta.json();
            if (!resultado.ok || !resultado.cambio) return;

            const [actual, vecino] = resultado.actualizadas;
            [actual, vecino].forEach(function (item) {
                const filaEl = fila(item.inscripcionId);
                if (!filaEl) return;
                const celda = filaEl.querySelector('[data-campo="numeroRegistro"]');
                if (celda) celda.textContent = item.numeroRegistro || '—';
                marcarGuardado(filaEl);
            });

            // Las dos filas ya eran vecinas en la tabla - alcanza con invertir su posicion
            // (el numero que se ve en cada una ya se actualizo arriba).
            const filaActual = fila(actual.inscripcionId);
            const filaVecino = fila(vecino.inscripcionId);
            if (filaActual && filaVecino) {
                if (direccion === 'subir') filaActual.parentNode.insertBefore(filaActual, filaVecino);
                else filaVecino.parentNode.insertBefore(filaVecino, filaActual);
            }
        } catch (error) {
            // Sin indicador de error especifico aca (a diferencia de valoracionesAutosave):
            // si falla, la fila simplemente no se mueve y el numero no cambia - se nota solo.
        } finally {
            boton.disabled = false;
            actualizarBotones();
        }
    }

    cuerpo.addEventListener('click', function (evento) {
        const boton = evento.target.closest('[data-accion="subir"], [data-accion="bajar"]');
        if (!boton) return;
        mover(boton.dataset.inscripcionId, boton.dataset.accion, boton);
    });
}
