// Cartas de las actividades. `forma`:
//   'tarjeta' = imagen + palabra · 'palabra' = solo la palabra · 'imagen' = solo la imagen
// Un «elemento» puede ser una palabra o una frase (`esFrase`). Una frase sin imagen propia se muestra
// con un collage de las imágenes de sus palabras (`partes`).

import { el } from './dom.js';

function crearImagen(palabra, url) {
  if (url) return el('img', { class: 'carta-foto', src: url, alt: '', draggable: 'false' });
  if (palabra.emoji) return el('span', { class: 'carta-emoji', 'aria-hidden': 'true' }, palabra.emoji);
  return el('span', { class: 'carta-vacia', 'aria-hidden': 'true' });
}

/** Hasta 3 imágenes pequeñas, una al lado de otra: lo que se ve de una frase que no tiene foto propia. */
function crearCollage(partes) {
  return el('span', { class: 'collage', 'aria-hidden': 'true' }, partes.map(({ palabra, url }) => crearImagen(palabra, url)));
}

/**
 * @param interactiva  true = botón que se puede tocar (opción); false = solo muestra (modelo)
 * @param url          URL de la imagen del elemento (si no hay, se usa su emoji o el collage de `partes`)
 * @param partes       [{ palabra, url }] para el collage de una frase sin imagen propia
 */
export function crearCarta({ forma, palabra, url = null, partes = [], grande = false, interactiva = true }) {
  const contenido = [];
  if (forma !== 'palabra') contenido.push(!url && partes.length ? crearCollage(partes) : crearImagen(palabra, url));
  if (forma !== 'imagen') contenido.push(el('span', { class: 'palabra-texto' }, palabra.texto));
  return el(
    interactiva ? 'button' : 'div',
    {
      class: `carta carta-${forma}${grande ? ' carta-grande' : ''}${palabra.esFrase ? ' carta-frase' : ''}`,
      type: interactiva ? 'button' : null,
      'aria-label': palabra.texto,
      'data-id': palabra.id,
    },
    ...contenido,
  );
}
