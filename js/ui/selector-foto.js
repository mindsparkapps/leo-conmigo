// Selector de foto: vista previa cuadrada + "Tomar foto", "Elegir de la galería" y "Quitar".
// Deja la foto ya recortada y reducida en `estado.blob`; la pantalla que lo usa decide cuándo guardarla.
//
//   const sel = crearSelectorFoto({ urlInicial, texto: 'Leo' });
//   sel.elemento   -> se agrega al DOM
//   sel.estado     -> { blob, mime, quitar }  (blob = foto nueva; quitar = pidió borrar la que había)
//   sel.liberar()  -> al salir de la vista

import { el } from './dom.js';
import { elegirImagen } from '../hardware.js';
import { prepararImagen } from '../imagenes.js';
import { crearMiniatura, pintarMiniatura } from './miniatura.js';

export function crearSelectorFoto({ urlInicial = null, texto = '', alCambiar = () => {} } = {}) {
  const estado = { blob: null, mime: null, quitar: false };
  let urlNueva = null;

  const miniatura = crearMiniatura({ url: urlInicial, texto }, { grande: true });
  const error = el('p', { class: 'error-texto', role: 'alert', hidden: true });
  const botonQuitar = el('button', { type: 'button', class: 'boton secundario chico', onclick: quitar }, 'Quitar foto');

  function urlActual() {
    if (estado.blob) return urlNueva;
    return estado.quitar ? null : urlInicial;
  }

  function refrescar() {
    const url = urlActual();
    pintarMiniatura(miniatura, { url, texto });
    botonQuitar.hidden = !url;
  }

  async function elegir(camara) {
    error.hidden = true;
    const archivo = await elegirImagen({ camara });
    if (!archivo) return;
    try {
      const { blob, mime } = await prepararImagen(archivo);
      if (urlNueva) URL.revokeObjectURL(urlNueva);
      urlNueva = URL.createObjectURL(blob);
      Object.assign(estado, { blob, mime, quitar: false });
      refrescar();
      alCambiar(estado);
    } catch (e) {
      error.textContent = e.message;
      error.hidden = false;
    }
  }

  function quitar() {
    if (urlNueva) URL.revokeObjectURL(urlNueva);
    urlNueva = null;
    Object.assign(estado, { blob: null, mime: null, quitar: urlInicial !== null });
    refrescar();
    alCambiar(estado);
  }

  const elemento = el(
    'div',
    { class: 'selector-foto' },
    miniatura,
    el(
      'div',
      { class: 'selector-foto-acciones' },
      el('button', { type: 'button', class: 'boton chico', onclick: () => elegir(true) }, 'Tomar foto'),
      el('button', { type: 'button', class: 'boton secundario chico', onclick: () => elegir(false) }, 'Elegir de la galería'),
      botonQuitar,
    ),
    error,
  );
  refrescar();

  return {
    elemento,
    estado,
    /** Cambia la inicial que se muestra mientras no hay foto (p. ej. al escribir el nombre). */
    establecerTexto(nuevo) {
      texto = nuevo;
      if (!urlActual()) refrescar();
    },
    liberar() {
      if (urlNueva) URL.revokeObjectURL(urlNueva);
      urlNueva = null;
    },
  };
}
