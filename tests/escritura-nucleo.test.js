// Fase 27 (Ampliación 5): núcleo puro del modo Escritura: niveles, banco de palabras y armado de piezas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crearAleatorio } from '../js/core/azar.js';
import { claveSilaba } from '../js/core/silabeo.js';
import { esDeEscritura, idDeBanco } from '../js/core/escritura/comun.js';
import { IDS_DE_NIVELES, NIVELES, analizarSilaba, nivelDe, nivelPorId, nivelSiguiente, rasgosDe } from '../js/core/escritura/niveles.js';
import { armarPiezas, silabasLejanas, silabasParecidas } from '../js/core/escritura/piezas.js';

const banco = JSON.parse(readFileSync(new URL('../data/escritura/banco.json', import.meta.url), 'utf8'));
const MINIMO = (nivel) => (nivel === 'E13' || nivel === 'E15' ? 4 : 12);
const pal = (texto, silabas) => ({ texto, silabas });

// ─── Niveles ───────────────────────────────────────────────────────────────────────────────────────────────────

test('los 20 niveles, de E01 a E20, con nombre, dificultad, ejemplo y unidad', () => {
  assert.equal(NIVELES.length, 20);
  NIVELES.forEach((n, i) => {
    assert.equal(n.id, `E${String(i + 1).padStart(2, '0')}`);
    assert.equal(n.numero, i + 1);
    for (const campo of ['nombre', 'dificultad', 'ejemplo', 'unidad']) assert.ok(n[campo], `${n.id} sin ${campo}`);
  });
  assert.deepEqual(IDS_DE_NIVELES, NIVELES.map((n) => n.id));
  assert.equal(nivelPorId('E07').nombre, 'Sílabas con GU y GÜ');
  assert.equal(nivelSiguiente('E01'), 'E02');
  assert.equal(nivelSiguiente('E20'), null);
  assert.equal(nivelPorId('E01').unidad, 'vocal');
  assert.equal(nivelPorId('E18').unidad, 'palabra');
  assert.equal(nivelPorId('E10').unidad, 'silaba');
  assert.equal(nivelPorId('E04').dificultad, 'Fácil');
  assert.equal(nivelPorId('E13').dificultad, 'Avanzada');
});

test('analizarSilaba: ataque, núcleo y coda', () => {
  assert.deepEqual(analizarSilaba('ma'), { ataque: 'm', nucleo: 'a', coda: '' });
  assert.deepEqual(analizarSilaba('sol'), { ataque: 's', nucleo: 'o', coda: 'l' });
  assert.deepEqual(analizarSilaba('que'), { ataque: 'qu', nucleo: 'e', coda: '' });
  assert.deepEqual(analizarSilaba('güe'), { ataque: 'gü', nucleo: 'e', coda: '' });
  assert.deepEqual(analizarSilaba('gua'), { ataque: 'g', nucleo: 'ua', coda: '' });
  assert.deepEqual(analizarSilaba('guau'), { ataque: 'g', nucleo: 'uau', coda: '' });
  assert.deepEqual(analizarSilaba('guay'), { ataque: 'g', nucleo: 'uay', coda: '' });
  assert.deepEqual(analizarSilaba('ya'), { ataque: 'y', nucleo: 'a', coda: '' });
  assert.deepEqual(analizarSilaba('pla'), { ataque: 'pl', nucleo: 'a', coda: '' });
  assert.deepEqual(analizarSilaba('tlán'), { ataque: 'tl', nucleo: 'a', coda: 'n' });
  assert.deepEqual(analizarSilaba('al'), { ataque: '', nucleo: 'a', coda: 'l' });
});

