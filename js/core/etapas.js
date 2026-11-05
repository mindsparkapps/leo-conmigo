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
