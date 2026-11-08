// «Mi álbum»: un libro 3D con todas sus calcomanías. Las que aún no ganó se ven en gris y translúcidas;
// al ganarlas aparecen a color. Se pasan las hojas tocando, arrastrando o con las flechas.
// Debajo, unos puntos muestran cuánto lleva del álbum actual (el que da monedas al completarse).

import { el } from '../ui/dom.js';
import { deshabilitarAdulto } from '../acceso.js';
import { NOMBRE_APP } from '../config.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { liberarUrls } from '../medios.js';
import { cargarMonedas } from '../albumes.js';
import { armarLibro, codigosDelLibro } from '../core/libro-album.js';
import { dibujarCaras } from '../ui/laminas.js';

export const titulo = NOMBRE_APP;

const ICONO_CASA = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 8L6 32h8v22h14V40h8v14h14V32h8z" fill="currentColor"/></svg>`;
const ICONO_ATRAS = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M40 10L18 32l22 22" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICONO_ADELANTE = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M24 10l22 22-22 22" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function montar(contenedor, { ir }) {
  deshabilitarAdulto();
  const casa = el('button', { type: 'button', class: 'boton-casa boton-casa-chico', 'aria-label': 'Volver al inicio', onclick: () => ir('/nino') });
  casa.innerHTML = ICONO_CASA;
  const zona = el('div', { class: 'libro-zona' });
  contenedor.append(el('section', { class: 'vista-nino libro-nino' }, zona, casa));

  const estado = { vivo: true, libro: null };
  pintar(zona, estado).catch((error) => {
    console.error(error);
    zona.replaceChildren(el('p', { class: 'mensaje-nino' }, 'Algo no funcionó. Toca la casa para volver.'));
  });
  return () => {
    estado.vivo = false;
    estado.libro?.destruir();
    liberarUrls();
  };
}

function flecha(clase, etiqueta, icono, alTocar) {
  const b = el('button', { type: 'button', class: `libro-flecha ${clase}`, 'aria-label': etiqueta, onclick: alTocar });
  b.innerHTML = icono;
  return b;
}

async function pintar(zona, estado) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!perfil || !estado.vivo) return;
  const datos = await cargarMonedas(store, perfil);
  const propias = datos.propias.filter((p) => !p.deleted);
  const ganadas = datos.calcomanias.filter((c) => !c.deleted).map((c) => c.codigo);

  const libro = armarLibro({ codigos: codigosDelLibro({ album: datos.album, propias, ganadas }), ganadas });
  const caras = await dibujarCaras({ store, libro, propias });
  if (!estado.vivo) return;

  // Puntos del álbum actual: llenos los ya ganados, vacíos los que faltan
  const llevados = datos.actual.codigos.length;
  const puntos = el(
    'div',
    { class: 'libro-puntos', role: 'img', 'aria-label': `${llevados} de ${datos.album.tamano}` },
    Array.from({ length: datos.album.tamano }, (_, i) => el('span', { class: i < llevados ? 'punto lleno' : 'punto' })),
  );

  const lienzo = el('div', { class: 'libro-lienzo-zona', role: 'img', 'aria-label': `Mi álbum: ${libro.conseguidas} de ${libro.total} calcomanías` });
  zona.replaceChildren(lienzo);

  let controlador = null;
  try {
    const { crearLibro3D } = await import('../ui/libro3d.js');
    if (!estado.vivo) return;
    const atras = flecha('libro-atras', 'Página anterior', ICONO_ATRAS, () => controlador?.pasar(-1));
    const adelante = flecha('libro-adelante', 'Página siguiente', ICONO_ADELANTE, () => controlador?.pasar(1));
    controlador = crearLibro3D(lienzo, caras, {
      alCambiar: ({ puedeAtras, puedeAdelante }) => {
        atras.disabled = !puedeAtras;
        adelante.disabled = !puedeAdelante;
      },
    });
    estado.libro = controlador;
    atras.disabled = !controlador.puedeAtras();
    adelante.disabled = !controlador.puedeAdelante();
    zona.append(el('div', { class: 'libro-controles' }, atras, puntos, adelante));
  } catch (error) {
    // Sin WebGL (o sin poder cargar three.js): las mismas láminas, una página debajo de otra
    console.warn('No se pudo mostrar el libro 3D', error);
    lienzo.replaceChildren(...caras.slice(2).map((c) => { c.classList.add('libro-cara-plana'); return c; }));
    lienzo.classList.add('libro-plano');
    zona.append(puntos);
  }
}
