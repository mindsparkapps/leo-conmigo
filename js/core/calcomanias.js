// Calcomanías del álbum: una al terminar cada sesión (PLAN.md §5).
// Los dibujos son SVG propios en data/calcomanias/<codigo>.svg.

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
]);

export const rutaCalcomania = (codigo) => `data/calcomanias/${codigo}.svg`;

/**
 * Elige la calcomanía de hoy: una que el niño aún no tenga; si ya las tiene todas, una cualquiera.
 * @param tenidas  códigos que ya tiene
 * @returns { codigo, esNueva }
 */
export function elegirCalcomania(tenidas, aleatorio = Math.random) {
  const propias = new Set(tenidas);
  const nuevas = CALCOMANIAS.filter((c) => !propias.has(c.codigo));
  const lista = nuevas.length ? nuevas : CALCOMANIAS;
  const elegida = lista[Math.floor(aleatorio() * lista.length)];
  return { codigo: elegida.codigo, esNueva: nuevas.length > 0 };
}
