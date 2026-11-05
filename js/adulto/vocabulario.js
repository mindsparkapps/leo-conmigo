// Lista de palabras del niño activo: orden de introducción, activar/desactivar, escuchar y editar.

import { el } from '../ui/dom.js';
import { cabecera, cargando, mostrarError, describirError } from '../ui/adulto.js';
import { crearMiniatura } from '../ui/miniatura.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { urlDeMedio, liberarUrls } from '../medios.js';
import { decirPalabra, desbloquearAudio, detener } from '../audio.js';
import {
  armarPalabrasDelAsistente, agruparPorCategoria, clavePalabra, mover, nombreDeCategoria, ordenadas,
} from '../core/vocabulario.js';

export const titulo = 'Vocabulario · Leo Conmigo';

export function montar(contenedor) {
  const raiz = el('section', { class: 'vista-adulto' }, cabecera('Vocabulario'), cargando());
  contenedor.append(raiz);
  let vivo = true;
  pintar(raiz, () => vivo).catch((error) => mostrarError(raiz, error));
  return () => {
    vivo = false;
    detener();
    liberarUrls();
  };
}

async function cargarCatalogo() {
  const respuesta = await fetch('data/vocabulario-inicial.json');
  if (!respuesta.ok) throw new Error('No se pudo cargar la lista inicial de palabras.');
  return respuesta.json();
}

