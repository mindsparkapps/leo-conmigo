// Datos de apoyo para las pruebas (no es una prueba: no termina en .test.js).

import { ESTADOS, idProgreso, nuevoProgreso } from '../js/core/progreso.js';

export const PERFIL_ID = 'p1';
export const ACTIVIDADES = ['L1', 'L2', 'L3', 'L4', 'L5'];

export function palabra(id, texto, categoria = 'otras', orden = 0) {
  return { id, perfilId: PERFIL_ID, texto, categoria, orden, activa: true, tipo: 'sustantivo' };
}

// 14 palabras variadas (id = texto), con orden creciente
const DATOS = [
  ['mamá', 'personas'], ['papá', 'personas'], ['perro', 'animales'], ['gato', 'animales'],
  ['pan', 'comida'], ['leche', 'comida'], ['manzana', 'comida'], ['casa', 'casa'],
  ['mesa', 'casa'], ['pelota', 'juguetes'], ['auto', 'juguetes'], ['globo', 'juguetes'],
  ['mano', 'cuerpo'], ['ojo', 'cuerpo'],
];
export function vocabulario(cantidad = DATOS.length) {
  return DATOS.slice(0, cantidad).map(([texto, categoria], i) => palabra(texto, texto, categoria, i));
}

const ensayoDe = (dia, ok) => ({
  fecha: `2026-10-${String(dia).padStart(2, '0')}T10:00:00`,
  correctoAlPrimerIntento: ok,
  opciones: 2,
});

/**
 * Progreso ya armado.
 *  estado 'dominada': proximoRepaso por defecto ya vencido (2026-10-30).
 *  estado 'practica': historial con `aciertos` de `total` ensayos.
 */
export function progresoCon(elementoId, actividad, estado, { proximoRepaso, aciertos = 2, total = 3, caja = 1 } = {}) {
  const base = nuevoProgreso({ perfilId: PERFIL_ID, elementoId, actividad });
  if (estado === ESTADOS.NUEVA) return base;
  if (estado === ESTADOS.DOMINADA) {
    return {
      ...base,
      estado,
      cajaLeitner: caja,
      proximoRepaso: proximoRepaso === undefined ? '2026-10-30' : proximoRepaso,
      historial: [ensayoDe(1, true), ensayoDe(1, true), ensayoDe(2, true), ensayoDe(2, true)],
    };
  }
  const historial = Array.from({ length: total }, (_, i) => ensayoDe(20 + i, i < aciertos));
  return { ...base, estado, historial };
}

export function idDe(elementoId, actividad) {
  return idProgreso(PERFIL_ID, elementoId, actividad);
}

export const perfil = (ajustes = {}) => ({ id: PERFIL_ID, ajustes });

export const HOY = new Date(2026, 10, 5, 10, 0, 0); // 5 de noviembre de 2026, 10:00 (hora local)
