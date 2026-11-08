// Pantalla principal del modo niño: su foto y su nombre (la primera palabra que ve cada día), sus monedas y
// cuatro botones grandes: Jugar, Tienda, Álbum (sus calcomanías) y Config (modo adulto, tras mantener 3 s y la suma).

import { el } from '../ui/dom.js';
import { crearCandado } from '../ui/candado.js';
import { crearMiniatura } from '../ui/miniatura.js';
import { habilitarAdulto, deshabilitarAdulto } from '../acceso.js';
import { NOMBRE_APP, TEXTO_VERSION } from '../config.js';
import { observar, instalar } from '../pwa.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { urlDeMedio, liberarUrls } from '../medios.js';
import { desbloquearAudio } from '../audio.js';
import { hayQuePracticar as hayAlgoQuePracticar } from '../core/controlador.js';
import { librosParaElNino } from '../core/frases.js';
import { premiosVisibles } from '../core/album.js';
import { acreditarAlbumesPendientes, cargarMonedas } from '../albumes.js';
import { saltarLeccionActivo } from '../dev.js';
import { terminarLeccion } from './premio.js';
import { normalizarAjustes } from '../core/modelos.js';

export const titulo = NOMBRE_APP;

const ICONO_LIBRO = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M6 12h22a6 6 0 0 1 4 2 6 6 0 0 1 4-2h22v38H36a6 6 0 0 0-4 2 6 6 0 0 0-4-2H6z" fill="currentColor"/><path d="M32 16v36" stroke="#fff" stroke-width="3"/></svg>`;

const ICONO_TIENDA = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M8 24l6-14h36l6 14v6a8 8 0 0 1-12 6.9 8 8 0 0 1-12 0 8 8 0 0 1-12 0A8 8 0 0 1 8 30z" fill="currentColor"/><path d="M14 42v14h36V42" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>`;

const ICONO_JUGAR = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M18 8l38 24-38 24z" fill="currentColor"/></svg>`;

const ICONO_ALBUM = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 6l7.4 15.6 17 2.2-12.4 11.8 3.1 16.9L32 44.1 16.9 52.5l3.1-16.9L7.6 23.8l17-2.2z" fill="currentColor"/></svg>`;

export function montar(contenedor, { ir }) {
  deshabilitarAdulto(); // al volver al modo niño, el modo adulto vuelve a quedar bloqueado

  const vista = el('section', { class: 'vista-nino inicio-nino' });
  contenedor.append(vista);

  let vivo = true;
  pintar(vista, ir, () => vivo).catch((error) => {
    console.error(error);
    vista.prepend(el('h1', { class: 'titulo-nino' }, NOMBRE_APP), el('p', { class: 'mensaje-nino' }, 'Algo no funcionó. Un adulto puede tocar el candado.'));
    if (!vista.querySelector('.candado')) vista.append(crearCandado({ alDesbloquear: () => entrarAdulto(ir) }));
  });
  return () => {
    vivo = false;
    liberarUrls();
  };
}

function entrarAdulto(ir) {
  habilitarAdulto();
  ir('/adulto');
}

/** Botón grande del menú: icono arriba y texto debajo. */
function botonMenu({ clase, etiqueta, icono, alTocar, desactivado = false }) {
  const boton = el(
    'button',
    { type: 'button', class: `menu-boton ${clase}`, 'aria-label': etiqueta, disabled: desactivado || undefined, onclick: alTocar },
    el('span', { class: 'menu-etiqueta', 'aria-hidden': 'true' }, etiqueta),
  );
  boton.insertAdjacentHTML('afterbegin', icono);
  return boton;
}

