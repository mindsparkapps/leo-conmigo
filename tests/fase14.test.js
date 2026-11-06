import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAJA_APRENDIDA, DIAS_CONTROL, ESTADOS, aplicarResultado, desmarcarAprendida, diaDeControl, estaAprendida, idNivel, nuevoNivel,
  nuevoProgreso, registrarEnsayo,
} from '../js/core/progreso.js';
import { crearSesion, reajustarPorDificultad } from '../js/core/sesion.js';
import { elegirDistractores } from '../js/core/distractores.js';
import { crearAleatorio } from '../js/core/azar.js';
import { AJUSTES_POR_DEFECTO, normalizarAjustes } from '../js/core/modelos.js';
import { tablaDePalabras, volverAPracticar } from '../js/core/estadisticas.js';
import { dificultadesDe, analizar } from '../js/core/analisis.js';
import { avisosPendientes, deshacerCambio, evaluarAutoajuste, marcarVisto } from '../js/core/autoajuste.js';
import { crearControlador } from '../js/core/controlador.js';
import { simular } from './simulador.js';
import { ACTIVIDADES, HOY, PERFIL_ID, palabra, perfil, progresoCon, vocabulario } from './ayudas.js';

const nuevo = () => nuevoProgreso({ perfilId: PERFIL_ID, elementoId: 'mamá', actividad: 'L1' });
const fecha = (dia, hora = 10) => new Date(2026, 9, dia, hora, 0, 0);
const ensayo = (progreso, dia, ok, extra = {}, rapido = true) =>
  registrarEnsayo(progreso, { fecha: fecha(dia), correctoAlPrimerIntento: ok, opciones: 2, ...extra }, { avanceRapido: rapido });

// ---------- avance rápido ----------

test('avance rápido: 3 aciertos al primer intento con 2 opciones o más → dominada provisional, caja 1, repaso mañana', () => {
  let p = nuevo();
  p = ensayo(p, 1, true);
  p = ensayo(p, 1, true);
  assert.equal(p.estado, ESTADOS.PRACTICA);
  p = ensayo(p, 1, true);
  assert.equal(p.estado, ESTADOS.DOMINADA);
  assert.equal(p.provisional, true);
  assert.equal(p.cajaLeitner, 1);
  assert.equal(p.proximoRepaso, '2026-10-02');
});

test('avance rápido: sin el ajuste, o con un fallo entre los 3 primeros, o con ensayos de 1 opción o fáciles, no acelera', () => {
  let sin = nuevo();
  for (let i = 0; i < 3; i++) sin = ensayo(sin, 1, true, {}, false);
  assert.equal(sin.estado, ESTADOS.PRACTICA);

  let fallo = nuevo();
  for (const ok of [true, false, true, true]) fallo = ensayo(fallo, 1, ok);
  assert.equal(fallo.estado, ESTADOS.PRACTICA);

  let unaOpcion = nuevo();
  for (let i = 0; i < 3; i++) unaOpcion = ensayo(unaOpcion, 1, true, { opciones: 1 });
  assert.equal(unaOpcion.estado, ESTADOS.PRACTICA);

  let faciles = nuevo();
  for (let i = 0; i < 3; i++) faciles = ensayo(faciles, 1, true, { esFacil: true });
  assert.equal(faciles.estado, ESTADOS.PRACTICA);
  // los fáciles no cuentan, pero siguen sin impedirlo: 3 que cuentan después sí acelera
  for (let i = 0; i < 3; i++) faciles = ensayo(faciles, 1, true);
  assert.equal(faciles.estado, ESTADOS.DOMINADA);
  assert.equal(faciles.provisional, true);
});

test('avance rápido: solo cuenta al llegar al tercer ensayo; un cuarto acierto tras un fallo no lo activa', () => {
  let p = nuevo();
  for (const ok of [false, true, true, true, true]) p = ensayo(p, 1, ok);
  assert.equal(p.estado, ESTADOS.PRACTICA); // 4 de 5 en un solo día: tampoco cumple el dominio normal (2 días)
});

test('provisional: si el repaso del día siguiente falla, vuelve a práctica con UN solo error', () => {
  let p = nuevo();
  for (let i = 0; i < 3; i++) p = ensayo(p, 1, true);
  p = ensayo(p, 2, false);
  assert.equal(p.estado, ESTADOS.PRACTICA);
  assert.equal(p.provisional, false);
  assert.equal(p.proximoRepaso, null);
  assert.equal(p.cajaLeitner, 1);
});

test('provisional: si el repaso acierta, deja de ser provisional y sigue la caja normal', () => {
  let p = nuevo();
  for (let i = 0; i < 3; i++) p = ensayo(p, 1, true);
  p = ensayo(p, 2, true);
  assert.equal(p.estado, ESTADOS.DOMINADA);
  assert.equal(p.provisional, false);
  assert.equal(p.cajaLeitner, 2);
  assert.equal(p.proximoRepaso, '2026-10-04');
});

