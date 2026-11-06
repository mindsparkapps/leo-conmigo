import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIAS_VENTANA, LIMITE_RESUMEN, PREGUNTA_PARA_IA, actividadMasDificil, analizar, confusionesFrecuentes, construirExportacion,
  indiceDeDificultad, mediana, metricasPorPalabra, nombreDeArchivoAnalisis, ocultarNombreEn, resumenParaIA, resumenPorHora,
  respuestasAnalizables, tendenciaDe,
} from '../js/core/analisis.js';

const HOY = new Date(2026, 10, 6, 12, 0, 0); // 6 de noviembre de 2026
let contador = 0;

/** Una respuesta de ejemplo; `contador` hace que se ordenen en el orden en que se crean. */
function r(texto, { ok = true, ms = 3000, audio = 0, dia = '2026-11-05', hora = 10, actividad = 'L1', tipo = 'practica', errores = null, ...resto } = {}) {
  contador += 1;
  return {
    id: `s:${contador}`,
    perfilId: 'p1',
    fecha: new Date(Date.UTC(2026, 9, 1) + contador * 60000).toISOString(),
    dia,
    hora,
    elementoId: texto,
    texto,
    esFrase: false,
    actividad,
    tipo,
    esFacil: false,
    correctoAlPrimerIntento: ok,
    errores: errores ?? (ok ? [] : [{ id: 'otra', texto: 'otra', ms: 900 }]),
    msAcierto: ms,
    distraido: ms > 60000,
    repeticionesAudio: audio,
    ...resto,
  };
}
const varias = (n, texto, opciones) => Array.from({ length: n }, () => r(texto, opciones));

test('mediana: impar, par, vacía y valores no numéricos', () => {
  assert.equal(mediana([3, 1, 2]), 2);
  assert.equal(mediana([4, 1, 3, 2]), 2.5);
  assert.equal(mediana([]), null);
  assert.equal(mediana([5, null, NaN, 7]), 6);
});

test('respuestasAnalizables: deja fuera lo fácil, L6, los cuentos, lo borrado y lo de hace más de 60 días', () => {
  const buenas = [r('sol'), r('luna', { dia: '2026-09-07' })]; // el día 60 todavía cuenta
  const fuera = [
    r('fácil', { esFacil: true }),
    r('voz', { actividad: 'L6', tipo: 'lectura' }),
    r('cuento', { actividad: 'B2', tipo: 'cuento' }),
    r('borrada', { deleted: true }),
    r('vieja', { dia: '2026-09-06' }),
  ];
  const rs = respuestasAnalizables([...fuera, ...buenas], { hoy: HOY });
  assert.deepEqual(rs.map((x) => x.texto), ['sol', 'luna']);
  assert.equal(respuestasAnalizables(fuera, { hoy: HOY, dias: null }).length, 1); // sin ventana: solo queda «vieja»
});

test('índice de dificultad: la fórmula del plan, con sus topes', () => {
  assert.equal(indiceDeDificultad({ tasa: 1, tiempoRelativo: 1, audioPorEnsayo: 0 }), 0);
  assert.equal(indiceDeDificultad({ tasa: 0, tiempoRelativo: 3, audioPorEnsayo: 2 }), 100);
  assert.equal(indiceDeDificultad({ tasa: 0, tiempoRelativo: 99, audioPorEnsayo: 99 }), 100); // topes
  assert.equal(indiceDeDificultad({ tasa: 0.4, tiempoRelativo: 3, audioPorEnsayo: 1.2 }), 70);
  assert.equal(indiceDeDificultad({ tasa: 1, tiempoRelativo: null, audioPorEnsayo: 0 }), 0); // sin tiempo: no suma
  assert.equal(indiceDeDificultad({ tasa: 1, tiempoRelativo: 0.5, audioPorEnsayo: 0 }), 0); // más rápido que su promedio no resta
});

