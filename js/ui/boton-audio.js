// Botón del altavoz: toca para volver a escuchar la palabra.

import { el } from './dom.js';

const ICONO = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <path d="M8 24h12l16-14v44L20 40H8z" fill="currentColor"/>
  <path d="M44 22a14 14 0 0 1 0 20M50 14a24 24 0 0 1 0 36" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
</svg>`;

export function crearBotonAudio({ grande = false, alToque }) {
  const boton = el('button', {
    type: 'button',
    class: grande ? 'boton-audio boton-audio-grande' : 'boton-audio',
    'aria-label': 'Escuchar',
  });
  boton.innerHTML = ICONO;
  boton.addEventListener('click', (e) => {
    if (e.pointerType === 'touch' && e.isPrimary === false) return; // ignora el segundo dedo (el ratón y el teclado siempre valen)
    alToque();
  });
  return boton;
}
