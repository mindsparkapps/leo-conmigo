// Al terminar la práctica, si hay varios álbumes cargados: el niño elige de cuál quiere su lámina de premio
// (hasta 3 álbumes al azar; si hay menos, los que haya). Al elegir se le da la lámina y se pasa al premio.

import { el } from '../ui/dom.js';
import { crearTarjetaAlbum } from '../ui/tarjeta-album.js';
import { deshabilitarAdulto } from '../acceso.js';
import { NOMBRE_APP } from '../config.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { desbloquearAudio, detener, hablarTexto } from '../audio.js';
import { liberarUrls } from '../medios.js';
import { urlDePortada } from '../colecciones.js';
import { terminarLeccion } from './premio.js';

export const titulo = NOMBRE_APP;

let pendiente = null;

/** La sesión deja aquí lo que se ofrece: { opciones: álbumes (de `listarColecciones`), ajustes (normalizados) }. */
export function establecerEleccion(datos) {
  pendiente = datos;
}

export function montar(contenedor, { ir }) {
  deshabilitarAdulto();
  if (!pendiente) {
    ir('/nino');
    return undefined;
  }
  const { opciones, ajustes } = pendiente;
  const fila = el('div', { class: 'elegir-albumes' });
  const vista = el(
    'section',
    { class: 'vista-nino elegir-nino', 'aria-label': 'Elige un álbum' },
    el('p', { class: 'mensaje-nino mensaje-premio' }, '¡Lo lograste! Elige tu lámina'),
    fila,
  );
  contenedor.append(vista);

  let vivo = true;
  let elegido = false;
  (async () => {
    const store = await obtenerStore();
    const perfil = await perfilActivo();
    if (!vivo || !perfil) return;
    const tarjetas = await Promise.all(opciones.map(async (coleccion, indice) => crearTarjetaAlbum({
      url: await urlDePortada(store, coleccion),
      color: coleccion.colorPortada,
      nombre: coleccion.nombre,
      flota: true,
      indice,
      alTocar: async () => {
        if (elegido) return;
        elegido = true;
        desbloquearAudio();
        try {
          await terminarLeccion(store, perfil, ajustes, { coleccionId: coleccion.id });
        } catch (error) {
          console.error('No se pudo dar la lámina', error);
        }
        pendiente = null;
        if (vivo) ir('/nino/premio');
      },
    })));
    if (!vivo) return;
    fila.replaceChildren(...tarjetas);
    if (ajustes.sonido) {
      desbloquearAudio();
      hablarTexto('¡Lo lograste! Elige un álbum', { velocidad: ajustes.velocidadVoz });
    }
  })().catch((error) => console.error('No se pudieron mostrar los álbumes', error));

  return () => {
    vivo = false;
    detener();
    liberarUrls();
  };
}
