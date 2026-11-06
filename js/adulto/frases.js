// Frases del niño (etapa 2): se arman con sus palabras, en orden, y pueden tener una foto propia.
// Sin foto, el niño ve un collage con los dibujos de sus palabras. Sirven para F1, F2, F3 y para los libros.

import { el } from '../ui/dom.js';
import { cabecera, campo, cargando, mostrarError, describirError } from '../ui/adulto.js';
import { crearMiniatura } from '../ui/miniatura.js';
import { crearSelectorFoto } from '../ui/selector-foto.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { borrarMedio, guardarMedio, liberarUrls, urlDeMedio } from '../medios.js';
import { decirFrase, desbloquearAudio, detener } from '../audio.js';
import { MAX_PALABRAS_FRASE, frasePracticable, palabrasDeFrase, textoDeFrase, validarFrase } from '../core/frases.js';
import { nuevaFrase } from '../core/modelos.js';
import { ordenadas, siguienteOrden } from '../core/vocabulario.js';
import { tablaDePalabras } from '../core/estadisticas.js';

export const titulo = 'Frases · Leo Conmigo';

export function montar(contenedor) {
  const raiz = el('section', { class: 'vista-adulto' }, cabecera('Frases'), cargando());
  contenedor.append(raiz);
  const estado = { vivo: true, liberar: () => {} };
  pintar(raiz, estado).catch((error) => mostrarError(raiz, error));
  return () => {
    estado.vivo = false;
    detener();
    estado.liberar();
    liberarUrls();
  };
}

