import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVIDADES } from '../js/actividades/indice.js';
import { crearControlador } from '../js/core/controlador.js';
import { crearAleatorio } from '../js/core/azar.js';
import { anotarParaSilabas, claveSilaba, empiezanIgual } from '../js/core/silabeo.js';
import { ESTADOS } from '../js/core/progreso.js';
import { HOY, PERFIL_ID, progresoCon } from './ayudas.js';
import { LEIDAS_SILABAS, palabrasSilabas } from './escenarios.js';
import { jugarSesion } from './jugar.js';

const leidas = (ids = LEIDAS_SILABAS) => ids.map((id) => progresoCon(id, 'L4', ESTADOS.DOMINADA, { proximoRepaso: '2026-12-31' }));
const elementos = () => anotarParaSilabas({ perfilId: PERFIL_ID, palabras: palabrasSilabas(), progresos: leidas() }).elementos;
const mapa = () => new Map(elementos().map((e) => [e.id, e]));

const ensayo = (elementoId, distractorIds, extra = {}) => ({ elementoId, actividad: 'S1', tipo: 'practica', esFacil: false, distractorIds, opciones: 1 + distractorIds.length, ...extra });
const crear = (id, elementoId, distractorIds, azar = 3) =>
  ACTIVIDADES[id].crearEnsayo({ ensayo: ensayo(elementoId, distractorIds), palabras: mapa(), aleatorio: crearAleatorio(azar) });

// ---------- S1: descubro la sílaba ----------

test('S1: el modelo es la palabra en sílabas con la primera resaltada, y suena esa sílaba', () => {
  const e = crear('S1', 'mamá', ['pato', 'mesa']);
  assert.deepEqual(e.modelo, { forma: 'silabas', palabraId: 'mamá', resaltar: 0 });
  assert.equal(e.dicho, 'ma');
  assert.equal(e.audioInicial, true);
  assert.equal(e.modo, 'simple');
});

test('S1: la correcta es OTRA palabra que empieza igual y ningún distractor empieza igual', () => {
  const palabras = mapa();
  for (let semilla = 1; semilla <= 30; semilla++) {
    const e = crear('S1', 'cama', ['pato', 'mesa', 'gato'], semilla);
    assert.equal(e.correctaId, 'casa', 'la única otra «ca»');
    assert.ok(e.cartas.some((c) => c.id === e.correctaId));
    for (const c of e.cartas) {
      assert.notEqual(c.id, 'cama', 'la palabra del modelo no es opción');
      if (c.id !== e.correctaId) assert.equal(empiezanIgual(palabras.get(c.id), palabras.get('cama')), false, c.id);
    }
    assert.equal(new Set(e.cartas.map((c) => c.id)).size, e.cartas.length);
    assert.equal(e.opciones, 4);
  }
});

test('S1: si el motor propone una que empieza igual, se cambia por otra leída', () => {
  const e = crear('S1', 'mamá', ['mano', 'pato']); // «mano» empieza igual que «mamá»: sería otra respuesta correcta
  assert.equal(e.correctaId, 'mano');
  assert.equal(e.cartas.length, 3);
  const otras = e.cartas.filter((c) => c.id !== 'mano').map((c) => c.id);
  assert.ok(otras.every((id) => !['mamá', 'mano'].includes(id)));
});

test('S1: una palabra sin compañera no se puede usar', () => {
  assert.equal(ACTIVIDADES.S1.aplicaA(mapa().get('gato')), false);
  assert.throws(() => crear('S1', 'gato', ['pato']), /empiece igual/);
  assert.equal(ACTIVIDADES.S1.aplicaA(mapa().get('mamá')), true);
});

// ---------- S2: completo la palabra ----------

