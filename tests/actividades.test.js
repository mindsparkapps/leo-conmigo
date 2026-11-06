import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVIDADES } from '../js/actividades/indice.js';
import { armarEnsayo, mezclarCartas, esSegundoDedo } from '../js/actividades/comun.js';
import { crearAleatorio } from '../js/core/azar.js';
import { palabra } from './ayudas.js';

const palabras = new Map(['perro', 'gato', 'pan', 'casa'].map((t) => [t, { ...palabra(t, t), emoji: '🐶' }]));
const planEnsayo = (extra = {}) => ({ elementoId: 'perro', distractorIds: ['gato', 'pan'], tipo: 'practica', esFacil: false, ...extra });
const crear = (id, extra = {}, semilla = 1) =>
  ACTIVIDADES[id].crearEnsayo({ ensayo: planEnsayo(), palabras, aleatorio: crearAleatorio(semilla), ...extra });

// Lo que define cada actividad según el plan (§3, etapa 1)
const ESPERADO = {
  L1: { modelo: 'tarjeta', cartas: 'tarjeta', audioInicial: true, consigna: 'Toca la que es igual' },
  L2: { modelo: 'tarjeta', cartas: 'palabra', audioInicial: true, consigna: 'Toca la palabra que es igual' },
  L3: { modelo: 'imagen', cartas: 'palabra', audioInicial: true, consigna: 'Toca la palabra' },
  L4: { modelo: 'palabra', cartas: 'imagen', audioInicial: false, consigna: 'Lee y toca el dibujo' },
  L5: { modelo: 'audio', cartas: 'palabra', audioInicial: true, consigna: 'Escucha y toca la palabra' },
};

test('hay dieciséis actividades (P1–P3, L1–L6, F1–F3, S1–S4) con la interfaz común', () => {
  assert.deepEqual(
    Object.keys(ACTIVIDADES).sort(),
    ['F1', 'F2', 'F3', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'P1', 'P2', 'P3', 'S1', 'S2', 'S3', 'S4'],
  );
  const etapaDe = { P: 0, L: 1, F: 2, S: 3 };
  for (const [id, act] of Object.entries(ACTIVIDADES)) {
    assert.equal(act.id, id);
    assert.equal(act.etapa, etapaDe[id[0]], `${id}: etapa`);
    assert.equal(typeof act.nombre, 'string');
    assert.equal(typeof act.consigna, 'string');
    assert.equal(typeof act.crearEnsayo, 'function');
    assert.equal(typeof act.render, 'function');
  }
});

for (const [id, esperado] of Object.entries(ESPERADO)) {
  test(`${id}: formas del modelo y de las opciones, audio inicial y consigna`, () => {
    const e = crear(id);
    assert.equal(e.actividad, id);
    assert.equal(e.modelo.forma, esperado.modelo);
    assert.equal(e.modelo.palabraId, 'perro');
    assert.ok(e.cartas.every((c) => c.forma === esperado.cartas));
    assert.equal(e.audioInicial, esperado.audioInicial);
    assert.equal(e.consigna, esperado.consigna);
  });

  test(`${id}: la correcta aparece una sola vez, entre las opciones, junto a sus distractores`, () => {
    const e = crear(id);
    assert.deepEqual(e.cartas.map((c) => c.id).sort(), ['gato', 'pan', 'perro']);
    assert.equal(e.correctaId, 'perro');
    assert.equal(e.cartas[e.posicionCorrecta].id, 'perro');
    assert.equal(e.cartas.filter((c) => c.id === e.correctaId).length, 1);
  });
}

test('entre L1 y L5, L4 es la única donde la palabra se lee sin audio al comienzo', () => {
  assert.deepEqual(['L1', 'L2', 'L3', 'L4', 'L5'].filter((id) => !crear(id).audioInicial), ['L4']);
});

test('el ensayo conserva lo que viene del plan (tipo, facilidad) y es serializable', () => {
  const e = crear('L1', { ensayo: planEnsayo({ tipo: 'repaso', esFacil: true }) });
  assert.equal(e.tipo, 'repaso');
  assert.equal(e.esFacil, true);
  assert.deepEqual(JSON.parse(JSON.stringify(e)), e);
});

test('con una sola opción (sin distractores) el ensayo igual se arma', () => {
  const e = crear('L3', { ensayo: planEnsayo({ distractorIds: [] }) });
  assert.equal(e.cartas.length, 1);
  assert.equal(e.posicionCorrecta, 0);
});

test('una palabra desconocida es un error claro', () => {
  assert.throws(() => crear('L1', { ensayo: planEnsayo({ distractorIds: ['fantasma'] }) }), /Palabra desconocida/);
  assert.throws(() => crear('L1', { ensayo: planEnsayo({ elementoId: 'fantasma' }) }), /Palabra desconocida/);
});

test('armarEnsayo no modifica las entradas', () => {
  const ensayo = Object.freeze({ ...planEnsayo(), distractorIds: Object.freeze(['gato', 'pan']) });
  assert.doesNotThrow(() => armarEnsayo({ actividad: 'LX', ensayo, palabras, formaModelo: 'tarjeta', formaCarta: 'palabra', audioInicial: true, consigna: 'x' }));
});

// ---------- posición de la correcta ----------

test('mezclarCartas: la correcta nunca cae 3 veces seguidas en el mismo lugar', () => {
  const azar = crearAleatorio(5);
  for (const n of [2, 3, 4]) {
    const ids = ['a', 'b', 'c', 'd'].slice(0, n);
    const cartas = ids.map((id) => ({ id }));
    const posiciones = [];
    for (let k = 0; k < 3000; k++) {
      const m = mezclarCartas(cartas, 'a', azar, posiciones.slice(-2));
      posiciones.push(m.findIndex((c) => c.id === 'a'));
      assert.deepEqual(m.map((c) => c.id).sort(), ids, 'tiene que seguir siendo una permutación');
    }
    for (let k = 2; k < posiciones.length; k++) {
      assert.ok(!(posiciones[k] === posiciones[k - 1] && posiciones[k] === posiciones[k - 2]), `${n} opciones: 3 seguidas en ${k}`);
    }
    assert.equal(new Set(posiciones).size, n, 'la correcta debe poder estar en cualquier lugar');
  }
});

test('esSegundoDedo: solo se ignoran los punteros reales que no son el primario', () => {
  assert.equal(esSegundoDedo({ pointerType: 'touch', isPrimary: false }), true, 'segundo dedo');
  assert.equal(esSegundoDedo({ pointerType: 'touch', isPrimary: true }), false, 'primer dedo');
  assert.equal(esSegundoDedo({ pointerType: 'mouse', isPrimary: true }), false);
  assert.equal(esSegundoDedo({ pointerType: '', isPrimary: false }), false, 'clic de teclado o pulsador: siempre válido');
  assert.equal(esSegundoDedo({}), false);
});

test('mezclarCartas: con una sola carta no hay nada que evitar', () => {
  assert.deepEqual(mezclarCartas([{ id: 'a' }], 'a', crearAleatorio(1), [0, 0]), [{ id: 'a' }]);
});
