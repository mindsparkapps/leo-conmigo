// Datos de apoyo para probar etapas, frases y libros (no es una prueba: no termina en .test.js).

import { PERFIL_ID, vocabulario } from './ayudas.js';
import { silabear } from '../js/core/silabas.js';

/**
 * 14 palabras del niño más «come» y «bebe». Todas tienen emoji; las de posición par tienen además foto
 * (medioImagenId), así que sirven para «misma cosa». id = texto.
 */
export function palabrasDelNino() {
  const base = vocabulario(14).map((p, i) => ({ ...p, emoji: '🍎', ...(i % 2 === 0 ? { medioImagenId: `img-${p.id}` } : {}) }));
  const verbos = ['come', 'bebe'].map((t, i) => ({
    id: t, perfilId: PERFIL_ID, texto: t, categoria: 'enlace', tipo: 'enlace', orden: 14 + i, activa: true, emoji: '😋',
  }));
  return [...base, ...verbos];
}

/**
 * Palabras para la etapa 3 (id = texto, con foto de cada una). Las `leidas` ya se dominan en L4; `nuevas` no se han visto
 * y están hechas con sílabas de las leídas (masa = ma·sa, mapa = ma·pa); «luna» tiene sílabas desconocidas.
 */
export function palabrasSilabas() {
  const leidas = ['mamá', 'mano', 'cama', 'casa', 'mesa', 'pato', 'gato', 'pelota', 'taza', 'pan'];
  const nuevas = ['masa', 'mapa', 'luna'];
  return [...leidas, ...nuevas].map((texto, i) => ({
    id: texto, perfilId: PERFIL_ID, texto, categoria: 'otras', tipo: 'sustantivo', orden: i, activa: true,
    emoji: '🍎', medioImagenId: `img-${texto}`, silabas: silabear(texto),
  }));
}
export const LEIDAS_SILABAS = ['mamá', 'mano', 'cama', 'casa', 'mesa', 'pato', 'gato', 'pelota', 'taza', 'pan'];

export function frase(id, palabraIds, extra = {}) {
  return { id, perfilId: PERFIL_ID, palabraIds, texto: palabraIds.join(' '), orden: 0, activa: true, medioImagenId: null, ...extra };
}

/** Cuatro frases con las palabras anteriores. */
export function frasesDelNino() {
  return [
    frase('f1', ['papá', 'come', 'pan'], { orden: 0 }),
    frase('f2', ['mamá', 'come', 'manzana'], { orden: 1 }),
    frase('f3', ['mamá', 'bebe', 'leche'], { orden: 2 }),
    frase('f4', ['gato', 'come', 'pan'], { orden: 3 }),
  ];
}
