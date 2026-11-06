// Libros del niño («Mi libro», B1): un título y hasta 10 páginas, cada una con una frase y, si se quiere,
// su propia foto. El niño los lee con el resaltado palabra por palabra y el audio al tocar.

import { el } from '../ui/dom.js';
import { cabecera, campo, cargando, mostrarError, describirError } from '../ui/adulto.js';
import { crearMiniatura } from '../ui/miniatura.js';
import { crearSelectorFoto } from '../ui/selector-foto.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { borrarMedio, guardarMedio, liberarUrls, urlDeMedio } from '../medios.js';
import { MAX_LARGO_TITULO, MAX_PAGINAS_LIBRO, paginasLeibles, palabrasDeFrase, validarLibro } from '../core/frases.js';
import { nuevoLibro, normalizarPregunta } from '../core/modelos.js';
import {
  MAX_LARGO_PREGUNTA, MAX_OTRAS_OPCIONES, MAX_PREGUNTAS, armarCuentoDesdePlantilla, plantillasDisponibles, preguntasLeibles, validarPreguntas,
} from '../core/cuentos.js';
import { ordenadas, tieneImagen } from '../core/vocabulario.js';

export const titulo = 'Libros · Leo Conmigo';

async function cargarPlantillas() {
  try {
    const respuesta = await fetch('data/cuentos-iniciales.json');
    return respuesta.ok ? await respuesta.json() : [];
  } catch {
    return []; // sin conexión y sin copia en caché: simplemente no se ofrecen
  }
}

export function montar(contenedor) {
  const raiz = el('section', { class: 'vista-adulto' }, cabecera('Libros'), cargando());
  contenedor.append(raiz);
  const estado = { vivo: true, liberar: () => {} };
  pintar(raiz, estado).catch((error) => mostrarError(raiz, error));
  return () => {
    estado.vivo = false;
    estado.liberar();
    liberarUrls();
  };
}

