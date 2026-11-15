// Tarjeta de un álbum: su portada, su nombre y, si se pide, cuántas láminas faltan por pegar en un cuadrado verde
// translúcido en el centro de la portada. Un botón grande (para tocar).

import { el } from './dom.js';

/**
 * @param url      portada
 * @param nombre   nombre del álbum
 * @param faltan   número para el cuadrado verde (null = sin cuadrado)
 * @param alTocar  () => void
 */
export function crearTarjetaAlbum({ url, nombre, faltan = null, alTocar }) {
  const portada = el(
    'span',
    { class: 'album-portada' },
    el('img', { src: url, alt: '', draggable: 'false' }),
    faltan === null ? null : el('span', { class: 'album-faltan', 'aria-hidden': 'true' }, String(faltan)),
  );
  const etiqueta = faltan === null
    ? nombre
    : `${nombre}. ${faltan === 0 ? 'Completo' : `Faltan ${faltan} ${faltan === 1 ? 'lámina' : 'láminas'} por pegar`}`;
  return el('button', { type: 'button', class: 'album-tarjeta', 'aria-label': etiqueta, onclick: alTocar }, portada, el('span', { class: 'album-nombre' }, nombre));
}