test('una dominada normal sigue necesitando DOS errores seguidos para volver a práctica', () => {
  const p = { ...progresoCon('mamá', 'L1', ESTADOS.DOMINADA, { proximoRepaso: '2026-10-05' }), provisional: undefined };
  const una = registrarEnsayo(p, { fecha: fecha(6), correctoAlPrimerIntento: false, opciones: 2 });
  assert.equal(una.estado, ESTADOS.DOMINADA);
  const dos = registrarEnsayo(una, { fecha: fecha(7), correctoAlPrimerIntento: false, opciones: 2 });
  assert.equal(dos.estado, ESTADOS.PRACTICA);
});

test('aplicarResultado pasa el avance rápido al progreso', () => {
  let p = nuevo();
  let n = nuevoNivel(PERFIL_ID, 'L1');
  for (let i = 0; i < 3; i++) {
    ({ progreso: p, nivel: n } = aplicarResultado({
      progreso: p, nivel: n, resultado: { fecha: fecha(1), correctoAlPrimerIntento: true, opciones: 3 }, avanceRapido: true,
    }));
  }
  assert.equal(p.provisional, true);
});

// ---------- palabras aprendidas ----------

const dominadaEnCaja = (actividad, caja, extra = {}) => ({
  ...progresoCon('mamá', actividad, ESTADOS.DOMINADA, { proximoRepaso: '2026-10-30', caja }),
  ...extra,
});

test('aprendida: un repaso acertado estando en la caja 5 la marca; antes de eso (caja 4 → 5) todavía no', () => {
  const desdeCaja4 = registrarEnsayo(dominadaEnCaja('L1', 4), { fecha: fecha(31), correctoAlPrimerIntento: true, opciones: 3 });
  assert.equal(desdeCaja4.cajaLeitner, CAJA_APRENDIDA);
  assert.equal(desdeCaja4.aciertosEnCaja5, undefined);
  const desdeCaja5 = registrarEnsayo(dominadaEnCaja('L1', 5), { fecha: fecha(31), correctoAlPrimerIntento: true, opciones: 3 });
  assert.equal(desdeCaja5.aciertosEnCaja5, 1);
  assert.equal(desdeCaja5.cajaLeitner, 5);
});

test('estaAprendida: todas dominadas de verdad (no provisionales) y al menos un repaso acertado en la caja 5', () => {
  const todas = ACTIVIDADES.map((a, i) => dominadaEnCaja(a, 5, i === 0 ? { aciertosEnCaja5: 1 } : {}));
  assert.equal(estaAprendida(todas), true);
  assert.equal(estaAprendida(todas.map((p) => ({ ...p, aciertosEnCaja5: 0 }))), false);
  assert.equal(estaAprendida([...todas.slice(0, 4), { ...todas[4], provisional: true }]), false);
  assert.equal(estaAprendida([...todas.slice(0, 4), progresoCon('mamá', 'L5', ESTADOS.PRACTICA)]), false);
  assert.equal(estaAprendida([...todas.slice(0, 4), undefined]), false);
  assert.equal(estaAprendida([]), false);
});

test('aprendida: si falla un repaso, deja de contar y vuelve a dominada en caja 1', () => {
  const p = registrarEnsayo(dominadaEnCaja('L1', 5, { aciertosEnCaja5: 1 }), { fecha: fecha(31), correctoAlPrimerIntento: false, opciones: 3 });
  assert.equal(p.estado, ESTADOS.DOMINADA);
  assert.equal(p.cajaLeitner, 1);
  assert.equal(p.aciertosEnCaja5, 0);
  assert.equal(estaAprendida([p]), false);
  const repracticar = desmarcarAprendida(dominadaEnCaja('L1', 5, { aciertosEnCaja5: 2 }));
  assert.deepEqual([repracticar.cajaLeitner, repracticar.aciertosEnCaja5, repracticar.proximoRepaso], [1, 0, null]);
});

/** Una palabra aprendida: 5 actividades dominadas en caja 5; el último ensayo, en el día de octubre dado. */
function aprendida(id, ultimoDia) {
  return ACTIVIDADES.map((actividad, i) => {
    const base = progresoCon(id, actividad, ESTADOS.DOMINADA, { proximoRepaso: '2026-10-30', caja: 5 });
    return {
      ...base,
      aciertosEnCaja5: i === 0 ? 1 : 0,
      historial: [{ fecha: `2026-10-${String(ultimoDia).padStart(2, '0')}T10:00:00`, correctoAlPrimerIntento: true, opciones: 3 }],
    };
  });
}
const dominada = (id) => ACTIVIDADES.map((a) => progresoCon(id, a, ESTADOS.DOMINADA, { proximoRepaso: '2026-11-01' }));
const sesion = (progresos, { semilla = 1, ajustes = {}, elementos = vocabulario(5) } = {}) =>
  crearSesion({
    perfil: perfil({ ensayosPorSesion: 8, ...ajustes }), elementos, progresos, niveles: [], actividades: ACTIVIDADES, hoy: HOY, aleatorio: crearAleatorio(semilla),
  });

