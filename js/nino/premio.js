// Fin de sesión: celebración y calcomanía nueva. Sin números ni porcentajes (PLAN.md §5).

import { el } from '../ui/dom.js';
import { crearCandado } from '../ui/candado.js';
import { habilitarAdulto, deshabilitarAdulto } from '../acceso.js';
import { NOMBRE_APP } from '../config.js';
import { desbloquearAudio, detener, hablarTexto } from '../audio.js';
import { vibrar } from '../hardware.js';
import { rutaCalcomania } from '../core/calcomanias.js';

export const titulo = NOMBRE_APP;

const ICONO_CASA = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 8L6 32h8v22h14V40h8v14h14V32h8z" fill="currentColor"/></svg>`;

let premio = null;

/** La sesión deja aquí lo que debe mostrarse: { codigo, ajustes } (ajustes ya normalizados). */
export function establecerPremio(datos) {
  premio = datos;
}

/** Estrellas que suben y se desvanecen (≤ 1,5 s). Con movimiento reducido el CSS las oculta. */
export function lluviaDeEstrellas(vista) {
  const lluvia = el(
    'div',
    { class: 'estrellas', 'aria-hidden': 'true' },
    [12, 30, 50, 70, 88].map((x, i) => el('span', { style: `left:${x}%; animation-delay:${i * 90}ms` }, '⭐')),
  );
  vista.append(lluvia);
  setTimeout(() => lluvia.remove(), 1500);
}

export function montar(contenedor, { ir }) {
  deshabilitarAdulto();
  if (!premio) {
    ir('/nino'); // abierto directamente (p. ej. al recargar): no hay nada que premiar
    return undefined;
  }
  const { codigo, ajustes } = premio;
  const candado = crearCandado({
    alDesbloquear: () => {
      habilitarAdulto();
      ir('/adulto');
    },
  });
  const casa = el('button', { type: 'button', class: 'boton-casa', 'aria-label': 'Volver al inicio', onclick: () => ir('/nino') });
  casa.innerHTML = ICONO_CASA;

  const vista = el(
    'section',
    { class: 'vista-nino premio-nino' },
    el('img', { class: 'calcomania-grande', src: rutaCalcomania(codigo), alt: '', draggable: 'false' }),
    casa,
    candado,
  );
  contenedor.append(vista);

  const celebra = ajustes.intensidadCelebracion !== 'ninguna';
  if (ajustes.intensidadCelebracion === 'normal') lluviaDeEstrellas(vista);
  if (celebra && ajustes.sonido) {
    desbloquearAudio();
    hablarTexto('¡Lo lograste!', { velocidad: ajustes.velocidadVoz });
  }
  if (celebra && ajustes.vibracion) vibrar([40, 60, 40]);

  return () => {
    detener();
    premio = null;
  };
}
