// Perfiles: ver, elegir el niño activo, editar nombre y foto, y agregar otro niño.

import { el } from '../ui/dom.js';
import { cabecera, campo, cargando, mostrarError, describirError } from '../ui/adulto.js';
import { crearMiniatura } from '../ui/miniatura.js';
import { crearSelectorFoto } from '../ui/selector-foto.js';
import { obtenerStore, perfilActivo, fijarPerfilActivo } from '../contexto.js';
import { guardarMedio, borrarMedio, urlDeMedio, liberarUrls } from '../medios.js';
import { MAX_LARGO_PALABRA } from '../core/vocabulario.js';

export const titulo = 'Perfiles · Leo Conmigo';

export function montar(contenedor) {
  const raiz = el('section', { class: 'vista-adulto' }, cabecera('Perfiles'), cargando());
  contenedor.append(raiz);
  const limpiezas = [];
  let vivo = true;
  pintar(raiz, limpiezas, () => vivo).catch((error) => mostrarError(raiz, error));
  return () => {
    vivo = false;
    limpiezas.forEach((f) => f());
    liberarUrls();
  };
}

async function pintar(raiz, limpiezas, estaVivo) {
  const store = await obtenerStore();
  const perfiles = (await store.listar('perfiles')).sort((a, b) => (a.creado ?? '').localeCompare(b.creado ?? ''));
  const activo = await perfilActivo();
  const urls = new Map();
  for (const p of perfiles) urls.set(p.id, await urlDeMedio(store, p.fotoMedioId));
  if (!estaVivo()) return;

  const lista = el('ul', { class: 'lista-filas' });
  const repintar = () => pintar(raiz, limpiezas, estaVivo).catch((error) => mostrarError(raiz, error));

  for (const perfil of perfiles) {
    const fila = el('li', { class: 'fila-perfil' });
    const esActivo = activo?.id === perfil.id;

    const vistaNormal = () =>
      fila.replaceChildren(
        el(
          'div',
          { class: 'fila-contenido' },
          crearMiniatura({ url: urls.get(perfil.id), texto: perfil.nombre }),
          el('div', { class: 'fila-texto' }, el('strong', {}, perfil.nombre), esActivo ? el('span', { class: 'insignia' }, 'Activo') : null),
          el(
            'div',
            { class: 'acciones-fila' },
            esActivo
              ? null
              : el('button', {
                  type: 'button',
                  class: 'boton chico',
                  onclick: async () => {
                    await fijarPerfilActivo(perfil.id);
                    repintar();
                  },
                }, 'Usar este perfil'),
            el('button', { type: 'button', class: 'boton secundario chico', onclick: vistaEdicion }, 'Editar'),
          ),
        ),
      );

    const vistaEdicion = () => {
      const entrada = el('input', { type: 'text', maxlength: MAX_LARGO_PALABRA, value: perfil.nombre, autocomplete: 'off' });
      const selector = crearSelectorFoto({ urlInicial: urls.get(perfil.id) ?? null, texto: perfil.nombre });
      limpiezas.push(() => selector.liberar());
      entrada.addEventListener('input', () => selector.establecerTexto(entrada.value));
      const error = el('p', { class: 'error-texto', role: 'alert', hidden: true });
      const guardar = el('button', { type: 'button', class: 'boton' }, 'Guardar');
      guardar.addEventListener('click', async () => {
        const nombre = entrada.value.trim();
        if (!nombre) {
          error.textContent = 'El nombre no puede quedar vacío.';
          error.hidden = false;
          return;
        }
        guardar.disabled = true;
        try {
          let fotoMedioId = perfil.fotoMedioId ?? null;
          const { blob, mime, quitar } = selector.estado;
          if (blob) {
            const medio = await guardarMedio(store, { tipo: 'imagen', blob, mime, origen: 'foto' });
            await borrarMedio(store, fotoMedioId);
            fotoMedioId = medio.id;
          } else if (quitar) {
            await borrarMedio(store, fotoMedioId);
            fotoMedioId = null;
          }
          await store.guardar('perfiles', { ...perfil, nombre, fotoMedioId });
          repintar();
        } catch (e) {
          console.error(e);
          error.textContent = describirError(e);
          error.hidden = false;
          guardar.disabled = false;
        }
      });
      fila.replaceChildren(
        el(
          'div',
          { class: 'panel-interno' },
          campo('Nombre', entrada),
          selector.elemento,
          error,
          el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'boton secundario', onclick: vistaNormal }, 'Cancelar'), guardar),
        ),
      );
      entrada.focus();
    };

    vistaNormal();
    lista.append(fila);
  }

  raiz.replaceChildren(
    cabecera('Perfiles'),
    perfiles.length
      ? el('div', { class: 'panel' }, lista)
      : el('div', { class: 'panel' }, el('p', {}, 'Todavía no hay ningún niño. Crea el primero para empezar.')),
    el('a', { class: 'boton', href: '#/adulto/asistente' }, perfiles.length ? 'Agregar otro niño' : 'Crear el primer perfil'),
  );
}
