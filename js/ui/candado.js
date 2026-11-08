// Candado de salida del modo niño: hay que MANTENER presionado 3 s y luego
// resolver una suma de dos cifras. Un niño no lo logra por accidente.

import { generarSuma, esRespuestaCorrecta } from '../core/suma.js';
import { el } from './dom.js';
import { efectoBoton } from './botones.js';

const MS_SOSTENER = 3000;

const ICONO = `
<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <circle class="candado-pista" cx="24" cy="24" r="21"/>
  <circle class="candado-avance" cx="24" cy="24" r="21"/>
  <rect class="candado-icono" x="15" y="23" width="18" height="13" rx="3"/>
  <path class="candado-icono-linea" d="M18.5 23v-4.5a5.5 5.5 0 0 1 11 0V23"/>
</svg>`;

/**
 * Devuelve el botón del candado. `alDesbloquear` se llama al resolver bien la suma.
 * Con `etiqueta` es un botón grande del menú principal (icono + texto) en vez del candado de la esquina.
 */
export function crearCandado({ alDesbloquear, etiqueta = null }) {
  const boton = el('button', {
    type: 'button',
    class: etiqueta ? 'candado candado-menu menu-boton' : 'candado',
    'aria-label': 'Zona de adultos. Mantén presionado 3 segundos.',
  });
  boton.innerHTML = ICONO;
  if (etiqueta) boton.append(el('span', { class: 'menu-etiqueta', 'aria-hidden': 'true' }, etiqueta));

  let temporizador = null;
  // En el celular el dedo tapa el candado: mientras se sostiene, el avance se ve también abajo, al centro
  let indicador = null;

  const quitarIndicador = () => {
    indicador?.remove();
    indicador = null;
  };

  const iniciar = () => {
    if (temporizador) return;
    boton.classList.add('sosteniendo');
    indicador = el('div', { class: 'candado-indicador', 'aria-hidden': 'true' });
    indicador.innerHTML = ICONO;
    document.body.append(indicador);
    temporizador = setTimeout(() => {
      temporizador = null;
      boton.classList.remove('sosteniendo');
      quitarIndicador();
      efectoBoton(boton); // que se vea el «squash» antes de pedir la suma
      setTimeout(() => pedirSuma(alDesbloquear), 400);
    }, MS_SOSTENER);
  };

  const cancelar = () => {
    clearTimeout(temporizador);
    temporizador = null;
    boton.classList.remove('sosteniendo');
    quitarIndicador();
  };

  boton.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    iniciar();
  });
  for (const tipo of ['pointerup', 'pointercancel', 'pointerleave']) {
    boton.addEventListener(tipo, cancelar);
  }
  // Evita el menú contextual que Android abre con una pulsación larga.
  boton.addEventListener('contextmenu', (e) => e.preventDefault());

  // Alternativa con teclado: mantener Enter o Espacio.
  boton.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); iniciar(); }
  });
  boton.addEventListener('keyup', (e) => {
    if (e.key === 'Enter' || e.key === ' ') cancelar();
  });
  boton.addEventListener('blur', cancelar);

  return boton;
}

function pedirSuma(alAcertar) {
  let suma = generarSuma();

  const enunciado = el('p', { class: 'suma-enunciado' });
  const error = el(
    'p',
    { class: 'suma-error', role: 'alert', hidden: true },
    'Ese no es el resultado. Prueba con esta otra suma.',
  );
  const entrada = el('input', {
    id: 'respuesta-suma',
    type: 'text',
    inputmode: 'numeric',
    pattern: '[0-9]*',
    autocomplete: 'off',
    maxlength: 3,
  });

  const mostrarSuma = () => {
    enunciado.textContent = `${suma.a} + ${suma.b} =`;
    entrada.value = '';
  };

  const formulario = el(
    'form',
    {
      novalidate: true,
      onsubmit: (e) => {
        e.preventDefault();
        if (entrada.value.trim() === '') { entrada.focus(); return; }
        if (esRespuestaCorrecta(suma, entrada.value)) {
          cerrar();
          alAcertar();
        } else {
          suma = generarSuma();
          mostrarSuma();
          error.hidden = false;
          entrada.focus();
        }
      },
    },
    enunciado,
    el('label', { for: 'respuesta-suma', class: 'solo-lectura' }, 'Resultado de la suma'),
    entrada,
    error,
    el(
      'div',
      { class: 'acciones' },
      el('button', { type: 'button', class: 'boton secundario', onclick: () => cerrar() }, 'Cancelar'),
      el('button', { type: 'submit', class: 'boton' }, 'Entrar'),
    ),
  );

  const dialogo = el(
    'dialog',
    { class: 'dialogo-suma', 'aria-labelledby': 'titulo-suma' },
    el('h2', { id: 'titulo-suma' }, 'Solo para adultos'),
    el('p', {}, 'Resuelve la suma para continuar.'),
    formulario,
  );

  function cerrar() {
    if (dialogo.open) dialogo.close();
    dialogo.remove();
  }
  dialogo.addEventListener('close', () => dialogo.remove());

  document.body.append(dialogo);
  mostrarSuma();
  dialogo.showModal();
  entrada.focus();
}
