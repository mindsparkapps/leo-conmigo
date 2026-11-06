// Une el almacén con la lógica del álbum y las monedas (fase 11). Lo usan el fin de sesión, el inicio,
// la tienda del niño y las pantallas del adulto. Sin DOM: se prueba en Node con el almacén en memoria.

import { CODIGOS_CATALOGO, codigosEnJuego, elegirCalcomania } from './core/calcomanias.js';
import { calcularAlbumes, normalizarAlbum, premiosDeAlbumPorCrear, saldo } from './core/album.js';

/** Todo lo que hace falta para pintar el álbum, el cofre y la tienda de un niño. */
export async function cargarMonedas(store, perfil) {
  const filtro = { perfilId: perfil.id };
  const [calcomanias, propias, movimientos, premios] = await Promise.all([
    store.listar('calcomanias', filtro),
    store.listar('calcomaniasPropias', filtro),
    store.listar('movimientos', filtro),
    store.listar('premios', filtro),
  ]);
  const album = normalizarAlbum(perfil.album);
  const estado = calcularAlbumes({ calcomanias, movimientos, tamano: album.tamano });
  return { album, calcomanias, propias, movimientos, premios, ...estado, saldo: saldo(movimientos) };
}

/**
 * Crea los premios de álbum que falten (idempotente). Sirve para el niño que ya tenía el álbum lleno antes de
 * que existieran las monedas: la primera vez que se abre la app recibe lo que le corresponde.
 * @returns los movimientos creados
 */
export async function acreditarAlbumesPendientes(store, perfil, { calcomanias, movimientos } = {}) {
  const filtro = { perfilId: perfil.id };
  const cals = calcomanias ?? (await store.listar('calcomanias', filtro));
  const movs = movimientos ?? (await store.listar('movimientos', filtro));
  const porCrear = premiosDeAlbumPorCrear({ perfilId: perfil.id, calcomanias: cals, movimientos: movs, album: perfil.album });
  if (porCrear.length) await store.guardarVarios('movimientos', porCrear);
  return porCrear;
}

/**
 * Fin de sesión: elige la calcomanía de hoy (una que no esté en el álbum actual y que esté en juego), la guarda
 * y, si con ella se completa el álbum, guarda su premio de monedas.
 * @returns {{ codigo, esNueva, album: null | { numero, codigos, monedas }, saldo }}
 *   `album` solo viene si ESTA calcomanía completó el álbum (para mostrar la celebración).
 */
export async function ganarCalcomania(store, perfil, { aleatorio = Math.random, ahora = () => new Date().toISOString() } = {}) {
  const filtro = { perfilId: perfil.id };
  const config = normalizarAlbum(perfil.album);
  const [calcomanias, propias, movimientos] = await Promise.all([
    store.listar('calcomanias', filtro),
    store.listar('calcomaniasPropias', filtro),
    store.listar('movimientos', filtro),
  ]);
  const { actual } = calcularAlbumes({ calcomanias, movimientos, tamano: config.tamano });
  const enJuego = codigosEnJuego(config, propias);
  const { codigo, esNueva } = elegirCalcomania(actual.codigos, aleatorio, enJuego.length ? enJuego : CODIGOS_CATALOGO);

  const fecha = ahora();
  const nueva = await store.guardar('calcomanias', { perfilId: perfil.id, codigo, fecha });
  const porCrear = await acreditarAlbumesPendientes(store, perfil, { calcomanias: [...calcomanias, nueva], movimientos });
  const completado = porCrear.find((m) => m.fechaFin === fecha) ?? null;
  return {
    codigo,
    esNueva,
    album: completado ? { numero: completado.albumNumero, codigos: completado.codigos, monedas: completado.cantidad } : null,
    saldo: saldo([...movimientos, ...porCrear]),
  };
}
