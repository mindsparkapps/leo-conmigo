// Calcomanías del álbum: una al terminar cada sesión (PLAN.md §5 y ampliación 2, fase 11).
// El catálogo por defecto son las láminas de data/laminas/gtaNNN.jpg (miniaturas de las imágenes que eligió el
// adulto; la portada del álbum es data/laminas/portada.jpg). Los 30 dibujos SVG de data/calcomanias/ ya no salen
// por defecto, pero siguen existiendo: un niño que ganó una antes la conserva en su libro.
// El adulto también puede crear calcomanías propias (código `propia:<id>`, con foto, pictograma o emoji:
// almacén `calcomaniasPropias`).

const NUMEROS_LAMINAS = [
  1, 2, 3, 4, 5, 6, 9, 10, 11, 14, 15, 16, 17, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 33, 34, 35, 36, 38, 39,
  40, 41, 43, 44, 46, 47, 48, 49, 50, 51, 52, 54, 56, 57, 58, 59, 61, 63, 64, 66, 67, 68, 71, 72, 74, 76, 77,
  78, 79, 80, 82, 83, 85, 87, 89, 91, 92, 93, 94, 95, 96, 97, 99, 100,
];

export const CALCOMANIAS = Object.freeze(
  NUMEROS_LAMINAS.map((n) => ({ codigo: `gta${String(n).padStart(3, '0')}`, nombre: `Lámina ${n}` })),
);

/** Los dibujos SVG de la primera versión del álbum (ya no están en juego por defecto). */
export const CALCOMANIAS_ANTIGUAS = Object.freeze([
  { codigo: 'estrella', nombre: 'Estrella' },
  { codigo: 'corazon', nombre: 'Corazón' },
  { codigo: 'sol', nombre: 'Sol' },
  { codigo: 'luna', nombre: 'Luna' },
  { codigo: 'flor', nombre: 'Flor' },
  { codigo: 'pez', nombre: 'Pez' },
  { codigo: 'globo', nombre: 'Globo' },
  { codigo: 'casa', nombre: 'Casa' },
  { codigo: 'arcoiris', nombre: 'Arcoíris' },
  { codigo: 'mariposa', nombre: 'Mariposa' },
  { codigo: 'barco', nombre: 'Barco' },
  { codigo: 'arbol', nombre: 'Árbol' },
  { codigo: 'nube', nombre: 'Nube' },
  { codigo: 'gota', nombre: 'Gota' },
  { codigo: 'manzana', nombre: 'Manzana' },
  { codigo: 'helado', nombre: 'Helado' },
  { codigo: 'pelota', nombre: 'Pelota' },
  { codigo: 'auto', nombre: 'Auto' },
  { codigo: 'tortuga', nombre: 'Tortuga' },
  { codigo: 'abeja', nombre: 'Abeja' },
  { codigo: 'conejo', nombre: 'Conejo' },
  { codigo: 'rana', nombre: 'Rana' },
  { codigo: 'pajaro', nombre: 'Pájaro' },
  { codigo: 'cohete', nombre: 'Cohete' },
  { codigo: 'tren', nombre: 'Tren' },
  { codigo: 'regalo', nombre: 'Regalo' },
  { codigo: 'corona', nombre: 'Corona' },
  { codigo: 'paraguas', nombre: 'Paraguas' },
  { codigo: 'hoja', nombre: 'Hoja' },
  { codigo: 'pastel', nombre: 'Pastel' },
]);

export const PREFIJO_PROPIA = 'propia:';

const esLamina = (codigo) => /^gta\d{3}$/.test(String(codigo));
export const rutaCalcomania = (codigo) => (esLamina(codigo) ? `data/laminas/${codigo}.jpg` : `data/calcomanias/${codigo}.svg`);
export const esPropia = (codigo) => String(codigo).startsWith(PREFIJO_PROPIA);
export const codigoDePropia = (id) => `${PREFIJO_PROPIA}${id}`;
export const idDePropia = (codigo) => String(codigo).slice(PREFIJO_PROPIA.length);

/** Códigos del catálogo de la app que salen por defecto (las láminas). */
export const CODIGOS_CATALOGO = Object.freeze(CALCOMANIAS.map((c) => c.codigo));

/** Todos los códigos de la app que existen (láminas y dibujos antiguos): sirve para descartar los que ya no existen. */
export const CODIGOS_EXISTENTES = Object.freeze([...CODIGOS_CATALOGO, ...CALCOMANIAS_ANTIGUAS.map((c) => c.codigo)]);

/**
 * Los códigos que pueden salir hoy: los que el adulto dejó en juego (`album.codigos`, o todo el catálogo si
 * es null) más las propias que siguen existiendo. Los códigos que ya no existen se descartan.
 * @param album    perfil.album normalizado
 * @param propias  calcomanías propias vigentes ({ id })
 */
export function codigosEnJuego(album, propias = []) {
  const existentes = new Set([...CODIGOS_EXISTENTES, ...propias.map((p) => codigoDePropia(p.id))]);
  const lista = album?.codigos ?? [...CODIGOS_CATALOGO, ...propias.map((p) => codigoDePropia(p.id))];
  return [...new Set(lista)].filter((c) => existentes.has(c));
}

/**
 * Elige la calcomanía de hoy: una que NO esté en el álbum actual (así no hay repetidas dentro de un álbum).
 * @param enAlbum  códigos que ya tiene el álbum actual
 * @param enJuego  códigos que pueden salir (por defecto, todo el catálogo)
 * @returns { codigo, esNueva }  `esNueva` es false solo si ya tiene todas las que están en juego
 */
export function elegirCalcomania(enAlbum, aleatorio = Math.random, enJuego = CODIGOS_CATALOGO) {
  const propias = new Set(enAlbum);
  const nuevas = enJuego.filter((c) => !propias.has(c));
  const lista = nuevas.length ? nuevas : enJuego;
  const codigo = lista[Math.floor(aleatorio() * lista.length)];
  return { codigo, esNueva: nuevas.length > 0 };
}
