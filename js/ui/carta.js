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
 * La palabra partida en sílabas, cada una de su color (y separadas por un punto, para no depender solo del color).
 * `resaltar`: índice de la sílaba que suena; `hueco`: índice de la sílaba que falta (se muestra un espacio vacío).
 */
function crearTextoSilabas(silabas, { resaltar = null, hueco = null, separar = true } = {}) {
  const partes = [];
  silabas.forEach((silaba, i) => {
    if (i > 0 && separar) partes.push(el('span', { class: 'silaba-punto', 'aria-hidden': 'true' }, '·'));
    const clases = ['silaba', `silaba-${i % 2}`];
    if (i === resaltar) clases.push('resaltada');
    if (i === hueco) clases.push('hueco-silaba');
    partes.push(el('span', { class: clases.join(' ') }, i === hueco ? '' : silaba));
  });
  return el('span', { class: 'palabra-texto texto-silabas' }, ...partes);
}

/**
 * @param interactiva  true = botón que se puede tocar (opción); false = solo muestra (modelo)
 * @param url          URL de la imagen del elemento (si no hay, se usa su emoji o el collage de `partes`)
 * @param partes       [{ palabra, url }] para el collage de una frase sin imagen propia
 * @param silabas      si se pasa, el texto se muestra partido en sílabas (etapa 3)
 * @param resaltar     índice de la sílaba resaltada (solo con `silabas`)
 * @param hueco        índice de la sílaba que falta, que se muestra como un espacio vacío (solo con `silabas`)
 */
export function crearCarta({
  forma, palabra, url = null, partes = [], grande = false, interactiva = true, silabas = null, resaltar = null, hueco = null,
}) {
  const contenido = [];
  const partida = Array.isArray(silabas) && silabas.length > 0;
  const soloTexto = forma === 'palabra' || forma === 'silabas' || forma === 'silaba'; // 'silaba': una opción que es una sílaba
  if (!soloTexto) contenido.push(!url && partes.length ? crearCollage(partes) : crearImagen(palabra, url));
  if (forma !== 'imagen') {
    contenido.push(partida ? crearTextoSilabas(silabas, { resaltar, hueco, separar: hueco == null }) : el('span', { class: 'palabra-texto' }, palabra.texto));
  }
  // Con un hueco, el nombre accesible no revela la sílaba que falta
  const nombre = hueco != null && partida ? silabas.map((s, i) => (i === hueco ? '…' : s)).join('') : palabra.texto;
  return el(
    interactiva ? 'button' : 'div',
    {
      class: `carta carta-${forma === 'silabas' ? 'palabra' : forma}${grande ? ' carta-grande' : ''}${palabra.esFrase ? ' carta-frase' : ''}`,
      type: interactiva ? 'button' : null,
      'aria-label': nombre,
      'data-id': palabra.id,
    },
    ...contenido,
  );
}
