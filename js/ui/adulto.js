// Piezas comunes de las vistas del modo adulto.

import { el } from './dom.js';

/** Encabezado con título y botón para volver. */
export function cabecera(titulo, { atras = '#/adulto', textoAtras = '← Volver' } = {}) {
  return el(
    'header',
    { class: 'encabezado-adulto' },
    el('h1', {}, titulo),
    el('a', { class: 'boton secundario', href: atras }, textoAtras),
  );
}

/** Explica un error de almacenamiento o de red en palabras sencillas. */
export function describirError(error) {
  const mensaje = String(error?.message ?? '');
  if (error?.name === 'QuotaExceededError') {
    return 'No queda espacio en el dispositivo para guardar más fotos o audios. Libera espacio e inténtalo de nuevo.';
  }
  if (mensaje.includes('IndexedDB no está disponible') || error?.name === 'SecurityError') {
    return 'Este navegador no permite guardar datos de la aplicación (puede ser una ventana privada). Abre la app en una ventana normal.';
  }
  if (error?.name === 'ErrorHardware' || error?.name === 'ErrorRed') return mensaje;
  return `No se pudo completar la operación. ${mensaje}`.trim();
}

/** Reemplaza el contenido de la vista por un aviso de error. */
export function mostrarError(raiz, error, { atras = '#/adulto' } = {}) {
  console.error(error);
  raiz.replaceChildren(
    cabecera('Algo salió mal', { atras }),
    el('div', { class: 'aviso', role: 'alert' }, el('p', {}, describirError(error))),
  );
}

/** Texto que se muestra mientras se cargan los datos. */
export function cargando() {
  return el('p', { class: 'ayuda', role: 'status' }, 'Cargando…');
}

/** Campo de formulario con su etiqueta: campo('Nombre', input, 'texto de ayuda opcional'). */
export function campo(etiqueta, control, ayuda = null) {
  return el(
    'label',
    { class: 'campo' },
    el('span', { class: 'campo-etiqueta' }, etiqueta),
    control,
    ayuda ? el('span', { class: 'ayuda' }, ayuda) : null,
  );
}