async function pintar(raiz, estado, { editando = null } = {}) {
  estado.liberar();
  estado.liberar = () => {};
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!perfil) {
    raiz.replaceChildren(
      cabecera('Frases'),
      el('div', { class: 'panel' }, el('p', {}, 'Primero crea el perfil del niño.')),
      el('a', { class: 'boton', href: '#/adulto/asistente' }, 'Crear el primer perfil'),
    );
    return;
  }

  const [listaPalabras, listaFrases, progresos] = await Promise.all([
    store.listar('palabras', { perfilId: perfil.id }),
    store.listar('frases', { perfilId: perfil.id }),
    store.listar('progresos', { perfilId: perfil.id }),
  ]);
  const palabras = ordenadas(listaPalabras.filter((p) => !p.deleted));
  const palabrasPorId = new Map(palabras.map((p) => [p.id, p]));
  const frases = listaFrases.filter((f) => !f.deleted).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const leidas = new Set(
    tablaDePalabras({ palabras, progresos }).filter((f) => f.estado === 'leida' || f.estado === 'completa' || f.estado === 'aprendida').map((f) => f.palabra.id),
  );
  const urls = new Map();
  for (const f of frases) if (f.medioImagenId) urls.set(f.medioImagenId, await urlDeMedio(store, f.medioImagenId));
  if (!estado.vivo) return;

  const repintar = (opciones) => pintar(raiz, estado, opciones).catch((error) => mostrarError(raiz, error));
  const avisoError = el('p', { class: 'error-texto', role: 'alert', hidden: true });
  const fallar = (error) => {
    console.error(error);
    avisoError.textContent = describirError(error);
    avisoError.hidden = false;
  };
  const obtenerMedio = (id) => store.obtener('medios', id);

  // ================= Lista =================
  const lista = el('ul', { class: 'lista-filas' });
  for (const f of frases) {
    const ps = palabrasDeFrase(f, palabrasPorId);
    const practicable = frasePracticable(f, palabrasPorId);
    lista.append(
      el(
        'li',
        { class: f.activa === false ? 'fila-palabra inactiva' : 'fila-palabra' },
        crearMiniatura({ url: urls.get(f.medioImagenId) ?? null, emoji: ps?.find((p) => p.emoji)?.emoji ?? null, texto: f.texto }),
        el(
          'div',
          { class: 'fila-texto' },
          el('strong', {}, f.texto),
          el(
            'span',
            { class: 'insignias' },
            f.medioImagenId ? el('span', { class: 'insignia' }, 'Con foto') : null,
            !ps ? el('span', { class: 'insignia apagada', title: 'Una de sus palabras ya no está en la lista' }, 'Le falta una palabra') : null,
            ps && !practicable && f.activa !== false
              ? el('span', { class: 'insignia apagada', title: 'Ninguna de sus palabras tiene imagen' }, 'Sin imagen')
              : null,
            f.activa === false ? el('span', { class: 'insignia apagada' }, 'En pausa') : null,
          ),
        ),
        el(
          'div',
          { class: 'acciones-fila' },
          ps
            ? el('button', {
                type: 'button',
                class: 'boton secundario chico',
                'aria-label': `Escuchar ${f.texto}`,
                onclick: () => {
                  desbloquearAudio();
                  decirFrase(ps, { obtenerMedio, velocidad: perfil.ajustes?.velocidadVoz ?? 1 });
                },
              }, '🔊')
            : null,
          el('button', { type: 'button', class: 'boton secundario chico', onclick: () => repintar({ editando: f }) }, 'Editar'),
          el('button', { type: 'button', class: 'boton secundario chico', onclick: () => alternarActiva(f) }, f.activa === false ? 'Activar' : 'Pausar'),
        ),
      ),
    );
  }

  async function alternarActiva(frase) {
    try {
      await store.guardar('frases', { ...frase, activa: frase.activa === false });
      repintar();
    } catch (e) {
      fallar(e);
    }
  }

  // ================= Formulario (nueva frase o edición) =================
  let elegidas = editando ? [...editando.palabraIds] : [];
  const vistaFrase = el('p', { class: 'frase-armada', 'aria-live': 'polite' });
  const errorFrase = el('p', { class: 'error-texto', role: 'alert', hidden: true });
  const selectorFoto = crearSelectorFoto({
    urlInicial: editando?.medioImagenId ? urls.get(editando.medioImagenId) ?? null : null,
    texto: editando?.texto ?? '',
  });
  estado.liberar = () => selectorFoto.liberar();

  function refrescarFrase() {
    const ps = elegidas.map((id) => palabrasPorId.get(id)).filter(Boolean);
    vistaFrase.replaceChildren(
      ...(ps.length
        ? ps.map((p, i) => el('span', { class: 'chip-frase' }, p.texto, el('button', {
            type: 'button',
            class: 'quitar-chip',
            'aria-label': `Quitar ${p.texto}`,
            onclick: () => { elegidas.splice(i, 1); refrescarFrase(); },
          }, '×')))
        : [el('span', { class: 'ayuda' }, 'Toca las palabras de abajo, en el orden de la frase.')]),
    );
    selectorFoto.establecerTexto(textoDeFrase(ps));
    errorFrase.hidden = true;
  }

  const botonesPalabra = (lote) =>
    lote.map((p) =>
      el('button', {
        type: 'button',
        class: 'chip',
        disabled: false,
        onclick: () => {
          if (elegidas.length >= MAX_PALABRAS_FRASE) {
            errorFrase.textContent = `Una frase puede tener hasta ${MAX_PALABRAS_FRASE} palabras.`;
            errorFrase.hidden = false;
            return;
          }
          elegidas.push(p.id);
          refrescarFrase();
        },
      }, p.texto),
    );
  const palabrasLeidas = palabras.filter((p) => leidas.has(p.id));
  const otrasPalabras = palabras.filter((p) => !leidas.has(p.id));

  const botonGuardar = el('button', { type: 'button', class: 'boton' }, editando ? 'Guardar cambios' : 'Agregar frase');
  botonGuardar.addEventListener('click', async () => {
    errorFrase.hidden = true;
    const error = validarFrase({ palabraIds: elegidas, palabrasPorId, frases, exceptoId: editando?.id });
    if (error) {
      errorFrase.textContent = error;
      errorFrase.hidden = false;
      return;
    }
    botonGuardar.disabled = true;
    try {
      const texto = textoDeFrase(elegidas.map((id) => palabrasPorId.get(id)));
      let medioImagenId = editando?.medioImagenId ?? null;
      const { blob, mime, quitar } = selectorFoto.estado;
      if (blob) {
        const medio = await guardarMedio(store, { tipo: 'imagen', blob, mime, origen: 'foto' });
        await borrarMedio(store, medioImagenId);
        medioImagenId = medio.id;
      } else if (quitar) {
        await borrarMedio(store, medioImagenId);
        medioImagenId = null;
      }
      if (editando) {
        await store.guardar('frases', { ...editando, palabraIds: [...elegidas], texto, medioImagenId });
      } else {
        const registro = nuevaFrase({ perfilId: perfil.id, palabraIds: [...elegidas], texto, orden: siguienteOrden(frases) });
        await store.guardar('frases', { ...registro, medioImagenId });
      }
      repintar();
    } catch (e) {
      fallar(e);
      botonGuardar.disabled = false;
    }
  });

  async function quitarFrase() {
    if (!editando) return;
    if (!globalThis.confirm(`¿Quitar la frase «${editando.texto}»? Los libros que la usan perderán esa página.`)) return;
    try {
      await borrarMedio(store, editando.medioImagenId);
      await store.borrar('frases', editando.id);
      repintar();
    } catch (e) {
      fallar(e);
    }
  }

  const formulario = el(
    'div',
    { class: 'panel' },
    el('h2', {}, editando ? 'Editar la frase' : 'Nueva frase'),
    el('p', { class: 'ayuda' }, 'Una frase corta con las palabras del niño, por ejemplo «papá come pan». Con 2 a 6 palabras.'),
    vistaFrase,
    errorFrase,
    palabrasLeidas.length ? el('h3', {}, 'Palabras que ya lee') : null,
    palabrasLeidas.length ? el('div', { class: 'paleta-palabras' }, botonesPalabra(palabrasLeidas)) : null,
    el('h3', {}, palabrasLeidas.length ? 'Otras palabras' : 'Palabras'),
    otrasPalabras.length
      ? el('div', { class: 'paleta-palabras' }, botonesPalabra(otrasPalabras))
      : el('p', { class: 'ayuda' }, 'No hay más palabras.'),
    el('div', { class: 'acciones' }, el('button', {
      type: 'button',
      class: 'boton secundario chico',
      onclick: () => { elegidas = []; refrescarFrase(); },
    }, 'Empezar de nuevo')),
    el('h3', {}, 'Foto de la frase (opcional)'),
    el('p', { class: 'ayuda' }, 'Sin foto, el niño ve los dibujos de las palabras juntos.'),
    selectorFoto.elemento,
    avisoError,
    el(
      'div',
      { class: 'acciones' },
      botonGuardar,
      editando ? el('button', { type: 'button', class: 'boton secundario', onclick: () => repintar() }, 'Cancelar') : null,
      editando ? el('button', { type: 'button', class: 'boton secundario', onclick: quitarFrase }, 'Quitar esta frase') : null,
    ),
  );

  const faltaEtapa = !palabras.length;
  raiz.replaceChildren(...[
    cabecera('Frases'),
    el('p', { class: 'ayuda' }, `Frases de ${perfil.nombre}. Se practican en la etapa 2 y se usan en los libros.`),
    faltaEtapa ? el('div', { class: 'panel' }, el('p', {}, 'Primero agrega palabras al vocabulario.')) : null,
    frases.length
      ? el('div', { class: 'panel' }, el('p', { class: 'ayuda' }, `${frases.length} frase${frases.length === 1 ? '' : 's'}`), lista)
      : el('div', { class: 'panel' }, el('p', {}, 'Aún no hay frases.')),
    faltaEtapa ? null : formulario,
  ].filter(Boolean));
  refrescarFrase();
}