test('las aprendidas no entran en los repasos normales, salvo un control cada 30 días (uno por sesión)', () => {
  assert.equal(DIAS_CONTROL, 30);
  const otras = ['papá', 'perro', 'gato', 'pan'].flatMap(dominada);
  // aprendida hace 16 días (octubre 20): todavía no toca control
  const sinControl = sesion([...aprendida('mamá', 20), ...otras]);
  assert.equal(sinControl.ensayos.filter((e) => e.elementoId === 'mamá').length, 0);
  // aprendida hace más de 30 días (octubre 2): toca control, un solo ensayo de repaso
  for (let semilla = 1; semilla <= 6; semilla++) {
    const conControl = sesion([...aprendida('mamá', 2), ...otras], { semilla });
    const suyos = conControl.ensayos.filter((e) => e.elementoId === 'mamá');
    assert.equal(suyos.length, 1, `semilla ${semilla}`);
    assert.equal(suyos[0].tipo, 'repaso');
    assert.equal(conControl.ensayos.length, 8);
  }
});

test('con varias aprendidas con control vencido, solo una por sesión', () => {
  const otras = ['perro', 'gato', 'pan'].flatMap(dominada);
  const plan = sesion([...aprendida('mamá', 2), ...aprendida('papá', 3), ...otras]);
  const controles = plan.ensayos.filter((e) => ['mamá', 'papá'].includes(e.elementoId));
  assert.equal(controles.length, 1);
  assert.equal(controles[0].elementoId, 'mamá'); // el más atrasado primero
});

test('si lo único que hay es un control, la sesión es de un solo ensayo', () => {
  const plan = sesion([...aprendida('mamá', 2)], { elementos: vocabulario(1) });
  assert.equal(plan.ensayos.length, 1);
  assert.equal(plan.ensayos[0].tipo, 'repaso');
  assert.equal(sesion([...aprendida('mamá', 20)], { elementos: vocabulario(1) }).ensayos.length, 0);
});

test('diaDeControl: 30 días después del último ensayo', () => {
  assert.equal(diaDeControl(aprendida('mamá', 2)[0]), '2026-11-01');
});

test('una aprendida sigue pudiendo ser distractor', () => {
  const todas = vocabulario(5);
  const progresos = [
    ...aprendida('mamá', 2),
    ...['papá', 'perro', 'gato'].flatMap((id) => ACTIVIDADES.slice(0, 1).map((a) => progresoCon(id, a, ESTADOS.PRACTICA, { aciertos: 1, total: 3 }))),
  ];
  const plan = crearSesion({
    perfil: perfil({ ensayosPorSesion: 8 }), elementos: todas, progresos, niveles: [], actividades: ACTIVIDADES, hoy: HOY, aleatorio: crearAleatorio(3),
    vistasPrevias: new Set(todas.map((p) => p.id)),
  });
  const usadas = new Set(plan.ensayos.flatMap((e) => e.distractorIds));
  assert.ok(usadas.has('mamá'));
});

test('tablaDePalabras marca «aprendida» y volverAPracticar la devuelve a los repasos', () => {
  const palabras = vocabulario(2);
  const progresos = [...aprendida('mamá', 2), ...dominada('papá')];
  const filas = tablaDePalabras({ palabras, progresos });
  assert.deepEqual(filas.map((f) => f.estado), ['aprendida', 'completa']);
  const devueltos = volverAPracticar({ elementoId: 'mamá', existentes: progresos });
  assert.equal(devueltos.length, 5);
  assert.equal(tablaDePalabras({ palabras, progresos: devueltos }).find((f) => f.palabra.id === 'mamá').estado, 'completa');
});

// ---------- prioridad a lo difícil ----------

test('reajustarPorDificultad: el índice alto recibe un ensayo que cede el índice bajo; el total no cambia', () => {
  const trabajo = ['a', 'b', 'c', 'd'].map((id) => ({ elemento: { id }, categoria: 'practica' }));
  const dif = new Map([
    ['a', { indice: 80, confiable: true }], ['b', { indice: 10, confiable: true }],
    ['c', { indice: 10, confiable: true }], ['d', { indice: 30, confiable: true }],
  ]);
  assert.deepEqual(reajustarPorDificultad(trabajo, [2, 2, 1, 2], dif, 4), [3, 1, 1, 2]); // c tiene 1: no cede
  assert.deepEqual(reajustarPorDificultad(trabajo, [2, 2, 1, 2], dif, 2), [2, 2, 1, 2]); // a ya está en el tope
  const pocos = new Map([['a', { indice: 80, confiable: false }], ['b', { indice: 10, confiable: true }]]);
  assert.deepEqual(reajustarPorDificultad(trabajo, [2, 2, 1, 2], pocos, 4), [2, 2, 1, 2]); // sin datos confiables, nada
  const nueva = [{ elemento: { id: 'a' }, categoria: 'nueva' }, { elemento: { id: 'b' }, categoria: 'practica' }];
  assert.deepEqual(reajustarPorDificultad(nueva, [2, 2], dif, 4), [2, 2]);
});