test('nivelDe: un ejemplo de cada rasgo', () => {
  const casos = [
    [['a'], 'E01'],
    [['ma', 'sa'], 'E02'],
    [['a', 'be', 'ja'], 'E02'],
    [['le', 'che'], 'E03'],
    [['po', 'llo'], 'E04'],
    [['u', 'ña'], 'E05'],
    [['que', 'so'], 'E06'],
    [['gui', 'so'], 'E07'],
    [['ci', 'güe', 'ña'], 'E07'],
    [['ra', 'na'], 'E08'],
    [['pe', 'rro'], 'E08'],
    [['ar', 'co'], 'E09'],
    [['sol'], 'E10'],
    [['tor', 'ta'], 'E10'],
    [['pla', 'to'], 'E11'],
    [['flor'], 'E11'],
    [['li', 'bro'], 'E12'],
    [['tren'], 'E12'],
    [['a', 'tle', 'ta'], 'E13'],
    [['cie', 'lo'], 'E14'],
    [['puer', 'ta'], 'E14'],
    [['guau'], 'E15'],
    [['buey'], 'E15'],
    [['dí', 'a'], 'E16'],
    [['po', 'e', 'ta'], 'E16'],
    [['ma', 'ri', 'po', 'sa'], 'E17'],
  ];
  for (const [silabas, nivel] of casos) assert.equal(nivelDe(silabas), nivel, silabas.join('-'));
});

test('nivelDe: la r suave entre vocales es directa; la r inicial o tras n/l/s es fuerte', () => {
  assert.equal(nivelDe(['pe', 'ra']), 'E02');
  assert.equal(nivelDe(['ro', 'sa']), 'E08');
  assert.ok(rasgosDe(['hon', 'ra']).includes('E08'));
});

test('nivelDe: el nivel más alto manda («chocolate» → E03, «plátano» → E11, «atlántico» → E13)', () => {
  assert.equal(nivelDe(['cho', 'co', 'la', 'te']), 'E03');
  assert.equal(nivelDe(['plá', 'ta', 'no']), 'E11');
  assert.equal(nivelDe(['a', 'tlán', 'ti', 'co']), 'E13');
  assert.equal(nivelDe(['gui', 'ta', 'rra']), 'E08');
  assert.equal(nivelDe(['gui', 'ño']), 'E07');
});

test('nivelDe: E17 con 4 o más sílabas sin rasgos especiales, o con una mezcla de 3 rasgos', () => {
  assert.equal(nivelDe(['ca', 'mi', 'se', 'ta']), 'E17');
  assert.equal(nivelDe(['chu', 'rras', 'co']), 'E17'); // CH + RR + mixta
  assert.deepEqual(rasgosDe(['chu', 'rras', 'co']), ['E02', 'E03', 'E08', 'E10']);
});

test('nivelDe: usa la división escrita a mano y, si falta, la automática', () => {
  assert.equal(nivelDe(pal('atleta', ['a', 'tle', 'ta'])), 'E13');
  assert.equal(nivelDe({ texto: 'sol' }), 'E10');
  assert.equal(nivelDe({ texto: 'gato' }), 'E02');
});

test('rasgosDe: el hiato pide una vocal al final de una sílaba y otra al inicio de la siguiente', () => {
  assert.ok(rasgosDe(['po', 'e', 'ta']).includes('E16'));
  assert.ok(!rasgosDe(['a', 'be', 'ja']).includes('E16'));
  assert.ok(!rasgosDe(['al', 'a']).includes('E16'));
});

// ─── Banco ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('banco: es válido, cada palabra trae su división, su emoji y su búsqueda', () => {
  assert.equal(banco.version, 1);
  for (const p of banco.palabras) {
    assert.ok(IDS_DE_NIVELES.slice(0, 17).includes(p.nivel), `${p.texto}: nivel ${p.nivel}`);
    assert.ok(Array.isArray(p.silabas) && p.silabas.length && p.silabas.every((s) => typeof s === 'string' && s), `${p.texto}: sílabas`);
    assert.ok(p.emoji, `${p.texto}: emoji`);
    assert.ok(p.arasaacBusqueda, `${p.texto}: búsqueda`);
    if (p.nivel === 'E01') {
      assert.ok(p.modelo, `${p.texto}: la vocal necesita la palabra de la imagen`);
      assert.ok(claveSilaba(p.modelo).startsWith(claveSilaba(p.texto)), `${p.modelo} no empieza con «${p.texto}»`);
    } else {
      assert.equal(p.silabas.join('').toLowerCase(), p.texto.toLowerCase(), `${p.texto}: las sílabas no suman la palabra`);
    }
  }
});

