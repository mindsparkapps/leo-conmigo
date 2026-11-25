import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  leerTokens, decodificarVoraz, traducirSegmentos, fonemasComoTexto, MS_POR_CUADRO,
} from '../js/core/habla/decodificar.js';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const tokens = leerTokens(leer('../data/habla/tokens-zipa.txt'));
const simbolos = JSON.parse(leer('../data/habla/simbolos.json'));

test('tokens-zipa.txt tiene los 127 tokens con los ids que se esperan', () => {
  assert.equal(tokens.length, 127);
  assert.ok(tokens.every((t) => typeof t === 'string' && t.length > 0));
  assert.equal(tokens[0], '<blk>');
  assert.equal(tokens[3], '▁');
  assert.equal(tokens[4], 'a');
  assert.equal(tokens[29], 'z');
  assert.equal(tokens[80], 'ɾ');
  assert.equal(tokens[122], 'β');
  assert.equal(tokens[123], 'θ');
  assert.equal(tokens[124], 'χ');
});

test('simbolos.json cubre los 127 tokens, en el mismo orden y sin repetirlos', () => {
  assert.equal(simbolos.tokens.length, 127);
  simbolos.tokens.forEach((t, i) => {
    assert.equal(t.id, i);
    assert.equal(t.ipa, tokens[i], `el token ${i} cambió`);
  });
});

test('todo fonema del inventario tiene al menos un token y todo token apunta a uno', () => {
  const inventario = new Set(simbolos.inventario.map((f) => f.id));
  assert.equal(inventario.size, simbolos.inventario.length, 'inventario sin repetidos');
  for (const id of inventario) {
    assert.ok(simbolos.tokens.some((t) => t.fonema === id), `ningún token da /${id}/`);
  }
  for (const t of simbolos.tokens) {
    if (t.tipo === 'fonema') assert.ok(inventario.has(t.fonema), `${t.ipa} → ${t.fonema} fuera del inventario`);
    else assert.equal(t.fonema, null, `${t.ipa} no debería tener fonema`);
  }
});

test('las uniones de alófonos y las variantes chilenas del plan', () => {
  const de = (ipa) => simbolos.tokens.find((t) => t.ipa === ipa);
  assert.equal(de('β').fonema, 'b');
  assert.equal(de('ð').fonema, 'd');
  assert.equal(de('ɣ').fonema, 'g');
  assert.equal(de('ʃ').fonema, 'tʃ');
  assert.equal(de('h').fonema, 'h');
  assert.equal(de('ɹ').fonema, 'ř');
  assert.equal(de('ʐ').fonema, 'ř');
  assert.equal(de('ɾ').fonema, 'ɾ');
  assert.equal(de('r').fonema, 'r');
  assert.equal(de('θ').tipo, 'otro', 'en Chile no hay /θ/');
  assert.equal(de('χ').fonema, 'x');
  assert.equal(de('<blk>').tipo, 'especial');
  assert.equal(de('ː').tipo, 'modificador');
});

test('decodificarVoraz: quita el blanco, junta repetidos y separa «a _ a»', () => {
  const V = 5;
  const fila = (id) => Array.from({ length: V }, (_, v) => Math.log(v === id ? 0.9 : 0.025));
  // a a _ a b b _ _ c
  const ids = [1, 1, 0, 1, 2, 2, 0, 0, 3];
  const logProbs = Float32Array.from(ids.flatMap(fila));
  const seg = decodificarVoraz(logProbs, ids.length, V);
  assert.deepEqual(seg.map((s) => s.id), [1, 1, 2, 3]);
  assert.deepEqual([seg[0].desde, seg[0].hasta], [0, 2]);
  assert.deepEqual([seg[2].desde, seg[2].hasta], [4, 6]);
  assert.ok(Math.abs(seg[0].prob - 0.9) < 1e-6);
  assert.equal(MS_POR_CUADRO, 20);
});

test('traducirSegmentos deja los fonemas del inventario y marca lo de fuera', () => {
  const id = (ipa) => tokens.indexOf(ipa);
  const seg = ['p', 'ɛ', 'ɾ', 'o', 'θ'].map((ipa, i) => ({ id: id(ipa), desde: i, hasta: i + 1, prob: 0.9 }));
  seg.splice(1, 0, { id: 3, desde: 1, hasta: 1, prob: 1 }, { id: id('ː'), desde: 1, hasta: 1, prob: 1 });
  const traducidos = traducirSegmentos(seg, simbolos);
  assert.equal(fonemasComoTexto(traducidos), 'p e ɾ o ?θ');
});