async function pintar(vista, ir, estaVivo) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!estaVivo()) return;

  if (!perfil) {
    vista.append(crearCandado({ alDesbloquear: () => entrarAdulto(ir) }));
    // Primera pantalla en un dispositivo nuevo: aquí el adulto puede instalar la app y ver la versión
    const instalacion = el('p', { class: 'instalar-inicio' });
    let dejar = null;
    dejar = observar((estado) => {
      if (dejar && !instalacion.isConnected) { dejar(); return; }
      instalacion.replaceChildren(
        ...(estado.puedeInstalar
          ? [el('button', { type: 'button', class: 'boton', onclick: () => instalar() }, 'Instalar en este dispositivo')]
          : estado.instalada
            ? []
            : [el('span', { class: 'ayuda' }, 'Para instalarla: en Android/Chrome abre el menú ⋮ y elige «Instalar aplicación»; en iPhone o iPad usa Compartir → «Agregar a pantalla de inicio».')]),
      );
    });
    vista.prepend(
      el('h1', { class: 'titulo-nino' }, NOMBRE_APP),
      el('p', { class: 'mensaje-nino' }, 'Un adulto debe preparar la aplicación.'),
      instalacion,
      el('p', { class: 'version-app' }, TEXTO_VERSION),
    );
    return;
  }

  // Si el niño ya tenía el álbum lleno antes de que existieran las monedas, recibe lo que le corresponde
  await acreditarAlbumesPendientes(store, perfil);
  const [palabras, frases, libros, progresos, niveles, monedas, foto] = await Promise.all([
    store.listar('palabras', { perfilId: perfil.id }),
    store.listar('frases', { perfilId: perfil.id }),
    store.listar('libros', { perfilId: perfil.id }),
    store.listar('progresos', { perfilId: perfil.id }),
    store.listar('niveles', { perfilId: perfil.id }),
    cargarMonedas(store, perfil),
    urlDeMedio(store, perfil.fotoMedioId),
  ]);
  if (!estaVivo()) return;

  const hayQuePracticar = hayAlgoQuePracticar({ perfil, palabras, frases, progresos, niveles });
  const palabrasPorId = new Map(palabras.filter((p) => !p.deleted).map((p) => [p.id, p]));
  const frasesPorId = new Map(frases.filter((f) => !f.deleted).map((f) => [f.id, f]));
  const hayLibros = librosParaElNino(libros, frasesPorId, palabrasPorId).length > 0;
  const hayTienda = premiosVisibles(monedas.premios).length > 0;

  // Pantalla principal: cuatro botones grandes (jugar, tienda, álbum, configuración) y, si hay, «Mis libros»
  const irA = (ruta) => () => {
    desbloquearAudio(); // en iPhone el audio solo suena si se activa con un toque
    ir(ruta);
  };
  const menu = el(
    'nav',
    { class: 'menu-inicio', 'aria-label': 'Menú' },
    botonMenu({
      clase: 'menu-jugar',
      etiqueta: 'Jugar',
      icono: ICONO_JUGAR,
      // Herramienta de desarrollador: sin lección, directo al premio (con calcomanía y monedas de verdad)
      alTocar: saltarLeccionActivo()
        ? async () => {
          desbloquearAudio();
          try {
            await terminarLeccion(store, perfil, normalizarAjustes(perfil.ajustes));
            ir('/nino/premio');
          } catch (error) {
            console.error('No se pudo saltar la lección', error);
          }
        }
        : irA('/nino/sesion'),
      desactivado: !hayQuePracticar && !saltarLeccionActivo(),
    }),
    botonMenu({ clase: 'menu-tienda', etiqueta: 'Tienda', icono: ICONO_TIENDA, alTocar: irA('/nino/tienda') }),
    botonMenu({ clase: 'menu-album', etiqueta: 'Álbum', icono: ICONO_ALBUM, alTocar: irA('/nino/albumes') }),
    hayLibros ? botonMenu({ clase: 'menu-libro', etiqueta: 'Libros', icono: ICONO_LIBRO, alTocar: irA('/nino/libros') }) : null,
    // Config lleva al modo adulto: sigue protegido (mantener 3 s y resolver la suma)
    crearCandado({ alDesbloquear: () => entrarAdulto(ir), etiqueta: 'Config' }),
  );

  vista.prepend(
    ...[
      crearMiniatura({ url: foto, texto: perfil.nombre }, { grande: true }),
      el('h1', { class: 'titulo-nino' }, perfil.nombre),
      hayQuePracticar ? null : el('p', { class: 'mensaje-nino' }, 'Un adulto debe agregar palabras con imagen.'),
      menu,
    ].filter(Boolean), // un nodo null se escribiría como el texto «null»
  );
}
