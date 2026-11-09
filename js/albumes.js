// Une el almacén con la lógica del álbum y las monedas (fase 11). Lo usan el fin de sesión, el inicio,
// la tienda del niño y las pantallas del adulto. Sin DOM: se prueba en Node con el almacén en memoria.

import { CODIGOS_CATALOGO, codigosEnJuego, elegirCalcomania } from './core/calcomanias.js';
import { calcularAlbumes, crearPagoLeccion, normalizarAlbum, premiosDeAlbumPorCrear, saldo } from './core/album.js';
import { crearCompraSobre, crearVenta, precioDeSobre, registroAVender, sacarSobre, valorDeVenta } from './core/sobres.js';

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
 * Paga la lección recién terminada: guarda el movimiento con `monedasPorLeccion` monedas.
 * @returns {{ cantidad, saldoAntes, saldo }}
 */
export async function pagarLeccion(store, perfil, { ahora = () => new Date().toISOString() } = {}) {
  const filtro = { perfilId: perfil.id };
  const { monedasPorLeccion } = normalizarAlbum(perfil.album);
  const antes = saldo(await store.listar('movimientos', filtro));
  await store.guardar('movimientos', crearPagoLeccion({ perfilId: perfil.id, cantidad: monedasPorLeccion, fecha: ahora() }));
  return { cantidad: monedasPorLeccion, saldoAntes: antes, saldo: antes + monedasPorLeccion };
}

/**
 * Compra un sobre: gasta las monedas y guarda sus láminas sueltas (pueden repetirse).
 * @returns {{ comprado: false, faltan, precio } | { comprado: true, codigos, precio, saldo, album }}
 */
export async function comprarSobre(store, perfil, { aleatorio = Math.random, ahora = () => new Date().toISOString() } = {}) {
  const filtro = { perfilId: perfil.id };
  const config = normalizarAlbum(perfil.album);
  const precio = precioDeSobre(config);
  const [calcomanias, propias, movimientos] = await Promise.all([
    store.listar('calcomanias', filtro),
    store.listar('calcomaniasPropias', filtro),
    store.listar('movimientos', filtro),
  ]);
  const actual = saldo(movimientos);
  if (actual < precio) return { comprado: false, faltan: precio - actual, precio };

  const enJuego = codigosEnJuego(config, propias);
  const codigos = sacarSobre(enJuego.length ? enJuego : CODIGOS_CATALOGO, aleatorio);
  const base = Date.parse(ahora());
  const nuevas = await store.guardarVarios(
    'calcomanias',
    codigos.map((codigo, i) => ({ perfilId: perfil.id, codigo, fecha: new Date(base + i).toISOString(), pegada: false })),
  );
  const compra = await store.guardar('movimientos', crearCompraSobre({ perfilId: perfil.id, precio, codigos, fecha: new Date(base).toISOString() }));
  const todas = [...calcomanias, ...(Array.isArray(nuevas) ? nuevas : [])];
  const porCrear = await acreditarAlbumesPendientes(store, perfil, { calcomanias: todas, movimientos: [...movimientos, compra] });
  const completado = porCrear.at(-1) ?? null;
  return {
    comprado: true,
    codigos,
    precio,
    saldo: saldo([...movimientos, compra, ...porCrear]),
    album: completado ? { numero: completado.albumNumero, codigos: completado.codigos, monedas: completado.cantidad } : null,
  };
}

/** Vende una copia de más de una lámina (nunca la última): quita el registro y paga la moneda. */
export async function venderRepetida(store, perfil, codigo, { ahora = () => new Date().toISOString() } = {}) {
  const filtro = { perfilId: perfil.id };
  const calcomanias = await store.listar('calcomanias', filtro);
  const registro = registroAVender(calcomanias, codigo);
  if (!registro) return { vendida: false };
  await store.borrar('calcomanias', registro.id);
  const venta = await store.guardar('movimientos', crearVenta({ perfilId: perfil.id, codigo, valor: valorDeVenta(perfil.album), fecha: ahora() }));
  const movimientos = await store.listar('movimientos', filtro);
  return { vendida: true, valor: venta.cantidad, saldo: saldo(movimientos) };
}

/** Deja los álbumes en blanco: borra las láminas y los premios de álbum. Los gastos y regalos de monedas se quedan. */
export async function reiniciarAlbumes(store, perfil) {
  const filtro = { perfilId: perfil.id };
  const [calcomanias, movimientos] = await Promise.all([store.listar('calcomanias', filtro), store.listar('movimientos', filtro)]);
  for (const c of calcomanias) await store.borrar('calcomanias', c.id);
  for (const m of movimientos.filter((x) => x.tipo === 'album')) await store.borrar('movimientos', m.id);
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
  // `pegada: false`: la lámina aparece suelta sobre el libro y el niño la pega en su lugar (nino/albumes.js)
  const nueva = await store.guardar('calcomanias', { perfilId: perfil.id, codigo, fecha, pegada: false });
  const porCrear = await acreditarAlbumesPendientes(store, perfil, { calcomanias: [...calcomanias, nueva], movimientos });
  const completado = porCrear.find((m) => m.fechaFin === fecha) ?? null;
  return {
    codigo,
    esNueva,
    album: completado ? { numero: completado.albumNumero, codigos: completado.codigos, monedas: completado.cantidad } : null,
    saldo: saldo([...movimientos, ...porCrear]),
  };
}
