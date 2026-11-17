// Estadísticas de escritura para el panel del adulto (Ampliación 5, fase 30). Lógica pura, sin DOM.
//
// Una «palabra» de escritura es un par (elemento, nivel): el progreso va en `<perfil>:<elementoId>:<nivel>` (el dictado `E20` es
// aparte). Aquí se cuenta por nivel cuántas hay nuevas, en práctica, dominadas y aprendidas, y se arma la tabla y el historial.

import { ESTADOS, estaAprendida } from '../progreso.js';
import { resumenDeSesion } from '../estadisticas.js';
import { esDeEscritura } from './comun.js';
import { IDS_DE_NIVELES, nivelPorId } from './niveles.js';

/** 'nueva' | 'practica' | 'dominada' | 'aprendida' de un progreso (o de la falta de uno). */
export function estadoDeEscritura(progreso) {
  if (!progreso || progreso.deleted || (progreso.estado === ESTADOS.NUEVA && !(progreso.historial ?? []).length)) return 'nueva';
  if (progreso.estado === ESTADOS.DOMINADA) return estaAprendida([progreso]) ? 'aprendida' : 'dominada';
  return 'practica';
}

const claveDe = (elementoId, nivel) => `${elementoId}:${nivel}`;

/** Un mapa (elementoId:nivel) → progreso, solo con los de escritura vivos. */
export function mapaDeProgresos(progresos) {
  return new Map((progresos ?? []).filter((p) => !p.deleted && esDeEscritura(p)).map((p) => [claveDe(p.elementoId, p.actividad), p]));
}

/**
 * Una fila por elemento activo, en el orden de los niveles:
 * `{ elemento, nivel, estado, ensayos, aciertos, ultimo }` (`aciertos` = al primer intento; `ultimo` = fecha del último ensayo).
 */
export function tablaDeEscritura({ elementos, progresos }) {
  const mapa = mapaDeProgresos(progresos);
  return (elementos ?? [])
    .filter((e) => e.activa !== false && !e.deleted && IDS_DE_NIVELES.includes(e.nivel))
    .map((elemento, orden) => {
      const p = mapa.get(claveDe(elemento.id, elemento.nivel));
      const historial = p?.historial ?? [];
      return {
        elemento,
        nivel: elemento.nivel,
        estado: estadoDeEscritura(p),
        ensayos: historial.length,
        aciertos: historial.filter((h) => h.correctoAlPrimerIntento).length,
        ultimo: historial.at(-1)?.fecha ?? null,
        orden,
      };
    })
    .sort((a, b) => IDS_DE_NIVELES.indexOf(a.nivel) - IDS_DE_NIVELES.indexOf(b.nivel) || a.orden - b.orden);
}

/** Por nivel: `{ id, nombre, total, nuevas, practica, dominadas, aprendidas }` (todos los niveles, también los vacíos). */
export function resumenPorNivel(filas) {
  return IDS_DE_NIVELES.map((id) => {
    const delNivel = filas.filter((f) => f.nivel === id);
    const cuenta = (estado) => delNivel.filter((f) => f.estado === estado).length;
    return {
      id, nombre: nivelPorId(id)?.nombre ?? id, total: delNivel.length,
      nuevas: cuenta('nueva'), practica: cuenta('practica'), dominadas: cuenta('dominada'), aprendidas: cuenta('aprendida'),
    };
  });
}

/** Totales de todo el modo: palabras que ya practicó, dominadas o aprendidas, sesiones y la última. */
export function resumenDeEscritura({ filas, sesiones }) {
  const propias = (sesiones ?? []).filter((s) => !s.deleted && esDeEscritura(s));
  const ultima = propias.reduce((max, s) => (s.inicio > max ? s.inicio : max), '');
  return {
    palabras: filas.length,
    practicadas: filas.filter((f) => f.estado !== 'nueva').length,
    dominadas: filas.filter((f) => f.estado === 'dominada' || f.estado === 'aprendida').length,
    aprendidas: filas.filter((f) => f.estado === 'aprendida').length,
    sesiones: propias.length,
    ultimaSesion: ultima || null,
  };
}

/**
 * Las últimas sesiones de escritura, la más reciente primero:
 * `{ id, inicio, segundos, palabras, aciertos, conAyuda, nivel, fatiga, interrumpida, nivelElegidoPorNino }`.
 */
export function historialDeEscritura(sesiones, limite = 20) {
  return (sesiones ?? [])
    .filter((s) => !s.deleted && esDeEscritura(s))
    .sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)))
    .slice(0, limite)
    .map((s) => {
      const r = resumenDeSesion(s);
      return {
        id: r.id, inicio: r.inicio, segundos: r.segundos, palabras: r.ensayos, aciertos: r.aciertos, conAyuda: r.conAyuda,
        nivel: s.nivel ?? null, fatiga: r.fatiga, interrumpida: Boolean(s.interrumpida), nivelElegidoPorNino: Boolean(s.nivelElegidoPorNino),
      };
    });
}