test('métricas por palabra: tasa, errores, tiempo mediano y relativo al propio niño, audio y días', () => {
  // mamá: 4 aciertos de 6 s y 6 fallos de 9 s con 2 toques de audio; sol: 6 aciertos de 2 s.
  // La mediana del niño en L1 (solo aciertos) es 2 s → mamá es 3 veces más lenta que su propio promedio.
  const rs = [
    ...varias(6, 'mamá', { ok: false, ms: 9000, audio: 2, dia: '2026-11-04' }),
    ...varias(4, 'mamá', { ok: true, ms: 6000, audio: 0, dia: '2026-11-05' }),
    ...varias(6, 'sol', { ok: true, ms: 2000 }),
  ];
  const [mama, sol] = metricasPorPalabra(rs, { hoy: HOY });
  assert.equal(mama.texto, 'mamá');
  assert.equal(mama.ensayos, 10);
  assert.equal(mama.aciertosPrimerIntento, 4);
  assert.equal(mama.tasa, 0.4);
  assert.equal(mama.errores, 6);
  assert.equal(mama.tiempoMediano, 6000);
  assert.equal(mama.tiempoRelativo, 3);
  assert.equal(mama.audioPorEnsayo, 1.2);
  assert.equal(mama.dias, 2);
  assert.equal(mama.indice, 70);
  assert.equal(mama.confiable, true);
  assert.equal(sol.indice, 0);
  assert.equal(sol.tiempoRelativo, 1);
  assert.equal(sol.dias, 1);
});

test('el tiempo mediano ignora los ensayos distraídos y los que no fueron al primer intento', () => {
  const rs = [...varias(5, 'luz', { ms: 2000 }), r('luz', { ms: 90000 }), r('luz', { ok: false, ms: 50000 })];
  const [luz] = metricasPorPalabra(rs, { hoy: HOY });
  assert.equal(luz.ensayos, 7);
  assert.equal(luz.tiempoMediano, 2000);
});

test('con menos de 5 ensayos la palabra es «pocos datos» (no confiable)', () => {
  const [a] = metricasPorPalabra(varias(4, 'pan', { ok: false }), { hoy: HOY });
  assert.equal(a.confiable, false);
  const [b] = metricasPorPalabra(varias(5, 'pan', { ok: false }), { hoy: HOY });
  assert.equal(b.confiable, true);
});

test('tendencia: últimos 5 contra los 5 anteriores, con umbral de 0,2', () => {
  const orden = (...marcas) => marcas.map((ok) => r('pan', { ok }));
  assert.equal(tendenciaDe(orden(false, false, false, false, false, true, true, true, true, true)), 'mejora');
  assert.equal(tendenciaDe(orden(true, true, true, true, true, false, false, false, true, true)), 'empeora');
  // 0,8 contra 0,6 = 0,2 justo: ya cuenta
  assert.equal(tendenciaDe(orden(true, true, true, false, false, true, true, true, true, false)), 'mejora');
  // 0,8 contra 0,8: igual
  assert.equal(tendenciaDe(orden(true, true, true, true, false, true, true, true, true, false)), 'igual');
  // faltan ensayos anteriores para comparar
  assert.equal(tendenciaDe(orden(false, false, true, true, true, true, true)), 'igual');
  assert.equal(tendenciaDe(orden(true, true, true)), 'igual');
});

test('un repaso fallado en los últimos 7 días se marca; uno más viejo, no', () => {
  const reciente = metricasPorPalabra([r('a', { tipo: 'repaso', ok: false, dia: '2026-11-03' })], { hoy: HOY });
  const viejo = metricasPorPalabra([r('b', { tipo: 'repaso', ok: false, dia: '2026-10-20' })], { hoy: HOY });
  assert.equal(reciente[0].falloRepasoReciente, true);
  assert.equal(viejo[0].falloRepasoReciente, false);
});

