// Calcomanías del álbum: una al terminar cada sesión (PLAN.md §5 y ampliación 2, fase 11).
// Los dibujos son SVG propios en data/calcomanias/<codigo>.svg. El adulto también puede crear
// calcomanías propias (código `propia:<id>`, con foto, pictograma o emoji: almacén `calcomaniasPropias`).

export const CALCOMANIAS = Object.freeze([
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

export const rutaCalcomania = (codigo) => `data/calcomanias/${codigo}.svg`;
export const esPropia = (codigo) => String(codigo).startsWith(PREFIJO_PROPIA);
export const codigoDePropia = (id) => `${PREFIJO_PROPIA}${id}`;
export const idDePropia = (codigo) => String(codigo).slice(PREFIJO_PROPIA.length);

/** Códigos del catálogo propio de la app. */
export const CODIGOS_CATALOGO = Object.freeze(CALCOMANIAS.map((c) => c.codigo));

/**
 * Los códigos que pueden salir hoy: los que el adulto dejó en juego (`album.codigos`, o todo el catálogo si
 * es null) más las propias que siguen existiendo. Los códigos que ya no existen se descartan.
 * @param album    perfil.album normalizado
 * @param propias  calcomanías propias vigentes ({ id })
 */
export function codigosEnJuego(album, propias = []) {
  const existentes = new Set([...CODIGOS_CATALOGO, ...propias.map((p) => codigoDePropia(p.id))]);
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
