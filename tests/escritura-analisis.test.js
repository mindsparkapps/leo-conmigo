// Fase 31 (Ampliación 5): análisis de la escritura y exportación para IA, con un conjunto fijo de respuestas.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { construirExportacion, resumenParaIA, analizar, LIMITE_RESUMEN } from '../js/core/analisis.js';
import { crearAleatorio } from '../js/core/azar.js';
import {
  ajustesDeConfusiones, analizarEscritura, confusionesDeSilabas, dificultadesDeEscritura, generalizacion, metricasDeSilabas, posicionDelError,
  respuestasDeEscritura,
} from '../js/core/escritura/analisis.js';
import { armarPiezas } from '../js/core/escritura/piezas.js';

const HOY = new Date('2026-11-17T12:00:00Z');
let n = 0;
function resp(texto, huecos, { errores = [], porHueco = null, primeraVez = false, perfilId = 'P', actividad = 'E02', sesionId = 's1' } = {}) {
  n += 1;
  const erroresPorHueco = porHueco ?? huecos.map((_, i) => errores.filter((e) => e.hueco === i).length);
  const toques = [
    ...errores.map((e, k) => ({ fichaId: `x${k}`, texto: e.texto, hueco: e.hueco, correcto: false, ms: 500 + k * 500, forma: 'toque' })),
    ...huecos.map((t, i) => ({ fichaId: `f${i}`, texto: t, hueco: i, correcto: true, ms: 3000 + i * 1000, forma: 'toque' })),
  ];
  return {
    id: `r${n}`, perfilId, sesionId, fecha: `2026-11-10T10:0${n}:00.000Z`, dia: '2026-11-10', hora: 10, numeroEnSesion: n, elementoId: `esc:${texto}`, texto, esFrase: false,
    actividad, tipo: 'practica', esFacil: false, modo: 'escritura', unidad: 'silaba', huecos, errores: errores.map((e) => ({ id: e.texto, texto: e.texto, hueco: e.hueco, ms: 600 })),
    erroresPorHueco, toques, escuchasPieza: [{ texto: huecos[0], ms: 100 }], ordenLlenado: huecos.map((_, i) => i), primeraVez, correctoAlPrimerIntento: errores.length === 0,
    msAcierto: 4000, repeticionesAudio: 1, distraido: false,
  };
}
const ba = (hueco = 0) => ({ texto: 'ba', hueco });
const conjunto = () => {
  n = 0;
  return [
    resp('pato', ['pa', 'to'], { errores: [ba(), ba()], primeraVez: true }),
    resp('pato', ['pa', 'to'], { errores: [ba()] }),
    resp('pato', ['pa', 'to']),
    resp('pelota', ['pe', 'lo', 'ta'], { errores: [{ texto: 'da', hueco: 2 }], primeraVez: true }),
    resp('pelota', ['pe', 'lo', 'ta']),
    resp('pelota', ['pe', 'lo', 'ta'], { errores: [{ texto: 'no', hueco: 1 }] }),
  ];
};