test('confusiones: pares objetivo → tocada, de más a menos frecuentes, con mínimo de 2', () => {
  const de = (texto, tocada, idTocada = tocada) => r(texto, { ok: false, errores: [{ id: idTocada, texto: tocada, ms: 800 }] });
  const rs = [
    de('mamá', 'mano'), de('mamá', 'mano'), de('mamá', 'mano'), de('mamá', 'mano'),
    de('sol', 'luz'), // una sola vez: no es confusión
    de('pan', 'pie'), de('pan', 'pie'),
    r('pan', { ok: false, errores: [{ id: 'pan', texto: 'pan', ms: 800 }] }), // tocarse a sí misma no cuenta
    r('pan', { ok: false, errores: [{ id: 'x', texto: null, ms: 800 }] }), // sin texto: no se puede decir
    r('mamá', { ok: false, esFacil: true, errores: [{ id: 'mano', texto: 'mano', ms: 800 }] }), // fácil: fuera
  ];
  const c = confusionesFrecuentes(rs, { hoy: HOY });
  assert.deepEqual(c.map((x) => [x.objetivo, x.tocada, x.veces]), [['mamá', 'mano', 4], ['pan', 'pie', 2]]);
  assert.equal(confusionesFrecuentes(rs, { hoy: HOY, minimo: 1 }).length, 3);
});

test('listas: más difíciles, más fáciles y para repetir más', () => {
  const rs = [
    // perro: 10 ensayos, 2 aciertos (al final), audio 1 en cada fallo
    ...varias(8, 'perro', { ok: false, ms: 4000, audio: 1 }),
    ...varias(2, 'perro', { ok: true, ms: 4000 }),
    // mamá: 10 ensayos, 5 aciertos, mejora (los fallos primero)
    ...varias(5, 'mamá', { ok: false, ms: 4000, audio: 1 }),
    ...varias(5, 'mamá', { ok: true, ms: 4000 }),
    ...varias(8, 'sol', { ok: true, ms: 2000 }),
    ...varias(8, 'casa', { ok: true, ms: 3000 }),
    // luz: solo 3 ensayos (no confiable), pero falló un repaso hace poco
    ...varias(2, 'luz', { ok: false }),
    r('luz', { ok: false, tipo: 'repaso', dia: '2026-11-04' }),
  ];
  const a = analizar(rs, { hoy: HOY });
  assert.equal(a.hayDatos, true);
  assert.deepEqual(a.masDificiles.map((p) => p.texto), ['perro', 'mamá']); // luz no es confiable; sol y casa valen 0
  assert.deepEqual(a.masFaciles.map((p) => p.texto), ['sol', 'casa']); // empatan en 0: gana el más rápido
  assert.deepEqual(a.paraRepetirMas.map((p) => p.texto), ['luz', 'perro']); // luz por el repaso, perro por índice ≥ 50
  assert.ok(a.palabras.find((p) => p.texto === 'luz').indice > 0);
  assert.equal(a.palabras.find((p) => p.texto === 'mamá').tendencia, 'mejora');
});

test('«para repetir más» incluye a quien empeora aunque su índice sea bajo', () => {
  const rs = [
    ...varias(5, 'tren', { ok: true, ms: 2000 }),
    ...varias(2, 'tren', { ok: false, ms: 2000 }),
    ...varias(3, 'tren', { ok: true, ms: 2000 }),
    ...varias(5, 'bus', { ok: true, ms: 2000 }),
  ];
  // tren: últimos 5 = 2 fallos + 3 aciertos (0,6) contra los 5 anteriores todos acertados (1) → empeora
  const a = analizar(rs, { hoy: HOY });
  const tren = a.palabras.find((p) => p.texto === 'tren');
  assert.equal(tren.tendencia, 'empeora');
  assert.ok(tren.indice < 50);
  assert.deepEqual(a.paraRepetirMas.map((p) => p.texto), ['tren']);
});

test('por actividad: tasa, tiempo mediano y la que más cuesta (solo con datos suficientes)', () => {
  const rs = [
    ...varias(6, 'a', { actividad: 'L1', ms: 2000 }),
    ...varias(3, 'a', { actividad: 'L4', ms: 5000 }),
    ...varias(3, 'a', { actividad: 'L4', ok: false, ms: 5000 }),
    ...varias(3, 'a', { actividad: 'L5', ok: false }), // L5 con solo 3 ensayos: pocos datos
  ];
  const a = analizar(rs, { hoy: HOY });
  assert.deepEqual(a.porActividad.map((x) => [x.actividad, x.ensayos, x.tasa]), [['L1', 6, 1], ['L4', 6, 0.5], ['L5', 3, 0]]);
  assert.equal(a.porActividad[1].tiempoMediano, 5000);
  assert.equal(a.actividadMasDificil.actividad, 'L4');
  assert.equal(actividadMasDificil([]), null);
});

