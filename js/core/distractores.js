// Elección de distractores (PLAN.md §4). Lógica pura.
//
// Reglas:
//  - Nunca se usa como distractor una palabra que el niño aún no ha visto (`vistas`).
//  - Nivel fácil: otra primera letra, largo distinto en 2 letras o más y otra categoría.
//    Si no alcanzan las palabras que cumplen todo, se relaja primero la categoría,
//    luego el largo y por último la primera letra.
//  - Nivel normal: cualquier palabra activa y vista distinta de la objetivo.
//
// Puede devolver menos distractores de los pedidos (si el niño ha visto pocas palabras):
// quien llame debe mostrar menos opciones, nunca palabras sin ver.

import { barajar } from './azar.js';

const normalizar = (texto) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * @param objetivo   palabra que debe acertar el niño ({ id, texto, categoria })
 * @param vocabulario todas las palabras del perfil
 * @param opciones   { cantidad, facil, vistas (Set de ids ya vistos), aleatorio }
 * @returns lista de palabras (como máximo `cantidad`)
 */
export function elegirDistractores(objetivo, vocabulario, {
  cantidad, facil = false, vistas, aleatorio = Math.random, soloOtraCategoria = false, excluirIds = [], incluirIds = [],
}) {
  if (!(vistas instanceof Set)) {
    throw new TypeError('`vistas` debe ser un Set con los ids de las palabras que el niño ya vio');
  }
  if (!(cantidad > 0)) return [];

  const textoObjetivo = normalizar(objetivo.texto);
  // `soloOtraCategoria` (actividad «clasificar»): ningún distractor puede ser de la misma categoría
  // que la correcta, porque entonces habría dos respuestas válidas.
  let candidatas = vocabulario.filter(
    (p) =>
      p.id !== objetivo.id &&
      p.activa !== false &&
      !p.deleted &&
      vistas.has(p.id) &&
      normalizar(p.texto) !== textoObjetivo &&
      !(soloOtraCategoria && p.categoria === objetivo.categoria),
  );
  // `excluirIds`: palabras que se prefiere no usar (si quedan palabras de sobra); `incluirIds`: se usan primero.
  if (excluirIds.length) {
    const sin = candidatas.filter((p) => !excluirIds.includes(p.id));
    if (sin.length >= cantidad) candidatas = sin;
  }

  const otraLetra = (p) => normalizar(p.texto)[0] !== textoObjetivo[0];
  const otroLargo = (p) => Math.abs(p.texto.length - objetivo.texto.length) >= 2;
  const otraCategoria = (p) => p.categoria == null || objetivo.categoria == null || p.categoria !== objetivo.categoria;

  const pasos = facil
    ? [[otraLetra, otroLargo, otraCategoria], [otraLetra, otroLargo], [otraLetra], []]
    : [[]];

  const elegidas = [];
  const textosUsados = new Set([textoObjetivo]);
  for (const p of candidatas.filter((c) => incluirIds.includes(c.id))) {
    if (elegidas.length >= cantidad) break;
    elegidas.push(p);
    textosUsados.add(normalizar(p.texto));
  }
  for (const reglas of pasos) {
    if (elegidas.length >= cantidad) break;
    for (const p of barajar(candidatas, aleatorio)) {
      if (elegidas.length >= cantidad) break;
      const texto = normalizar(p.texto);
      if (textosUsados.has(texto) || elegidas.includes(p)) continue;
      if (!reglas.every((regla) => regla(p))) continue;
      elegidas.push(p);
      textosUsados.add(texto);
    }
  }
  return elegidas;
}