test('banco: sin repetidos y con el mínimo por nivel (12; E13 y E15, 4)', () => {
  const ids = banco.palabras.map(idDeBanco);
  assert.equal(new Set(ids).size, ids.length, 'hay palabras repetidas');
  for (const nivel of IDS_DE_NIVELES.slice(0, 17)) {
    const n = banco.palabras.filter((p) => p.nivel === nivel).length;
    assert.ok(n >= MINIMO(nivel), `${nivel} tiene ${n}, mínimo ${MINIMO(nivel)}`);
  }
});

test('banco: todas las palabras caen en el nivel que declaran (≥ 60, recorrido entero)', () => {
  assert.ok(banco.palabras.length >= 60);
  for (const p of banco.palabras) assert.equal(nivelDe(p.silabas), p.nivel, `${p.texto} (${p.silabas.join('-')})`);
});

test('banco: «tl» va junto (a-tle-ta, a-tlas, a-tlán-ti-co) y E15 tiene triptongos de verdad', () => {
  const de = (t) => banco.palabras.find((p) => p.texto.toLowerCase() === t)?.silabas.join('-');
  assert.equal(de('atleta'), 'a-tle-ta');
  assert.equal(de('atlas'), 'a-tlas');
  assert.equal(de('atlántico'), 'a-tlán-ti-co');
  assert.ok(banco.palabras.filter((p) => p.nivel === 'E15').every((p) => p.silabas.some((s) => analizarSilaba(s).nucleo.length === 3)));
});

test('banco: las voces que declara existen en data/voces', () => {
  for (const p of banco.palabras.filter((x) => x.voz)) {
    assert.doesNotThrow(() => readFileSync(new URL(`../${p.voz}`, import.meta.url)), p.voz);
  }
});

test('banco: frases para E18 con sus palabras divididas', () => {
  assert.ok(banco.frases.length >= 12);
  for (const f of banco.frases) {
    assert.ok(f.palabras.length >= 3 && f.emoji);
    assert.equal(f.palabras.map((p) => p.texto).join(' ').toLowerCase(), f.texto.toLowerCase());
    for (const p of f.palabras) assert.equal(p.silabas.join('').toLowerCase(), p.texto.toLowerCase());
  }
  assert.equal(new Set(banco.frases.map((f) => f.texto)).size, banco.frases.length);
});

test('banco: 6 textos para E19, con la palabra que falta dentro del texto', () => {
  assert.ok(banco.textos.length >= 6);
  for (const t of banco.textos) {
    assert.ok(t.frases.length >= 2 && t.frases.length <= 3);
    assert.equal(t.falta.silabas.join(''), t.falta.texto);
    assert.ok(t.frases.some((f) => f.toLowerCase().includes(t.falta.texto)), `${t.id}: falta «${t.falta.texto}»`);
    assert.ok(t.emoji);
  }
  assert.equal(new Set(banco.textos.map((t) => t.id)).size, banco.textos.length);
});

// ─── esDeEscritura ─────────────────────────────────────────────────────────────────────────────────────────────

test('esDeEscritura: actividad E.., tipo o modo «escritura»; la lectura no', () => {
  assert.equal(esDeEscritura({ actividad: 'E07' }), true);
  assert.equal(esDeEscritura({ tipo: 'escritura' }), true);
  assert.equal(esDeEscritura({ modo: 'escritura', actividad: 'E02' }), true);
  for (const a of ['P1', 'L4', 'L6', 'F3', 'S3', 'B1']) assert.equal(esDeEscritura({ actividad: a }), false, a);
  assert.equal(esDeEscritura({ tipo: 'lectura' }), false);
  assert.equal(esDeEscritura({}), false);
  assert.equal(esDeEscritura(null), false);
});

test('idDeBanco: esc:<texto>, y en E01 el nombre de la imagen', () => {
  assert.equal(idDeBanco({ texto: 'Gato' }), 'esc:gato');
  assert.equal(idDeBanco({ texto: 'a', modelo: 'abeja' }), 'esc:abeja');
});

// ─── Piezas ────────────────────────────────────────────────────────────────────────────────────────────────────

const claves = (lista) => lista.map((s) => claveSilaba(s));

