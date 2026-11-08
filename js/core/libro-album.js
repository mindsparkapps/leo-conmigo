// Contenido del libro del álbum (lógica pura, sin DOM): qué calcomanías lleva y en qué página va cada una.
// Las que el niño aún no ganó se muestran en gris y translúcidas; las ganadas, a color.

import { CODIGOS_CATALOGO, codigoDePropia, codigosEnJuego } from './calcomanias.js';

/** Calcomanías por página del libro (2 columnas × 3 filas). */
export const POR_PAGINA = 6;

/**
 * Los códigos que lleva el libro, en orden fijo (para que una calcomanía no cambie de lugar al ganar otra):
 * las que están en juego (catálogo y propias) y, al final, las ganadas que ya no están en juego pero siguen existiendo.
 * @param album    perfil.album normalizado
 * @param propias  calcomanías propias vigentes ({ id })
 * @param ganadas  códigos que el niño ya ganó alguna vez (en cualquier álbum)
 */
export function codigosDelLibro({ album, propias = [], ganadas = [] }) {
  const existentes = new Set([...CODIGOS_CATALOGO, ...propias.map((p) => codigoDePropia(p.id))]);
  const enJuego = codigosEnJuego(album, propias);
  const base = enJuego.length ? enJuego : [...existentes];
  const resto = [...new Set(ganadas)].filter((c) => existentes.has(c) && !base.includes(c));
  return [...base, ...resto];
}

/**
 * Reparte los códigos en páginas.
 * @returns {{ paginas: { codigo: string, ganada: boolean }[][], total: number, conseguidas: number }}
 */
export function armarLibro({ codigos, ganadas = [], porPagina = POR_PAGINA }) {
  const ganadasSet = new Set(ganadas);
  const unicos = [...new Set(codigos)];
  const items = unicos.map((codigo) => ({ codigo, ganada: ganadasSet.has(codigo) }));
  const paginas = [];
  for (let i = 0; i < items.length; i += porPagina) paginas.push(items.slice(i, i + porPagina));
  return { paginas, total: items.length, conseguidas: items.filter((i) => i.ganada).length };
}
