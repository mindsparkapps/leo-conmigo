import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ETAPAS_HECHAS, NOMBRE_ETAPA, UMBRAL_ETAPA_2, UMBRAL_ETAPA_3, etapaEfectiva, etapasDesbloqueadas, palabrasQueFaltan,
} from '../js/core/etapas.js';
import { normalizarAjustes } from '../js/core/modelos.js';
import { ESTADOS } from '../js/core/progreso.js';

const dominadasL4 = (n) => Array.from({ length: n }, (_, i) => ({ elementoId: `w${i}`, actividad: 'L4', estado: ESTADOS.DOMINADA }));

test('las etapas hechas son la 0, la 1 y la 2, y todas tienen nombre', () => {
  assert.deepEqual([...ETAPAS_HECHAS], [0, 1, 2]);
  for (const e of [0, 1, 2, 3]) assert.ok(NOMBRE_ETAPA[e].length > 0);
});

test('etapaEfectiva: usa la elegida si está abierta', () => {
  assert.equal(etapaEfectiva({ etapaActual: 1, desbloqueadas: [0, 1] }), 1);
  assert.equal(etapaEfectiva({ etapaActual: 0, desbloqueadas: [0, 1] }), 0);
  assert.equal(etapaEfectiva({ etapaActual: 2, desbloqueadas: [0, 1, 2] }), 2);
});

test('etapaEfectiva: si la elegida no está abierta, baja a la más alta abierta que sea menor', () => {
  assert.equal(etapaEfectiva({ etapaActual: 2, desbloqueadas: [0, 1] }), 1);
  assert.equal(etapaEfectiva({ etapaActual: 2, desbloqueadas: [0] }), 0);
  assert.equal(etapaEfectiva({ etapaActual: 1, desbloqueadas: [0] }), 0, 'el adulto bloqueó la 1');
});

test('etapaEfectiva: una etapa aún no hecha (la 3) no se usa aunque esté abierta', () => {
  assert.equal(etapaEfectiva({ etapaActual: 3, desbloqueadas: [0, 1, 2, 3] }), 2);
  assert.equal(etapaEfectiva({ etapaActual: 3, desbloqueadas: [0, 1, 3] }), 1);
});

test('etapaEfectiva: si no queda nada usable, la 1; por defecto la elegida es la 1', () => {
  assert.equal(etapaEfectiva({ etapaActual: 1, desbloqueadas: [] }), 1);
  assert.equal(etapaEfectiva({ etapaActual: 1, desbloqueadas: [3] }), 1);
  assert.equal(etapaEfectiva({ desbloqueadas: [0, 1] }), 1);
  assert.equal(etapaEfectiva({ etapaActual: 0, desbloqueadas: [1, 2] }), 1, 'bloqueó la 0 y ninguna menor sirve: sube a la menor abierta');
});

test('etapaEfectiva junto con etapasDesbloqueadas: umbral, forzar y bloquear', () => {
  const abiertas = (progresos, forzadas = [], bloqueadas = []) => etapasDesbloqueadas({ progresos, forzadas, bloqueadas });
  assert.equal(etapaEfectiva({ etapaActual: 2, desbloqueadas: abiertas(dominadasL4(UMBRAL_ETAPA_2 - 1)) }), 1, 'aún no llega al umbral');
  assert.equal(etapaEfectiva({ etapaActual: 2, desbloqueadas: abiertas(dominadasL4(UMBRAL_ETAPA_2)) }), 2, 'llegó al umbral');
  assert.equal(etapaEfectiva({ etapaActual: 2, desbloqueadas: abiertas([], [2]) }), 2, 'el adulto la abrió ya');
  assert.equal(etapaEfectiva({ etapaActual: 2, desbloqueadas: abiertas(dominadasL4(UMBRAL_ETAPA_2), [], [2]) }), 1, 'el adulto la bloqueó');
  assert.equal(etapaEfectiva({ etapaActual: 1, desbloqueadas: abiertas([], [], [1]) }), 0);
});

test('palabrasQueFaltan: cuántas palabras leídas faltan para abrir una etapa', () => {
  assert.equal(palabrasQueFaltan(2, dominadasL4(4)), UMBRAL_ETAPA_2 - 4);
  assert.equal(palabrasQueFaltan(3, dominadasL4(4)), UMBRAL_ETAPA_3 - 4);
  assert.equal(palabrasQueFaltan(2, dominadasL4(UMBRAL_ETAPA_2 + 5)), 0, 'nunca negativo');
  assert.equal(palabrasQueFaltan(1, []), 0, 'las etapas 0 y 1 no dependen de eso');
  assert.equal(palabrasQueFaltan(0, []), 0);
});

test('ajustes: las etapas forzadas y bloqueadas se limpian (sin repetidos, solo 0 a 3) y forzar gana', () => {
  const a = normalizarAjustes({ etapasForzadas: [2, '2', 2, 9, -1, 'x'], etapasBloqueadas: [2, 3, 3, 0] });
  assert.deepEqual(a.etapasForzadas, [2]);
  assert.deepEqual(a.etapasBloqueadas, [0, 3], 'si una etapa está en las dos listas, se abre');
  const vacios = normalizarAjustes({ etapasForzadas: 'no es lista', etapasBloqueadas: null });
  assert.deepEqual([vacios.etapasForzadas, vacios.etapasBloqueadas], [[], []]);
  assert.deepEqual([normalizarAjustes().etapasForzadas, normalizarAjustes().etapasBloqueadas], [[], []]);
});
