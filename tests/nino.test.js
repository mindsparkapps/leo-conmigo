import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ELOGIOS, elegirElogio } from '../js/core/elogios.js';
import { CALCOMANIAS, elegirCalcomania, rutaCalcomania } from '../js/core/calcomanias.js';
import { crearAleatorio } from '../js/core/azar.js';

// ---------- elogios ----------

test('elogios: cortos, en español y sin repetir el anterior', () => {
  assert.ok(ELOGIOS.length >= 4);
  assert.ok(ELOGIOS.every((e) => e.length <= 16 && e.startsWith('¡') && e.endsWith('!')));
  const azar = crearAleatorio(8);
  let anterior = null;
  const usados = new Set();
  for (let i = 0; i < 1000; i++) {
    const e = elegirElogio(anterior, azar);
    assert.ok(ELOGIOS.includes(e));
    assert.notEqual(e, anterior);
    usados.add(e);
    anterior = e;
  }
  assert.equal(usados.size, ELOGIOS.length, 'deben usarse todos');
});

// ---------- calcomanías ----------

test('calcomanías: 30 distintas, cada una con su dibujo SVG', () => {
  assert.equal(CALCOMANIAS.length, 30);
  assert.equal(new Set(CALCOMANIAS.map((c) => c.codigo)).size, 30);
  for (const { codigo, nombre } of CALCOMANIAS) {
    assert.ok(nombre.length > 0);
    const ruta = new URL(`../${rutaCalcomania(codigo)}`, import.meta.url);
    assert.ok(existsSync(ruta), `falta ${rutaCalcomania(codigo)}`);
    const texto = readFileSync(ruta, 'utf8');
    assert.match(texto, /^<svg[^>]+viewBox="0 0 100 100"/, codigo);
    assert.match(texto, /<\/svg>\s*$/, codigo);
    // Nunca rojo (el rojo se reserva para lo que la app evita mostrarle al niño)
    assert.ok(!/\bred\b/i.test(texto), `${codigo}: usa el color "red"`);
    for (const [, hex] of texto.matchAll(/#([0-9a-f]{6})\b/gi)) {
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
      assert.ok(!(r > 190 && g < 100 && b < 100), `${codigo}: #${hex} es rojo`);
    }
  }
});

test('calcomanías: primero las que no tiene; recién con todo lo que está en juego se repiten', () => {
  const azar = crearAleatorio(3);
  const tenidas = [];
  for (let i = 0; i < CALCOMANIAS.length; i++) {
    const { codigo, esNueva } = elegirCalcomania(tenidas, azar);
    assert.equal(esNueva, true);
    assert.ok(!tenidas.includes(codigo), `repetida antes de tiempo: ${codigo}`);
    tenidas.push(codigo);
  }
  assert.equal(tenidas.length, CALCOMANIAS.length);
  const repetida = elegirCalcomania(tenidas, azar);
  assert.equal(repetida.esNueva, false);
  assert.ok(tenidas.includes(repetida.codigo));
});

test('calcomanías: la ruta es la del dibujo', () => {
  assert.equal(rutaCalcomania('estrella'), 'data/calcomanias/estrella.svg');
});
