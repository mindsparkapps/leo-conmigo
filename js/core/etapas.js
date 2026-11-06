// Etapas del aprendizaje y su desbloqueo (PLAN.md §3 y §4). Lógica pura.

import { ESTADOS } from './progreso.js';

export const ACTIVIDADES_POR_ETAPA = Object.freeze({
  0: Object.freeze(['P1', 'P2', 'P3']),
  1: Object.freeze(['L1', 'L2', 'L3', 'L4', 'L5']),
  2: Object.freeze(['F1', 'F2', 'F3']),
  3: Object.freeze(['S1', 'S2', 'S3', 'S4']),
});

// Palabras dominadas en L4 ("leer": ve la palabra y toca el dibujo) que desbloquean cada etapa.
export const ACTIVIDAD_CLAVE = 'L4';
export const UMBRAL_ETAPA_2 = 10;
export const UMBRAL_ETAPA_3 = 20;

/** Cuántos elementos distintos están dominados en una actividad. */
export function contarDominadas(progresos, actividad = ACTIVIDAD_CLAVE) {
  const ids = new Set();
  for (const p of progresos) {
    if (p.actividad === actividad && p.estado === ESTADOS.DOMINADA && !p.deleted) ids.add(p.elementoId);
  }
  return ids.size;
}

/** Etapas cuyas actividades ya existen en la app. (La etapa 4, cuentos con preguntas, no es de sesiones: son libros.) */
export const ETAPAS_HECHAS = Object.freeze([0, 1, 2, 3]);

export const NOMBRE_ETAPA = Object.freeze({
  0: 'Etapa 0 · Ver y emparejar imágenes',
  1: 'Etapa 1 · Palabras',
  2: 'Etapa 2 · Frases',
  3: 'Etapa 3 · Sílabas',
});

/**
 * Etapas disponibles para el niño. Las etapas 0 y 1 están siempre disponibles;
 * la 2 y la 3 se abren solas por umbral. El adulto puede forzar o bloquear cualquiera.
 */
export function etapasDesbloqueadas({ progresos = [], forzadas = [], bloqueadas = [] } = {}) {
  const dominadas = contarDominadas(progresos);
  const etapas = new Set([0, 1]);
  if (dominadas >= UMBRAL_ETAPA_2) etapas.add(2);
  if (dominadas >= UMBRAL_ETAPA_3) etapas.add(3);
  for (const e of forzadas) etapas.add(e);
  for (const e of bloqueadas) etapas.delete(e);
  return [...etapas].sort((a, b) => a - b);
}

/** Cuántas palabras leídas faltan para abrir una etapa (0 si ya se alcanzó o no depende de eso). */
export function palabrasQueFaltan(etapa, progresos) {
  const umbral = etapa === 2 ? UMBRAL_ETAPA_2 : etapa === 3 ? UMBRAL_ETAPA_3 : 0;
  return Math.max(0, umbral - contarDominadas(progresos));
}

/**
 * Etapa que se practica hoy: la elegida por el adulto (`etapaActual`) si está abierta y hecha;
 * si no, la más alta abierta y hecha que sea menor; y si tampoco, la 1.
 */
export function etapaEfectiva({ etapaActual = 1, desbloqueadas, hechas = ETAPAS_HECHAS }) {
  const usables = desbloqueadas.filter((e) => hechas.includes(e));
  if (usables.includes(etapaActual)) return etapaActual;
  const menores = usables.filter((e) => e < etapaActual);
  if (menores.length) return Math.max(...menores);
  return usables.length ? Math.min(...usables) : 1;
}
