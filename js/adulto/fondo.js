// Fondo de la app (modo adulto): color, textura en blanco y negro y transparencia de la textura.

import { el } from '../ui/dom.js';
import { cabecera, campo } from '../ui/adulto.js';
import { FONDO_POR_DEFECTO, TEXTURAS, aplicarFondo, guardarFondo, leerFondo } from '../ui/fondo.js';

export const titulo = 'Fondo · Leo Conmigo';

export function montar(contenedor) {
  let fondo = leerFondo();
  const cambiar = (parte) => {
    fondo = { ...fondo, ...parte };
    guardarFondo(fondo);
    aplicarFondo(fondo);
  };

  const color = el('input', { type: 'color', value: fondo.color, 'aria-label': 'Color del fondo' });
  const alpha = el('input', { type: 'range', min: 0, max: 100, step: 1, value: Math.round(fondo.alpha * 100), 'aria-label': 'Transparencia de la textura' });
  const alphaValor = el('output', {}, `${Math.round(fondo.alpha * 100)} %`);
  color.addEventListener('input', () => cambiar({ color: color.value }));
  alpha.addEventListener('input', () => {
    alphaValor.textContent = `${alpha.value} %`;
    cambiar({ alpha: Number(alpha.value) / 100 });
  });

  const opciones = TEXTURAS.map((t) => {
    const radio = el('input', { type: 'radio', name: 'textura', value: t.id, checked: t.id === fondo.textura });
    radio.addEventListener('change', () => cambiar({ textura: t.id }));
    const muestra = el('span', { class: 'fondo-muestra', style: t.ruta ? `background-image:url("${t.ruta}")` : '' });
    return el('label', { class: 'fondo-opcion' }, radio, muestra, el('span', {}, t.nombre));
  });

  const restablecer = () => {
    fondo = { ...FONDO_POR_DEFECTO };
    guardarFondo(fondo);
    aplicarFondo(fondo);
    color.value = fondo.color;
    alpha.value = Math.round(fondo.alpha * 100);
    alphaValor.textContent = `${alpha.value} %`;
    opciones.forEach((o) => { o.querySelector('input').checked = o.querySelector('input').value === fondo.textura; });
  };

  contenedor.append(
    el(
      'section',
      { class: 'vista-adulto' },
      cabecera('Fondo de la app'),
      el(
        'div',
        { class: 'panel' },
        el('p', { class: 'ayuda' }, 'Los cambios se ven al instante y valen para este dispositivo. La textura siempre es en blanco y negro: se mezcla con el color que elijas.'),
        campo('Color', color),
        campo('Transparencia de la textura', el('div', { class: 'fila' }, alpha, alphaValor), '0 % no se ve; 100 % se ve completa.'),
        el('h2', {}, 'Textura'),
        el('div', { class: 'fondo-opciones' }, opciones),
        el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'boton secundario', onclick: restablecer }, 'Restablecer')),
      ),
    ),
  );
  return () => {};
}