describe('análisis de escritura', () => {
  test('por sílaba: apariciones, errores y tasa', () => {
    const s = Object.fromEntries(metricasDeSilabas(conjunto()).map((x) => [x.texto, x]));
    assert.deepEqual([s.pa.apariciones, s.pa.errores, s.pa.sinError], [3, 3, 1]);
    assert.equal(Math.round(s.pa.tasa * 100), 33);
    assert.deepEqual([s.to.apariciones, s.to.errores, s.to.sinError], [3, 0, 3]);
    assert.deepEqual([s.lo.errores, s.lo.sinError], [1, 2]);
    assert.equal(s.pa.confiable, true);
    assert.equal(metricasDeSilabas(conjunto())[0].texto, 'pa'); // la que más le cuesta, primero
  });

  test('el tiempo de una sílaba es desde su toque anterior', () => {
    const s = Object.fromEntries(metricasDeSilabas(conjunto()).map((x) => [x.texto, x]));
    assert.equal(s.to.tiempoMediano, 1000); // toques correctos en 3000, 4000: «to» llegó 1000 ms después de «pa»
  });

  test('confusiones de sílabas: solo las que se repiten', () => {
    assert.deepEqual(confusionesDeSilabas(conjunto()), [{ objetivo: 'pa', tocada: 'ba', veces: 3, niveles: ['E02'] }]);
    assert.equal(confusionesDeSilabas(conjunto(), { minimo: 1 }).length, 3);
  });

  test('posición del error: primera, medio y última', () => {
    const p = posicionDelError(conjunto());
    assert.deepEqual([p.primera.oportunidades, p.primera.errores], [6, 2]);
    assert.deepEqual([p.medio.oportunidades, p.medio.errores], [3, 1]);
    assert.deepEqual([p.ultima.oportunidades, p.ultima.errores], [6, 1]);
    assert.equal(p.ultima.tasaError, 0.167);
  });

  test('generalización: palabras vistas por primera vez armadas sin error', () => {
    const g = generalizacion(conjunto());
    assert.deepEqual([g.total.palabras, g.total.aciertos, g.total.tasa], [2, 0, 0]);
    assert.deepEqual(g.porNivel, [{ nivel: 'E02', palabras: 2, aciertos: 0, tasa: 0 }]);
  });

  test('todo junto: palabras por (palabra, nivel), nivel y audio', () => {
    const a = analizarEscritura(conjunto(), { hoy: HOY });
    assert.equal(a.ensayos, 6);
    assert.deepEqual(a.palabras.map((p) => p.clave).sort(), ['esc:pato:E02', 'esc:pelota:E02']);
    const pato = a.palabras.find((p) => p.elementoId === 'esc:pato');
    assert.equal(pato.nivel, 'E02');
    assert.equal(pato.audioPorEnsayo, 2); // 1 escucha de la palabra + 1 de una pieza, por ensayo
    assert.equal(pato.confiable, false); // 3 ensayos
    assert.equal(a.hayDatos, false);
    assert.deepEqual([a.porNivel[0].nivel, a.porNivel[0].ensayos, a.porNivel[0].sesiones], ['E02', 6, 1]);
    assert.deepEqual([a.nivelMasDificil.nivel, a.nivelMasDificil.ensayos], ['E02', 6]); // hay 5 ensayos o más en el nivel
  });

  test('el perfil de prueba va aparte del real', () => {
    const real = conjunto();
    const prueba = [resp('casa', ['ca', 'sa'], { perfilId: 'prueba:P', errores: [{ texto: 'ta', hueco: 0 }] })];
    const todo = [...real, ...prueba];
    assert.equal(respuestasDeEscritura(todo, { hoy: HOY }).length, 6);
    assert.equal(respuestasDeEscritura(todo, { hoy: HOY, perfilId: 'prueba:P' }).length, 1);
    assert.equal(analizarEscritura(todo, { hoy: HOY }).ensayos, 6);
    assert.equal(analizarEscritura(todo, { hoy: HOY, perfilId: 'prueba:P' }).ensayos, 1);
  });

  test('las respuestas de lectura no entran', () => {
    const lectura = { ...conjunto()[0], modo: 'lectura', actividad: 'L4', tipo: 'practica' };
    assert.equal(analizarEscritura([lectura], { hoy: HOY }).ensayos, 0);
  });

  test('dificultades para la sesión: un índice por palabra', () => {
    const mapa = dificultadesDeEscritura(analizarEscritura(conjunto(), { hoy: HOY }));
    assert.deepEqual([...mapa.keys()].sort(), ['esc:pato', 'esc:pelota']);
    assert.equal(typeof mapa.get('esc:pato').indice, 'number');
  });
});

