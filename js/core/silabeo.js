// Datos de la etapa 3 (sílabas, PLAN.md §3). Lógica pura, sin DOM.
//
// La etapa 3 solo parte de palabras que el niño YA lee (dominadas en L4):
//   S1 «descubro la sílaba»  palabra leída con otra palabra leída que empieza con la misma sílaba
//   S2 «completo la palabra» palabra leída de 2 o más sílabas
//   S3 «armo la palabra»     palabra leída de 2 o más sílabas
//   S4 «palabra nueva»       palabra NUNCA vista hecha solo con sílabas que ya domina
// Cada palabra se «anota» con lo que necesitan esas actividades para decidir si le corresponden.

import { ACTIVIDADES_POR_ETAPA } from './etapas.js';
import { ESTADOS, idProgreso } from './progreso.js';
import { silabear } from './silabas.js';

export const ACTIVIDAD_LEIDA = 'L4';

/** Una sílaba sin tilde ni mayúsculas, para compararlas («má» y «ma» cuentan como la misma). */
export const claveSilaba = (silaba) => String(silaba).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Las sílabas de una palabra: las que fijó el adulto o, si faltan, la división automática. */
export function silabasDe(palabra) {
  const lista = Array.isArray(palabra.silabas) ? palabra.silabas.map((s) => String(s).trim()).filter(Boolean) : [];
  return lista.length ? lista : silabear(palabra.texto);
}

/** ¿Empiezan con la misma sílaba? */
export const empiezanIgual = (a, b) => claveSilaba(silabasDe(a)[0] ?? '') === claveSilaba(silabasDe(b)[0] ?? '');

/**
 * Anota cada palabra con lo que usan S1–S4 y devuelve también los ids de las palabras que el niño ya vio
 * en la etapa 1 (sirven como distractores desde el primer ensayo).
 *
 * Cada elemento anotado trae: `silabas`, `leida`, `conMismaSilaba` (S1), `paraS4` y `vistaAntes`.
 */
export function anotarParaSilabas({ perfilId, palabras, progresos }) {
  const porId = new Map(progresos.filter((p) => !p.deleted).map((p) => [p.id, p]));
  const progresoDe = (id, actividad) => porId.get(idProgreso(perfilId, id, actividad));
  const esLeida = (id) => progresoDe(id, ACTIVIDAD_LEIDA)?.estado === ESTADOS.DOMINADA;
  const vistaEnEtapa1 = (id) =>
    ACTIVIDADES_POR_ETAPA[1].some((a) => {
      const p = progresoDe(id, a);
      return Boolean(p) && (p.historial.length > 0 || p.estado === ESTADOS.DOMINADA);
    });

  const base = palabras.map((p) => ({ ...p, silabas: silabasDe(p) }));
  const conocidas = new Set(); // sílabas de palabras leídas
  const primeras = new Map(); // primera sílaba -> cuántas palabras leídas empiezan así
  for (const p of base) {
    if (!esLeida(p.id)) continue;
    for (const s of p.silabas) conocidas.add(claveSilaba(s));
    const inicio = claveSilaba(p.silabas[0]);
    primeras.set(inicio, (primeras.get(inicio) ?? 0) + 1);
  }

  const elementos = base.map((p) => {
    const leida = esLeida(p.id);
    const vistaAntes = leida || vistaEnEtapa1(p.id);
    return {
      ...p,
      leida,
      vistaAntes,
      conMismaSilaba: leida && p.silabas.length >= 2 && (primeras.get(claveSilaba(p.silabas[0])) ?? 0) >= 2,
      paraS4: !vistaAntes && p.silabas.length >= 2 && p.silabas.every((s) => conocidas.has(claveSilaba(s))),
    };
  });
  return { elementos, vistasPrevias: new Set(elementos.filter((e) => e.vistaAntes).map((e) => e.id)) };
}

/**
 * Sílabas para usar como distractores (en S2 y S3): de las palabras que se pasan, sin repetir
 * (por clave) y sin ninguna de `excluir` (claves). Devuelve como máximo `cantidad`, en orden de aparición.
 */
export function silabasDistractoras({ palabras, excluir = [], cantidad }) {
  const vetadas = new Set(excluir.map(claveSilaba));
  const elegidas = [];
  for (const p of palabras) {
    for (const s of silabasDe(p)) {
      if (elegidas.length >= cantidad) return elegidas;
      const clave = claveSilaba(s);
      if (vetadas.has(clave)) continue;
      vetadas.add(clave);
      elegidas.push(s);
    }
  }
  return elegidas;
}