async function pintar(raiz, estado, { editando = null, nuevo = false } = {}) {
  estado.liberar();
  estado.liberar = () => {};
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!perfil) {
    raiz.replaceChildren(
      cabecera('Libros'),
      el('div', { class: 'panel' }, el('p', {}, 'Primero crea el perfil del niño.')),
      el('a', { class: 'boton', href: '#/adulto/asistente' }, 'Crear el primer perfil'),
    );
    return;
  }

  const [listaPalabras, listaFrases, listaLibros] = await Promise.all([
    store.listar('palabras', { perfilId: perfil.id }),
    store.listar('frases', { perfilId: perfil.id }),
    store.listar('libros', { perfilId: perfil.id }),
  ]);
  const palabrasPorId = new Map(listaPalabras.filter((p) => !p.deleted).map((p) => [p.id, p]));
  const frases = listaFrases.filter((f) => !f.deleted).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const frasesPorId = new Map(frases.map((f) => [f.id, f]));
  const libros = listaLibros.filter((l) => !l.deleted).sort((a, b) => String(a.creado ?? '').localeCompare(String(b.creado ?? '')));
  const urls = new Map();
  if (editando) for (const p of editando.paginas) if (p.medioImagenId) urls.set(p.medioImagenId, await urlDeMedio(store, p.medioImagenId));
  const plantillas = editando || nuevo ? [] : await cargarPlantillas();
  if (!estado.vivo) return;

  const repintar = (opciones) => pintar(raiz, estado, opciones).catch((error) => mostrarError(raiz, error));
  const avisoError = el('p', { class: 'error-texto', role: 'alert', hidden: true });
  const fallar = (error) => {
    console.error(error);
    avisoError.textContent = describirError(error);
    avisoError.hidden = false;
  };

  // ================= Lista de libros =================
  const lista = el('ul', { class: 'lista-filas' });
  for (const libro of libros) {
    const leibles = paginasLeibles(libro, frasesPorId, palabrasPorId).length;
    lista.append(
      el(
        'li',
        { class: 'fila-palabra' },
        crearMiniatura({ texto: libro.titulo }),
        el(
          'div',
          { class: 'fila-texto' },
          el('strong', {}, libro.titulo),
          el(
            'span',
            { class: 'ayuda' },
            `${libro.paginas.length} página${libro.paginas.length === 1 ? '' : 's'}`,
            leibles < libro.paginas.length ? ` · ${leibles} se pueden leer` : '',
          ),
          el(
            'span',
            { class: 'insignias' },
            preguntasLeibles(libro, palabrasPorId).length
              ? el('span', { class: 'insignia' }, `Cuento · ${preguntasLeibles(libro, palabrasPorId).length} pregunta${preguntasLeibles(libro, palabrasPorId).length === 1 ? '' : 's'}`)
              : null,
            leibles === 0 ? el('span', { class: 'insignia apagada' }, 'No se muestra al niño') : null,
          ),
        ),
        el('div', { class: 'acciones-fila' }, el('button', { type: 'button', class: 'boton secundario chico', onclick: () => repintar({ editando: libro }) }, 'Editar')),
      ),
    );
  }

  // ================= Formulario =================
  const formulario = editando || nuevo ? crearFormulario() : null;

  function crearFormulario() {
    const entradaTitulo = el('input', { type: 'text', maxlength: MAX_LARGO_TITULO, autocomplete: 'off', value: editando?.titulo ?? '' });
    const errorTitulo = el('p', { class: 'error-texto', role: 'alert', hidden: true });
    const contenedorPaginas = el('div', { class: 'paginas-editor' });
    const quitadas = []; // medios de páginas que se sacaron del libro (se borran al guardar)

    const paginas = (editando?.paginas ?? [{ fraseId: null, medioImagenId: null }]).map((p) => nuevaPagina(p));
    estado.liberar = () => paginas.forEach((p) => p.selector.liberar());

    function nuevaPagina({ fraseId = null, medioImagenId = null } = {}) {
      const selector = crearSelectorFoto({ urlInicial: medioImagenId ? urls.get(medioImagenId) ?? null : null, texto: '' });
      const seleccion = el(
        'select',
        { 'aria-label': 'Frase de la página' },
        el('option', { value: '' }, 'Elige una frase'),
        frases.map((f) => {
          const completa = Boolean(palabrasDeFrase(f, palabrasPorId));
          return el('option', { value: f.id, selected: f.id === fraseId, disabled: !completa }, completa ? f.texto : `${f.texto} (le falta una palabra)`);
        }),
      );
      return { fraseId, medioImagenId, selector, seleccion };
    }

    function pintarPaginas() {
      contenedorPaginas.replaceChildren(
        ...paginas.map((pagina, i) =>
          el(
            'div',
            { class: 'pagina-editor' },
            el(
              'div',
              { class: 'fila' },
              el('h3', {}, `Página ${i + 1}`),
              el('div', { class: 'acciones-fila' },
                el('button', { type: 'button', class: 'boton secundario chico', 'aria-label': 'Subir la página', disabled: i === 0, onclick: () => mover(i, -1) }, '▲'),
                el('button', { type: 'button', class: 'boton secundario chico', 'aria-label': 'Bajar la página', disabled: i === paginas.length - 1, onclick: () => mover(i, 1) }, '▼'),
                el('button', { type: 'button', class: 'boton secundario chico', onclick: () => quitarPagina(i) }, 'Quitar'),
              ),
            ),
            campo('Frase', pagina.seleccion),
            el('p', { class: 'ayuda' }, 'Foto de la página (si no pones una, se usa la de la frase o los dibujos de sus palabras):'),
            pagina.selector.elemento,
          ),
        ),
      );
      botonAgregar.disabled = paginas.length >= MAX_PAGINAS_LIBRO;
    }
    function mover(i, delta) {
      const j = i + delta;
      if (j < 0 || j >= paginas.length) return;
      [paginas[i], paginas[j]] = [paginas[j], paginas[i]];
      pintarPaginas();
    }
    function quitarPagina(i) {
      const [pagina] = paginas.splice(i, 1);
      pagina.selector.liberar();
      if (pagina.medioImagenId) quitadas.push(pagina.medioImagenId);
      pintarPaginas();
    }
    const botonAgregar = el('button', {
      type: 'button',
      class: 'boton secundario',
      onclick: () => {
        if (paginas.length >= MAX_PAGINAS_LIBRO) return;
        paginas.push(nuevaPagina());
        pintarPaginas();
      },
    }, '+ Agregar página');

    // ---- preguntas del cuento (etapa 4): se responden tocando el dibujo de una palabra ----
    const preguntas = (editando?.preguntas ?? []).map(normalizarPregunta);
    const conImagen = ordenadas([...palabrasPorId.values()].filter(tieneImagen));
    const contenedorPreguntas = el('div', { class: 'preguntas-editor' });
    const botonAgregarPregunta = el('button', {
      type: 'button',
      class: 'boton secundario',
      onclick: () => {
        if (preguntas.length >= MAX_PREGUNTAS) return;
        preguntas.push({ texto: '', correctaId: null, distractorIds: [] });
        pintarPreguntas();
      },
    }, '+ Agregar pregunta');

    function pintarPreguntas() {
      contenedorPreguntas.replaceChildren(
        ...preguntas.map((q, i) => {
          const entrada = el('input', { type: 'text', maxlength: MAX_LARGO_PREGUNTA, autocomplete: 'off', placeholder: '¿Quién come pan?', value: q.texto });
          entrada.addEventListener('input', () => { q.texto = entrada.value; });
          const respuesta = el(
            'select',
            { 'aria-label': `Respuesta de la pregunta ${i + 1}` },
            el('option', { value: '' }, 'Elige la respuesta'),
            conImagen.map((p) => el('option', { value: p.id, selected: p.id === q.correctaId }, p.texto)),
          );
          respuesta.addEventListener('change', () => {
            q.correctaId = respuesta.value || null;
            q.distractorIds = q.distractorIds.filter((id) => id !== q.correctaId);
            pintarPreguntas();
          });
          const resumen = el('summary', {}, `Otras opciones (${q.distractorIds.length} de ${MAX_OTRAS_OPCIONES})`);
          const casillas = conImagen.filter((p) => p.id !== q.correctaId).map((p) => {
            const casilla = el('input', { type: 'checkbox', checked: q.distractorIds.includes(p.id) });
            casilla.addEventListener('change', () => {
              if (casilla.checked && q.distractorIds.length >= MAX_OTRAS_OPCIONES) { casilla.checked = false; return; }
              q.distractorIds = casilla.checked ? [...q.distractorIds, p.id] : q.distractorIds.filter((id) => id !== p.id);
              resumen.textContent = `Otras opciones (${q.distractorIds.length} de ${MAX_OTRAS_OPCIONES})`;
            });
            return el('label', { class: 'item-catalogo' }, casilla, el('span', {}, p.texto));
          });
          return el(
            'div',
            { class: 'pagina-editor' },
            el(
              'div',
              { class: 'fila' },
              el('h3', {}, `Pregunta ${i + 1}`),
              el('button', { type: 'button', class: 'boton secundario chico', onclick: () => { preguntas.splice(i, 1); pintarPreguntas(); } }, 'Quitar'),
            ),
            campo('La pregunta', entrada),
            campo('Respuesta correcta', respuesta, 'Es una palabra del vocabulario con imagen: el niño toca su dibujo.'),
            el('details', { class: 'panel-detalle', open: q.distractorIds.length === 0 }, resumen, el('div', { class: 'catalogo-items' }, casillas)),
          );
        }),
      );
      botonAgregarPregunta.disabled = preguntas.length >= MAX_PREGUNTAS;
    }

    const botonGuardar = el('button', { type: 'button', class: 'boton' }, editando ? 'Guardar cambios' : 'Crear libro');
    botonGuardar.addEventListener('click', async () => {
      avisoError.hidden = true;
      errorTitulo.hidden = true;
      const pedido = paginas.map((p) => ({ fraseId: p.seleccion.value || null, medioImagenId: p.medioImagenId }));
      const error = validarLibro({ titulo: entradaTitulo.value, paginas: pedido, frasesPorId })
        ?? validarPreguntas({ preguntas, palabrasPorId });
      if (error) {
        const lugar = error.includes('título') ? errorTitulo : avisoError;
        lugar.textContent = error;
        lugar.hidden = false;
        return;
      }
      botonGuardar.disabled = true;
      try {
        const resultado = [];
        for (let i = 0; i < paginas.length; i++) {
          const p = paginas[i];
          let medioImagenId = p.medioImagenId;
          const { blob, mime, quitar } = p.selector.estado;
          if (blob) {
            const medio = await guardarMedio(store, { tipo: 'imagen', blob, mime, origen: 'foto' });
            await borrarMedio(store, medioImagenId);
            medioImagenId = medio.id;
          } else if (quitar) {
            await borrarMedio(store, medioImagenId);
            medioImagenId = null;
          }
          resultado.push({ fraseId: pedido[i].fraseId, medioImagenId });
        }
        for (const id of quitadas) await borrarMedio(store, id);
        if (editando) {
          await store.guardar('libros', { ...editando, titulo: entradaTitulo.value.trim(), paginas: resultado, preguntas: preguntas.map(normalizarPregunta) });
        } else {
          await store.guardar('libros', nuevoLibro({ perfilId: perfil.id, titulo: entradaTitulo.value, paginas: resultado, preguntas }));
        }
        repintar();
      } catch (e) {
        fallar(e);
        botonGuardar.disabled = false;
      }
    });

    async function quitarLibro() {
      if (!globalThis.confirm(`¿Quitar el libro «${editando.titulo}»? Las frases y las palabras no se borran.`)) return;
      try {
        for (const p of editando.paginas) await borrarMedio(store, p.medioImagenId);
        await store.borrar('libros', editando.id);
        repintar();
      } catch (e) {
        fallar(e);
      }
    }

    pintarPaginas();
    pintarPreguntas();
    return el(
      'div',
      { class: 'panel' },
      el('h2', {}, editando ? 'Editar el libro' : 'Nuevo libro'),
      campo('Título', entradaTitulo),
      errorTitulo,
      contenedorPaginas,
      el('div', { class: 'acciones' }, botonAgregar),
      el('h3', {}, 'Preguntas al final (opcional)'),
      el('p', { class: 'ayuda' }, `Con 1 o ${MAX_PREGUNTAS} preguntas, el libro es un cuento: al terminarlo el niño responde tocando un dibujo («¿Quién comió pan?»). No se evalúa nada.`),
      contenedorPreguntas,
      el('div', { class: 'acciones' }, botonAgregarPregunta),
      avisoError,
      el(
        'div',
        { class: 'acciones' },
        botonGuardar,
        el('button', { type: 'button', class: 'boton secundario', onclick: () => repintar() }, 'Cancelar'),
        editando ? el('button', { type: 'button', class: 'boton secundario', onclick: quitarLibro }, 'Quitar este libro') : null,
      ),
    );
  }

  // ================= Cuentos de ejemplo =================
  const titulosExistentes = new Set(libros.map((l) => l.titulo));
  const disponibles = plantillasDisponibles(plantillas, [...palabrasPorId.values()]);
  async function agregarCuento(plantilla) {
    try {
      const { frasesNuevas, libro } = armarCuentoDesdePlantilla({ plantilla, perfilId: perfil.id, palabras: [...palabrasPorId.values()], frases });
      if (frasesNuevas.length) await store.guardarVarios('frases', frasesNuevas);
      await store.guardar('libros', libro);
      repintar();
    } catch (e) {
      fallar(e);
    }
  }
  const panelEjemplos = disponibles.length
    ? el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Cuentos de ejemplo'),
        el('p', { class: 'ayuda' }, 'Cuentos cortos con preguntas, hechos con palabras del vocabulario inicial. Se pueden agregar cuando el niño ya tiene esas palabras, y después puedes cambiarlos.'),
        el(
          'ul',
          { class: 'lista-filas' },
          disponibles.map(({ plantilla, faltan, completa }) => {
            const agregado = titulosExistentes.has(plantilla.titulo);
            return el(
              'li',
              { class: 'fila-palabra' },
              el(
                'div',
                { class: 'fila-texto' },
                el('strong', {}, plantilla.titulo),
                el('span', { class: 'ayuda' }, `${plantilla.paginas.length} páginas · ${plantilla.preguntas?.length ?? 0} preguntas`),
                !completa ? el('span', { class: 'ayuda' }, `Faltan palabras: ${faltan.join(', ')}`) : null,
              ),
              el(
                'div',
                { class: 'acciones-fila' },
                agregado
                  ? el('span', { class: 'insignia' }, 'Ya está')
                  : el('button', { type: 'button', class: 'boton secundario chico', disabled: !completa, onclick: () => agregarCuento(plantilla) }, 'Agregar'),
              ),
            );
          }),
        ),
      )
    : null;

  const sinFrases = !frases.length;
  raiz.replaceChildren(...[
    cabecera('Libros'),
    el('p', { class: 'ayuda' }, `Libros de ${perfil.nombre}: cada página tiene una frase y, si quieres, una foto. Los lee desde su pantalla de inicio.`),
    sinFrases
      ? el('div', { class: 'panel' }, el('p', {}, 'Para armar un libro primero hacen falta frases.'), el('a', { class: 'boton', href: '#/adulto/frases' }, 'Crear frases'))
      : null,
    libros.length
      ? el('div', { class: 'panel' }, el('p', { class: 'ayuda' }, `${libros.length} libro${libros.length === 1 ? '' : 's'}`), lista)
      : sinFrases ? null : el('div', { class: 'panel' }, el('p', {}, 'Aún no hay libros.')),
    formulario ?? (sinFrases ? null : el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'boton', onclick: () => repintar({ nuevo: true }) }, '+ Nuevo libro'))),
    formulario ? null : panelEjemplos,
    formulario ? null : avisoError,
  ].filter(Boolean));
}
