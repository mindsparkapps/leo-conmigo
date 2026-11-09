// Asistente de primer uso: crea el perfil del niño y sus primeras palabras.
//   1. Nombre y foto del niño
//   2. Su gente y sus cosas favoritas (con foto)
//   3. Palabras de la lista inicial que se quieren agregar

import { el } from '../ui/dom.js';
import { cabecera, campo, mostrarError, describirError } from '../ui/adulto.js';
import { crearSelectorFoto } from '../ui/selector-foto.js';
import { obtenerStore, fijarPerfilActivo } from '../contexto.js';
import { nuevoPerfil } from '../core/modelos.js';
import { armarPalabrasDelAsistente, agruparPorCategoria, nombreDeCategoria, MAX_LARGO_PALABRA } from '../core/vocabulario.js';
import { guardarMedio, borrarMedio, ponerVocesIniciales } from '../medios.js';

export const titulo = 'Nuevo niño · Leo Conmigo';

const SUGERENCIAS = [
  { etiqueta: 'Mamá', texto: 'Mamá', categoria: 'personas' },
  { etiqueta: 'Papá', texto: 'Papá', categoria: 'personas' },
  { etiqueta: 'Abuela', texto: 'Abuela', categoria: 'personas' },
  { etiqueta: 'Abuelo', texto: 'Abuelo', categoria: 'personas' },
  { etiqueta: 'Hermano', texto: 'Hermano', categoria: 'personas' },
  { etiqueta: 'Hermana', texto: 'Hermana', categoria: 'personas' },
  { etiqueta: 'Mascota', texto: '', categoria: 'animales', pista: 'Nombre de la mascota' },
  { etiqueta: 'Otra palabra', texto: '', categoria: 'otras', pista: 'Por ejemplo, su juguete favorito' },
];
const CATEGORIAS_PERSONALES = ['personas', 'animales', 'juguetes', 'comida', 'casa', 'cuerpo', 'otras'];
const TOTAL_PASOS = 3;

export function montar(contenedor, { ir }) {
  const raiz = el('section', { class: 'vista-adulto' });
  contenedor.append(raiz);
  const limpiezas = [];
  let vivo = true;
  iniciar(raiz, ir, limpiezas, () => vivo).catch((error) => mostrarError(raiz, error));
  return () => {
    vivo = false;
    limpiezas.forEach((f) => f());
  };
}

async function cargarCatalogo() {
  const respuesta = await fetch('data/vocabulario-inicial.json');
  if (!respuesta.ok) throw new Error('No se pudo cargar la lista inicial de palabras.');
  return respuesta.json();
}

