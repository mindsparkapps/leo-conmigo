// Une los álbumes cargados con el almacén (portadas y sobres) y los carga para las pantallas del niño y del adulto.

import { RUTA_PORTADA } from './ui/laminas.js';
import { urlDeMedio } from './medios.js';
import { listarColecciones } from './core/colecciones.js';

/** Los álbumes del niño (el de la app y los cargados con láminas), con las propias ya leídas. */
export async function cargarColecciones(store, perfil) {
  const propias = await store.listar('calcomaniasPropias', { perfilId: perfil.id });
  return { propias, colecciones: listarColecciones({ perfil, propias }) };
}

/** URL de la portada de un álbum (la de la app, o la imagen que eligió el adulto). */
export async function urlDePortada(store, coleccion) {
  if (coleccion.esBase) return RUTA_PORTADA;
  return (await urlDeMedio(store, coleccion.medioPortadaId)) ?? RUTA_PORTADA;
}

/** URL de la imagen del sobre de un álbum; si no tiene una propia, usa su portada. */
export async function urlDeSobre(store, coleccion) {
  if (coleccion.esBase) return RUTA_PORTADA;
  return (await urlDeMedio(store, coleccion.medioSobreId)) ?? (await urlDePortada(store, coleccion));
}
