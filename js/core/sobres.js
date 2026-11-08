// Sobres de láminas y venta de repetidas (tienda del niño). Lógica pura, sin DOM.
// Un sobre cuesta lo que el niño gana jugando SESIONES_POR_SOBRE veces: cada sesión da una lámina y un álbum
// lleno paga `monedasPorAlbum`, así que una sesión vale monedasPorAlbum / tamano monedas.

import { normalizarAlbum } from './album.js';

export const SESIONES_POR_SOBRE = 5;
export const LAMINAS_POR_SOBRE = 3;
export const VALOR_VENTA = 1;

/** Precio de un sobre en monedas (al menos 1). */
export function precioDeSobre(album) {
  const { tamano, monedasPorAlbum } = normalizarAlbum(album);
  return Math.max(1, Math.ceil((SESIONES_POR_SOBRE * monedasPorAlbum) / tamano));
}

/** Saca `cantidad` láminas al azar entre las que están en juego (pueden repetirse). */
export function sacarSobre(enJuego, aleatorio = Math.random, cantidad = LAMINAS_POR_SOBRE) {
  if (!enJuego.length) return [];
  return Array.from({ length: cantidad }, () => enJuego[Math.floor(aleatorio() * enJuego.length)]);
}

/** El movimiento que gasta las monedas de un sobre. */
export function crearCompraSobre({ perfilId, precio, codigos, fecha = new Date().toISOString() }) {
  return { perfilId, fecha, cantidad: -precio, tipo: 'sobre', nota: 'Sobre de láminas', codigos: [...codigos] };
}

/** El movimiento que paga una lámina repetida. */
export function crearVenta({ perfilId, codigo, valor = VALOR_VENTA, fecha = new Date().toISOString() }) {
  return { perfilId, fecha, cantidad: valor, tipo: 'venta', nota: 'Lámina repetida', codigo };
}

/**
 * Láminas que el niño tiene de más: de cada código se queda con una.
 * @returns [{ codigo, sobran }] en el orden en que las ganó
 */
export function repetidas(calcomanias) {
  const cuenta = new Map();
  for (const c of [...calcomanias].filter((x) => !x.deleted).sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))) {
    cuenta.set(c.codigo, (cuenta.get(c.codigo) ?? 0) + 1);
  }
  return [...cuenta].filter(([, n]) => n > 1).map(([codigo, n]) => ({ codigo, sobran: n - 1 }));
}

/** El registro que se quita al vender una copia: primero una suelta, si no la más reciente. null si no sobra ninguna. */
export function registroAVender(calcomanias, codigo) {
  const copias = calcomanias.filter((c) => !c.deleted && c.codigo === codigo).sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''));
  if (copias.length < 2) return null;
  const sueltas = copias.filter((c) => c.pegada === false);
  return sueltas.length ? sueltas[sueltas.length - 1] : copias[copias.length - 1];
}
