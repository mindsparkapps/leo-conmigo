// Contenido del libro del álbum (lógica pura, sin DOM): qué láminas lleva, en qué página (letra) y con qué número
// va cada una, y cuáles ya están pegadas.
//
// Una lámina ganada NO queda pegada sola: aparece suelta sobre el libro y el niño la lleva a su lugar. Cada registro
// de `calcomanias` lleva `pegada: false` hasta entonces. Los registros sin el campo (de antes de esta función) se
// toman como ya pegados, para no dejar al niño con láminas sueltas que no pidió.

import { CODIGOS_CATALOGO, codigoDePropia, codigosEnJuego } from './calcomanias.js';

/** Láminas por página del libro (2 columnas × 3 filas). */
export const POR_PAGINA = 6;

/** A, B, … Z, AA, AB, … */
export function letraDePagina(indice) {
  let n = indice;
  let letra = '';
  do {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letra;
}

/** El nombre de un lugar del libro, como se ve en las láminas y en los huecos: «A-7». */
export const etiquetaDeLamina = (letra, numero) => `${letra}-${numero}`;

/**
 * Los códigos que lleva el libro, en orden fijo (para que una lámina no cambie de lugar al ganar otra):
 * las que están en juego (láminas y propias vigentes).
 * @param album    perfil.album normalizado
 * @param propias  calcomanías propias vigentes ({ id })
 */
export function codigosDelLibro({ album, propias = [] }) {
  const enJuego = codigosEnJuego(album, propias);
  return enJuego.length ? enJuego : [...CODIGOS_CATALOGO, ...propias.map((p) => codigoDePropia(p.id))];
}

/**
 * Separa lo que el niño ya ganó en lo pegado y lo que aún anda suelto.
 * @param calcomanias  registros del almacén (los borrados se ignoran)
 * @returns {{ pegadas: string[], sueltas: string[] }}  `sueltas` por orden de llegada, sin repetir y sin las ya pegadas
 */
export function separarCalcomanias(calcomanias) {
  const vivas = calcomanias.filter((c) => !c.deleted);
  const pegadas = new Set(vivas.filter((c) => c.pegada !== false).map((c) => c.codigo));
  const sueltas = [];
  for (const c of [...vivas].sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))) {
    if (c.pegada === false && !pegadas.has(c.codigo) && !sueltas.includes(c.codigo)) sueltas.push(c.codigo);
  }
  return { pegadas: [...pegadas], sueltas };
}

/** Los registros que hay que guardar para dar por pegada una lámina (todos los sueltos de ese código). */
export function registrosAlPegar(calcomanias, codigo, ahora = new Date().toISOString()) {
  return calcomanias
    .filter((c) => !c.deleted && c.codigo === codigo && c.pegada === false)
    .map((c) => ({ ...c, pegada: true, fechaPegada: ahora }));
}

/**
 * Reparte los códigos en páginas, con letra de página y número de lámina (1, 2, 3… en todo el libro).
 * @param pegadas  códigos ya pegados
 * @returns {{ paginas: { letra: string, items: { codigo, numero, letra, pegada }[] }[], total: number, pegadas: number }}
 */
export function armarLibro({ codigos, pegadas = [], porPagina = POR_PAGINA }) {
  const pegadasSet = new Set(pegadas);
  const unicos = [...new Set(codigos)];
  const paginas = [];
  for (let i = 0; i < unicos.length; i += porPagina) {
    const letra = letraDePagina(paginas.length);
    paginas.push({
      letra,
      items: unicos.slice(i, i + porPagina).map((codigo, k) => ({ codigo, numero: i + k + 1, letra, pegada: pegadasSet.has(codigo) })),
    });
  }
  return { paginas, total: unicos.length, pegadas: unicos.filter((c) => pegadasSet.has(c)).length };
}

/** Dónde va una lámina: su página y su número. null si no está en el libro. */
export function lugarDeLamina(libro, codigo) {
  for (let p = 0; p < libro.paginas.length; p++) {
    const item = libro.paginas[p].items.find((i) => i.codigo === codigo);
    if (item) return { pagina: p, letra: item.letra, numero: item.numero, posicion: libro.paginas[p].items.indexOf(item) };
  }
  return null;
}
