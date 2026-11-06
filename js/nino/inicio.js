// Inicio del modo niño: su foto y su nombre (la primera palabra que ve cada día), un solo botón ▶
// y debajo el álbum de calcomanías. Sin menús ni textos: solo el candado lleva al modo adulto.

import { el } from '../ui/dom.js';
import { crearCandado } from '../ui/candado.js';
import { crearMiniatura } from '../ui/miniatura.js';
import { habilitarAdulto, deshabilitarAdulto } from '../acceso.js';
import { NOMBRE_APP } from '../config.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { urlDeMedio, liberarUrls } from '../medios.js';
import { desbloquearAudio } from '../audio.js';
import { hayQuePracticar as hayAlgoQuePracticar } from '../core/controlador.js';
import { CALCOMANIAS, rutaCalcomania } from '../core/calcomanias.js';
import { librosParaElNino } from '../core/frases.js';

export const titulo = NOMBRE_APP;

const ICONO_LIBRO = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M6 12h22a6 6 0 0 1 4 2 6 6 0 0 1 4-2h22v38H36a6 6 0 0 0-4 2 6 6 0 0 0-4-2H6z" fill="currentColor"/><path d="M32 16v36" stroke="#fff" stroke-width="3"/></svg>`;

const ICONO_JUGAR = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M18 8l38 24-38 24z" fill="currentColor"/></svg>`;

export function montar(contenedor, { ir }) {
  deshabilitarAdulto(); // al volver al modo niño, el modo adulto vuelve a quedar bloqueado

  const candado = crearCandado({
    alDesbloquear: () => {
      habilitarAdulto();
      ir('/adulto');
    },
  });
  const vista = el('section', { class: 'vista-nino inicio-nino' }, candado);
  contenedor.append(vista);

  let vivo = true;
  pintar(vista, ir, () => vivo).catch((error) => {
    console.error(error);
    vista.prepend(el('h1', { class: 'titulo-nino' }, NOMBRE_APP), el('p', { class: 'mensaje-nino' }, 'Algo no funcionó. Un adulto puede tocar el candado.'));
  });
  return () => {
    vivo = false;
    liberarUrls();
  };
}

async function pintar(vista, ir, estaVivo) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!estaVivo()) return;

  if (!perfil) {
    vista.prepend(el('h1', { class: 'titulo-nino' }, NOMBRE_APP), el('p', { class: 'mensaje-nino' }, 'Un adulto debe preparar la aplicación.'));
    return;
  }

  const [palabras, frases, libros, progresos, niveles, calcomanias, foto] = await Promise.all([
    store.listar('palabras', { perfilId: perfil.id }),
    store.listar('frases', { perfilId: perfil.id }),
    store.listar('libros', { perfilId: perfil.id }),
    store.listar('progresos', { perfilId: perfil.id }),
    store.listar('niveles', { perfilId: perfil.id }),
    store.listar('calcomanias', { perfilId: perfil.id }),
    urlDeMedio(store, perfil.fotoMedioId),
  ]);
  if (!estaVivo()) return;

  const hayQuePracticar = hayAlgoQuePracticar({ perfil, palabras, frases, progresos, niveles });
  const palabrasPorId = new Map(palabras.filter((p) => !p.deleted).map((p) => [p.id, p]));
  const frasesPorId = new Map(frases.filter((f) => !f.deleted).map((f) => [f.id, f]));
  const hayLibros = librosParaElNino(libros, frasesPorId, palabrasPorId).length > 0;
  const tenidas = new Set(calcomanias.map((c) => c.codigo));

  const jugar = hayQuePracticar
    ? el('button', {
        type: 'button',
        class: 'boton-jugar',
        'aria-label': 'Empezar',
        onclick: () => {
          desbloquearAudio(); // en iPhone el audio solo suena si se activa con un toque
          ir('/nino/sesion');
        },
      })
    : el('p', { class: 'mensaje-nino' }, 'Un adulto debe agregar palabras con imagen.');
  if (hayQuePracticar) jugar.innerHTML = ICONO_JUGAR;

  // «Mi libro» (B1): solo aparece si el adulto armó al menos un libro
  const libro = hayLibros
    ? el('button', {
        type: 'button',
        class: 'boton-libro',
        'aria-label': 'Mis libros',
        onclick: () => {
          desbloquearAudio();
          ir('/nino/libros');
        },
      })
    : null;
  if (libro) libro.innerHTML = ICONO_LIBRO;
  const acciones = el('div', { class: 'acciones-inicio' }, jugar, libro);

  const album = el(
    'div',
    { class: 'album', 'aria-label': 'Mis calcomanías' },
    CALCOMANIAS.map(({ codigo, nombre }) =>
      tenidas.has(codigo)
        ? el('img', { class: 'calcomania', src: rutaCalcomania(codigo), alt: nombre, draggable: 'false' })
        : el('span', { class: 'calcomania-hueco', 'aria-hidden': 'true' }), // lugar vacío: aún no la ganó
    ),
  );

  vista.prepend(
    crearMiniatura({ url: foto, texto: perfil.nombre }, { grande: true }),
    el('h1', { class: 'titulo-nino' }, perfil.nombre),
    acciones,
    album,
  );
}
