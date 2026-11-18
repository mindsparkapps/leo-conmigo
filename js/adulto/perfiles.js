// Perfiles: ver, elegir el perfil activo, cambiarle el nombre y agregar otro. El perfil (curso) no lleva foto:
// la foto es del alumno. Un perfil antiguo que ya tenía foto la sigue mostrando.

import { el } from '../ui/dom.js';
import { cabecera, campo, cargando, mostrarError, describirError } from '../ui/adulto.js';
import { crearMiniatura } from '../ui/miniatura.js';
import { obtenerStore, perfilActivo, fijarPerfilActivo } from '../contexto.js';
import { urlDeMedio, liberarUrls } from '../medios.js';
import { MAX_LARGO_PALABRA } from '../core/vocabulario.js';
import { borrarPerfil } from '../core/borrar-perfil.js';

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
  // «Escritura (experimental)»: una casilla por perfil (la misma que el menú Escritura); se guarda al marcarla
  const casillaEscritura = (perfil) => {
    const casilla = el('input', { type: 'checkbox', checked: Boolean(perfil.ajustes?.escritura?.habilitada) });
    casilla.addEventListener('change', async () => {
      const actual = (await store.obtener('perfiles', perfil.id)) ?? perfil;
      await store.guardar('perfiles', { ...actual, ajustes: { ...actual.ajustes, escritura: { ...(actual.ajustes?.escritura ?? {}), habilitada: casilla.checked } } });
    });
    return el('label', { class: 'ayuda' }, casilla, ' Escritura (experimental)');
  };

  for (const perfil of perfiles) {
    const fila = el('li', { class: 'fila-perfil' });
    const esActivo = activo?.id === perfil.id;

    const vistaNormal = () =>
      fila.replaceChildren(
        el(
          'div',
          { class: 'fila-contenido' },
          crearMiniatura({ url: urls.get(perfil.id), texto: perfil.nombre }),
          el('div', { class: 'fila-texto' }, el('strong', {}, perfil.nombre), esActivo ? el('span', { class: 'insignia' }, 'Activo') : null, casillaEscritura(perfil)),
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
            // El perfil activo no se puede borrar: primero se elige otro (así nunca se queda la app sin niño activo)
            esActivo
              ? null
              : el('button', {
                  type: 'button',
                  class: 'boton secundario chico',
                  onclick: async (e) => {
                    const palabras = (await store.listar('palabras', { perfilId: perfil.id })).length;
                    const detalle = palabras ? ` (${palabras} palabra${palabras === 1 ? '' : 's'})` : '';
                    if (!globalThis.confirm(`¿Borrar el perfil «${perfil.nombre}»? Se borran para siempre sus palabras${detalle}, fotos, audios, progreso, monedas y álbum, también en Google Drive y en los demás dispositivos. No se puede deshacer.`)) return;
                    e.target.disabled = true;
                    try {
                      await borrarPerfil(store, perfil.id);
                      repintar();
                    } catch (error) {
                      console.error(error);
                      globalThis.alert(describirError(error));
                      e.target.disabled = false;
                    }
                  },
                }, 'Borrar'),
          ),
        ),
      );

    const vistaEdicion = () => {
      const entrada = el('input', { type: 'text', maxlength: MAX_LARGO_PALABRA, value: perfil.nombre, autocomplete: 'off' });
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
          // El perfil no lleva foto (la foto es del alumno): solo se cambia el nombre
          await store.guardar('perfiles', { ...perfil, nombre });
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
      : el('div', { class: 'panel' }, el('p', {}, 'Todavía no hay ningún perfil. Crea el primero para empezar.')),
    el('a', { class: 'boton', href: '#/adulto/asistente' }, perfiles.length ? 'Agregar perfil' : 'Crear el primer perfil'),
  );
}