test('S2: falta una sílaba de la palabra y la correcta es esa sílaba', () => {
  const palabras = mapa();
  const vistos = new Set();
  for (let semilla = 1; semilla <= 40; semilla++) {
    const e = crear('S2', 'pelota', ['pato', 'mesa', 'taza'], semilla);
    const { hueco } = e.modelo;
    assert.ok(Number.isInteger(hueco) && hueco >= 0 && hueco < 3);
    vistos.add(hueco);
    assert.equal(e.correctaId, palabras.get('pelota').silabas[hueco]);
    assert.equal(e.modelo.forma, 'tarjeta');
    assert.equal(e.dicho, null, 'al tocar el modelo suena la palabra entera');
    assert.ok(e.cartas.every((c) => c.forma === 'silaba' && c.texto === c.id));
    // ninguna opción se parece a una sílaba de la palabra (salvo la correcta) ni se repite
    const claves = e.cartas.map((c) => claveSilaba(c.id));
    assert.equal(new Set(claves).size, claves.length);
    for (const c of e.cartas) {
      if (c.id === e.correctaId) continue;
      assert.ok(!palabras.get('pelota').silabas.some((s) => claveSilaba(s) === claveSilaba(c.id)), `${c.id} se confunde con la palabra`);
    }
  }
  assert.deepEqual([...vistos].sort(), [0, 1, 2], 'el hueco puede estar en cualquier sílaba');
});

test('S2: la cantidad de opciones sigue la del motor (2, 3 o 4)', () => {
  for (const [distractores, esperadas] of [[['pato'], 2], [['pato', 'mesa'], 3], [['pato', 'mesa', 'taza'], 4]]) {
    assert.equal(crear('S2', 'cama', distractores).cartas.length, esperadas);
  }
});

test('S2: una palabra de una sola sílaba no aplica', () => {
  assert.equal(ACTIVIDADES.S2.aplicaA(mapa().get('pan')), false);
  assert.equal(ACTIVIDADES.S2.aplicaA(mapa().get('cama')), true);
  assert.throws(() => crear('S2', 'pan', ['pato']), /una sola sílaba/);
});

// ---------- S3: armo la palabra ----------

test('S3: se tocan las sílabas en orden; con más opciones se suman sílabas de relleno', () => {
  const e = crear('S3', 'pelota', ['pato', 'mesa', 'taza']);
  assert.equal(e.modo, 'secuencia');
  assert.deepEqual(e.orden, ['pe', 'lo', 'ta']);
  assert.equal(e.fichas.length, 3 + 2, 'una opción menos que distractores: 2 de relleno');
  const relleno = e.fichas.filter((f) => !e.orden.includes(f.palabraId));
  assert.equal(relleno.length, 2);
  assert.ok(relleno.every((f) => !e.orden.some((s) => claveSilaba(s) === claveSilaba(f.palabraId))));
  assert.ok(e.fichas.every((f) => f.texto === f.palabraId));
  assert.equal(e.modelo.forma, 'imagen');
});

test('S3: con 2 opciones no hay relleno y las fichas nunca empiezan en el orden correcto', () => {
  for (let semilla = 1; semilla <= 40; semilla++) {
    const e = crear('S3', 'pelota', ['pato'], semilla);
    assert.equal(e.fichas.length, 3);
    assert.notDeepEqual(e.fichas.map((f) => f.palabraId), e.orden);
  }
});

test('S3: una palabra con sílabas repetidas (pa·pa) se puede armar con cualquiera de las dos fichas', () => {
  const palabras = mapa();
  palabras.set('papa', { ...palabras.get('mamá'), id: 'papa', texto: 'papa', silabas: ['pa', 'pa'] });
  const e = ACTIVIDADES.S3.crearEnsayo({ ensayo: ensayo('papa', ['pato']), palabras, aleatorio: crearAleatorio(1) });
  assert.deepEqual(e.orden, ['pa', 'pa']);
  assert.equal(e.fichas.filter((f) => f.palabraId === 'pa').length, 2);
});

// ---------- S4: palabra nueva ----------

