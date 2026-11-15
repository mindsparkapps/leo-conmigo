// Tarjeta de un álbum: su portada, su nombre y, si se pide, cuántas láminas hay por pegar en un cuadrado verde
// translúcido en el centro de la portada. Un botón grande (para tocar).
// Al pasar el ratón la portada se agranda; al tocarla se aplasta y se estira (squash and stretch) y, cuando termina el
// gesto, recién entonces se llama a `alTocar` (así el niño alcanza a ver qué tocó).

import { el } from './dom.js';

/** Lo que dura el aplastar y estirar (ms); `alTocar` se llama al terminar. */
export const MS_APLASTAR = 650;

/**
 * @param url      portada
 * @param nombre   nombre del álbum
 * @param faltan   número para el cuadrado verde: láminas listas para pegar (null = sin cuadrado)
 * @param flota    la tarjeta flota suavemente; `indice` desfasa el vaivén de cada una
 * @param alTocar  () => void
 */
export function crearTarjetaAlbum({ url, nombre, faltan = null, flota = false, indice = 0, alTocar }) {
  const portada = el(
    'span',
    { class: 'album-portada' },
    el('img', { src: url, alt: '', draggable: 'false' }),
    faltan ? el('span', { class: 'album-faltan', 'aria-hidden': 'true' }, String(faltan)) : null, // con 0 láminas por pegar no se dibuja el cuadro
  );
  const etiqueta = faltan === null
    ? nombre
    : `${nombre}. ${faltan === 0 ? 'Nada por pegar' : `${faltan} ${faltan === 1 ? 'lámina' : 'láminas'} por pegar`}`;
  let tocada = false;
  const tarjeta = el('button', {
    type: 'button',
    class: `album-tarjeta${flota ? ' flota' : ''}`,
    style: flota ? `--i:${indice}` : null,
    'aria-label': etiqueta,
    onclick: () => {
      if (tocada) return;
      tocada = true;
      const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (quieto) { alTocar(); return; }
      portada.classList.add('aplastar');
      setTimeout(() => {
        alTocar();
        tocada = false;
        portada.classList.remove('aplastar');
      }, MS_APLASTAR);
    },
  }, portada, el('span', { class: 'album-nombre' }, nombre));
  return tarjeta;
}
