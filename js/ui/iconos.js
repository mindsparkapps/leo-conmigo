// Iconos dibujados (SVG) para los botones del modo adulto. Los emojis (🔊 🎙️) no se ven en todos los equipos.

export const SVG_ALTAVOZ = '<svg class="icono-boton" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 9v6h4l5 4V5L7 9z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

export const SVG_MICROFONO = '<svg class="icono-boton" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

export const SVG_REPRODUCIR = '<svg class="icono-boton" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>';

/** Un nodo con el icono (para ponerlo dentro de un botón con `el`). */
export function nodoIcono(svg) {
  const nodo = document.createElement('span');
  nodo.className = 'icono-nodo';
  nodo.setAttribute('aria-hidden', 'true');
  nodo.innerHTML = svg;
  return nodo;
}