test('crearSesion reparte más ensayos a la palabra difícil y menos a la fácil, con el mismo total', () => {
  const todas = vocabulario(5);
  const progresos = todas.map((p) => progresoCon(p.id, 'L1', ESTADOS.PRACTICA, { aciertos: 1, total: 3 }));
  const dificultades = new Map([
    ['mamá', { indice: 90, confiable: true, tasa: 0.2, confusionId: null }],
    ['papá', { indice: 5, confiable: true, tasa: 1, confusionId: null }],
  ]);
  const cuenta = (plan, id) => plan.ensayos.filter((e) => e.elementoId === id).length;
  const base = crearSesion({ perfil: perfil({ ensayosPorSesion: 8 }), elementos: todas, progresos, niveles: [], actividades: ACTIVIDADES, hoy: HOY, aleatorio: crearAleatorio(1) });
  const con = crearSesion({ perfil: perfil({ ensayosPorSesion: 8 }), elementos: todas, progresos, niveles: [], actividades: ACTIVIDADES, hoy: HOY, aleatorio: crearAleatorio(1), dificultades });
  assert.equal(base.ensayos.length, 8);
  assert.equal(con.ensayos.length, 8);
  assert.equal(cuenta(con, 'mamá'), cuenta(base, 'mamá') + 1);
  assert.equal(cuenta(con, 'papá'), cuenta(base, 'papá') - 1);
});

// ---------- confusiones como distractor ----------

test('elegirDistractores: excluirIds evita una palabra (si sobran otras) e incluirIds la pone primero', () => {
  const voc = vocabulario(8);
  const vistas = new Set(voc.map((p) => p.id));
  const objetivo = voc[0];
  for (let semilla = 1; semilla <= 10; semilla++) {
    const sin = elegirDistractores(objetivo, voc, { cantidad: 3, vistas, aleatorio: crearAleatorio(semilla), excluirIds: ['papá'] });
    assert.ok(!sin.some((p) => p.id === 'papá'));
    const con = elegirDistractores(objetivo, voc, { cantidad: 3, vistas, aleatorio: crearAleatorio(semilla), incluirIds: ['papá'] });
    assert.ok(con.some((p) => p.id === 'papá'));
    assert.equal(con.length, 3);
  }
  // si excluirla dejaría menos opciones de las pedidas, no se excluye
  const pocas = voc.slice(0, 3);
  const conPocas = elegirDistractores(objetivo, pocas, { cantidad: 2, vistas, aleatorio: crearAleatorio(1), excluirIds: ['papá'] });
  assert.equal(conPocas.length, 2);
});

function sesionConConfusion(semilla, tasa) {
  const todas = vocabulario(8); // 5 en práctica y 3 más que ya vio: «papá» no entra sola en todas las opciones
  const progresos = todas.slice(0, 5).map((p) => progresoCon(p.id, 'L1', ESTADOS.PRACTICA, { aciertos: 1, total: 3 }));
  const niveles = [{ ...nuevoNivel(PERFIL_ID, 'L1'), id: idNivel(PERFIL_ID, 'L1'), opciones: 4 }];
  const dificultades = new Map([['mamá', { indice: 40, confiable: true, tasa, confusionId: 'papá' }]]);
  return crearSesion({
    perfil: perfil({ ensayosPorSesion: 8 }), elementos: todas, progresos, niveles, actividades: ACTIVIDADES, hoy: HOY,
    aleatorio: crearAleatorio(semilla), dificultades, vistasPrevias: new Set(todas.map((p) => p.id)),
  });
}

test('confusión con precisión < 80 %: nunca se usa como distractor de esa palabra', () => {
  for (let semilla = 1; semilla <= 25; semilla++) {
    const plan = sesionConConfusion(semilla, 0.5);
    for (const e of plan.ensayos.filter((x) => x.elementoId === 'mamá')) assert.ok(!e.distractorIds.includes('papá'), `semilla ${semilla}`);
  }
});

