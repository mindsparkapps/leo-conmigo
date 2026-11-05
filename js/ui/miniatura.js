// Cuadro con la imagen de una palabra o de un perfil: foto, emoji o, si no hay, la inicial.

import { el } from './dom.js';

export function pintarMiniatura(caja, { url = null, emoji = null, texto = '' } = {}) {
  if (url) caja.replaceChildren(el('img', { src: url, alt: '' }));
  else if (emoji) caja.replaceChildren(el('span', { class: 'miniatura-emoji' }, emoji));
  else caja.replaceChildren(el('span', { class: 'miniatura-letra' }, (String(texto).trim()[0] ?? '?').toUpperCase()));
}

export function crearMiniatura(datos = {}, { grande = false } = {}) {
  const caja = el('span', { class: grande ? 'miniatura miniatura-grande' : 'miniatura', 'aria-hidden': 'true' });
  pintarMiniatura(caja, datos);
  return caja;
}