test('por hora: solo franjas con 20 ensayos o más, y solo si hay al menos dos', () => {
  const manana = varias(20, 'a', { hora: 9 });
  const tarde = [...varias(15, 'a', { hora: 16 }), ...varias(5, 'a', { hora: 16, ok: false })];
  const pocos = varias(19, 'a', { hora: 22 });
  const h = resumenPorHora([...manana, ...tarde, ...pocos]);
  assert.deepEqual(h.map((x) => [x.franja, x.ensayos, x.tasa]), [['manana', 20, 1], ['tarde', 20, 0.75]]);
  assert.deepEqual(resumenPorHora(manana), []); // una sola franja: no hay con qué comparar
  // madrugada (2 h) y noche (23 h) son la misma franja: una sola, nada que comparar
  assert.deepEqual(resumenPorHora([...varias(20, 'a', { hora: 2 }), ...varias(20, 'a', { hora: 23 })]), []);
});

test('sin datos suficientes no hay listas: hayDatos es falso', () => {
  const vacio = analizar([], { hoy: HOY });
  assert.equal(vacio.hayDatos, false);
  assert.deepEqual(vacio.palabras, []);
  const poco = analizar(varias(4, 'sol'), { hoy: HOY });
  assert.equal(poco.hayDatos, false);
  assert.deepEqual(poco.masDificiles, []);
  assert.equal(poco.palabras[0].confiable, false);
});

// ---------- exportar ----------

const perfil = { id: 'p1', nombre: 'Leo Martín', fechaNacimiento: '2018-11-07', etapaActual: 1, ajustes: { ensayosPorSesion: 8, maxOpciones: 4 } };
const sesiones = [
  { id: 's1', perfilId: 'p1', inicio: '2026-11-05T10:00:00.000Z', fin: '2026-11-05T10:06:00.000Z', fatiga: false, ensayos: [{ correctoAlPrimerIntento: true }, { correctoAlPrimerIntento: false }] },
  { id: 's2', perfilId: 'p1', inicio: '2026-11-04T10:00:00.000Z', fin: '2026-11-04T10:06:00.000Z', deleted: true, ensayos: [] },
];

test('exportación: trae esquema, método, métricas, sesiones y todas las respuestas (aunque pasen de 60 días)', () => {
  const rs = [r('vieja', { dia: '2026-01-10' }), ...varias(5, 'sol'), r('borrada', { deleted: true })];
  const x = construirExportacion({ perfil, sesiones, respuestas: rs, hoy: HOY, version: '0.13.0' });
  const vuelta = JSON.parse(JSON.stringify(x));
  assert.deepEqual(Object.keys(vuelta.esquema).sort(), ['confusiones', 'metodo', 'metricasPorPalabra', 'perfil', 'porActividad', 'porHora', 'respuestas', 'sesiones', 'ventanaDias']);
  assert.equal(vuelta.metodo.length, 5);
  assert.equal(vuelta.perfil.nombre, 'Leo');
  assert.equal(vuelta.perfil.edad, 7); // cumple 8 el 7 de nov.
  assert.equal(vuelta.perfil.fechaNacimiento, undefined);
  assert.equal(vuelta.ventanaDias, DIAS_VENTANA);
  assert.deepEqual(vuelta.metricasPorPalabra.map((p) => p.texto), ['sol']);
  assert.equal(vuelta.respuestas.length, 6); // la vieja entra; la borrada, no
  assert.deepEqual(vuelta.sesiones.map((s) => [s.id, s.ensayos, s.aciertosPrimerIntento]), [['s1', 2, 1]]);
  assert.equal(vuelta.versionApp, '0.13.0');
});

