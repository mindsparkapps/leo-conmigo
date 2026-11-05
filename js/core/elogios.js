// Elogios hablados, cortos y variados (PLAN.md §2.10).

export const ELOGIOS = Object.freeze(['¡Muy bien!', '¡Eso es!', '¡Lo lograste!', '¡Genial!', '¡Excelente!', '¡Bien hecho!']);

/** Un elogio distinto del anterior. */
export function elegirElogio(anterior = null, aleatorio = Math.random) {
  const posibles = ELOGIOS.filter((e) => e !== anterior);
  return posibles[Math.floor(aleatorio() * posibles.length)];
}
