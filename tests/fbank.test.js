import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularFbank, cuadrosDeFbank, FBANK } from '../js/core/habla/fbank.js';

const referencia = JSON.parse(
  readFileSync(new URL('./datos/fbank-referencia.json', import.meta.url), 'utf8'),
);

test('el fbank de JavaScript coincide con lhotse (error absoluto medio < 0,01)', () => {
  assert.equal(referencia.casos.length, 3);
  for (const caso of referencia.casos) {
    const audio = Float32Array.from(caso.pcm, (v) => v / 32768);
    const { datos, cuadros, bandas } = calcularFbank(audio);
    assert.equal(cuadros, caso.cuadros, `${caso.nombre}: cuadros`);
    assert.equal(bandas, 80);
    // por banda: promedio del error absoluto sobre todos los cuadros
    for (let b = 0; b < bandas; b++) {
      let error = 0;
      for (let c = 0; c < cuadros; c++) error += Math.abs(datos[c * bandas + b] - caso.fbank[c][b]);
      error /= cuadros;
      assert.ok(error < 0.01, `${caso.nombre} banda ${b}: error medio ${error}`);
    }
    // y en conjunto debe ser mucho menor (solo redondeo de float32)
    let total = 0;
    let maximo = 0;
    for (let c = 0; c < cuadros; c++) {
      for (let b = 0; b < bandas; b++) {
        const e = Math.abs(datos[c * bandas + b] - caso.fbank[c][b]);
        total += e;
        maximo = Math.max(maximo, e);
      }
    }
    assert.ok(total / (cuadros * bandas) < 0.001, `${caso.nombre}: error medio ${total / (cuadros * bandas)}`);
    assert.ok(maximo < 0.05, `${caso.nombre}: error máximo ${maximo}`);
  }
});

test('el número de cuadros sigue la regla de lhotse (snip_edges falso)', () => {
  assert.equal(cuadrosDeFbank(16000), 100);
  assert.equal(cuadrosDeFbank(8123), 51);
  assert.equal(cuadrosDeFbank(0), 0);
  assert.equal(calcularFbank(new Float32Array(0)).cuadros, 0);
  assert.equal(FBANK.bandas, 80);
});

test('un audio más corto que la ventana no revienta', () => {
  const { datos, cuadros } = calcularFbank(new Float32Array(100).fill(0.1));
  assert.equal(cuadros, cuadrosDeFbank(100));
  assert.ok(datos.every(Number.isFinite));
});