test('confusión con precisión ≥ 80 %: se usa a propósito como distractor (garantizado una vez por sesión)', () => {
  let conTrialNormal = 0;
  for (let semilla = 1; semilla <= 25; semilla++) {
    const mamas = sesionConConfusion(semilla, 0.9).ensayos.filter((e) => e.elementoId === 'mamá');
    if (!mamas.some((e) => !e.esFacil)) continue; // todos sus ensayos fueron de los fáciles (2 opciones): no aplica
    conTrialNormal += 1;
    assert.ok(mamas.some((e) => e.distractorIds.includes('papá')), `semilla ${semilla}`);
  }
  assert.ok(conTrialNormal > 10);
});

test('dificultadesDe toma de los registros la confusión más frecuente de cada palabra', () => {
  const r = (texto, ok, tocada) => ({
    id: `${texto}${Math.random()}`, fecha: `2026-11-0${1 + Math.floor(Math.random() * 4)}T10:00:00.000Z`, dia: '2026-11-04', hora: 10, elementoId: texto, texto,
    actividad: 'L1', tipo: 'practica', esFacil: false, correctoAlPrimerIntento: ok, msAcierto: 2000, repeticionesAudio: 0,
    errores: ok ? [] : [{ id: tocada, texto: tocada, ms: 500 }],
  });
  const rs = [...Array(3).fill(0).map(() => r('mamá', false, 'papá')), r('mamá', false, 'mano'), ...Array(2).fill(0).map(() => r('mamá', true))];
  const mapa = dificultadesDe(analizar(rs, { hoy: HOY }));
  assert.equal(mapa.get('mamá').confusionId, 'papá');
  assert.equal(mapa.get('mamá').confiable, true);
  assert.equal(mapa.get('mamá').tasa, 2 / 6);
});

// ---------- ajustes ----------

test('ajustes nuevos: valores por defecto y límites', () => {
  const a = normalizarAjustes();
  assert.equal(a.avanceRapido, true);
  assert.equal(a.palabrasNuevasPorSesion, 2);
  assert.deepEqual(a.automaticos, { ensayosPorSesion: true, maxOpciones: true, etapa: true, palabrasNuevas: true });
  assert.equal(AJUSTES_POR_DEFECTO.palabrasNuevasPorSesion, 2);
  assert.equal(normalizarAjustes({ palabrasNuevasPorSesion: 9 }).palabrasNuevasPorSesion, 2);
  assert.equal(normalizarAjustes({ palabrasNuevasPorSesion: 0 }).palabrasNuevasPorSesion, 1);
  assert.equal(normalizarAjustes({ avanceRapido: false }).avanceRapido, false);
  assert.deepEqual(normalizarAjustes({ automaticos: { etapa: false, basura: 1 } }).automaticos, { ensayosPorSesion: true, maxOpciones: true, etapa: false, palabrasNuevas: true });
});

test('palabrasNuevasPorSesion = 1 limita las palabras nuevas por sesión', () => {
  const todas = vocabulario(6);
  const plan = (ajustes) => crearSesion({ perfil: perfil({ ensayosPorSesion: 8, ...ajustes }), elementos: todas, progresos: [], niveles: [], actividades: ACTIVIDADES, hoy: HOY, aleatorio: crearAleatorio(1) });
  assert.equal(plan({}).resumen.nuevas, 2);
  assert.equal(plan({ palabrasNuevasPorSesion: 1 }).resumen.nuevas, 1);
});

// ---------- autoajuste ----------

const HOY_AUTO = new Date(2026, 10, 5, 18, 0, 0);
/** Una sesión terminada: `dia` de noviembre, `minutos` de duración, y `aciertos` de `total` ensayos al primer intento. */
function ses(dia, { minutos = 6, fatiga = false, interrumpida = false, aciertos = 8, total = 8 } = {}) {
  const inicio = new Date(2026, 10, dia, 10, 0, 0);
  return {
    id: `s${dia}`, inicio: inicio.toISOString(), fin: new Date(inicio.getTime() + minutos * 60000).toISOString(), fatiga, interrumpida,
    ensayos: Array.from({ length: total }, (_, i) => ({ correctoAlPrimerIntento: i < aciertos, tipo: 'practica' })),
  };
}
const buenas = [ses(1), ses(2), ses(3)];
const base = (extra = {}) => ({ perfil: { id: PERFIL_ID, nombre: 'Leo', ajustes: {}, etapaActual: 1 }, sesiones: buenas, hoy: HOY_AUTO, ...extra });

