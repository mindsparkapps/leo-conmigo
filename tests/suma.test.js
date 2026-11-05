import test from 'node:test';
import assert from 'node:assert/strict';
import { generarSuma, esRespuestaCorrecta } from '../js/core/suma.js';

test('generarSuma: siempre dos sumandos de dos cifras', () => {
  for (let i = 0; i < 1000; i++) {
    const { a, b, resultado } = generarSuma();
    assert.ok(a >= 12 && a <= 89, `a fuera de rango: ${a}`);
    assert.ok(b >= 12 && b <= 89, `b fuera de rango: ${b}`);
    assert.equal(resultado, a + b);
  }
});

test('generarSuma: extremos del rango', () => {
  assert.deepEqual(generarSuma(() => 0), { a: 12, b: 12, resultado: 24 });
  assert.deepEqual(generarSuma(() => 0.999999), { a: 89, b: 89, resultado: 178 });
});

test('esRespuestaCorrecta: acepta el resultado exacto con espacios', () => {
  const suma = { a: 34, b: 58, resultado: 92 };
  assert.equal(esRespuestaCorrecta(suma, '92'), true);
  assert.equal(esRespuestaCorrecta(suma, ' 92 '), true);
});

test('esRespuestaCorrecta: rechaza vacío, letras, signos y otros números', () => {
  const suma = { a: 34, b: 58, resultado: 92 };
  for (const texto of ['', '   ', 'noventa', '9 2', '-92', '92.0', '93', '0092', null, undefined]) {
    assert.equal(esRespuestaCorrecta(suma, texto), false, `debió rechazar ${JSON.stringify(texto)}`);
  }
});