async function pintar(raiz, estaVivo, { catalogoAbierto = false } = {}) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!perfil) {
    raiz.replaceChildren(
      cabecera('Vocabulario'),
      el('div', { class: 'panel' }, el('p', {}, 'Primero crea el perfil del niño.')),
      el('a', { class: 'boton', href: '#/adulto/asistente' }, 'Crear el primer perfil'),
    );
    return;
  }

  const palabras = ordenadas(await store.listar('palabras', { perfilId: perfil.id }));
  const urls = new Map();
  for (const p of palabras) urls.set(p.id, await urlDeMedio(store, p.medioImagenId));
  if (!estaVivo()) return;

  const repintar = (opciones) => pintar(raiz, estaVivo, opciones).catch((error) => mostrarError(raiz, error));
  const avisoError = el('p', { class: 'error-texto', role: 'alert', hidden: true });
  const fallar = (error) => {
    console.error(error);
    avisoError.textContent = describirError(error);
    avisoError.hidden = false;
  };

  // ---- lista ----
  const lista = el('ul', { class: 'lista-filas' });
  palabras.forEach((p, i) => {
    const silabas = (p.silabas ?? []).join('-');
    lista.append(
      el(
        'li',
        { class: p.activa === false ? 'fila-palabra inactiva' : 'fila-palabra' },
        crearMiniatura({ url: urls.get(p.id), emoji: p.emoji, texto: p.texto }),
        el(
          'div',
          { class: 'fila-texto' },
          el('strong', {}, p.texto),
          el('span', { class: 'ayuda' }, `${silabas} · ${nombreDeCategoria(p.categoria)}`),
          el(
            'span',
            { class: 'insignias' },
            p.medioAudioId ? el('span', { class: 'insignia' }, 'Tu voz') : null,
            !p.medioImagenId && !p.emoji
              ? el('span', { class: 'insignia apagada', title: 'Una palabra sin imagen no se practica hasta que tenga una' }, 'Sin imagen')
              : null,
            p.activa === false ? el('span', { class: 'insignia apagada' }, 'En pausa') : null,
          ),
        ),
        el(
          'div',
          { class: 'acciones-fila' },
          el('button', {
            type: 'button',
            class: 'boton secundario chico',
            'aria-label': `Escuchar ${p.texto}`,
            onclick: () => {
              desbloquearAudio();
              decirPalabra(p, { obtenerMedio: (id) => store.obtener('medios', id), velocidad: perfil.ajustes?.velocidadVoz ?? 1 });
            },
          }, '🔊'),
          el('button', {
            type: 'button',
            class: 'boton secundario chico',
            'aria-label': `Subir ${p.texto}`,
            disabled: i === 0,
            onclick: () => reordenar(p, -1),
          }, '▲'),
          el('button', {
            type: 'button',
            class: 'boton secundario chico',
            'aria-label': `Bajar ${p.texto}`,
            disabled: i === palabras.length - 1,
            onclick: () => reordenar(p, 1),
          }, '▼'),
          el('a', { class: 'boton secundario chico', href: `#/adulto/palabra/${p.id}`, 'aria-label': `Editar ${p.texto}` }, 'Editar'),
          el('button', {
            type: 'button',
            class: 'boton secundario chico',
            'aria-pressed': String(p.activa !== false),
            onclick: () => alternarActiva(p),
          }, p.activa === false ? 'Activar' : 'Pausar'),
        ),
      ),
    );
  });

  async function reordenar(palabra, delta) {
    try {
      const cambios = mover(palabras, palabra.id, delta);
      if (!cambios.length) return;
      const porId = new Map(palabras.map((p) => [p.id, p]));
      await store.guardarVarios('palabras', cambios.map((c) => ({ ...porId.get(c.id), orden: c.orden })));
      repintar({ catalogoAbierto: panelCatalogo.open });
    } catch (e) {
      fallar(e);
    }
  }

  async function alternarActiva(palabra) {
    try {
      await store.guardar('palabras', { ...palabra, activa: palabra.activa === false });
      repintar({ catalogoAbierto: panelCatalogo.open });
    } catch (e) {
      fallar(e);
    }
  }

  // ---- agregar de la lista inicial ----
  const panelCatalogo = el('details', { class: 'panel' });
  panelCatalogo.open = catalogoAbierto;
  panelCatalogo.append(el('summary', {}, 'Agregar palabras de la lista inicial'));
  const contenidoCatalogo = el('div', {}, cargando());
  panelCatalogo.append(contenidoCatalogo);
  let catalogoCargado = false;
  const cargarPanelCatalogo = async () => {
    if (catalogoCargado) return;
    catalogoCargado = true;
    try {
      const catalogo = await cargarCatalogo();
      const existentes = new Set(palabras.map((p) => clavePalabra(p.texto)));
      const pendientes = catalogo.filter((e) => !existentes.has(clavePalabra(e.texto)));
      if (!pendientes.length) {
        contenidoCatalogo.replaceChildren(el('p', { class: 'ayuda' }, 'Ya agregaste todas las palabras de la lista inicial.'));
        return;
      }
      const elegidas = new Set();
      const grupos = agruparPorCategoria(pendientes).map(({ categoria, items }) =>
        el(
          'div',
          { class: 'grupo-catalogo' },
          el('h3', {}, categoria.nombre),
          el(
            'div',
            { class: 'catalogo-items' },
            items.map((e) => {
              const casilla = el('input', { type: 'checkbox' });
              casilla.addEventListener('change', () => (casilla.checked ? elegidas.add(e.texto) : elegidas.delete(e.texto)));
              return el('label', { class: 'item-catalogo' }, casilla, el('span', {}, `${e.emoji ?? ''} ${e.texto}`.trim()));
            }),
          ),
        ),
      );
      const agregar = el('button', { type: 'button', class: 'boton' }, 'Agregar las marcadas');
      agregar.addEventListener('click', async () => {
        if (!elegidas.size) return;
        agregar.disabled = true;
        try {
          const { palabras: nuevas } = armarPalabrasDelAsistente({
            perfilId: perfil.id,
            nino: {},
            catalogo: pendientes.filter((e) => elegidas.has(e.texto)),
            existentes: palabras,
          });
          await store.guardarVarios('palabras', nuevas);
          repintar({ catalogoAbierto: true });
        } catch (e) {
          fallar(e);
          agregar.disabled = false;
        }
      });
      contenidoCatalogo.replaceChildren(...grupos, agregar);
    } catch (e) {
      contenidoCatalogo.replaceChildren(el('p', { class: 'error-texto' }, describirError(e)));
    }
  };
  panelCatalogo.addEventListener('toggle', () => { if (panelCatalogo.open) cargarPanelCatalogo(); });
  if (panelCatalogo.open) cargarPanelCatalogo();

  raiz.replaceChildren(
    cabecera('Vocabulario'),
    el('p', { class: 'ayuda' }, `Palabras de ${perfil.nombre}. El niño las va aprendiendo en este orden, de arriba hacia abajo.`),
    el('div', { class: 'acciones acciones-inicio' }, el('a', { class: 'boton', href: '#/adulto/palabra/nueva' }, '+ Agregar palabra')),
    avisoError,
    palabras.length
      ? el('div', { class: 'panel' }, el('p', { class: 'ayuda' }, `${palabras.length} palabra${palabras.length === 1 ? '' : 's'}`), lista)
      : el('div', { class: 'panel' }, el('p', {}, 'Aún no hay palabras. Agrega una o elige de la lista inicial.')),
    panelCatalogo,
  );
}