test('autoajuste: 3 sesiones buenas suben los ensayos de 2 en 2 (tope 12) y lo anotan', () => {
  const r = evaluarAutoajuste(base());
  assert.equal(r.perfil.ajustes.ensayosPorSesion, 10);
  assert.equal(r.cambios.length, 1);
  assert.deepEqual([r.cambios[0].ajuste, r.cambios[0].antes, r.cambios[0].despues, r.cambios[0].visto], ['ensayosPorSesion', 8, 10, false]);
  assert.match(r.cambios[0].motivo, /3 sesiones seguidas sin cansarse/);
  assert.equal(r.perfil.cambiosAutomaticos.length, 1);
  const tope = evaluarAutoajuste(base({ perfil: { id: PERFIL_ID, ajustes: { ensayosPorSesion: 12 }, etapaActual: 1 } }));
  assert.equal(tope.cambios.length, 0);
  const once = evaluarAutoajuste(base({ perfil: { id: PERFIL_ID, ajustes: { ensayosPorSesion: 11 }, etapaActual: 1 } }));
  assert.equal(once.perfil.ajustes.ensayosPorSesion, 12);
});

test('autoajuste: no sube si hubo cansancio, aciertos bajos, sesiones largas o menos de 3 sesiones', () => {
  const unaFatiga = evaluarAutoajuste(base({ sesiones: [ses(1), ses(2, { fatiga: true }), ses(3)] })); // un cansancio: ni sube ni baja
  assert.equal(unaFatiga.cambios.length, 0);
  assert.equal(evaluarAutoajuste(base({ sesiones: [ses(1, { aciertos: 6 }), ses(2, { aciertos: 6 }), ses(3, { aciertos: 6 })] })).cambios.length, 0);
  assert.equal(evaluarAutoajuste(base({ sesiones: [ses(1, { minutos: 9 }), ses(2, { minutos: 9 }), ses(3, { minutos: 9 })] })).cambios.length, 0);
  assert.equal(evaluarAutoajuste(base({ sesiones: [ses(1), ses(2)] })).cambios.length, 0);
});

test('autoajuste: baja 2 (mínimo 4) si se cansó en 2 de 3, si duran más de 12 min o si hubo una interrumpida', () => {
  const cansado = evaluarAutoajuste(base({ sesiones: [ses(1, { fatiga: true }), ses(2, { fatiga: true }), ses(3)] }));
  assert.equal(cansado.perfil.ajustes.ensayosPorSesion, 6);
  assert.match(cansado.cambios[0].motivo, /se cansó en 2 de las últimas 3/);
  const largas = evaluarAutoajuste(base({ sesiones: [ses(1, { minutos: 13 }), ses(2, { minutos: 14 }), ses(3, { minutos: 15 })] }));
  assert.equal(largas.perfil.ajustes.ensayosPorSesion, 6);
  const interrumpida = evaluarAutoajuste(base({ sesiones: [ses(1), ses(2, { interrumpida: true }), ses(3)] }));
  assert.equal(interrumpida.perfil.ajustes.ensayosPorSesion, 6);
  const minimo = evaluarAutoajuste(base({ perfil: { id: PERFIL_ID, ajustes: { ensayosPorSesion: 5 }, etapaActual: 1 }, sesiones: [ses(1, { fatiga: true }), ses(2, { fatiga: true }), ses(3)] }));
  assert.equal(minimo.perfil.ajustes.ensayosPorSesion, 4);
  const yaEnMinimo = evaluarAutoajuste(base({ perfil: { id: PERFIL_ID, ajustes: { ensayosPorSesion: 4 }, etapaActual: 1 }, sesiones: [ses(1, { fatiga: true }), ses(2, { fatiga: true }), ses(3)] }));
  assert.equal(yaEnMinimo.cambios.length, 0);
});

test('autoajuste: un ajuste cambia como máximo una vez por día', () => {
  const primero = evaluarAutoajuste(base());
  const segundo = evaluarAutoajuste(base({ perfil: primero.perfil }));
  assert.equal(segundo.cambios.length, 0);
  assert.equal(segundo.perfil.ajustes.ensayosPorSesion, 10);
  // al día siguiente ya puede volver a cambiar
  const mañana = evaluarAutoajuste(base({ perfil: primero.perfil, hoy: new Date(2026, 10, 6, 18, 0, 0) }));
  assert.equal(mañana.perfil.ajustes.ensayosPorSesion, 12);
});

test('autoajuste: lo que está en «Lo elijo yo» no se toca', () => {
  const r = evaluarAutoajuste(base({ perfil: { id: PERFIL_ID, ajustes: { automaticos: { ensayosPorSesion: false } }, etapaActual: 1 } }));
  assert.equal(r.cambios.length, 0);
  assert.equal(normalizarAjustes(r.perfil.ajustes).ensayosPorSesion, 8);
});

