// Efecto común de todos los botones: «squash and stretch», destello (shine) y un «pop» de sonido al tocarlos.
// Un solo oyente en el documento: sirve para los botones de las vistas que se crean después.

import { sonidoClic, permitirSonidos } from './sonidos.js';
import { perfilActivo } from '../contexto.js';
import { normalizarAjustes } from '../core/modelos.js';

const SELECTOR = 'button, a.boton, a.boton-respuesta, a.menu-boton, [role="button"]:not(.sobre-pack), .boton';
const FOTOGRAMAS = [
  { scale: '1 1' },
  { scale: '1.22 0.76', offset: 0.22 },
  { scale: '0.86 1.2', offset: 0.5 },
  { scale: '1.06 0.95', offset: 0.75 },
  { scale: '1 1' },
];

let ultimaLectura = 0;
async function actualizarSonido() {
  const ahora = performance.now();
  if (ahora - ultimaLectura < 3000) return;
  ultimaLectura = ahora;
  try {
    const perfil = await perfilActivo();
    permitirSonidos(perfil ? normalizarAjustes(perfil.ajustes).sonido : true);
  } catch { /* se queda como estaba */ }
}

function destello(boton) {
  if (getComputedStyle(boton).position === 'static') boton.style.position = 'relative';
  const capa = document.createElement('span');
  capa.className = 'brillo-clic';
  capa.setAttribute('aria-hidden', 'true');
  const barra = document.createElement('span');
  capa.append(barra);
  boton.append(capa);
  const quitar = () => { capa.remove(); };
  if (barra.animate) {
    barra.animate([{ transform: 'translateX(-130%) skewX(-20deg)' }, { transform: 'translateX(130%) skewX(-20deg)' }], { duration: 520, easing: 'ease-out' }).finished.then(quitar, quitar);
  } else {
    setTimeout(quitar, 520);
  }
}

/** El efecto de un botón: sonido, «squash and stretch» y destello. */
export function efectoBoton(boton) {
  actualizarSonido().finally(sonidoClic);
  if (matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  if (boton.animate) boton.animate(FOTOGRAMAS, { duration: 360, easing: 'ease-out' });
  destello(boton);
}

// Botones que cambian de pantalla: esperan a que se vea el efecto antes de navegar
const NAVEGACION = '.menu-boton:not(.candado), .boton-casa, .boton-casa-chico, .boton-jugar, .boton-nav, .boton-libro, a[href^="#/"]';
const RETARDO_NAVEGACION_MS = 380;

export function iniciarBotones() {
  document.addEventListener(
    'click',
    (e) => {
      const boton = e.target instanceof Element ? e.target.closest(SELECTOR) : null;
      if (!boton || boton.disabled || boton.getAttribute('aria-disabled') === 'true') return;
      if (boton.classList.contains('candado')) return; // su efecto sale al completar la pulsación larga
      if (boton.dataset.sinRetardo) return; // el clic que se repite tras la espera: el efecto ya se vio
      if (boton.matches(NAVEGACION)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (boton.dataset.esperando) return;
        boton.dataset.esperando = '1';
        efectoBoton(boton);
        setTimeout(() => {
          delete boton.dataset.esperando;
          if (!boton.isConnected) return;
          boton.dataset.sinRetardo = '1';
          boton.click();
          delete boton.dataset.sinRetardo;
        }, RETARDO_NAVEGACION_MS);
        return;
      }
      efectoBoton(boton);
    },
    true,
  );
  actualizarSonido();
}
