// Selector de imagen con tres caminos: foto (cámara o galería), pictograma de ARASAAC o emoji.
// Lo usan los premios de la tienda y las calcomanías propias (fase 11). La pantalla que lo usa decide cuándo guardar.
//
//   const sel = crearSelectorImagen({ texto: 'Helado', urlInicial, emojiInicial });
//   sel.elemento     -> se agrega al DOM
//   sel.leer()       -> { blob, mime, origen: 'foto'|'arasaac'|null, arasaacId, emoji, quitar }
//                       blob = imagen nueva a guardar; quitar = pidió borrar la que había
//   sel.liberar()    -> al salir de la vista

import { el } from './dom.js';
import { crearSelectorFoto } from './selector-foto.js';
import { crearMiniatura, pintarMiniatura } from './miniatura.js';
import { describirError } from './adulto.js';
import { buscarPictogramas, descargarPictograma, urlImagen, CREDITO_ARASAAC } from '../pictos.js';

const EMOJIS = ['🍦', '🍎', '🍪', '🎈', '⚽', '🧸', '🚗', '🎬', '🛝', '🚲', '📚', '🎁', '🐶', '🐱', '🌳', '⭐'];

export function crearSelectorImagen({ texto = '', urlInicial = null, emojiInicial = null } = {}) {
  let emoji = emojiInicial;
  let picto = null; // { blob, mime, arasaacId } elegido en esta pantalla
  let ultimo = null; // 'foto' | 'picto': lo último que eligió
  let numeroBusqueda = 0;
  let vivo = true;

  const vista = crearMiniatura({ url: urlInicial, emoji, texto }, { grande: true });
  let urlPicto = null;

  const foto = crearSelectorFoto({
    urlInicial,
    texto,
    alCambiar: () => {
      ultimo = 'foto';
      refrescarVista();
    },
  });

  // La vista previa muestra lo que no es foto nueva (la foto nueva ya se ve en su propio selector):
  // la imagen guardada, el pictograma elegido, el emoji o la inicial.
  function refrescarVista() {
    const fotoNueva = ultimo === 'foto' && Boolean(foto.estado.blob);
    vista.style.display = fotoNueva ? 'none' : '';
    if (fotoNueva) return;
    const url = ultimo === 'picto' ? urlPicto : foto.estado.quitar ? null : urlInicial;
    pintarMiniatura(vista, { url, emoji: url ? null : emoji, texto });
  }

  // --- pictograma ---
  const entradaBusqueda = el('input', { type: 'search', autocomplete: 'off', value: texto });
  const estadoBusqueda = el('p', { class: 'ayuda', role: 'status' });
  const cuadricula = el('div', { class: 'cuadricula-pictos' });

  function botonPicto(resultado) {
    const nombre = resultado.palabras[0] ?? String(resultado.id);
    const boton = el(
      'button',
      { type: 'button', class: 'picto', 'aria-label': `Usar el pictograma «${nombre}»`, 'aria-pressed': 'false' },
      el('img', { src: urlImagen(resultado.id, 300), alt: '', loading: 'lazy' }),
    );
    boton.addEventListener('click', async () => {
      boton.disabled = true;
      estadoBusqueda.textContent = 'Descargando el pictograma…';
      try {
        const d = await descargarPictograma(resultado.id);
        if (urlPicto) URL.revokeObjectURL(urlPicto);
        urlPicto = URL.createObjectURL(d.blob);
        picto = d;
        ultimo = 'picto';
        cuadricula.querySelectorAll('.picto').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        boton.setAttribute('aria-pressed', 'true');
        estadoBusqueda.textContent = 'Pictograma elegido.';
        refrescarVista();
      } catch (e) {
        estadoBusqueda.textContent = describirError(e);
      } finally {
        boton.disabled = false;
      }
    });
    return boton;
  }

  async function buscar() {
    const consulta = entradaBusqueda.value.trim();
    if (!consulta) {
      estadoBusqueda.textContent = 'Escribe qué quieres buscar.';
      return;
    }
    const mio = ++numeroBusqueda;
    estadoBusqueda.textContent = 'Buscando…';
    cuadricula.replaceChildren();
    try {
      const resultados = await buscarPictogramas(consulta);
      if (mio !== numeroBusqueda || !vivo) return;
      if (!resultados.length) {
        estadoBusqueda.textContent = 'No se encontraron pictogramas. Prueba con otra palabra.';
        return;
      }
      estadoBusqueda.textContent = 'Elige uno:';
      cuadricula.replaceChildren(...resultados.map(botonPicto));
    } catch (e) {
      if (mio === numeroBusqueda && vivo) estadoBusqueda.textContent = describirError(e);
    }
  }
  entradaBusqueda.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscar();
    }
  });

  // --- emoji ---
  const entradaEmoji = el('input', { type: 'text', maxlength: 16, autocomplete: 'off', placeholder: 'Pega o escribe un emoji', value: emoji ?? '', 'aria-label': 'Emoji' });
  entradaEmoji.addEventListener('input', () => {
    emoji = entradaEmoji.value.trim() || null;
    refrescarVista();
  });
  const paleta = el(
    'div',
    { class: 'paleta-emoji' },
    EMOJIS.map((e) =>
      el('button', {
        type: 'button',
        class: 'chip',
        'aria-label': `Usar el emoji ${e}`,
        onclick: () => {
          emoji = e;
          entradaEmoji.value = e;
          refrescarVista();
        },
      }, e),
    ),
  );

  const seccion = (titulo, ...hijos) => el('details', { class: 'seccion-imagen' }, el('summary', {}, titulo), ...hijos);
  const elemento = el(
    'div',
    { class: 'selector-imagen' },
    vista,
    seccion('Foto', foto.elemento),
    seccion(
      'Pictograma (ARASAAC)',
      el('div', { class: 'fila' }, el('label', { class: 'campo' }, el('span', { class: 'campo-etiqueta' }, 'Buscar pictograma'), entradaBusqueda), el('button', { type: 'button', class: 'boton chico', onclick: buscar }, 'Buscar')),
      estadoBusqueda,
      cuadricula,
      el('p', { class: 'ayuda' }, CREDITO_ARASAAC),
    ),
    seccion('Emoji', el('label', { class: 'campo' }, el('span', { class: 'campo-etiqueta' }, 'Emoji'), entradaEmoji), paleta),
  );
  refrescarVista();

  return {
    elemento,
    establecerTexto(nuevo) {
      texto = nuevo;
      foto.establecerTexto(nuevo);
      refrescarVista();
    },
    leer() {
      if (ultimo === 'picto' && picto) return { blob: picto.blob, mime: picto.mime, origen: 'arasaac', arasaacId: picto.arasaacId, emoji, quitar: false };
      if (foto.estado.blob) return { blob: foto.estado.blob, mime: foto.estado.mime, origen: 'foto', arasaacId: null, emoji, quitar: false };
      return { blob: null, mime: null, origen: null, arasaacId: null, emoji, quitar: foto.estado.quitar };
    },
    liberar() {
      vivo = false;
      foto.liberar();
      if (urlPicto) URL.revokeObjectURL(urlPicto);
      urlPicto = null;
    },
  };
}
