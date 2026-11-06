// Editor de una palabra: texto, sílabas, categoría, imagen (foto / pictograma / emoji) y voz
// (grabada por el adulto o sintética). Sirve para palabras nuevas (#/adulto/palabra/nueva)
// y para editar (#/adulto/palabra/<id>).

import { el } from '../ui/dom.js';
import { cabecera, campo, cargando, mostrarError, describirError } from '../ui/adulto.js';
import { crearMiniatura, pintarMiniatura } from '../ui/miniatura.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { guardarMedio, borrarMedio, urlDeMedio, liberarUrls } from '../medios.js';
import { elegirImagen, soporte, motivoSinGrabacion, crearGrabadora } from '../hardware.js';
import { prepararImagen } from '../imagenes.js';
import { buscarPictogramas, descargarPictograma, urlImagen, CREDITO_ARASAAC } from '../pictos.js';
import {
  desbloquearAudio, detener, hablarTexto, hayVozSintetica, reproducirBlob, vozSinteticaElegida,
} from '../audio.js';
import { silabear, unirSilabas } from '../core/silabas.js';
import { nuevaPalabra } from '../core/modelos.js';
import {
  CATEGORIAS, MAX_LARGO_PALABRA, TIPOS, parsearSilabas, siguienteOrden, silabasForman, validarTexto,
} from '../core/vocabulario.js';

export const titulo = 'Palabra · Leo Conmigo';

const ATRAS = '#/adulto/vocabulario';
const MAX_GRABACION_MS = 8000;
const EMOJIS = [
  '🍎', '🍌', '🍞', '🥛', '💧', '🍲', '🧀', '🍪', '🏠', '🛏️', '🪑', '🚪',
  '🐶', '🐱', '🐦', '🐟', '🐮', '🐻', '⚽', '🚗', '🎈', '🧸', '📖', '👕',
  '👩', '👨', '👵', '👴', '👶', '✋', '👁️', '👃', '👄', '🦶', '😋', '😴',
];

export function montar(contenedor, { ruta, ir }) {
  const id = ruta.split('/')[3];
  const raiz = el('section', { class: 'vista-adulto' }, cabecera('Palabra', { atras: ATRAS }), cargando());
  contenedor.append(raiz);
  const limpiezas = [];
  let vivo = true;
  iniciar(raiz, id, ir, limpiezas, () => vivo).catch((error) => mostrarError(raiz, error, { atras: ATRAS }));
  return () => {
    vivo = false;
    detener();
    limpiezas.forEach((f) => f());
    liberarUrls();
  };
}