test('ocultar el nombre: no aparece en ningún campo, ni siquiera como palabra o dentro de un texto', () => {
  const rs = [
    ...varias(5, 'Leo'), // el niño practica su propio nombre
    r('mamá', { ok: false, errores: [{ id: 'leo2', texto: 'leo', ms: 800 }] }),
    r('Leonardo'), // otra palabra que solo empieza igual: se conserva
  ];
  const x = construirExportacion({ perfil, sesiones, respuestas: rs, hoy: HOY, ocultarNombre: true });
  const texto = JSON.stringify(x);
  assert.ok(!/\bLeo\b/i.test(texto), 'no debe quedar «Leo»');
  assert.ok(!/Mart[ií]n/i.test(texto));
  assert.equal(x.perfil.nombre, 'el niño');
  assert.ok(texto.includes('Leonardo'));
  // sin ocultar, queda tal cual
  assert.ok(JSON.stringify(construirExportacion({ perfil, sesiones, respuestas: rs, hoy: HOY })).includes('"Leo"'));
  assert.deepEqual(ocultarNombreEn({ a: 'Ana y Luis' }, ''), { a: 'Ana y Luis' });
});

test('exportación: no lleva fotos ni audios', () => {
  const x = construirExportacion({ perfil: { ...perfil, fotoMedioId: 'm1' }, respuestas: varias(5, 'sol'), hoy: HOY });
  const texto = JSON.stringify(x);
  assert.ok(!texto.includes('fotoMedioId'));
  assert.ok(!texto.includes('medioImagenId'));
  assert.ok(!texto.includes('data:'));
});

test('nombre del archivo exportado', () => {
  assert.equal(nombreDeArchivoAnalisis(perfil, HOY), 'leo-conmigo-analisis-leo-2026-11-06.json');
  assert.equal(nombreDeArchivoAnalisis({ nombre: 'José Ángel' }, HOY), 'leo-conmigo-analisis-jose-2026-11-06.json');
  assert.equal(nombreDeArchivoAnalisis(perfil, HOY, true), 'leo-conmigo-analisis-nino-2026-11-06.json');
});

test('resumen para IA: Markdown con las secciones y la pregunta, y nunca pasa de 4 000 caracteres', () => {
  const rs = [
    ...varias(8, 'perro', { ok: false, ms: 4000, audio: 1, errores: [{ id: 'gato', texto: 'gato', ms: 700 }] }),
    ...varias(2, 'perro', { ok: true, ms: 4000 }),
    ...varias(8, 'sol', { ok: true, ms: 2000 }),
  ];
  const texto = resumenParaIA({ perfil, analisis: analizar(rs, { hoy: HOY }), hoy: HOY });
  for (const parte of ['# Datos de lectura de Leo', '## Le cuestan más', '## Le salen fácil', '## Para repetir más', '## Se confunde entre', '- perro', 'perro ↔ gato: 8 veces', '## Pregunta', PREGUNTA_PARA_IA]) {
    assert.ok(texto.includes(parte), `falta: ${parte}`);
  }
  assert.ok(texto.length <= LIMITE_RESUMEN);
  assert.ok(!resumenParaIA({ perfil, analisis: analizar(rs, { hoy: HOY }), hoy: HOY, ocultarNombre: true }).includes('Leo'));

  // muchísimas palabras con nombres largos
  const muchas = [];
  for (let i = 0; i < 60; i += 1) muchas.push(...varias(6, `palabra-larguísima-número-${i}-${'x'.repeat(40)}`, { ok: i % 3 === 0, errores: [{ id: `o${i}`, texto: `otra-palabra-muy-larga-${i}-${'y'.repeat(40)}`, ms: 500 }] }));
  const largo = resumenParaIA({ perfil, analisis: analizar(muchas, { hoy: HOY }), hoy: HOY });
  assert.ok(largo.length <= LIMITE_RESUMEN, `mide ${largo.length}`);
  assert.ok(largo.includes(PREGUNTA_PARA_IA));
});