test('armarPiezas: de 0 a 4 sílabas extra, nunca iguales a una de la palabra', () => {
  const palabras = banco.palabras.filter((p) => p.nivel !== 'E01');
  const aleatorio = crearAleatorio(7);
  for (const p of palabras) {
    for (let extras = 0; extras <= 4; extras++) {
      const r = armarPiezas({ palabra: p, extras, aleatorio, nivel: p.nivel });
      assert.deepEqual(r.huecos, p.silabas);
      assert.equal(r.extras, extras, `${p.texto} con ${extras} extras`);
      assert.equal(r.fichas.length, p.silabas.length + extras);
      const propias = new Set(claves(p.silabas));
      const distractoras = r.fichas.filter((f) => f.distractor);
      assert.equal(distractoras.length, extras);
      for (const d of distractoras) assert.ok(!propias.has(claveSilaba(d.texto)), `${p.texto}: «${d.texto}» está en la palabra`);
      assert.equal(new Set(claves(distractoras.map((d) => d.texto))).size, extras, `${p.texto}: distractoras repetidas`);
      // las piezas de la palabra están todas
      assert.deepEqual(r.fichas.filter((f) => !f.distractor).map((f) => f.texto).sort(), [...p.silabas].sort());
      assert.equal(new Set(r.fichas.map((f) => f.id)).size, r.fichas.length);
    }
  }
});

test('armarPiezas: pide más de 4 o menos de 0 y se ajusta', () => {
  const p = pal('mesa', ['me', 'sa']);
  assert.equal(armarPiezas({ palabra: p, extras: 9, aleatorio: crearAleatorio(1) }).extras, 4);
  assert.equal(armarPiezas({ palabra: p, extras: -3, aleatorio: crearAleatorio(1) }).extras, 0);
});

test('armarPiezas: reproducible con la misma semilla y distinta con otra', () => {
  const p = pal('mariposa', ['ma', 'ri', 'po', 'sa']);
  const a = armarPiezas({ palabra: p, extras: 3, aleatorio: crearAleatorio(42) });
  const b = armarPiezas({ palabra: p, extras: 3, aleatorio: crearAleatorio(42) });
  assert.deepEqual(a, b);
  const otras = new Set();
  for (let s = 1; s <= 12; s++) otras.add(JSON.stringify(armarPiezas({ palabra: p, extras: 3, aleatorio: crearAleatorio(s) }).fichas));
  assert.ok(otras.size > 1);
});

test('armarPiezas: las piezas no quedan en el orden de las cajas si se puede evitar', () => {
  const p = pal('pelota', ['pe', 'lo', 'ta']);
  for (let s = 1; s <= 60; s++) {
    for (const extras of [0, 2]) {
      const r = armarPiezas({ palabra: p, extras, aleatorio: crearAleatorio(s) });
      assert.notDeepEqual(r.fichas.slice(0, 3).map((f) => f.texto), p.silabas, `semilla ${s}, ${extras} extras`);
    }
  }
  // una palabra de una sola sílaba no se puede desordenar y no debe colgarse
  assert.equal(armarPiezas({ palabra: pal('sol', ['sol']), extras: 0, aleatorio: crearAleatorio(1) }).fichas.length, 1);
  // sílabas iguales: tampoco
  assert.equal(armarPiezas({ palabra: pal('tata', ['ta', 'ta']), extras: 0, aleatorio: crearAleatorio(1) }).fichas.length, 2);
});

test('armarPiezas: la sílaba parecida solo aparece con 2 o más extras', () => {
  const p = pal('mesa', ['me', 'sa']);
  const esParecida = (texto) => {
    const k = claveSilaba(texto);
    return p.silabas.some((s) => silabasParecidas(s).map(claveSilaba).includes(k));
  };
  const contar = (extras, semilla) =>
    armarPiezas({ palabra: p, extras, aleatorio: crearAleatorio(semilla) }).fichas.filter((f) => f.distractor && esParecida(f.texto)).length;
  for (let s = 1; s <= 40; s++) {
    assert.equal(contar(0, s), 0);
    assert.equal(contar(1, s), 0, `con 1 extra (semilla ${s})`);
    for (const extras of [2, 3, 4]) assert.ok(contar(extras, s) >= 1, `con ${extras} extras (semilla ${s})`);
  }
});