describe('confusiones al armar las piezas', () => {
  const analisis = (tasa) => ({ silabas: [{ texto: 'pa', confiable: true, tasa }], confusiones: [{ objetivo: 'pa', tocada: 'ba', veces: 3, niveles: ['E02'] }] });

  test('con la sílaba por debajo de 80 %, la confusión no se usa de distractora', () => {
    assert.deepEqual(ajustesDeConfusiones({ huecos: ['pa', 'to'], analisis: analisis(0.5) }), { evitar: ['ba'], incluir: [] });
  });

  test('con 80 % o más se usa a propósito, una sola vez por sesión', () => {
    const usadas = new Set();
    assert.deepEqual(ajustesDeConfusiones({ huecos: ['pa', 'to'], analisis: analisis(0.9), yaUsadas: usadas }), { evitar: [], incluir: ['ba'] });
    assert.deepEqual(ajustesDeConfusiones({ huecos: ['pa', 'to'], analisis: analisis(0.9), yaUsadas: usadas }), { evitar: [], incluir: [] });
  });

  test('una palabra sin esa caja no cambia nada', () => {
    assert.deepEqual(ajustesDeConfusiones({ huecos: ['ma', 'ta'], analisis: analisis(0.5) }), { evitar: [], incluir: [] });
  });

  test('armarPiezas: `incluir` pone la sílaba pedida y `evitar` la saca', () => {
    const palabra = { texto: 'pato', silabas: ['pa', 'to'] };
    const con = armarPiezas({ palabra, extras: 2, incluir: ['ba'], aleatorio: crearAleatorio(3), nivel: 'E02' });
    assert.ok(con.fichas.some((f) => f.texto === 'ba' && f.distractor));
    assert.equal(con.extras, 2);
    for (let semilla = 1; semilla <= 30; semilla++) {
      const sin = armarPiezas({ palabra, extras: 4, evitar: ['ba'], aleatorio: crearAleatorio(semilla), nivel: 'E02' });
      assert.ok(!sin.fichas.some((f) => f.texto === 'ba'));
    }
  });
});

describe('armarEnsayoEscritura con lo que confunde', () => {
  const elemento = { id: 'esc:pato', texto: 'pato', nivel: 'E02', palabra: { texto: 'pato', silabas: ['pa', 'to'] } };
  const ensayo = { elementoId: 'esc:pato', actividad: 'E02', extras: 4 };
  const analisis = (tasa) => ({ silabas: [{ texto: 'pa', confiable: true, tasa }], confusiones: [{ objetivo: 'pa', tocada: 'ba', veces: 3, niveles: ['E02'] }] });

  test('mientras la sílaba falla, la confusión nunca sale de distractora', async () => {
    const { armarEnsayoEscritura } = await import('../js/core/escritura/sesion.js');
    for (let semilla = 1; semilla <= 25; semilla++) {
      const v = armarEnsayoEscritura({ ensayo, elemento, ajustes: {}, aleatorio: crearAleatorio(semilla), analisis: analisis(0.4) });
      assert.ok(!v.fichas.some((f) => f.texto === 'ba'));
    }
  });

  test('con 80 % o más, sale a propósito una sola vez en la sesión', async () => {
    const { armarEnsayoEscritura } = await import('../js/core/escritura/sesion.js');
    const usadas = new Set();
    const primera = armarEnsayoEscritura({ ensayo, elemento, ajustes: {}, aleatorio: crearAleatorio(1), analisis: analisis(0.95), yaUsadas: usadas });
    assert.ok(primera.fichas.some((f) => f.texto === 'ba' && f.distractor));
    assert.equal(usadas.size, 1);
    // la segunda palabra de la sesión ya no la pide a propósito (`incluir` vacío): se prueba directo con el ajuste
    assert.deepEqual(ajustesDeConfusiones({ huecos: ['pa', 'to'], analisis: analisis(0.95), yaUsadas: usadas }).incluir, []);
  });

  test('sin análisis todo queda como antes (misma semilla, mismas piezas)', async () => {
    const { armarEnsayoEscritura } = await import('../js/core/escritura/sesion.js');
    const a = armarEnsayoEscritura({ ensayo, elemento, ajustes: {}, aleatorio: crearAleatorio(5) });
    const b = armarEnsayoEscritura({ ensayo, elemento, ajustes: {}, aleatorio: crearAleatorio(5), analisis: { silabas: [], confusiones: [] } });
    assert.deepEqual(a.fichas, b.fichas);
  });
});

