import test from 'node:test';
import assert from 'node:assert/strict';
import { crearAleatorio, barajar, elegirUno } from '../js/core/azar.js';
import { nuevoId } from '../js/core/id.js';
import { AJUSTES_POR_DEFECTO, normalizarAjustes, nuevoPerfil, nuevaPalabra } from '../js/core/modelos.js';
import {
  ACTIVIDADES_POR_ETAPA, UMBRAL_ETAPA_2, UMBRAL_ETAPA_3, contarDominadas, etapasDesbloqueadas,
} from '../js/core/etapas.js';
import { ESTADOS } from '../js/core/progreso.js';

// ---------- azar ----------

test('crearAleatorio: misma semilla, misma secuencia; valores en [0, 1)', () => {
  const a = crearAleatorio(5);
  const b = crearAleatorio(5);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(crearAleatorio(1)(), crearAleatorio(2)());
});

test('barajar: es una permutación y no modifica la original', () => {
  const original = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = barajar(original, crearAleatorio(9));
  assert.deepEqual([...r].sort(), original);
  assert.deepEqual(original, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(barajar([], crearAleatorio(1)), []);
});

test('barajar: todas las posiciones son posibles', () => {
  const vistos = new Set();
  for (let s = 1; s <= 300; s++) vistos.add(barajar(['a', 'b', 'c'], crearAleatorio(s)).join(''));
  assert.equal(vistos.size, 6);
});

test('elegirUno', () => {
  assert.equal(elegirUno([], crearAleatorio(1)), undefined);
  assert.ok(['a', 'b'].includes(elegirUno(['a', 'b'], crearAleatorio(1))));
});

// ---------- id ----------

test('nuevoId: formato UUID v4 y sin repetidos', () => {
  const ids = new Set();
  for (let i = 0; i < 1000; i++) {
    const id = nuevoId();
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    ids.add(id);
  }
  assert.equal(ids.size, 1000);
});

test('nuevoId: el respaldo sin randomUUID también genera UUID v4', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: (b) => globalThis.__cripto.getRandomValues(b) }, configurable: true });
  try {
    assert.match(nuevoId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally {
    Object.defineProperty(globalThis, 'crypto', original);
  }
});
globalThis.__cripto = globalThis.crypto;

// ---------- modelos ----------

test('normalizarAjustes: completa con valores por defecto', () => {
  assert.deepEqual(normalizarAjustes(), { ...AJUSTES_POR_DEFECTO });
  assert.equal(normalizarAjustes({}).ensayosPorSesion, 8);
});

test('normalizarAjustes: acota los valores fuera de rango', () => {
  assert.equal(normalizarAjustes({ ensayosPorSesion: 1 }).ensayosPorSesion, 4);
  assert.equal(normalizarAjustes({ ensayosPorSesion: 99 }).ensayosPorSesion, 15);
  assert.equal(normalizarAjustes({ ensayosPorSesion: 'abc' }).ensayosPorSesion, 8);
  assert.equal(normalizarAjustes({ maxOpciones: 1 }).maxOpciones, 2);
  assert.equal(normalizarAjustes({ maxOpciones: 9 }).maxOpciones, 4);
  assert.equal(normalizarAjustes({ velocidadVoz: 5 }).velocidadVoz, 1.2);
  assert.equal(normalizarAjustes({ intensidadCelebracion: 'enorme' }).intensidadCelebracion, 'normal');
  assert.equal(normalizarAjustes({ tamanoLetra: 'gigante' }).tamanoLetra, 'normal');
});

test('normalizarAjustes: una lista vacía de actividades significa "todas"', () => {
  assert.equal(normalizarAjustes({ actividadesHabilitadas: [] }).actividadesHabilitadas, null);
  assert.deepEqual(normalizarAjustes({ actividadesHabilitadas: ['L1', 'L2'] }).actividadesHabilitadas, ['L1', 'L2']);
});

test('nuevoPerfil y nuevaPalabra: valores iniciales y validación', () => {
  const perfil = nuevoPerfil({ nombre: '  Leo  ' });
  assert.equal(perfil.nombre, 'Leo');
  assert.equal(perfil.etapaActual, 1);
  assert.equal(perfil.ajustes.ensayosPorSesion, 8);
  assert.throws(() => nuevoPerfil({ nombre: '   ' }));

  const p = nuevaPalabra({ perfilId: perfil.id, texto: 'mamá' });
  assert.deepEqual(p.silabas, ['ma', 'má']);
  assert.equal(p.activa, true);
  assert.equal(p.tipo, 'sustantivo');
  assert.deepEqual(nuevaPalabra({ perfilId: 'x', texto: 'casa', silabas: ['ca', 'sa'] }).silabas, ['ca', 'sa']);
  assert.throws(() => nuevaPalabra({ perfilId: 'x', texto: '' }));
  assert.throws(() => nuevaPalabra({ texto: 'casa' }));
});

// ---------- etapas ----------

const dominadasEnL4 = (n) =>
  Array.from({ length: n }, (_, i) => ({ elementoId: `w${i}`, actividad: 'L4', estado: ESTADOS.DOMINADA }));

test('actividades por etapa', () => {
  assert.deepEqual([...ACTIVIDADES_POR_ETAPA[1]], ['L1', 'L2', 'L3', 'L4', 'L5']);
  assert.deepEqual([...ACTIVIDADES_POR_ETAPA[3]], ['S1', 'S2', 'S3', 'S4']);
});

test('contarDominadas: solo la actividad pedida, sin repetir elementos ni contar borradas', () => {
  const progresos = [
    ...dominadasEnL4(3),
    { elementoId: 'w0', actividad: 'L4', estado: ESTADOS.DOMINADA }, // repetida
    { elementoId: 'a', actividad: 'L3', estado: ESTADOS.DOMINADA }, // otra actividad
    { elementoId: 'b', actividad: 'L4', estado: ESTADOS.PRACTICA }, // no dominada
    { elementoId: 'c', actividad: 'L4', estado: ESTADOS.DOMINADA, deleted: true },
  ];
  assert.equal(contarDominadas(progresos), 3);
});

test('etapas: la 2 se abre con 10 palabras dominadas en L4 y la 3 con 20', () => {
  assert.deepEqual(etapasDesbloqueadas({ progresos: dominadasEnL4(UMBRAL_ETAPA_2 - 1) }), [0, 1]);
  assert.deepEqual(etapasDesbloqueadas({ progresos: dominadasEnL4(UMBRAL_ETAPA_2) }), [0, 1, 2]);
  assert.deepEqual(etapasDesbloqueadas({ progresos: dominadasEnL4(UMBRAL_ETAPA_3 - 1) }), [0, 1, 2]);
  assert.deepEqual(etapasDesbloqueadas({ progresos: dominadasEnL4(UMBRAL_ETAPA_3) }), [0, 1, 2, 3]);
});

test('etapas: el adulto puede forzar y bloquear cualquiera', () => {
  assert.deepEqual(etapasDesbloqueadas({ forzadas: [3] }), [0, 1, 3]);
  assert.deepEqual(etapasDesbloqueadas({ progresos: dominadasEnL4(20), bloqueadas: [3] }), [0, 1, 2]);
  assert.deepEqual(etapasDesbloqueadas({ bloqueadas: [0] }), [1]);
  assert.deepEqual(etapasDesbloqueadas(), [0, 1]);
});
