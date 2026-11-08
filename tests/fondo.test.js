import test from 'node:test';
import assert from 'node:assert/strict';
import { FONDO_POR_DEFECTO, normalizarFondo } from '../js/ui/fondo.js';

test('normalizarFondo: valores rotos vuelven al valor por defecto', () => {
  assert.deepEqual(normalizarFondo({}), FONDO_POR_DEFECTO);
  assert.deepEqual(normalizarFondo({ color: 'rojo', alpha: 'x', textura: 'nada' }), FONDO_POR_DEFECTO);
});

test('normalizarFondo: limita la transparencia a 0–1 y respeta lo válido', () => {
  const f = normalizarFondo({ color: '#AABBCC', alpha: 3, textura: 'agua' });
  assert.deepEqual(f, { color: '#aabbcc', alpha: 1, textura: 'agua' });
  assert.equal(normalizarFondo({ alpha: -2 }).alpha, 0);
});
