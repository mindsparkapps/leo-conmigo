import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { RUTAS_DE_FRASES, rutaDeFrase } from '../js/frases-voz.js';
import { ELOGIOS } from '../js/core/elogios.js';

const raiz = new URL('../', import.meta.url);
const SW = readFileSync(new URL('sw.js', raiz), 'utf8');

test('frases con voz: cada mp3 existe, no está vacío y se precachea', () => {
  assert.equal(new Set(RUTAS_DE_FRASES).size, RUTAS_DE_FRASES.length);
  for (const ruta of RUTAS_DE_FRASES) {
    const url = new URL(ruta, raiz);
    assert.ok(existsSync(url), `falta ${ruta}`);
    assert.ok(readFileSync(url).length > 1000, `${ruta} está vacío`);
    assert.ok(SW.includes(`'${ruta}'`), `${ruta} no está en PRECACHE`);
  }
});

test('frases con voz: todos los elogios y las consignas fijas de las actividades tienen grabación', () => {
  for (const elogio of ELOGIOS) assert.ok(rutaDeFrase(elogio), `sin voz: ${elogio}`);
  const actividades = ['F1', 'F2', 'F3', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'P1', 'P2', 'S1', 'S2', 'S3', 'S4'];
  for (const a of actividades) {
    const fuente = readFileSync(new URL(`js/actividades/${a}.js`, raiz), 'utf8');
    const consigna = fuente.match(/^\s*consigna: '([^']+)'/m)?.[1];
    assert.ok(consigna, `${a}: no se encontró la consigna`);
    assert.ok(rutaDeFrase(consigna), `${a}: la consigna «${consigna}» no tiene voz`);
  }
});

test('frases con voz: un texto que no es una frase fija no tiene ruta', () => {
  assert.equal(rutaDeFrase('mamá'), null);
  assert.equal(rutaDeFrase(''), null);
  assert.equal(rutaDeFrase('  ¡Genial!  '), 'data/voces/frases/genial.mp3');
});
