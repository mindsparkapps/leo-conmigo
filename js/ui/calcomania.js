// Dibujo de una calcomanía: las de la app son SVG; las propias del adulto, una foto, un pictograma o un emoji.

import { el } from './dom.js';
import { CALCOMANIAS, esPropia, idDePropia, rutaCalcomania } from '../core/calcomanias.js';
import { urlDeMedio } from '../medios.js';

const nombres = new Map(CALCOMANIAS.map((c) => [c.codigo, c.nombre]));

export const nombreDeCalcomania = (codigo, propiasPorId = new Map()) =>
  esPropia(codigo) ? propiasPorId.get(idDePropia(codigo))?.nombre ?? 'Calcomanía' : nombres.get(codigo) ?? 'Calcomanía';

/** El mapa id -> calcomanía propia (sin las borradas). */
export const mapaDePropias = (propias) => new Map(propias.filter((p) => !p.deleted).map((p) => [p.id, p]));

/**
 * Nodo de una calcomanía. Devuelve null si era propia y ya no existe.
 * @param clase  'calcomania' (en el álbum) o 'calcomania-grande' (al ganarla)
 */
export async function nodoDeCalcomania(store, codigo, propiasPorId, { clase = 'calcomania', decorativo = false } = {}) {
  const nombre = nombreDeCalcomania(codigo, propiasPorId);
  const aria = decorativo ? { alt: '' } : { alt: nombre };
  if (!esPropia(codigo)) return el('img', { class: clase, src: rutaCalcomania(codigo), draggable: 'false', ...aria });
  const propia = propiasPorId.get(idDePropia(codigo));
  if (!propia) return null;
  const url = await urlDeMedio(store, propia.medioImagenId);
  const contenido = url
    ? el('img', { src: url, alt: '', draggable: 'false' })
    : el('span', { class: 'calcomania-emoji' }, propia.emoji ?? (nombre[0] ?? '★'));
  return el('span', { class: `${clase} calcomania-propia`, role: 'img', 'aria-label': decorativo ? null : nombre, 'aria-hidden': decorativo ? 'true' : null }, contenido);
}