async function iniciar(raiz, id, ir, limpiezas, estaVivo) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!perfil) {
    raiz.replaceChildren(
      cabecera('Palabra', { atras: ATRAS }),
      el('div', { class: 'panel' }, el('p', {}, 'Primero crea el perfil del niño.')),
      el('a', { class: 'boton', href: '#/adulto/asistente' }, 'Crear el primer perfil'),
    );
    return;
  }
  const palabras = await store.listar('palabras', { perfilId: perfil.id });
  const esNueva = id === 'nueva';
  const palabra = esNueva ? null : palabras.find((p) => p.id === id);
  if (!esNueva && !palabra) throw new Error('No se encontró la palabra.');
  if (!estaVivo()) return;
  const velocidad = perfil.ajustes?.velocidadVoz ?? 1;

  // ================= Texto y sílabas =================
  const entradaTexto = el('input', { type: 'text', maxlength: MAX_LARGO_PALABRA, autocomplete: 'off', value: palabra?.texto ?? '' });
  const errorTexto = el('p', { class: 'error-texto', role: 'alert', hidden: true });
  const entradaSilabas = el('input', { type: 'text', autocomplete: 'off', value: (palabra?.silabas ?? []).join('-') });
  const errorSilabas = el('p', { class: 'error-texto', role: 'alert', hidden: true });
  let silabasEditadas = Boolean(palabra) && unirSilabas(palabra.silabas) !== unirSilabas(silabear(palabra.texto));

  const mensajeSilabas = () => `Las sílabas deben formar la palabra «${entradaTexto.value.trim()}».`;
  const revisarSilabas = () => {
    const ok = silabasForman(parsearSilabas(entradaSilabas.value), entradaTexto.value) || !entradaSilabas.value.trim();
    errorSilabas.textContent = ok ? '' : mensajeSilabas();
    errorSilabas.hidden = ok;
  };
  const sugerirSilabas = () => {
    entradaSilabas.value = unirSilabas(silabear(entradaTexto.value));
    silabasEditadas = false;
    errorSilabas.hidden = true;
  };
  entradaTexto.addEventListener('input', () => {
    errorTexto.hidden = true;
    if (silabasEditadas) revisarSilabas();
    else sugerirSilabas();
    actualizarVistaImagen();
  });
  entradaSilabas.addEventListener('input', () => {
    silabasEditadas = true;
    revisarSilabas();
  });

  const selCategoria = el(
    'select',
    {},
    CATEGORIAS.map((c) => el('option', { value: c.id, selected: c.id === (palabra?.categoria ?? 'otras') }, c.nombre)),
  );
  const selTipo = el(
    'select',
    {},
    TIPOS.map((t) => el('option', { value: t.id, selected: t.id === (palabra?.tipo ?? 'sustantivo') }, t.nombre)),
  );

  const panelTexto = el(
    'div',
    { class: 'panel' },
    el('h2', {}, 'La palabra'),
    campo('Palabra', entradaTexto),
    errorTexto,
    campo('Sílabas', entradaSilabas, 'Separadas con guiones. Se proponen solas y puedes corregirlas.'),
    errorSilabas,
    el('button', { type: 'button', class: 'boton secundario chico', onclick: sugerirSilabas }, 'Volver a las sílabas automáticas'),
    el('div', { class: 'fila fila-campos' }, campo('Categoría', selCategoria), campo('Tipo', selTipo)),
  );

  // ================= Imagen =================
  // La imagen principal (foto o pictograma) y el emoji son independientes: una palabra puede tener
  // una foto Y un emoji. El emoji se muestra cuando no hay foto, y sirve de «dibujo» para emparejar (P2).
  let seleccion = palabra?.medioImagenId ? { tipo: 'mantener' } : { tipo: 'ninguna' };
  let emojiElegido = palabra?.emoji ?? null;
  let urlNueva = null;
  const soltarUrlNueva = () => {
    if (urlNueva) URL.revokeObjectURL(urlNueva);
    urlNueva = null;
  };
  limpiezas.push(soltarUrlNueva);

  // El pictograma «de apoyo» (medioSimboloId) va al lado de la foto para la actividad «misma cosa» (P2)
  let simbolo = palabra?.medioSimboloId ? { tipo: 'mantener' } : { tipo: 'ninguna' };
  let urlSimboloNuevo = null;
  const soltarUrlSimbolo = () => {
    if (urlSimboloNuevo) URL.revokeObjectURL(urlSimboloNuevo);
    urlSimboloNuevo = null;
  };
  limpiezas.push(soltarUrlSimbolo);

  const vistaImagen = crearMiniatura({}, { grande: true });
  const descripcionImagen = el('p', { class: 'ayuda', role: 'status' });
  async function actualizarVistaImagen() {
    const texto = entradaTexto.value;
    const emoji = emojiElegido;
    const sufijoEmoji = emoji ? ` Emoji: ${emoji}.` : '';
    if (seleccion.tipo === 'mantener') {
      pintarMiniatura(vistaImagen, { url: await urlDeMedio(store, palabra.medioImagenId), emoji, texto });
      descripcionImagen.textContent = (palabra.arasaacId ? 'Imagen actual: pictograma de ARASAAC.' : 'Imagen actual: foto.') + sufijoEmoji;
    } else if (seleccion.tipo === 'nueva') {
      pintarMiniatura(vistaImagen, { url: urlNueva, emoji, texto });
      descripcionImagen.textContent = (seleccion.origen === 'arasaac' ? 'Imagen elegida: pictograma de ARASAAC.' : 'Imagen elegida: foto.') + sufijoEmoji;
    } else if (emoji) {
      pintarMiniatura(vistaImagen, { emoji, texto });
      descripcionImagen.textContent = 'Solo emoji. Una foto real se aprende mucho más fácil.';
    } else {
      pintarMiniatura(vistaImagen, { texto });
      descripcionImagen.textContent = 'Sin imagen. Una palabra con foto real se aprende mucho más fácil.';
    }
  }
  function elegirImagenNueva({ blob, mime, origen, arasaacId = null }) {
    soltarUrlNueva();
    urlNueva = URL.createObjectURL(blob);
    seleccion = { tipo: 'nueva', blob, mime, origen, arasaacId };
    actualizarVistaImagen();
  }

  const vistaSimbolo = crearMiniatura({}, { grande: false });
  const descripcionSimbolo = el('p', { class: 'ayuda', role: 'status' });
  const botonQuitarSimbolo = el('button', {
    type: 'button',
    class: 'boton secundario chico',
    onclick: () => {
      soltarUrlSimbolo();
      simbolo = { tipo: 'ninguna' };
      actualizarVistaSimbolo();
    },
  }, 'Quitar el dibujo');
  async function actualizarVistaSimbolo() {
    const texto = entradaTexto.value;
    let url = null;
    if (simbolo.tipo === 'mantener') url = await urlDeMedio(store, palabra.medioSimboloId);
    else if (simbolo.tipo === 'nueva') url = urlSimboloNuevo;
    pintarMiniatura(vistaSimbolo, url ? { url, texto } : { emoji: emojiElegido, texto });
    botonQuitarSimbolo.hidden = simbolo.tipo === 'ninguna';
    descripcionSimbolo.textContent = url
      ? 'Dibujo para «misma cosa»: pictograma de ARASAAC.'
      : emojiElegido
        ? 'Para «misma cosa» se usará el emoji. Puedes elegir un pictograma en su lugar.'
        : 'Sin dibujo: la actividad «misma cosa» no usará esta palabra.';
  }
  function elegirSimboloNuevo({ blob, mime, arasaacId = null }) {
    soltarUrlSimbolo();
    urlSimboloNuevo = URL.createObjectURL(blob);
    simbolo = { tipo: 'nueva', blob, mime, arasaacId };
    actualizarVistaSimbolo();
  }

  // --- pestaña Foto ---
  const errorFoto = el('p', { class: 'error-texto', role: 'alert', hidden: true });
  async function tomarFoto(camara) {
    errorFoto.hidden = true;
    const archivo = await elegirImagen({ camara });
    if (!archivo) return;
    try {
      const { blob, mime } = await prepararImagen(archivo);
      elegirImagenNueva({ blob, mime, origen: 'foto' });
    } catch (e) {
      errorFoto.textContent = e.message;
      errorFoto.hidden = false;
    }
  }
  const panelFoto = el(
    'div',
    { class: 'panel-pestana' },
    el(
      'div',
      { class: 'acciones' },
      el('button', { type: 'button', class: 'boton', onclick: () => tomarFoto(true) }, 'Tomar foto'),
      el('button', { type: 'button', class: 'boton secundario', onclick: () => tomarFoto(false) }, 'Elegir de la galería'),
    ),
    errorFoto,
  );

  // --- pestaña Pictograma ---
  const entradaBusqueda = el('input', { type: 'search', autocomplete: 'off', value: palabra?.busquedaPicto ?? palabra?.texto ?? '' });
  const estadoBusqueda = el('p', { class: 'ayuda', role: 'status' });
  const cuadricula = el('div', { class: 'cuadricula-pictos' });
  let busquedaHecha = false;
  let numeroBusqueda = 0;

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
        if (selDestinoPicto.value === 'simbolo') elegirSimboloNuevo({ blob: d.blob, mime: d.mime, arasaacId: d.arasaacId });
        else elegirImagenNueva({ blob: d.blob, mime: d.mime, origen: 'arasaac', arasaacId: d.arasaacId });
        cuadricula.querySelectorAll('.picto').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        boton.setAttribute('aria-pressed', 'true');
        estadoBusqueda.textContent = 'Pictograma elegido. Ya queda guardado para usarlo sin conexión.';
      } catch (e) {
        estadoBusqueda.textContent = describirError(e);
      } finally {
        boton.disabled = false;
      }
    });
    return boton;
  }

  async function buscar() {
    busquedaHecha = true;
    const texto = entradaBusqueda.value.trim() || entradaTexto.value.trim();
    if (!texto) {
      estadoBusqueda.textContent = 'Escribe qué quieres buscar.';
      return;
    }
    const mio = ++numeroBusqueda;
    estadoBusqueda.textContent = 'Buscando…';
    cuadricula.replaceChildren();
    try {
      const resultados = await buscarPictogramas(texto);
      if (mio !== numeroBusqueda || !estaVivo()) return;
      if (!resultados.length) {
        estadoBusqueda.textContent = 'No se encontraron pictogramas. Prueba con otra palabra.';
        return;
      }
      estadoBusqueda.textContent = 'Toca el que quieras usar:';
      cuadricula.replaceChildren(...resultados.map(botonPicto));
    } catch (e) {
      if (mio === numeroBusqueda) estadoBusqueda.textContent = describirError(e);
    }
  }
  entradaBusqueda.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); buscar(); }
  });
  const selDestinoPicto = el(
    'select',
    {},
    el('option', { value: 'imagen' }, 'La imagen principal de la palabra'),
    el('option', { value: 'simbolo' }, 'Un dibujo para emparejar con su foto («misma cosa»)'),
  );
  const panelPicto = el(
    'div',
    { class: 'panel-pestana' },
    campo('Usar el pictograma como', selDestinoPicto, 'Con una foto y un dibujo de la misma cosa, el niño puede practicar a emparejarlos.'),
    el('div', { class: 'fila fila-imagen' }, vistaSimbolo, descripcionSimbolo, botonQuitarSimbolo),
    el('div', { class: 'fila' }, campo('Buscar pictograma', entradaBusqueda), el('button', { type: 'button', class: 'boton chico', onclick: buscar }, 'Buscar')),
    estadoBusqueda,
    cuadricula,
    el('p', { class: 'ayuda creditos' }, CREDITO_ARASAAC),
  );

  // --- pestaña Emoji ---
  const entradaEmoji = el('input', {
    type: 'text', maxlength: 16, autocomplete: 'off', placeholder: 'Pega o escribe un emoji',
    value: emojiElegido ?? '',
  });
  entradaEmoji.addEventListener('input', () => {
    emojiElegido = entradaEmoji.value.trim() || null;
    actualizarVistaImagen();
    actualizarVistaSimbolo();
  });
  const panelEmoji = el(
    'div',
    { class: 'panel-pestana' },
    campo('Emoji', entradaEmoji, 'Se muestra cuando la palabra no tiene foto. Si tiene foto, el emoji sirve de dibujo para «misma cosa».'),
    el(
      'div',
      { class: 'paleta-emoji' },
      EMOJIS.map((e) => el('button', {
        type: 'button',
        class: 'chip',
        'aria-label': `Usar el emoji ${e}`,
        onclick: () => {
          entradaEmoji.value = e;
          entradaEmoji.dispatchEvent(new Event('input'));
        },
      }, e)),
    ),
  );

  // --- pestaña Sin imagen ---
  const panelNinguna = el(
    'div',
    { class: 'panel-pestana' },
    el('button', {
      type: 'button',
      class: 'boton secundario',
      onclick: () => {
        soltarUrlNueva();
        soltarUrlSimbolo();
        entradaEmoji.value = '';
        emojiElegido = null;
        seleccion = { tipo: 'ninguna' };
        simbolo = { tipo: 'ninguna' };
        actualizarVistaImagen();
        actualizarVistaSimbolo();
      },
    }, 'Quitar la foto, el emoji y el dibujo'),
  );

  // --- pestañas ---
  const PESTANAS = [
    ['foto', 'Foto', panelFoto],
    ['picto', 'Pictograma', panelPicto],
    ['emoji', 'Emoji', panelEmoji],
    ['ninguna', 'Sin imagen', panelNinguna],
  ];
  const botonesPestana = {};
  function mostrarPestana(nombre) {
    for (const [clave, , panel] of PESTANAS) {
      panel.hidden = clave !== nombre;
      botonesPestana[clave].setAttribute('aria-selected', String(clave === nombre));
      botonesPestana[clave].classList.toggle('activa', clave === nombre);
    }
    if (nombre === 'picto' && !busquedaHecha) buscar();
  }
  const barraPestanas = el(
    'div',
    { class: 'pestanas', role: 'tablist', 'aria-label': 'De dónde sale la imagen' },
    PESTANAS.map(([clave, nombre]) => {
      const boton = el('button', { type: 'button', class: 'pestana', role: 'tab', onclick: () => mostrarPestana(clave) }, nombre);
      botonesPestana[clave] = boton;
      return boton;
    }),
  );

  const panelImagen = el(
    'div',
    { class: 'panel' },
    el('h2', {}, 'La imagen'),
    el('div', { class: 'fila fila-imagen' }, vistaImagen, descripcionImagen),
    barraPestanas,
    ...PESTANAS.map(([, , panel]) => panel),
  );

  // ================= Voz =================
  const motivo = motivoSinGrabacion(soporte());
  let audio = palabra?.medioAudioId ? { origen: 'medio' } : { origen: 'ninguna' };
  let grabadora = null;
  let reloj = null;
  let inicioGrabacion = 0;

  const estadoVoz = el('p', { class: 'ayuda', role: 'status' });
  const errorVoz = el('p', { class: 'error-texto', role: 'alert', hidden: true });
  const infoVozSintetica = el('p', { class: 'ayuda' });
  const botonGrabar = el('button', { type: 'button', class: 'boton' }, '🎙️ Grabar mi voz');
  const botonEscuchar = el('button', { type: 'button', class: 'boton secundario chico' }, '▶ Escuchar mi grabación');
  const botonBorrar = el('button', { type: 'button', class: 'boton secundario chico' }, 'Borrar grabación');
  const botonSintetica = el('button', { type: 'button', class: 'boton secundario chico' }, '🔊 Escuchar la voz sintética');

  let vozSinteticaDisponible = hayVozSintetica(); // se confirma más abajo: puede haber síntesis pero ninguna voz en español

  function refrescarVoz() {
    const hay = audio.origen !== 'ninguna';
    botonEscuchar.hidden = !hay;
    botonBorrar.hidden = !hay;
    if (grabadora) return;
    if (hay) estadoVoz.textContent = 'Se usará tu voz.';
    else if (vozSinteticaDisponible) estadoVoz.textContent = 'Se usará la voz sintética.';
    else estadoVoz.textContent = 'Por ahora esta palabra no tendrá sonido: graba tu voz para que se escuche.';
  }

  async function terminarGrabacion() {
    if (!grabadora) return;
    const g = grabadora;
    grabadora = null;
    clearInterval(reloj);
    botonGrabar.textContent = '🎙️ Grabar mi voz';
    try {
      const r = await g.detener();
      if (!r || r.blob.size < 500 || r.ms < 300) {
        errorVoz.textContent = 'No se escuchó nada. Acércate al micrófono e inténtalo de nuevo.';
        errorVoz.hidden = false;
      } else {
        audio = { origen: 'nueva', blob: r.blob, mime: r.mime };
      }
    } catch (e) {
      errorVoz.textContent = describirError(e);
      errorVoz.hidden = false;
    }
    refrescarVoz();
  }

  async function alternarGrabacion() {
    errorVoz.hidden = true;
    desbloquearAudio();
    detener();
    if (grabadora?.grabando) { await terminarGrabacion(); return; }
    botonGrabar.disabled = true;
    try {
      grabadora = await crearGrabadora({ maxMs: MAX_GRABACION_MS });
    } catch (e) {
      errorVoz.textContent = describirError(e);
      errorVoz.hidden = false;
      botonGrabar.disabled = false;
      return;
    }
    botonGrabar.disabled = false;
    botonGrabar.textContent = '⏹ Detener';
    inicioGrabacion = Date.now();
    grabadora.iniciar(() => { terminarGrabacion(); });
    const actualizar = () => {
      estadoVoz.textContent = `Grabando… ${Math.floor((Date.now() - inicioGrabacion) / 1000)} s. Di la palabra con claridad.`;
    };
    actualizar();
    reloj = setInterval(actualizar, 250);
  }
  limpiezas.push(() => {
    clearInterval(reloj);
    grabadora?.cancelar();
  });

  botonGrabar.addEventListener('click', alternarGrabacion);
  botonEscuchar.addEventListener('click', async () => {
    desbloquearAudio();
    errorVoz.hidden = true;
    let blob = audio.origen === 'nueva' ? audio.blob : null;
    if (!blob && audio.origen === 'medio') blob = (await store.obtener('medios', palabra.medioAudioId))?.blob ?? null;
    if (!blob || !(await reproducirBlob(blob, { velocidad }))) {
      errorVoz.textContent = 'No se pudo reproducir la grabación en este dispositivo.';
      errorVoz.hidden = false;
    }
  });
  botonBorrar.addEventListener('click', () => {
    audio = { origen: 'ninguna' };
    refrescarVoz();
  });
  botonSintetica.addEventListener('click', async () => {
    desbloquearAudio();
    errorVoz.hidden = true;
    const ok = await hablarTexto(entradaTexto.value.trim() || palabra?.texto || '', { velocidad });
    if (!ok) {
      errorVoz.textContent = 'Este dispositivo no pudo reproducir la voz sintética.';
      errorVoz.hidden = false;
    }
  });

  if (motivo) {
    botonGrabar.disabled = true;
    errorVoz.textContent = motivo;
    errorVoz.hidden = false;
  }
  if (!hayVozSintetica()) {
    botonSintetica.hidden = true;
    infoVozSintetica.textContent = 'Este navegador no tiene voz sintética: graba tu voz para que la palabra se escuche.';
  } else {
    vozSinteticaElegida().then((voz) => {
      if (!estaVivo()) return;
      if (!voz) {
        vozSinteticaDisponible = false;
        botonSintetica.hidden = true;
        infoVozSintetica.textContent = 'Este dispositivo no tiene voz sintética en español: graba tu voz para que la palabra se escuche.';
        refrescarVoz();
      } else {
        const chilena = /^es[-_]cl$/i.test(voz.lang);
        infoVozSintetica.textContent = `Voz sintética: ${voz.nombre} (${voz.lang})${chilena ? '' : ' — no es español de Chile, pero es la más parecida disponible.'}`;
      }
    });
  }

  const panelVoz = el(
    'div',
    { class: 'panel' },
    el('h2', {}, 'La voz'),
    el('p', { class: 'ayuda' }, 'Tu propia voz es lo mejor: es la que el niño conoce. Si no grabas, se usa una voz sintética.'),
    el('div', { class: 'acciones' }, botonGrabar, botonEscuchar, botonBorrar),
    estadoVoz,
    errorVoz,
    el('div', { class: 'acciones' }, botonSintetica),
    infoVozSintetica,
  );

  // ================= Guardar y quitar =================
  const errorGeneral = el('p', { class: 'error-texto', role: 'alert', hidden: true });
  const botonGuardar = el('button', { type: 'button', class: 'boton' }, esNueva ? 'Agregar palabra' : 'Guardar cambios');

  async function guardar() {
    errorGeneral.hidden = true;
    if (grabadora?.grabando) await terminarGrabacion();

    const texto = entradaTexto.value.trim();
    const errorDeTexto = validarTexto(texto, palabras, { exceptoId: palabra?.id });
    if (errorDeTexto) {
      errorTexto.textContent = errorDeTexto;
      errorTexto.hidden = false;
      entradaTexto.focus();
      return;
    }
    const silabas = parsearSilabas(entradaSilabas.value);
    if (!silabasForman(silabas, texto)) {
      errorSilabas.textContent = mensajeSilabas();
      errorSilabas.hidden = false;
      entradaSilabas.focus();
      return;
    }

    botonGuardar.disabled = true;
    try {
      const campos = { texto, silabas, categoria: selCategoria.value, tipo: selTipo.value };
      let medioImagenId = palabra?.medioImagenId ?? null;
      let medioSimboloId = palabra?.medioSimboloId ?? null;
      let arasaacId = palabra?.arasaacId ?? null;
      const emoji = emojiElegido;
      let medioAudioId = palabra?.medioAudioId ?? null;

      if (seleccion.tipo === 'nueva') {
        const medio = await guardarMedio(store, { tipo: 'imagen', blob: seleccion.blob, mime: seleccion.mime, origen: seleccion.origen, arasaacId: seleccion.arasaacId });
        await borrarMedio(store, medioImagenId);
        medioImagenId = medio.id;
        arasaacId = seleccion.arasaacId;
      } else if (seleccion.tipo === 'ninguna') {
        await borrarMedio(store, medioImagenId);
        medioImagenId = null;
        arasaacId = null;
      }

      if (simbolo.tipo === 'nueva') {
        const medio = await guardarMedio(store, { tipo: 'imagen', blob: simbolo.blob, mime: simbolo.mime, origen: 'arasaac', arasaacId: simbolo.arasaacId });
        await borrarMedio(store, medioSimboloId);
        medioSimboloId = medio.id;
      } else if (simbolo.tipo === 'ninguna') {
        await borrarMedio(store, medioSimboloId);
        medioSimboloId = null;
      }

      if (audio.origen === 'nueva') {
        const medio = await guardarMedio(store, { tipo: 'audio', blob: audio.blob, mime: audio.mime, origen: 'grabacion' });
        await borrarMedio(store, medioAudioId);
        medioAudioId = medio.id;
      } else if (audio.origen === 'ninguna') {
        await borrarMedio(store, medioAudioId);
        medioAudioId = null;
      }

      const datos = { ...campos, medioImagenId, medioSimboloId, arasaacId, emoji, medioAudioId };
      if (palabra) {
        await store.guardar('palabras', { ...palabra, ...datos });
      } else {
        const registro = nuevaPalabra({ perfilId: perfil.id, orden: siguienteOrden(palabras), ...datos });
        await store.guardar('palabras', registro);
      }
      ir('/adulto/vocabulario');
    } catch (e) {
      console.error(e);
      errorGeneral.textContent = describirError(e);
      errorGeneral.hidden = false;
      botonGuardar.disabled = false;
    }
  }
  botonGuardar.addEventListener('click', guardar);

  async function quitarPalabra() {
    if (!palabra) return;
    if (!globalThis.confirm(`¿Quitar «${palabra.texto}» de la lista? Se borrarán también su imagen y su voz.`)) return;
    try {
      await borrarMedio(store, palabra.medioImagenId);
      await borrarMedio(store, palabra.medioSimboloId);
      await borrarMedio(store, palabra.medioAudioId);
      await store.borrar('palabras', palabra.id);
      ir('/adulto/vocabulario');
    } catch (e) {
      errorGeneral.textContent = describirError(e);
      errorGeneral.hidden = false;
    }
  }

  // ================= Montaje =================
  raiz.replaceChildren(
    cabecera(esNueva ? 'Nueva palabra' : 'Editar palabra', { atras: ATRAS, textoAtras: 'Cancelar' }),
    panelTexto,
    panelImagen,
    panelVoz,
    errorGeneral,
    el(
      'div',
      { class: 'acciones' },
      botonGuardar,
      esNueva ? null : el('button', { type: 'button', class: 'boton secundario', onclick: quitarPalabra }, 'Quitar esta palabra'),
    ),
  );
  if (esNueva) sugerirSilabas();
  refrescarVoz();
  actualizarVistaImagen();
  actualizarVistaSimbolo();
  mostrarPestana(!palabra?.medioImagenId && emojiElegido ? 'emoji' : palabra?.arasaacId ? 'picto' : 'foto');
  if (esNueva) entradaTexto.focus();
}