test('autoajuste: sube el máximo de opciones si en todas las actividades acierta ≥ 85 % con el máximo actual; nunca baja', () => {
  const nivel = (actividad, opciones, aciertos) => ({ id: `p:${actividad}`, actividad, opciones, ultimos: Array.from({ length: 10 }, (_, i) => i < aciertos) });
  const perfil3 = { id: PERFIL_ID, ajustes: { maxOpciones: 3 }, etapaActual: 1 };
  const sube = evaluarAutoajuste(base({ perfil: perfil3, sesiones: [], niveles: [nivel('L1', 3, 9), nivel('L2', 3, 10)] }));
  assert.equal(sube.perfil.ajustes.maxOpciones, 4);
  assert.equal(evaluarAutoajuste(base({ perfil: perfil3, sesiones: [], niveles: [nivel('L1', 3, 9), nivel('L2', 3, 8)] })).cambios.length, 0); // 80 %
  assert.equal(evaluarAutoajuste(base({ perfil: perfil3, sesiones: [], niveles: [nivel('L1', 3, 9), nivel('L2', 2, 10)] })).cambios.length, 0); // L2 aún no llegó al máximo
  assert.equal(evaluarAutoajuste(base({ perfil: perfil3, sesiones: [], niveles: [] })).cambios.length, 0);
  const malo = evaluarAutoajuste(base({ perfil: perfil3, sesiones: [], niveles: [nivel('L1', 3, 2)] }));
  assert.equal(malo.cambios.length, 0);
  assert.equal(malo.perfil.ajustes.maxOpciones, 3); // nunca baja solo
});

test('autoajuste: palabras nuevas por sesión baja a 1 con promedio ≥ 50 y vuelve a 2 con < 30', () => {
  const baja = evaluarAutoajuste(base({ sesiones: [], indicesEnPractica: [60, 50, 40] }));
  assert.equal(baja.perfil.ajustes.palabrasNuevasPorSesion, 1);
  assert.equal(evaluarAutoajuste(base({ sesiones: [], indicesEnPractica: [40, 40] })).cambios.length, 0);
  const sube = evaluarAutoajuste(base({ perfil: { id: PERFIL_ID, ajustes: { palabrasNuevasPorSesion: 1 }, etapaActual: 1 }, sesiones: [], indicesEnPractica: [10, 20, 30] }));
  assert.equal(sube.perfil.ajustes.palabrasNuevasPorSesion, 2);
  assert.equal(evaluarAutoajuste(base({ perfil: { id: PERFIL_ID, ajustes: { palabrasNuevasPorSesion: 1 }, etapaActual: 1 }, sesiones: [], indicesEnPractica: [30, 40] })).cambios.length, 0);
  assert.equal(evaluarAutoajuste(base({ sesiones: [], indicesEnPractica: [] })).cambios.length, 0);
});

test('autoajuste: la etapa sube con ≥ 80 % de palabras dominadas o aprendidas y la siguiente abierta; nunca baja sola', () => {
  const sube = evaluarAutoajuste(base({ sesiones: [], proporcionEtapa: 0.8, etapaSiguienteAbierta: true }));
  assert.equal(sube.perfil.etapaActual, 2);
  assert.equal(sube.cambios[0].ajuste, 'etapa');
  assert.equal(evaluarAutoajuste(base({ sesiones: [], proporcionEtapa: 0.79, etapaSiguienteAbierta: true })).perfil.etapaActual, 1);
  assert.equal(evaluarAutoajuste(base({ sesiones: [], proporcionEtapa: 0.9, etapaSiguienteAbierta: false })).perfil.etapaActual, 1);
  // las últimas 3 sesiones salieron mal: solo se sugiere, la etapa no cambia
  const mala = [ses(1, { aciertos: 3 }), ses(2, { aciertos: 3 }), ses(3, { aciertos: 3 })];
  const r = evaluarAutoajuste(base({ perfil: { id: PERFIL_ID, ajustes: {}, etapaActual: 2 }, sesiones: mala }));
  assert.equal(r.perfil.etapaActual, 2);
  const sugerencia = r.cambios.find((c) => c.sugerencia);
  assert.ok(sugerencia);
  assert.equal(sugerencia.despues, null);
  // y no se repite mientras el adulto no la haya visto
  assert.equal(evaluarAutoajuste(base({ perfil: r.perfil, sesiones: mala, hoy: new Date(2026, 10, 7) })).cambios.filter((c) => c.sugerencia).length, 0);
});

test('autoajuste: Deshacer vuelve al valor anterior y deja ese ajuste en «Lo elijo yo»; Entendido solo oculta el aviso', () => {
  const r = evaluarAutoajuste(base());
  assert.equal(avisosPendientes(r.perfil).length, 1);
  const deshecho = deshacerCambio(r.perfil, 0);
  assert.equal(deshecho.ajustes.ensayosPorSesion, 8);
  assert.equal(deshecho.ajustes.automaticos.ensayosPorSesion, false);
  assert.equal(avisosPendientes(deshecho).length, 0);
  // ya en «Lo elijo yo»: no vuelve a cambiar
  assert.equal(evaluarAutoajuste(base({ perfil: deshecho, hoy: new Date(2026, 10, 9) })).cambios.length, 0);
  const visto = marcarVisto(r.perfil, 0);
  assert.equal(visto.ajustes.ensayosPorSesion, 10);
  assert.equal(avisosPendientes(visto).length, 0);
  // deshacer la etapa devuelve la etapa
  const etapa = evaluarAutoajuste(base({ sesiones: [], proporcionEtapa: 1, etapaSiguienteAbierta: true }));
  assert.equal(deshacerCambio(etapa.perfil, 0).etapaActual, 1);
  assert.equal(deshacerCambio(etapa.perfil, 0).ajustes.automaticos.etapa, false);
});

