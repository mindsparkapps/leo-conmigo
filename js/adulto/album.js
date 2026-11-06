// Álbum y monedas (modo adulto, fase 11): tamaño del álbum, monedas por álbum, qué calcomanías están en juego,
// calcomanías propias y los álbumes ya completos.

import { el } from '../ui/dom.js';
import { cabecera, campo, cargando, describirError, mostrarError } from '../ui/adulto.js';
import { crearSelectorImagen } from '../ui/selector-imagen.js';
import { crearMiniatura } from '../ui/miniatura.js';
import { crearCofre } from '../ui/moneda.js';
import { mapaDePropias, nodoDeCalcomania } from '../ui/calcomania.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { borrarMedio, guardarMedio, liberarUrls, urlDeMedio } from '../medios.js';
import { cargarMonedas } from '../albumes.js';
import { MONEDAS_MAX, MONEDAS_MIN, TAMANO_MAX, TAMANO_MIN, normalizarAlbum } from '../core/album.js';
import { CALCOMANIAS, codigoDePropia } from '../core/calcomanias.js';

export const titulo = 'Álbum y monedas · Leo Conmigo';

export function montar(contenedor) {
  const raiz = el('section', { class: 'vista-adulto' }, cabecera('Álbum y monedas'), cargando());
  contenedor.append(raiz);
  let vivo = true;
  let selector = null;

  async function pintar() {
    const store = await obtenerStore();
    const perfil = await perfilActivo();
    if (!vivo) return;
    if (!perfil) {
      raiz.replaceChildren(cabecera('Álbum y monedas'), el('div', { class: 'panel' }, el('p', {}, 'Primero crea el perfil del niño.'), el('a', { class: 'boton', href: '#/adulto/asistente' }, 'Crear el perfil')));
      return;
    }
    const datos = await cargarMonedas(store, perfil);
    const propias = mapaDePropias(datos.propias);
    const actualesNodos = (await Promise.all(datos.actual.codigos.map((c) => nodoDeCalcomania(store, c, propias)))).filter(Boolean);
    const miniaturasPropias = new Map(await Promise.all([...propias.values()].map(async (p) => [p.id, await urlDeMedio(store, p.medioImagenId)])));
    if (!vivo) return;

    // ----- ajustes del álbum -----
    const config = datos.album;
    const entradaTamano = el('input', { type: 'number', min: TAMANO_MIN, max: TAMANO_MAX, value: config.tamano, inputmode: 'numeric' });
    const entradaMonedas = el('input', { type: 'number', min: MONEDAS_MIN, max: MONEDAS_MAX, value: config.monedasPorAlbum, inputmode: 'numeric' });
    const enJuego = new Set(config.codigos ?? [...CALCOMANIAS.map((c) => c.codigo), ...[...propias.keys()].map(codigoDePropia)]);
    const mensaje = el('p', { class: 'ayuda', role: 'status' });

    const todos = [
      ...CALCOMANIAS.map((c) => ({ codigo: c.codigo, nombre: c.nombre, url: `data/calcomanias/${c.codigo}.svg` })),
      ...[...propias.values()].map((p) => ({ codigo: codigoDePropia(p.id), nombre: p.nombre, url: miniaturasPropias.get(p.id), emoji: p.emoji })),
    ];
    const casillas = new Map();
    const cuadricula = el(
      'div',
      { class: 'casillas-calcomanias' },
      todos.map((c) => {
        const casilla = el('input', { type: 'checkbox', checked: enJuego.has(c.codigo) });
        casillas.set(c.codigo, casilla);
        const dibujo = c.url ? el('img', { src: c.url, alt: '', draggable: 'false' }) : el('span', { class: 'calcomania-emoji' }, c.emoji ?? '★');
        return el('label', { class: 'casilla-calcomania' }, casilla, dibujo, el('span', {}, c.nombre));
      }),
    );
    const marcar = (valor) => casillas.forEach((c) => { c.checked = valor; });

    async function guardarAjustes() {
      const elegidas = todos.filter((c) => casillas.get(c.codigo).checked).map((c) => c.codigo);
      const tamano = Number(entradaTamano.value);
      const monedas = Number(entradaMonedas.value);
      if (!Number.isInteger(tamano) || tamano < TAMANO_MIN || tamano > TAMANO_MAX) {
        mensaje.textContent = `El tamaño del álbum va de ${TAMANO_MIN} a ${TAMANO_MAX}.`;
        return;
      }
      if (!Number.isInteger(monedas) || monedas < MONEDAS_MIN || monedas > MONEDAS_MAX) {
        mensaje.textContent = `Las monedas por álbum van de ${MONEDAS_MIN} a ${MONEDAS_MAX}.`;
        return;
      }
      if (elegidas.length < tamano) {
        mensaje.textContent = `Elige al menos ${tamano} calcomanías (ahora hay ${elegidas.length}) o achica el álbum.`;
        return;
      }
      const todasMarcadas = elegidas.length === todos.length;
      try {
        await store.guardar('perfiles', { ...perfil, album: normalizarAlbum({ tamano, monedasPorAlbum: monedas, codigos: todasMarcadas ? null : elegidas }) });
        mensaje.textContent = 'Guardado. Rige desde la próxima calcomanía; los álbumes ya completos no cambian.';
        await pintar();
      } catch (error) {
        mensaje.textContent = describirError(error);
      }
    }

    // ----- calcomanías propias -----
    const entradaNombre = el('input', { type: 'text', maxlength: 30, autocomplete: 'off' });
    selector?.liberar();
    selector = crearSelectorImagen({ texto: '' });
    const mensajePropia = el('p', { class: 'ayuda', role: 'status' });

    async function agregarPropia() {
      const nombre = entradaNombre.value.trim();
      const imagen = selector.leer();
      if (!nombre) { mensajePropia.textContent = 'Ponle un nombre.'; return; }
      if (!imagen.blob && !imagen.emoji) { mensajePropia.textContent = 'Elige una foto, un pictograma o un emoji.'; return; }
      try {
        const medio = imagen.blob ? await guardarMedio(store, { tipo: 'imagen', blob: imagen.blob, mime: imagen.mime, origen: imagen.origen, arasaacId: imagen.arasaacId }) : null;
        await store.guardar('calcomaniasPropias', { perfilId: perfil.id, nombre, medioImagenId: medio?.id ?? null, arasaacId: imagen.arasaacId, emoji: imagen.emoji });
        await pintar();
      } catch (error) {
        mensajePropia.textContent = describirError(error);
      }
    }

    async function quitarPropia(propia) {
      if (!window.confirm(`¿Quitar la calcomanía «${propia.nombre}»? Si el niño ya la ganó, desaparece de sus álbumes.`)) return;
      try {
        await store.borrar('calcomaniasPropias', propia.id);
        await borrarMedio(store, propia.medioImagenId);
        await pintar();
      } catch (error) {
        mensajePropia.textContent = describirError(error);
      }
    }

    const listaPropias = [...propias.values()].map((p) =>
      el(
        'li',
        { class: 'fila-contenido' },
        crearMiniatura({ url: miniaturasPropias.get(p.id), emoji: p.emoji, texto: p.nombre }),
        el('div', { class: 'fila-texto' }, el('strong', {}, p.nombre)),
        el('button', { type: 'button', class: 'boton secundario chico', 'aria-label': `Quitar la calcomanía ${p.nombre}`, onclick: () => quitarPropia(p) }, 'Quitar'),
      ),
    );

    raiz.replaceChildren(
      cabecera('Álbum y monedas'),
      el(
        'div',
        { class: 'panel' },
        el('h2', {}, `Álbum ${datos.actual.numero} (${datos.actual.codigos.length} de ${config.tamano})`),
        actualesNodos.length
          ? el('div', { class: 'album album-adulto', 'aria-label': 'Calcomanías del álbum actual' }, actualesNodos)
          : el('p', { class: 'ayuda' }, 'Aún no tiene calcomanías en este álbum.'),
        el('p', { class: 'ayuda' }, `Álbumes completos: ${datos.completos.length}. Cada sesión terminada da una calcomanía; al llenar el álbum el niño gana ${config.monedasPorAlbum} monedas de oro y empieza otro álbum vacío.`),
        el('div', { class: 'fila-contenido' }, crearCofre({ saldo: datos.saldo }), el('a', { class: 'boton secundario', href: '#/adulto/tienda' }, 'Ir a la tienda')),
      ),
      el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Cómo es el álbum'),
        el('div', { class: 'fila' }, campo('Calcomanías por álbum', entradaTamano, `De ${TAMANO_MIN} a ${TAMANO_MAX}`), campo('Monedas de oro por álbum', entradaMonedas, `De ${MONEDAS_MIN} a ${MONEDAS_MAX}`)),
        el('h3', {}, 'Calcomanías en juego'),
        el('p', { class: 'ayuda' }, 'Solo salen las marcadas. Tiene que haber al menos tantas como calcomanías por álbum.'),
        el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'boton secundario chico', onclick: () => marcar(true) }, 'Marcar todas'), el('button', { type: 'button', class: 'boton secundario chico', onclick: () => marcar(false) }, 'Quitar todas')),
        cuadricula,
        mensaje,
        el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'boton', onclick: guardarAjustes }, 'Guardar')),
      ),
      el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Mis calcomanías propias'),
        el('p', { class: 'ayuda' }, 'Crea calcomanías con una foto (su mascota, un familiar), un pictograma o un emoji. Si arriba están todas las calcomanías marcadas, las nuevas entran solas al juego; si no, márcalas arriba y guarda.'),
        listaPropias.length ? el('ul', { class: 'lista-simple' }, listaPropias) : el('p', { class: 'ayuda' }, 'Todavía no hay ninguna.'),
        campo('Nombre', entradaNombre),
        selector.elemento,
        mensajePropia,
        el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'boton', onclick: agregarPropia }, 'Agregar calcomanía')),
      ),
    );
  }

  pintar().catch((error) => mostrarError(raiz, error));
  return () => {
    vivo = false;
    selector?.liberar();
    liberarUrls();
  };
}
