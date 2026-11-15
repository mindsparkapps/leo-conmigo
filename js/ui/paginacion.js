// Controles de paginación del modo adulto: «‹ Anterior · 21–40 de 232 · Siguiente ›».

import { el } from './dom.js';

/**
 * @param info  lo que devuelve `paginar` de core/listas.js
 * @param irA   (pagina) => void
 */
export function crearPaginacion(info, irA) {
  if (info.paginas <= 1) return null;
  const boton = (texto, pagina, deshabilitado, etiqueta) =>
    el('button', { type: 'button', class: 'boton secundario chico', disabled: deshabilitado, 'aria-label': etiqueta, onclick: () => irA(pagina) }, texto);
  return el(
    'nav',
    { class: 'paginacion', 'aria-label': 'Páginas' },
    boton('«', 1, info.pagina === 1, 'Primera página'),
    boton('‹ Anterior', info.pagina - 1, info.pagina === 1, 'Página anterior'),
    el('span', { class: 'paginacion-texto', role: 'status' }, `${info.desde}–${info.hasta} de ${info.total} · página ${info.pagina} de ${info.paginas}`),
    boton('Siguiente ›', info.pagina + 1, info.pagina === info.paginas, 'Página siguiente'),
    boton('»', info.paginas, info.pagina === info.paginas, 'Última página'),
  );
}