test('autoajuste: guarda como máximo los últimos 30 cambios', () => {
  const previos = Array.from({ length: 40 }, (_, i) => ({ dia: '2026-09-01', ajuste: 'etapa', visto: true, antes: i, despues: i + 1 }));
  const r = evaluarAutoajuste(base({ perfil: { id: PERFIL_ID, ajustes: {}, etapaActual: 1, cambiosAutomaticos: previos } }));
  assert.equal(r.perfil.cambiosAutomaticos.length, 30);
  assert.equal(r.perfil.cambiosAutomaticos.at(-1).ajuste, 'ensayosPorSesion');
});

// ---------- el controlador de la sesión ----------

function jugarDias(ajustes, dias = 3) {
  const progresos = new Map();
  const niveles = new Map();
  const palabras = vocabulario(10).map((p) => ({ ...p, emoji: '🍎' }));
  for (let d = 0; d < dias; d++) {
    const hoy = new Date(2026, 9, 1 + d, 10, 0, 0);
    const ctl = crearControlador({
      perfil: perfil(ajustes), palabras, progresos: [...progresos.values()], niveles: [...niveles.values()], respuestas: [],
      hoy, aleatorio: crearAleatorio(d + 1), reloj: () => hoy,
    });
    let ensayo = ctl.iniciar(1000);
    let ahora = 1000;
    while (ensayo) {
      ahora += 1500;
      ctl.tocar(ensayo.correctaId, ahora);
      const r = ctl.avanzar((ahora += 800));
      progresos.set(r.guardar.progreso.id, r.guardar.progreso);
      if (r.guardar.nivel) niveles.set(r.guardar.nivel.id, r.guardar.nivel);
      ensayo = r.siguiente;
      if (r.terminada) break;
    }
  }
  return [...progresos.values()];
}

test('el controlador usa el avance rápido según el ajuste (por defecto, encendido)', () => {
  const con = jugarDias({});
  const sin = jugarDias({ avanceRapido: false });
  assert.ok(con.some((p) => p.provisional && p.estado === ESTADOS.DOMINADA), 'con avance rápido hay actividades dominadas a prueba');
  assert.ok(!sin.some((p) => p.provisional));
  const dominadas = (lista) => lista.filter((p) => p.estado === ESTADOS.DOMINADA).length;
  assert.ok(dominadas(con) > dominadas(sin));
});

// ---------- simulador ----------

const sesionesHasta = (r, meta) => {
  const i = r.dominadasL4PorSesion.findIndex((n) => n >= meta);
  return i === -1 ? Infinity : i + 1;
};
const mediana = (lista) => [...lista].sort((a, b) => a - b)[Math.floor(lista.length / 2)];

test('simulador: el avance rápido acelera a un niño que ya conoce las palabras', () => {
  const semillas = [1, 2, 3];
  const sin = semillas.map((semilla) => sesionesHasta(simular({ palabras: 10, conocidas: 10, dias: 50, semilla, revisar: false }), 10));
  const con = semillas.map((semilla) => sesionesHasta(simular({ palabras: 10, conocidas: 10, dias: 50, semilla, revisar: false, avanceRapido: true }), 10));
  assert.ok(mediana(con) <= mediana(sin) - 4, `con ${con} / sin ${sin}`);
});

test('simulador: el niño lento sigue a su ritmo (±1 semana) y nunca hay más de 2 palabras nuevas por sesión', () => {
  const semillas = [1, 2, 3];
  const sin = semillas.map((semilla) => sesionesHasta(simular({ palabras: 10, dias: 80, semilla, revisar: false }), 10));
  let maxNuevas = 0;
  const con = semillas.map((semilla) => sesionesHasta(simular({
    palabras: 10, dias: 80, semilla, revisar: false, avanceRapido: true, alPlan: (plan) => { maxNuevas = Math.max(maxNuevas, plan.resumen.nuevas); },
  }), 10));
  assert.ok(Math.abs(mediana(con) - mediana(sin)) <= 6, `con ${con} / sin ${sin}`);
  assert.ok(maxNuevas <= 2);
});

test('simulador: con avance rápido, las sesiones siguen cumpliendo las reglas de orden y cantidad', () => {
  const r = simular({ palabras: 14, dias: 40, semilla: 4, avanceRapido: true, conocidas: 5 });
  assert.ok(r.sesiones > 20);
});