describe('exportación para la IA', () => {
  const perfil = { id: 'P', nombre: 'Leo', ajustes: { escritura: { habilitada: true, nivelEscritura: 'E02' } } };
  const sesiones = [
    { id: 's1', perfilId: 'P', tipo: 'escritura', nivel: 'E02', inicio: '2026-11-10T10:00:00Z', fin: '2026-11-10T10:05:00Z', ensayos: [{ correctoAlPrimerIntento: true }, { correctoAlPrimerIntento: false }] },
    { id: 's2', perfilId: 'P', inicio: '2026-11-10T11:00:00Z', fin: '2026-11-10T11:05:00Z', ensayos: [{ correctoAlPrimerIntento: true }] },
  ];

  test('trae la sección de escritura y la lectura no cambia', () => {
    const rs = conjunto();
    const con = construirExportacion({ perfil, sesiones, respuestas: rs, hoy: HOY });
    const sin = construirExportacion({ perfil, sesiones: sesiones.filter((s) => s.tipo !== 'escritura'), respuestas: [], hoy: HOY });
    assert.ok(con.escritura);
    assert.equal(con.escritura.prueba, false);
    assert.equal(con.escritura.respuestas.length, 6);
    assert.equal(con.escritura.sesiones.length, 1);
    assert.deepEqual(con.escritura.confusiones[0].objetivo, 'pa');
    assert.ok(con.escritura.esquema.generalizacion && con.escritura.metodo.length >= 5);
    assert.equal(con.escritura.ajustes.nivelEscritura, 'E02');
    // lo de lectura es idéntico con o sin escritura en el almacén
    for (const clave of ['metricasPorPalabra', 'confusiones', 'porActividad', 'porHora', 'respuestas']) assert.deepEqual(con[clave], sin[clave]);
    assert.deepEqual(con.sesiones.map((s) => s.id), ['s2']);
    assert.ok(!('escritura' in sin));
    assert.deepEqual(JSON.parse(JSON.stringify(con.escritura)).respuestas.length, 6); // se vuelve a leer
  });

  test('el perfil de prueba sale aparte y marcado', () => {
    const prueba = [resp('casa', ['ca', 'sa'], { perfilId: 'prueba:P' })];
    const real = construirExportacion({ perfil, sesiones, respuestas: [...conjunto(), ...prueba], hoy: HOY });
    assert.equal(real.escritura.respuestas.length, 6);
    const solo = construirExportacion({ perfil, respuestas: prueba, hoy: HOY, prueba: true });
    assert.equal(solo.escritura.prueba, true);
    assert.equal(solo.escritura.respuestas.length, 1);
    assert.ok(!('escritura' in construirExportacion({ perfil, respuestas: prueba, hoy: HOY }))); // sin pedirlo, la prueba no aparece en la exportación real
  });

  test('ocultar el nombre también cubre la escritura', () => {
    const x = construirExportacion({ perfil, sesiones, respuestas: conjunto().map((r) => ({ ...r, texto: 'Leo' })), hoy: HOY, ocultarNombre: true });
    assert.ok(!JSON.stringify(x).includes('Leo'));
  });

  test('el resumen en Markdown suma líneas de escritura y la pregunta, sin pasar de 4 000 caracteres', () => {
    const rs = conjunto();
    const texto = resumenParaIA({ perfil, analisis: analizar([], { hoy: HOY }), hoy: HOY, escritura: analizarEscritura(rs, { hoy: HOY, sesiones }) });
    assert.match(texto, /## Escritura/);
    assert.match(texto, /Confunde: pa→ba \(3\)/);
    assert.match(texto, /qué sílabas reforzar/);
    assert.ok(texto.length <= LIMITE_RESUMEN);
    assert.doesNotMatch(resumenParaIA({ perfil, analisis: analizar([], { hoy: HOY }), hoy: HOY }), /Escritura/);
  });
});
