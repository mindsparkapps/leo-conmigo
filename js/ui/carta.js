// Cartas de las actividades. `forma`:
//   'tarjeta' = imagen + palabra · 'palabra' = solo la palabra · 'imagen' = solo la imagen

import { el } from './dom.js';

function crearImagen(palabra, url) {
  if (url) return el('img', { class: 'carta-foto', src: url, alt: '', draggable: 'false' });
  if (palabra.emoji) return el('span', { class: 'carta-emoji', 'aria-hidden': 'true' }, palabra.emoji);
  return el('span', { class: 'carta-vacia', 'aria-hidden': 'true' });
}

/**
 * @param interactiva  true = botón que se puede tocar (opción); false = solo muestra (modelo)
 * @param url          URL de la imagen de la palabra (si no hay, se usa su emoji)
 */
export function crearCarta({ forma, palabra, url = null, grande = false, interactiva = true }) {
  const partes = [];
  if (forma !== 'palabra') partes.push(crearImagen(palabra, url));
  if (forma !== 'imagen') partes.push(el('span', { class: 'palabra-texto' }, palabra.texto));
  return el(
    interactiva ? 'button' : 'div',
    {
      class: `carta carta-${forma}${grande ? ' carta-grande' : ''}`,
      type: interactiva ? 'button' : null,
      'aria-label': palabra.texto,
      'data-id': palabra.id,
    },
    ...partes,
  );
}
