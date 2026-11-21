import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { RUTAS_DE_FRASES, rutaDeFrase } from '../js/frases-voz.js';
import { RUTAS_DE_SILABAS, rutaDeSilaba } from '../js/silabas-voz.js';
import { PREGUNTAS_CATEGORIA } from '../js/core/vocabulario.js';
import { ELOGIOS } from '../js/core/elogios.js';

const raiz = new URL('../', import.meta.url);
const SW = readFileSync(new URL('sw.js', raiz), 'utf8');
const DEL_DICCIONARIO = new Set(
  JSON.parse(readFileSync(new URL('data/voces/silabas-diccionario.json', raiz), 'utf8'))
    .map((s) => rutaDeSilaba(s.texto))
    .filter(Boolean),
);

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

test('sílabas con voz: cada mp3 existe, se precachea y la primera sílaba de cada palabra del catálogo tiene voz', () => {
  assert.equal(new Set(RUTAS_DE_SILABAS).size, RUTAS_DE_SILABAS.length);
  for (const ruta of RUTAS_DE_SILABAS) {
    const url = new URL(ruta, raiz);
    assert.ok(existsSync(url), `falta ${ruta}`);
    assert.ok(readFileSync(url).length > 1000, `${ruta} está vacío`);
    // Excepción (plan de sílabas del diccionario, fase 3): esas no se precargan; el service worker las guarda al oírlas.
    if (DEL_DICCIONARIO.has(ruta)) continue;
    assert.ok(SW.includes(`'${ruta}'`), `${ruta} no está en PRECACHE`);
  }
  const catalogo = JSON.parse(readFileSync(new URL('data/vocabulario-inicial.json', raiz), 'utf8'));
  for (const palabra of catalogo) assert.ok(rutaDeSilaba(palabra.silabas[0]), `sin voz la sílaba «${palabra.silabas[0]}» de ${palabra.texto}`);
  assert.notEqual(rutaDeSilaba('pa'), rutaDeSilaba('pá'));
});

test('frases con voz: las que dice la app con montos son genéricas y tienen grabación', () => {
  for (const texto of ['Te faltan monedas', '¡Has ganado tus monedas!', '¡Completaste tu álbum! ¡Has ganado tus monedas!']) {
    assert.ok(rutaDeFrase(texto), `sin voz: ${texto}`);
  }
  for (const pregunta of Object.values(PREGUNTAS_CATEGORIA)) assert.ok(rutaDeFrase(pregunta), `sin voz: ${pregunta}`);
  const cuentos = JSON.parse(readFileSync(new URL('data/cuentos-iniciales.json', raiz), 'utf8'));
  for (const cuento of cuentos) for (const q of cuento.preguntas) assert.ok(rutaDeFrase(q.texto), `sin voz: ${q.texto}`);
});

test('frases con voz: un texto que no es una frase fija no tiene ruta', () => {
  assert.equal(rutaDeFrase('mamá'), null);
  assert.equal(rutaDeFrase(''), null);
  assert.equal(rutaDeFrase('  ¡Genial!  '), 'data/voces/frases/genial.mp3');
});
