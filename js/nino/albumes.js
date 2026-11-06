// «Mis álbumes»: los álbumes que el niño ya completó. Solo se mira (sin textos, sin nada que tocar salvo volver).

import { el } from '../ui/dom.js';
import { crearCandado } from '../ui/candado.js';
import { habilitarAdulto, deshabilitarAdulto } from '../acceso.js';
import { NOMBRE_APP } from '../config.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { liberarUrls } from '../medios.js';
import { cargarMonedas } from '../albumes.js';
import { mapaDePropias, nodoDeCalcomania } from '../ui/calcomania.js';

export const titulo = NOMBRE_APP;

const ICONO_CASA = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 8L6 32h8v22h14V40h8v14h14V32h8z" fill="currentColor"/></svg>`;

export function montar(contenedor, { ir }) {
  deshabilitarAdulto();
  const candado = crearCandado({
    alDesbloquear: () => {
      habilitarAdulto();
      ir('/adulto');
    },
  });
  const casa = el('button', { type: 'button', class: 'boton-casa boton-casa-chico', 'aria-label': 'Volver al inicio', onclick: () => ir('/nino') });
  casa.innerHTML = ICONO_CASA;
  const zona = el('div', { class: 'albumes-zona' });
  contenedor.append(el('section', { class: 'vista-nino albumes-nino' }, zona, casa, candado));

  let vivo = true;
  pintar(zona, () => vivo).catch((error) => {
    console.error(error);
    zona.replaceChildren(el('p', { class: 'mensaje-nino' }, 'Algo no funcionó. Un adulto puede tocar el candado.'));
  });
  return () => {
    vivo = false;
    liberarUrls();
  };
}

async function pintar(zona, estaVivo) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!perfil || !estaVivo()) return;
  const datos = await cargarMonedas(store, perfil);
  const propias = mapaDePropias(datos.propias);
  const bloques = [];
  for (const album of [...datos.completos].reverse()) {
    const nodos = (await Promise.all(album.codigos.map((c) => nodoDeCalcomania(store, c, propias)))).filter(Boolean);
    bloques.push(el('div', { class: 'album album-pasado', 'aria-label': `Álbum ${album.numero}` }, nodos));
  }
  if (!estaVivo()) return;
  zona.replaceChildren(...(bloques.length ? bloques : [el('p', { class: 'mensaje-nino' }, 'Todavía no completaste ningún álbum.')]));
}