test('S4: se lee la palabra sola (sin audio) y se elige el dibujo; solo para palabras nuevas con sílabas conocidas', () => {
  const e = crear('S4', 'masa', ['mamá', 'pato']);
  assert.equal(e.modelo.forma, 'palabra');
  assert.ok(e.cartas.every((c) => c.forma === 'imagen'));
  assert.equal(e.audioInicial, false);
  assert.equal(e.correctaId, 'masa');
  assert.equal(ACTIVIDADES.S4.aplicaA(mapa().get('masa')), true);
  assert.equal(ACTIVIDADES.S4.aplicaA(mapa().get('luna')), false);
  assert.equal(ACTIVIDADES.S4.aplicaA(mapa().get('mamá')), false);
});

test('S1–S4 solo usan como opción palabras que ya lee', () => {
  const palabras = mapa();
  for (const id of ['S1', 'S2', 'S3', 'S4']) {
    assert.equal(ACTIVIDADES[id].esOpcionValida(palabras.get('mamá')), true, id);
    assert.equal(ACTIVIDADES[id].esOpcionValida(palabras.get('luna')), false, id);
  }
});

// ---------- una sesión completa de la etapa 3 ----------

const crearCtl = ({ etapa = 3, progresos = leidas(), ajustes = { etapasForzadas: [3] }, semilla = 5 } = {}) =>
  crearControlador({
    perfil: { id: PERFIL_ID, etapaActual: etapa, ajustes },
    palabras: palabrasSilabas(),
    frases: [],
    progresos,
    niveles: [],
    hoy: HOY,
    aleatorio: crearAleatorio(semilla),
    reloj: () => HOY,
  });

test('etapa 3: solo S1–S4, solo palabras que le corresponden a cada actividad', () => {
  const ctl = crearCtl();
  assert.equal(ctl.etapa, 3);
  assert.ok(ctl.plan.ensayos.length > 0);
  for (const e of ctl.plan.ensayos) {
    assert.match(e.actividad, /^S[1-4]$/);
    assert.equal(ACTIVIDADES[e.actividad].aplicaA(ctl.palabras.get(e.elementoId)), true, `${e.actividad} con ${e.elementoId}`);
  }
});

test('etapa 3: desde el primer ensayo hay opciones (las palabras que lee cuentan como vistas)', () => {
  const ctl = crearCtl();
  assert.ok(ctl.plan.ensayos[0].opciones >= 2);
});

test('etapa 3: se juega entera solo con toques, con y sin errores', () => {
  for (const errar of [() => false, (n) => n % 2 === 0]) {
    const ctl = crearCtl();
    const { vistos, guardados } = jugarSesion(ctl, { errar });
    assert.ok(vistos.length >= 6);
    assert.ok(ctl.terminada);
    assert.ok(guardados.every((g) => g.progreso && g.nivel && /^S[1-4]$/.test(g.progreso.actividad)));
  }
});

test('etapa 3: las palabras nuevas con sílabas conocidas se leen con S4 y las demás no', () => {
  const ctl = crearCtl({ ajustes: { etapasForzadas: [3], actividadesHabilitadas: ['S4'] } });
  const usadas = new Set(ctl.plan.ensayos.map((e) => e.elementoId));
  assert.ok([...usadas].every((id) => ['masa', 'mapa'].includes(id)));
  assert.ok(usadas.size > 0);
});

test('etapa 3 sin palabras leídas: se usa la etapa 1 para no dejar al niño sin nada', () => {
  const ctl = crearCtl({ progresos: [] });
  assert.equal(ctl.etapa, 1);
  assert.ok(ctl.plan.ensayos.length > 0);
});

test('etapa 3 cerrada (menos de 20 palabras leídas) y no forzada: se practica la etapa 1', () => {
  const ctl = crearCtl({ ajustes: {} });
  assert.equal(ctl.etapa, 1);
});

test('etapa 3: el progreso de S1–S4 se guarda por palabra y actividad, sin tocar L1–L5', () => {
  const ctl = crearCtl();
  const { guardados } = jugarSesion(ctl);
  for (const g of guardados) {
    assert.equal(g.progreso.id, `${PERFIL_ID}:${g.progreso.elementoId}:${g.progreso.actividad}`);
    assert.match(g.progreso.actividad, /^S/);
  }
});