test('armarPiezas: las distractoras lejanas tienen otra consonante y otra vocal que la palabra', () => {
  const p = pal('mesa', ['me', 'sa']);
  for (let s = 1; s <= 30; s++) {
    const r = armarPiezas({ palabra: p, extras: 1, aleatorio: crearAleatorio(s) });
    const d = analizarSilaba(r.fichas.find((f) => f.distractor).texto);
    assert.ok(!['m', 's'].includes(d.ataque), d.ataque);
    assert.ok(!['e', 'a'].includes(d.nucleo), d.nucleo);
  }
});

test('armarPiezas E01: la pieza es una vocal y las extras son otras vocales', () => {
  for (let extras = 0; extras <= 4; extras++) {
    const r = armarPiezas({ palabra: pal('a', ['a']), extras, nivel: 'E01', aleatorio: crearAleatorio(3) });
    assert.equal(r.unidad, 'vocal');
    assert.deepEqual(r.huecos, ['a']);
    assert.equal(r.extras, extras);
    assert.ok(r.fichas.filter((f) => f.distractor).every((f) => /^[eiou]$/.test(f.texto)));
  }
});

test('armarPiezas E18: por palabras (una caja por palabra) o por sílabas (con el inicio de cada palabra)', () => {
  const frase = banco.frases[0]; // Mamá toma leche
  const a = armarPiezas({ palabra: frase, extras: 2, nivel: 'E18', aleatorio: crearAleatorio(5) });
  assert.equal(a.unidad, 'palabra');
  assert.deepEqual(a.huecos, ['Mamá', 'toma', 'leche']);
  const propias = new Set(a.huecos.map((h) => h.toLowerCase()));
  assert.equal(a.fichas.length, 5);
  assert.ok(a.fichas.filter((f) => f.distractor).every((f) => !propias.has(f.texto.toLowerCase())));

  const b = armarPiezas({ palabra: frase, extras: 2, nivel: 'E18', por: 'silabas', aleatorio: crearAleatorio(5) });
  assert.equal(b.unidad, 'silaba');
  assert.deepEqual(b.huecos, ['Ma', 'má', 'to', 'ma', 'le', 'che']);
  assert.deepEqual(b.inicioDePalabra, [true, false, true, false, true, false]);
  assert.equal(b.fichas.length, 8);
});

test('armarPiezas: «evitar» saca sílabas de las distractoras', () => {
  const p = pal('mesa', ['me', 'sa']);
  for (let s = 1; s <= 30; s++) {
    const r = armarPiezas({ palabra: p, extras: 4, evitar: ['mi', 'ta'], aleatorio: crearAleatorio(s) });
    assert.ok(!r.fichas.some((f) => f.distractor && ['mi', 'ta'].includes(f.texto)));
  }
});

test('silabasParecidas: misma consonante con otra vocal, la invertida y sin tilde', () => {
  assert.ok(silabasParecidas('ma').includes('me'));
  assert.ok(!silabasParecidas('ma').includes('ma'));
  assert.ok(silabasParecidas('al').includes('la'));
  assert.ok(silabasParecidas('la').includes('al'));
  assert.ok(silabasParecidas('sol').includes('sal'));
  assert.ok(silabasParecidas('cha').includes('che'));
  assert.deepEqual(silabasParecidas('que'), ['qui']);
  assert.ok(!silabasParecidas('go').includes('ge')); // la «g» cambia de sonido
  assert.ok(!silabasParecidas('má').includes('ma')); // «má» y «ma» cuentan como la misma
  assert.deepEqual(silabasParecidas('ma', { excluir: ['me', 'mi'] }).slice(0, 2), ['mo', 'mu']);
  assert.deepEqual(silabasParecidas('guau'), []);
});

test('silabasLejanas: otra consonante y otra vocal; nunca la propia ni las excluidas', () => {
  const l = silabasLejanas('ma', { excluir: ['te'] });
  assert.ok(l.length > 20);
  assert.ok(!l.includes('te') && !l.includes('ma') && !l.some((s) => s.startsWith('m')) && !l.some((s) => s.endsWith('a')));
  assert.ok(l.every((s) => s.length === 2));
});
