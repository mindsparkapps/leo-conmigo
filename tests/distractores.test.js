import test from 'node:test';
import assert from 'node:assert/strict';
import { elegirDistractores } from '../js/core/distractores.js';
import { crearAleatorio } from '../js/core/azar.js';
import { palabra, vocabulario } from './ayudas.js';

const VOC = vocabulario();
const mamá = VOC.find((p) => p.id === 'mamá');
const todasVistas = new Set(VOC.map((p) => p.id));

test('exige el conjunto de palabras vistas', () => {
  assert.throws(() => elegirDistractores(mamá, VOC, { cantidad: 2 }), TypeError);
  assert.throws(() => elegirDistractores(mamá, VOC, { cantidad: 2, vistas: ['papá'] }), TypeError);
});

test('devuelve la cantidad pedida, sin repetir ni incluir la palabra objetivo', () => {
  for (let semilla = 1; semilla <= 50; semilla++) {
    const r = elegirDistractores(mamá, VOC, { cantidad: 3, vistas: todasVistas, aleatorio: crearAleatorio(semilla) });
    assert.equal(r.length, 3);
    assert.equal(new Set(r.map((p) => p.id)).size, 3);
    assert.ok(!r.some((p) => p.id === mamá.id));
  }
});

test('cantidad 0 o negativa devuelve vacío', () => {
  assert.deepEqual(elegirDistractores(mamá, VOC, { cantidad: 0, vistas: todasVistas }), []);
  assert.deepEqual(elegirDistractores(mamá, VOC, { cantidad: -1, vistas: todasVistas }), []);
});

test('NUNCA usa palabras que el niño no ha visto', () => {
  const vistas = new Set(['papá', 'perro', 'pan']);
  for (let semilla = 1; semilla <= 100; semilla++) {
    const r = elegirDistractores(mamá, VOC, { cantidad: 3, facil: semilla % 2 === 0, vistas, aleatorio: crearAleatorio(semilla) });
    for (const p of r) assert.ok(vistas.has(p.id), `${p.id} no estaba vista`);
  }
});

test('si el niño ha visto pocas palabras, devuelve menos distractores (no inventa)', () => {
  const r = elegirDistractores(mamá, VOC, { cantidad: 3, vistas: new Set(['mamá', 'papá']) });
  assert.deepEqual(r.map((p) => p.id), ['papá']);
  assert.deepEqual(elegirDistractores(mamá, VOC, { cantidad: 3, vistas: new Set() }), []);
  assert.deepEqual(elegirDistractores(mamá, VOC, { cantidad: 3, vistas: new Set(['mamá']) }), []);
});

test('nivel fácil: otra primera letra, largo distinto en 2 o más y otra categoría', () => {
  // objetivo "mamá" (4 letras, personas): los que cumplen todo son de ≤2 o ≥6 letras, otra categoría y no empiezan con m
  const voc = [
    mamá,
    palabra('pelota', 'pelota', 'juguetes'), // 6 letras, otra letra, otra categoría -> cumple
    palabra('manzana', 'manzana', 'comida'), // empieza con m -> no cumple
    palabra('papá', 'papá', 'personas'), // misma categoría y mismo largo -> no cumple
    palabra('casa', 'casa', 'casa'), // mismo largo -> no cumple
    palabra('ojo', 'ojo', 'cuerpo'), // 3 letras: diferencia de 1 -> no cumple
  ];
  const vistas = new Set(voc.map((p) => p.id));
  for (let semilla = 1; semilla <= 30; semilla++) {
    const [primero] = elegirDistractores(mamá, voc, { cantidad: 1, facil: true, vistas, aleatorio: crearAleatorio(semilla) });
    assert.equal(primero.id, 'pelota');
  }
});

test('nivel fácil: si faltan palabras que cumplan todo, relaja categoría, luego largo, luego letra', () => {
  const objetivo = palabra('mesa', 'mesa', 'casa');
  const voc = [
    objetivo,
    palabra('pelota', 'pelota', 'juguetes'), // cumple todo
    palabra('silla', 'silla', 'casa'), // otra letra, largo +1, misma categoría -> no cumple largo
    palabra('mano', 'mano', 'cuerpo'), // misma letra m
  ];
  const vistas = new Set(voc.map((p) => p.id));
  const r = elegirDistractores(objetivo, voc, { cantidad: 3, facil: true, vistas, aleatorio: crearAleatorio(3) });
  assert.equal(r[0].id, 'pelota'); // la más exigente va primero
  assert.deepEqual(r.map((p) => p.id).sort(), ['mano', 'pelota', 'silla']);
});

test('nivel normal: cualquier palabra vista distinta de la objetivo', () => {
  const vistas = new Set(VOC.map((p) => p.id));
  const vistos = new Set();
  for (let semilla = 1; semilla <= 200; semilla++) {
    for (const p of elegirDistractores(mamá, VOC, { cantidad: 2, vistas, aleatorio: crearAleatorio(semilla) })) vistos.add(p.id);
  }
  assert.equal(vistos.size, VOC.length - 1); // con azar suficiente salen todas
});

test('no usa palabras desactivadas, borradas ni con el mismo texto que la objetivo', () => {
  const voc = [
    mamá,
    { ...palabra('x1', 'perro', 'animales'), activa: false },
    { ...palabra('x2', 'gato', 'animales'), deleted: true },
    palabra('x3', 'MAMÁ', 'personas'), // mismo texto (sin importar mayúsculas ni tilde)
    palabra('x4', 'mama', 'personas'),
    palabra('x5', 'pan', 'comida'),
  ];
  const vistas = new Set(voc.map((p) => p.id));
  const r = elegirDistractores(mamá, voc, { cantidad: 5, vistas });
  assert.deepEqual(r.map((p) => p.id), ['x5']);
});

test('es reproducible con la misma semilla', () => {
  const a = elegirDistractores(mamá, VOC, { cantidad: 3, facil: true, vistas: todasVistas, aleatorio: crearAleatorio(42) });
  const b = elegirDistractores(mamá, VOC, { cantidad: 3, facil: true, vistas: todasVistas, aleatorio: crearAleatorio(42) });
  assert.deepEqual(a.map((p) => p.id), b.map((p) => p.id));
});
