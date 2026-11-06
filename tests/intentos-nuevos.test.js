import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOQUEO_MS, crearIntentoSecuencia, tocarSecuencia, fichaSiguiente, crearIntentoLectura, decidirLectura, resultadoDelIntento,
} from '../js/core/intento.js';
import { crearAleatorio } from '../js/core/azar.js';

const t0 = 10000;
const T = (ms) => t0 + ms;

// ---------- secuencia: «armo la frase» ----------

// Fichas mezcladas: la frase es a-b-c y en pantalla están como c, a, b
const ensayo = (extra = {}) => ({
  orden: ['a', 'b', 'c'],
  fichas: [{ id: 'x2', palabraId: 'c' }, { id: 'x0', palabraId: 'a' }, { id: 'x1', palabraId: 'b' }],
  ...extra,
});

test('secuencia: tocar las palabras en orden las coloca una a una y termina en la última', () => {
  let i = crearIntentoSecuencia(ensayo(), t0);
  let r = tocarSecuencia(i, 'x0', T(500));
  assert.equal(r.efecto, 'paso');
  i = r.intento;
  assert.deepEqual(i.colocadas, ['x0']);
  r = tocarSecuencia(i, 'x1', T(1000));
  assert.equal(r.efecto, 'paso');
  i = r.intento;
  r = tocarSecuencia(i, 'x2', T(1500));
  assert.equal(r.efecto, 'correcto');
  assert.equal(r.intento.estado, 'acertado');
  assert.deepEqual(resultadoDelIntento(r.intento), { correctoAlPrimerIntento: true, intentos: 3, ms: 1500 });
});

test('secuencia: una ficha equivocada se atenúa y se indica cuál sigue; el niño nunca pierde nada', () => {
  let i = crearIntentoSecuencia(ensayo(), t0);
  let r = tocarSecuencia(i, 'x2', T(500)); // toca «c» y toca «a»
  assert.equal(r.efecto, 'ayuda');
  i = r.intento;
  assert.deepEqual(i.atenuadas, ['x2']);
  assert.equal(i.estado, 'ayuda');
  assert.equal(fichaSiguiente(i), 'x0', 'debe iluminar la que corresponde');
  assert.deepEqual(i.colocadas, [], 'no se colocó nada');
});

test('secuencia: tras el próximo acierto las fichas atenuadas vuelven a poder usarse (pueden hacer falta después)', () => {
  let i = crearIntentoSecuencia(ensayo(), t0);
  i = tocarSecuencia(i, 'x2', T(500)).intento; // error con «c», que será necesaria al final
  let r = tocarSecuencia(i, 'x2', T(1000));
  assert.equal(r.efecto, 'ignorado', 'mientras sigue atenuada no cuenta como otro error');
  assert.equal(r.intento.errores.length, 1);
  r = tocarSecuencia(i, 'x0', T(1000));
  assert.equal(r.efecto, 'paso');
  assert.deepEqual(r.intento.atenuadas, [], 'el acierto limpia las atenuadas');
  i = tocarSecuencia(r.intento, 'x1', T(1500)).intento;
  const fin = tocarSecuencia(i, 'x2', T(2000));
  assert.equal(fin.efecto, 'correcto');
  assert.deepEqual(resultadoDelIntento(fin.intento), { correctoAlPrimerIntento: false, intentos: 4, ms: 2000 });
});

test('secuencia: una ficha ya colocada, una desconocida o un toque tras terminar se ignoran', () => {
  let i = crearIntentoSecuencia(ensayo(), t0);
  i = tocarSecuencia(i, 'x0', T(500)).intento;
  assert.equal(tocarSecuencia(i, 'x0', T(1000)).efecto, 'ignorado');
  assert.equal(tocarSecuencia(i, 'zzz', T(1000)).efecto, 'ignorado');
  i = tocarSecuencia(tocarSecuencia(i, 'x1', T(1000)).intento, 'x2', T(1500)).intento;
  assert.equal(tocarSecuencia(i, 'x2', T(3000)).efecto, 'ignorado');
});

test('secuencia: toques a menos de 400 ms del anterior (o del inicio del ensayo) no cuentan', () => {
  const i = crearIntentoSecuencia(ensayo(), t0);
  assert.equal(tocarSecuencia(i, 'x0', T(100)).efecto, 'ignorado');
  assert.equal(tocarSecuencia(i, 'x0', T(BLOQUEO_MS - 1)).efecto, 'ignorado');
  const r = tocarSecuencia(i, 'x0', T(BLOQUEO_MS));
  assert.equal(r.efecto, 'paso');
  assert.equal(tocarSecuencia(r.intento, 'x1', T(BLOQUEO_MS + 100)).efecto, 'ignorado', 'doble toque');
  assert.equal(tocarSecuencia(r.intento, 'x1', T(BLOQUEO_MS * 2)).efecto, 'paso');
});