async function iniciar(raiz, ir, limpiezas, estaVivo) {
  const catalogo = await cargarCatalogo();
  if (!estaVivo()) return;

  // ---- Paso 1: el niño ----
  const entradaNombre = el('input', { type: 'text', maxlength: MAX_LARGO_PALABRA, autocomplete: 'off', enterkeyhint: 'next' });
  const errorNombre = el('p', { class: 'error-texto', role: 'alert', hidden: true });
  const selectorNino = crearSelectorFoto({ texto: '' });
  limpiezas.push(() => selectorNino.liberar());
  entradaNombre.addEventListener('input', () => {
    errorNombre.hidden = true;
    selectorNino.establecerTexto(entradaNombre.value);
  });
  const paso1 = el(
    'div',
    { class: 'panel' },
    el('h2', {}, '¿Cómo se llama el niño?'),
    campo('Nombre', entradaNombre, 'Será la primera palabra que verá todos los días.'),
    errorNombre,
    el('p', { class: 'campo-etiqueta' }, 'Su foto (opcional)'),
    selectorNino.elemento,
  );

  // ---- Paso 2: su gente y sus cosas ----
  const filas = [];
  const listaFilas = el('div', { class: 'filas-personales' });
  function agregarFila({ texto = '', categoria = 'personas', pista = 'Nombre' } = {}) {
    const entrada = el('input', { type: 'text', maxlength: MAX_LARGO_PALABRA, autocomplete: 'off', placeholder: pista, value: texto });
    const categorias = el(
      'select',
      {},
      CATEGORIAS_PERSONALES.map((id) => el('option', { value: id, selected: id === categoria }, nombreDeCategoria(id))),
    );
    const selector = crearSelectorFoto({ texto });
    limpiezas.push(() => selector.liberar());
    entrada.addEventListener('input', () => selector.establecerTexto(entrada.value));
    const fila = el(
      'div',
      { class: 'fila-personal' },
      campo('Palabra', entrada),
      campo('Tipo', categorias),
      selector.elemento,
      el('button', {
        type: 'button',
        class: 'boton secundario chico',
        onclick: () => {
          fila.remove();
          filas.splice(filas.indexOf(datos), 1);
          selector.liberar();
        },
      }, 'Quitar esta palabra'),
    );
    const datos = { entrada, categorias, selector };
    filas.push(datos);
    listaFilas.append(fila);
    entrada.focus();
  }
  const paso2 = el(
    'div',
    { class: 'panel' },
    el('h2', {}, 'Su gente y sus cosas favoritas'),
    el('p', { class: 'ayuda' }, 'Las palabras con fotos reales (mamá, su perro, su juguete) son las que más fácil aprende. Toca para agregar.'),
    el(
      'div',
      { class: 'chips' },
      SUGERENCIAS.map((s) => el('button', { type: 'button', class: 'chip', onclick: () => agregarFila(s) }, `+ ${s.etiqueta}`)),
    ),
    listaFilas,
  );

  // ---- Paso 3: lista inicial ----
  const marcadas = new Set(catalogo.filter((e) => e.categoria !== 'enlace').map((e) => e.texto));
  const gruposCatalogo = el('div');
  function pintarCatalogo() {
    gruposCatalogo.replaceChildren(
      ...agruparPorCategoria(catalogo).map(({ categoria, items }) => {
        const casillas = items.map((e) => {
          const casilla = el('input', { type: 'checkbox', checked: marcadas.has(e.texto) });
          casilla.addEventListener('change', () => (casilla.checked ? marcadas.add(e.texto) : marcadas.delete(e.texto)));
          return el('label', { class: 'item-catalogo' }, casilla, el('span', {}, `${e.emoji ?? ''} ${e.texto}`.trim()));
        });
        const cambiarTodas = (valor) => {
          for (const e of items) (valor ? marcadas.add(e.texto) : marcadas.delete(e.texto));
          pintarCatalogo();
        };
        return el(
          'div',
          { class: 'grupo-catalogo' },
          el(
            'div',
            { class: 'fila' },
            el('h3', {}, categoria.nombre),
            el('button', { type: 'button', class: 'boton secundario chico', onclick: () => cambiarTodas(true) }, 'Todas'),
            el('button', { type: 'button', class: 'boton secundario chico', onclick: () => cambiarTodas(false) }, 'Ninguna'),
          ),
          categoria.id === 'enlace'
            ? el('p', { class: 'ayuda' }, 'Se usan más adelante, para armar frases. Puedes agregarlas cuando llegue el momento.')
            : null,
          el('div', { class: 'catalogo-items' }, casillas),
        );
      }),
    );
  }
  pintarCatalogo();
  const paso3 = el(
    'div',
    { class: 'panel' },
    el('h2', {}, 'Palabras para empezar'),
    el('p', { class: 'ayuda' }, 'Van después de las anteriores. Más adelante puedes quitarlas o cambiar el orden en «Vocabulario».'),
    gruposCatalogo,
  );

  // ---- Navegación ----
  const pasos = [paso1, paso2, paso3];
  let actual = 0;
  const indicador = el('p', { class: 'ayuda', role: 'status' });
  const mensaje = el('p', { class: 'error-texto', role: 'alert', hidden: true });
  const botonAtras = el('button', { type: 'button', class: 'boton secundario', onclick: () => ir_a(actual - 1) }, 'Atrás');
  const botonSiguiente = el('button', { type: 'button', class: 'boton', onclick: avanzar }, 'Siguiente');

  function ir_a(n) {
    actual = Math.min(Math.max(n, 0), pasos.length - 1);
    pasos.forEach((p, i) => { p.hidden = i !== actual; });
    indicador.textContent = `Paso ${actual + 1} de ${TOTAL_PASOS}`;
    botonAtras.hidden = actual === 0;
    botonSiguiente.textContent = actual === pasos.length - 1 ? 'Crear y empezar' : 'Siguiente';
    mensaje.hidden = true;
    globalThis.scrollTo?.(0, 0);
  }

  async function avanzar() {
    if (actual === 0) {
      if (!entradaNombre.value.trim()) {
        errorNombre.textContent = 'Escribe el nombre del niño.';
        errorNombre.hidden = false;
        entradaNombre.focus();
        return;
      }
      ir_a(1);
    } else if (actual === 1) {
      ir_a(2);
    } else {
      await crear();
    }
  }

  let perfilPendiente = null; // si un intento falla a medias, el siguiente reutiliza el mismo perfil
  async function crear() {
    botonSiguiente.disabled = true;
    botonAtras.disabled = true;
    mensaje.hidden = true;
    const creados = [];
    try {
      const store = await obtenerStore();
      const nuevoMedio = async (foto) => {
        if (!foto?.blob) return null;
        const medio = await guardarMedio(store, { tipo: 'imagen', blob: foto.blob, mime: foto.mime, origen: 'foto' });
        creados.push(medio.id);
        return medio.id;
      };

      const nombre = entradaNombre.value.trim();
      const fotoPerfilId = await nuevoMedio(selectorNino.estado);
      const fotoPalabraId = await nuevoMedio(selectorNino.estado); // copia propia: cada uso tiene su medio
      const personales = [];
      for (const f of filas) {
        const texto = f.entrada.value.trim();
        if (!texto) continue;
        personales.push({ texto, categoria: f.categorias.value, medioImagenId: await nuevoMedio(f.selector.estado) });
      }

      const perfil = perfilPendiente ?? nuevoPerfil({ nombre, fotoMedioId: fotoPerfilId });
      await store.guardar('perfiles', perfil);
      perfilPendiente = perfil;
      const existentes = await store.listar('palabras', { perfilId: perfil.id });
      const { palabras } = armarPalabrasDelAsistente({
        perfilId: perfil.id,
        nino: { nombre, medioImagenId: fotoPalabraId },
        personales,
        catalogo: catalogo.filter((e) => marcadas.has(e.texto)),
        existentes,
      });
      await ponerVocesIniciales(store, palabras, catalogo);
      await store.guardarVarios('palabras', palabras);

      // Las fotos que quedaron sin usar (palabra repetida) no se guardan
      const usados = new Set([perfil.fotoMedioId, ...palabras.map((p) => p.medioImagenId)]);
      for (const id of creados) if (!usados.has(id)) await borrarMedio(store, id);

      await fijarPerfilActivo(perfil.id);
      ir('/adulto/vocabulario');
    } catch (error) {
      console.error(error);
      mensaje.textContent = describirError(error);
      mensaje.hidden = false;
      botonSiguiente.disabled = false;
      botonAtras.disabled = false;
    }
  }

  raiz.append(
    cabecera('Nuevo niño', { atras: '#/adulto', textoAtras: 'Cancelar' }),
    indicador,
    ...pasos,
    mensaje,
    el('div', { class: 'acciones' }, botonAtras, botonSiguiente),
  );
  ir_a(0);
  entradaNombre.focus();
}
