import test from 'node:test';
import assert from 'node:assert/strict';
import { acentuar, recetaDe, palabraValida, esExtranjerismo, leerAff, expandir, analizar } from '../herramientas/silabas-diccionario.mjs';

// sílaba -> [receta, texto enviado] (fase 2 de docs/plan-silabas-diccionario.md; la primera regla que calza manda)
const RECETAS = {
  hi: [1, 'í'], her: [1, 'ér'], hor: [1, 'ór'], ham: [1, 'ám'], hier: [1, 'iér'], hí: [1, 'í'],
  ber: [2, 'ber'], der: [2, 'der'],
  ja: [3, 'ja'], jun: [3, 'jun'], jué: [3, 'jue'],
  xi: [4, 'ksí'], ex: [4, 'éks'],
  ceur: [5, 'seúr'], deur: [5, 'deúr'], coir: [5, 'coír'],
  guau: [6, 'guau'], miau: [6, 'miau'], bua: [6, 'bua'],
  miér: [7, 'miér'], nú: [7, 'nú'], tá: [7, 'tá'],
  so: [8, 'só'], mar: [8, 'már'], far: [8, 'fár'], go: [8, 'gó'], cor: [8, 'cór'], doc: [8, 'dóc'],
  nos: [8, 'nós'], lle: [8, 'llé'], ca: [8, 'cá'], qui: [8, 'quí'], gue: [8, 'gué'], cui: [8, 'cuí'],
  guar: [8, 'guár'], buey: [8, 'buéy'], güi: [8, 'güí'],
};

test('recetaDe: cada forma de sílaba cae en su receta', () => {
  const fallos = [];
  for (const [silaba, [receta, enviado]] of Object.entries(RECETAS)) {
    const r = recetaDe(silaba);
    if (r.receta !== receta || r.enviado !== enviado) fallos.push(`${silaba}: esperaba ${receta}/${enviado}, obtuvo ${r.receta}/${r.enviado}`);
  }
  assert.deepEqual(fallos, []);
});

test('acentuar: vocal fuerte, segunda de «ui» y «u» muda en qu/gu', () => {
  assert.equal(acentuar('mar'), 'már');
  assert.equal(acentuar('cui'), 'cuí');
  assert.equal(acentuar('quie'), 'quié');
  assert.equal(acentuar('gui'), 'guí');
  assert.equal(acentuar('mú'), 'mú');
  assert.equal(acentuar('sh'), 'sh');
});

test('palabraValida y esExtranjerismo', () => {
  assert.equal(palabraValida('canción'), true);
  assert.equal(palabraValida('Abad'), true);
  assert.equal(palabraValida('ADSL'), false);
  assert.equal(palabraValida('a1'), false);
  assert.equal(palabraValida('hot-dog'), false);
  assert.equal(esExtranjerismo('kilo'), true);
  assert.equal(esExtranjerismo('show'), true);
  assert.equal(esExtranjerismo('stress'), true);
  assert.equal(esExtranjerismo('casa'), false);
  assert.equal(esExtranjerismo('perro'), false);
});

test('expandir: sufijos, prefijos y combinación', () => {
  const aff = [
    'SFX S Y 2', 'SFX S 0 s [^s]', 'SFX S 0 es s',
    'PFX a Y 1', 'PFX a 0 re .',
  ].join('\n');
  const reglas = leerAff(aff);
  assert.deepEqual([...expandir('casa', ['S'], reglas)].sort(), ['casa', 'casas']);
  assert.deepEqual([...expandir('mes', ['S'], reglas)].sort(), ['mes', 'meses']);
  assert.deepEqual([...expandir('casa', ['S', 'a'], reglas)].sort(), ['casa', 'casas', 'recasa', 'recasas']);
});

test('analizar: sílabas que faltan y cuántas cubren cada porcentaje', () => {
  const palabras = new Map([['casa', 90], ['mesa', 6], ['pato', 3], ['zorro', 1]]);
  const r = analizar(palabras, new Set(['ca', 'sa']));
  assert.deepEqual(r.orden.map(([s]) => s), ['me', 'pa', 'to', 'rro', 'zo']);
  assert.equal(r.todas.yaCubierto, 90);
  assert.equal(r.todas.necesarias[99], 1 + 1 + 1); // me (mesa), pa y to (pato): 99 de 100
  assert.equal(r.todas.necesarias[100], 5);
});