test('secuencia: palabras repetidas («el perro y el gato»): sirve cualquiera de las fichas iguales', () => {
  const e = {
    orden: ['el', 'perro', 'el', 'gato'],
    fichas: [
      { id: 'a', palabraId: 'gato' }, { id: 'b', palabraId: 'el' }, { id: 'c', palabraId: 'perro' }, { id: 'd', palabraId: 'el' },
    ],
  };
  let i = crearIntentoSecuencia(e, t0);
  assert.equal(fichaSiguiente(i), 'b');
  i = tocarSecuencia(i, 'd', T(500)).intento; // toca la OTRA «el»: también vale
  assert.deepEqual(i.colocadas, ['d']);
  i = tocarSecuencia(i, 'c', T(1000)).intento;
  assert.equal(fichaSiguiente(i), 'b', 'queda libre la otra «el»');
  assert.equal(tocarSecuencia(i, 'a', T(1500)).efecto, 'ayuda', 'ahora tocaba «el», no «gato»');
  i = tocarSecuencia(i, 'b', T(1500)).intento;
  assert.equal(tocarSecuencia(i, 'a', T(2000)).efecto, 'correcto');
});

test('secuencia: una palabra de relleno (que no es de la frase) siempre es un error', () => {
  const e = ensayo({ fichas: [...ensayo().fichas, { id: 'r1', palabraId: 'zzz' }] });
  const i = crearIntentoSecuencia(e, t0);
  const r = tocarSecuencia(i, 'r1', T(500));
  assert.equal(r.efecto, 'ayuda');
  assert.equal(fichaSiguiente(r.intento), 'x0');
});

test('secuencia: pedir el resultado antes de terminar falla; fichaSiguiente al final es null', () => {
  let i = crearIntentoSecuencia(ensayo(), t0);
  assert.throws(() => resultadoDelIntento(i), /todavía no se resolvió/);
  for (const [k, id] of ['x0', 'x1', 'x2'].entries()) i = tocarSecuencia(i, id, T(500 * (k + 1))).intento;
  assert.equal(fichaSiguiente(i), null);
});

test('secuencia: no modifica el intento original', () => {
  const i = Object.freeze({ ...crearIntentoSecuencia(ensayo(), t0), colocadas: Object.freeze([]), errores: Object.freeze([]), atenuadas: Object.freeze([]) });
  const r = tocarSecuencia(i, 'x2', T(500));
  assert.deepEqual(i.errores, []);
  assert.notEqual(r.intento, i);
});

test('propiedad (toques al azar): una secuencia siempre se puede terminar y nunca se completa en desorden', () => {
  const azar = crearAleatorio(33);
  for (let ronda = 0; ronda < 400; ronda++) {
    const orden = ['a', 'b', 'c', 'd'].slice(0, 2 + Math.floor(azar() * 3));
    const ids = [...orden, 'z'];
    const fichas = ids.map((palabraId, k) => ({ id: `f${k}`, palabraId }));
    let i = crearIntentoSecuencia({ orden, fichas }, t0);
    let reloj = t0;
    for (let paso = 0; paso < 80 && i.estado !== 'acertado'; paso++) {
      reloj += 450 + Math.floor(azar() * 600);
      const f = fichas[Math.floor(azar() * fichas.length)];
      const antes = i.colocadas.length;
      const r = tocarSecuencia(i, f.id, reloj);
      if (r.efecto === 'paso' || r.efecto === 'correcto') assert.equal(f.palabraId, orden[antes]);
      if (r.efecto === 'ayuda') assert.notEqual(f.palabraId, orden[antes]);
      i = r.intento;
    }
    assert.equal(i.estado, 'acertado', 'con tiempo suficiente siempre termina');
    assert.deepEqual(i.colocadas.map((id) => fichas.find((f) => f.id === id).palabraId), orden);
  }
});

// ---------- lectura en voz alta: el adulto decide ----------

test('lectura: «lo leyó» a la primera cuenta como sin ayuda', () => {
  const i = crearIntentoLectura({}, t0);
  const r = decidirLectura(i, 'ok', T(2000));
  assert.equal(r.efecto, 'correcto');
  assert.deepEqual(resultadoDelIntento(r.intento), { correctoAlPrimerIntento: true, intentos: 1, ms: 2000 });
});

test('lectura: «otra vez» da ayuda y el ensayo termina «con ayuda»', () => {
  let i = crearIntentoLectura({}, t0);
  let r = decidirLectura(i, 'otra', T(1000));
  assert.equal(r.efecto, 'ayuda');
  i = r.intento;
  assert.equal(i.estado, 'ayuda');
  assert.equal(i.repeticiones, 1);
  r = decidirLectura(i, 'ok', T(2000));
  assert.deepEqual(resultadoDelIntento(r.intento), { correctoAlPrimerIntento: false, intentos: 2, ms: 2000 });
});

test('lectura: decisiones inválidas, toques seguidos y toques tras terminar se ignoran', () => {
  const i = crearIntentoLectura({}, t0);
  assert.equal(decidirLectura(i, 'quizá', T(1000)).efecto, 'ignorado');
  assert.equal(decidirLectura(i, 'ok', T(100)).efecto, 'ignorado', 'primeros 400 ms');
  const r = decidirLectura(i, 'otra', T(1000));
  assert.equal(decidirLectura(r.intento, 'ok', T(1100)).efecto, 'ignorado', 'doble toque');
  const fin = decidirLectura(r.intento, 'ok', T(2000));
  assert.equal(decidirLectura(fin.intento, 'otra', T(5000)).efecto, 'ignorado');
  assert.throws(() => resultadoDelIntento(i));
});
