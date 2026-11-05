import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOQUEO_MS, crearIntento, tocar, resultadoDelIntento } from '../js/core/intento.js';
import { crearAleatorio } from '../js/core/azar.js';

const ensayo = (ids = ['a', 'b', 'c'], correctaId = 'a') => ({ correctaId, cartas: ids.map((id) => ({ id })) });
const t0 = 10000; // el ensayo aparece a los 10 s del reloj
const T = (ms) => t0 + ms;

test('acertar a la primera: sin ayuda, un intento', () => {
  let i = crearIntento(ensayo(), t0);
  const r = tocar(i, 'a', T(1200));
  assert.equal(r.efecto, 'correcto');
  i = r.intento;
  assert.deepEqual(resultadoDelIntento(i), { correctoAlPrimerIntento: true, intentos: 1, ms: 1200 });
});

test('un error atenúa esa opción y pasa a "ayuda"; al acertar queda "con ayuda"', () => {
  let i = crearIntento(ensayo(), t0);
  let r = tocar(i, 'b', T(1000));
  assert.equal(r.efecto, 'ayuda');
  i = r.intento;
  assert.equal(i.estado, 'ayuda');
  assert.deepEqual(i.atenuadas, ['b']);
  r = tocar(i, 'a', T(2000));
  assert.equal(r.efecto, 'correcto');
  assert.deepEqual(resultadoDelIntento(r.intento), { correctoAlPrimerIntento: false, intentos: 2, ms: 2000 });
});

test('se pueden fallar todas las opciones equivocadas y aun así se termina acertando', () => {
  let i = crearIntento(ensayo(['a', 'b', 'c', 'd']), t0);
  for (const [k, id] of ['b', 'c', 'd'].entries()) {
    const r = tocar(i, id, T(1000 + k * 600));
    assert.equal(r.efecto, 'ayuda');
    i = r.intento;
  }
  assert.deepEqual(i.atenuadas, ['b', 'c', 'd']);
  const fin = tocar(i, 'a', T(4000));
  assert.equal(fin.efecto, 'correcto');
  assert.equal(resultadoDelIntento(fin.intento).intentos, 4);
});

test('los toques de los primeros 400 ms del ensayo se ignoran (el dedo viene del ensayo anterior)', () => {
  const i = crearIntento(ensayo(), t0);
  for (const ms of [0, 100, 399]) assert.equal(tocar(i, 'a', T(ms)).efecto, 'ignorado', `a los ${ms} ms`);
  assert.equal(tocar(i, 'a', T(BLOQUEO_MS)).efecto, 'correcto');
});

test('dos toques en menos de 400 ms cuentan como uno solo (también con errores)', () => {
  let i = crearIntento(ensayo(), t0);
  let r = tocar(i, 'b', T(1000));
  assert.equal(r.efecto, 'ayuda');
  i = r.intento;
  // segundo toque 150 ms después, aunque sea a la correcta: se ignora
  r = tocar(i, 'a', T(1150));
  assert.equal(r.efecto, 'ignorado');
  assert.equal(r.intento, i);
  // 400 ms después del último toque aceptado ya vale
  assert.equal(tocar(i, 'a', T(1400)).efecto, 'correcto');
});

test('un doble toque sobre la correcta no se cuenta dos veces', () => {
  let i = crearIntento(ensayo(), t0);
  const r = tocar(i, 'a', T(1000));
  i = r.intento;
  assert.equal(tocar(i, 'a', T(1100)).efecto, 'ignorado');
  assert.equal(tocar(i, 'a', T(5000)).efecto, 'ignorado', 'ni aunque pase el tiempo: el ensayo ya terminó');
  assert.equal(resultadoDelIntento(i).intentos, 1);
});

test('volver a tocar una opción ya atenuada no es otro error', () => {
  let i = crearIntento(ensayo(), t0);
  i = tocar(i, 'b', T(1000)).intento;
  const r = tocar(i, 'b', T(2000));
  assert.equal(r.efecto, 'ignorado');
  assert.equal(r.intento.errores.length, 1);
  assert.equal(r.intento.intentos, 1);
});

test('una opción que no existe se ignora', () => {
  const i = crearIntento(ensayo(), t0);
  assert.equal(tocar(i, 'zzz', T(1000)).efecto, 'ignorado');
});

test('con una sola opción (la primera vez, sin otras palabras vistas) se acierta de inmediato', () => {
  const i = crearIntento(ensayo(['a']), t0);
  const r = tocar(i, 'a', T(500));
  assert.equal(r.efecto, 'correcto');
  assert.equal(resultadoDelIntento(r.intento).correctoAlPrimerIntento, true);
});

test('el resultado no se puede pedir antes de acertar', () => {
  const i = crearIntento(ensayo(), t0);
  assert.throws(() => resultadoDelIntento(i), /todavía no se resolvió/);
  assert.throws(() => resultadoDelIntento(tocar(i, 'b', T(1000)).intento));
});

test('tocar no modifica el intento original', () => {
  const i = Object.freeze({ ...crearIntento(ensayo(), t0), errores: Object.freeze([]), atenuadas: Object.freeze([]) });
  const r = tocar(i, 'b', T(1000));
  assert.deepEqual(i.errores, []);
  assert.equal(i.estado, 'esperando');
  assert.notEqual(r.intento, i);
});

test('propiedad (toques al azar): nunca se acierta con una opción equivocada y los errores no se repiten', () => {
  const azar = crearAleatorio(21);
  for (let ronda = 0; ronda < 500; ronda++) {
    const ids = ['a', 'b', 'c', 'd'].slice(0, 2 + Math.floor(azar() * 3));
    let i = crearIntento(ensayo(ids, ids[Math.floor(azar() * ids.length)]), t0);
    let reloj = t0;
    for (let paso = 0; paso < 40 && i.estado !== 'acertado'; paso++) {
      reloj += Math.floor(azar() * 900); // toques a destiempo: muchos caen dentro del bloqueo
      const id = azar() < 0.9 ? ids[Math.floor(azar() * ids.length)] : 'fuera';
      const r = tocar(i, id, reloj);
      if (r.efecto === 'correcto') assert.equal(id, i.correctaId);
      if (r.efecto === 'ayuda') assert.notEqual(id, i.correctaId);
      i = r.intento;
    }
    assert.equal(new Set(i.errores).size, i.errores.length, 'error repetido');
    assert.ok(i.errores.every((e) => e !== i.correctaId));
    if (i.estado === 'acertado') assert.equal(i.intentos, i.errores.length + 1);
  }
});
