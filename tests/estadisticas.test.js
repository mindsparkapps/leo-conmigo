import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVIDADES_ETAPA_1, celdaDeProgreso, estadoDePalabra, actividadActualDe, tablaDePalabras, resumenGeneral,
  lunesDe, precisionSemanal, resumenDeSesion, historialDeSesiones, formatearDuracion, marcarDominada, idsDeProgresoDe,
} from '../js/core/estadisticas.js';
import { crearSesion } from '../js/core/sesion.js';
import { crearAleatorio } from '../js/core/azar.js';
import { ESTADOS } from '../js/core/progreso.js';
import { ACTIVIDADES, HOY, PERFIL_ID, perfil, progresoCon, vocabulario } from './ayudas.js';

const celdaNueva = { estado: 'nueva' };
const celdaPractica = { estado: 'practica' };
const celdaDominada = { estado: 'dominada' };

// ---------- celdas y estado de una palabra ----------

test('celdaDeProgreso: sin registro o sin historial es "nueva"; con historial cuenta los aciertos', () => {
  assert.deepEqual(celdaDeProgreso(undefined), { estado: 'nueva', ensayos: 0, aciertos: 0, proximoRepaso: null, caja: null });
  assert.equal(celdaDeProgreso(progresoCon('mamá', 'L1', ESTADOS.NUEVA)).estado, 'nueva');
  const c = celdaDeProgreso(progresoCon('mamá', 'L1', ESTADOS.PRACTICA, { aciertos: 2, total: 5 }));
  assert.deepEqual([c.estado, c.ensayos, c.aciertos], ['practica', 5, 2]);
  const d = celdaDeProgreso(progresoCon('mamá', 'L1', ESTADOS.DOMINADA, { proximoRepaso: '2026-11-20', caja: 3 }));
  assert.deepEqual([d.estado, d.proximoRepaso, d.caja], ['dominada', '2026-11-20', 3]);
});

test('estadoDePalabra: nueva, práctica, leída (dominada en L4) y completa', () => {
  const act = ACTIVIDADES_ETAPA_1;
  assert.equal(estadoDePalabra([celdaNueva, celdaNueva, celdaNueva, celdaNueva, celdaNueva], act), 'nueva');
  assert.equal(estadoDePalabra([celdaPractica, celdaNueva, celdaNueva, celdaNueva, celdaNueva], act), 'practica');
  assert.equal(estadoDePalabra([celdaDominada, celdaDominada, celdaPractica, celdaNueva, celdaNueva], act), 'practica');
  assert.equal(estadoDePalabra([celdaDominada, celdaDominada, celdaDominada, celdaDominada, celdaPractica], act), 'leida');
  assert.equal(estadoDePalabra([celdaDominada, celdaDominada, celdaDominada, celdaDominada, celdaDominada], act), 'completa');
  assert.equal(estadoDePalabra([], act), 'nueva');
});

test('actividadActualDe: la primera que aún no domina', () => {
  const act = ACTIVIDADES_ETAPA_1;
  assert.equal(actividadActualDe([celdaDominada, celdaDominada, celdaPractica, celdaNueva, celdaNueva], act), 'L3');
  assert.equal(actividadActualDe([celdaNueva, celdaNueva, celdaNueva, celdaNueva, celdaNueva], act), 'L1');
  assert.equal(actividadActualDe(Array(5).fill(celdaDominada), act), null);
});

// ---------- tabla y resumen ----------

const progresosDeEjemplo = () => [
  progresoCon('mamá', 'L1', ESTADOS.DOMINADA), progresoCon('mamá', 'L2', ESTADOS.DOMINADA), progresoCon('mamá', 'L3', ESTADOS.DOMINADA),
  progresoCon('mamá', 'L4', ESTADOS.DOMINADA), progresoCon('mamá', 'L5', ESTADOS.PRACTICA),
  progresoCon('papá', 'L1', ESTADOS.PRACTICA, { aciertos: 1, total: 2 }),
  { ...progresoCon('perro', 'L1', ESTADOS.DOMINADA), deleted: true }, // borrado: no cuenta
];

test('tablaDePalabras: una fila por palabra, en orden, con sus cinco actividades', () => {
  const filas = tablaDePalabras({ palabras: vocabulario(4).reverse(), progresos: progresosDeEjemplo() });
  assert.deepEqual(filas.map((f) => f.palabra.id), ['mamá', 'papá', 'perro', 'gato']);
  assert.ok(filas.every((f) => f.celdas.length === 5 && f.celdas.map((c) => c.actividad).join() === 'L1,L2,L3,L4,L5'));
  assert.deepEqual(filas.map((f) => f.estado), ['leida', 'practica', 'nueva', 'nueva']);
  assert.deepEqual(filas.map((f) => f.actividadActual), ['L5', 'L1', 'L1', 'L1']);
  assert.equal(filas[2].celdas[0].estado, 'nueva', 'un progreso borrado no cuenta');
});

test('resumenGeneral: palabras, leídas, en práctica, nuevas y sesiones', () => {
  const filas = tablaDePalabras({ palabras: vocabulario(4), progresos: progresosDeEjemplo() });
  const sesiones = [{ inicio: '2026-11-01T10:00:00.000Z' }, { inicio: '2026-11-03T10:00:00.000Z' }];
  assert.deepEqual(resumenGeneral({ filas, sesiones }), {
    palabras: 4, leidas: 1, completas: 0, enPractica: 2, nuevas: 2, sesiones: 2, ultimaSesion: '2026-11-03T10:00:00.000Z',
  });
  assert.equal(resumenGeneral({ filas: [], sesiones: [] }).ultimaSesion, null);
});

// ---------- semanas ----------

test('lunesDe: cualquier día cae en el lunes de su semana (domingo incluido)', () => {
  assert.equal(lunesDe(new Date(2026, 10, 2)), '2026-11-02'); // lunes
  assert.equal(lunesDe(new Date(2026, 10, 5)), '2026-11-02'); // jueves
  assert.equal(lunesDe(new Date(2026, 10, 8)), '2026-11-02'); // domingo
  assert.equal(lunesDe(new Date(2026, 10, 9)), '2026-11-09'); // lunes siguiente
  assert.equal(lunesDe(new Date(2026, 0, 1)), '2025-12-29'); // cruza de año
});

const sesionEn = (fecha, aciertos, errores) => ({
  inicio: fecha.toISOString(),
  ensayos: [...Array(aciertos).fill({ correctoAlPrimerIntento: true }), ...Array(errores).fill({ correctoAlPrimerIntento: false })],
});

test('precisionSemanal: 8 semanas hasta la actual, con aciertos al primer intento por semana', () => {
  const sesiones = [
    sesionEn(new Date(2026, 10, 2, 9), 6, 2), // lunes de esta semana (5 nov es jueves)
    sesionEn(new Date(2026, 10, 8, 20), 2, 0), // domingo de esta semana
    sesionEn(new Date(2026, 10, 3, 9), 0, 0), // sin ensayos
    sesionEn(new Date(2026, 9, 28, 9), 3, 3), // semana anterior
    sesionEn(new Date(2026, 8, 1, 9), 5, 0), // hace más de 8 semanas: no se muestra
  ];
  const semanas = precisionSemanal(sesiones, { hoy: HOY });
  assert.equal(semanas.length, 8);
  assert.equal(semanas.at(-1).inicio, '2026-11-02');
  assert.deepEqual([semanas.at(-1).ensayos, semanas.at(-1).aciertos, semanas.at(-1).precision], [10, 8, 0.8]);
  assert.deepEqual([semanas.at(-2).inicio, semanas.at(-2).ensayos, semanas.at(-2).precision], ['2026-10-26', 6, 0.5]);
  assert.equal(semanas[0].inicio, '2026-09-14');
  assert.ok(semanas.slice(0, 6).every((s) => s.precision === null && s.ensayos === 0), 'semanas sin datos: precisión null');
  assert.equal(semanas.reduce((a, s) => a + s.ensayos, 0), 16, 'la sesión de septiembre queda fuera');
});

test('precisionSemanal: sin sesiones todo es null, y el número de semanas es configurable', () => {
  const semanas = precisionSemanal([], { hoy: HOY, semanas: 3 });
  assert.deepEqual(semanas.map((s) => s.inicio), ['2026-10-19', '2026-10-26', '2026-11-02']);
  assert.ok(semanas.every((s) => s.precision === null));
});

test('precisionSemanal: el borde entre semanas es el lunes a las 00:00 (hora local)', () => {
  const s = precisionSemanal(
    [sesionEn(new Date(2026, 10, 1, 23, 59), 1, 0), sesionEn(new Date(2026, 10, 2, 0, 0), 0, 1)],
    { hoy: HOY, semanas: 2 },
  );
  assert.deepEqual([s[0].inicio, s[0].ensayos, s[0].aciertos], ['2026-10-26', 1, 1]);
  assert.deepEqual([s[1].inicio, s[1].ensayos, s[1].aciertos], ['2026-11-02', 1, 0]);
});

// ---------- sesiones ----------

test('resumenDeSesion y formatearDuracion', () => {
  const r = resumenDeSesion({
    id: 's1', inicio: '2026-11-05T10:00:00.000Z', fin: '2026-11-05T10:03:30.000Z', fatiga: true,
    ensayos: [{ correctoAlPrimerIntento: true }, { correctoAlPrimerIntento: false }, { correctoAlPrimerIntento: true }],
  });
  assert.deepEqual(r, { id: 's1', inicio: '2026-11-05T10:00:00.000Z', segundos: 210, ensayos: 3, aciertos: 2, conAyuda: 1, fatiga: true });
  assert.equal(resumenDeSesion({ inicio: 'x', fin: 'y', ensayos: [] }).segundos, null);
  assert.equal(resumenDeSesion({ inicio: '2026-11-05T10:05:00Z', fin: '2026-11-05T10:00:00Z' }).segundos, 0, 'nunca negativo');

  assert.equal(formatearDuracion(null), '—');
  assert.equal(formatearDuracion(45), 'menos de 1 min');
  assert.equal(formatearDuracion(150), '3 min');
  assert.equal(formatearDuracion(3600), '1 h 00 min');
  assert.equal(formatearDuracion(4020), '1 h 07 min');
});

test('historialDeSesiones: la más reciente primero, sin borradas y con límite', () => {
  const sesiones = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, inicio: `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`, fin: `2026-10-${String(i + 1).padStart(2, '0')}T10:05:00.000Z`, ensayos: [] }));
  sesiones.push({ id: 'borrada', inicio: '2026-12-01T10:00:00.000Z', fin: '2026-12-01T10:05:00.000Z', ensayos: [], deleted: true });
  const h = historialDeSesiones(sesiones, 20);
  assert.equal(h.length, 20);
  assert.equal(h[0].id, 's29');
  assert.ok(!h.some((s) => s.id === 'borrada'));
  assert.equal(historialDeSesiones(sesiones, 3).length, 3);
});

// ---------- marcado manual ----------

test('marcarDominada: deja las cinco actividades dominadas, para repasar ya, conservando el historial', () => {
  const existentes = [progresoCon('mamá', 'L2', ESTADOS.PRACTICA, { aciertos: 2, total: 3 })];
  const recs = marcarDominada({ perfilId: PERFIL_ID, elementoId: 'mamá', existentes });
  assert.equal(recs.length, 5);
  assert.deepEqual(recs.map((r) => r.actividad), ['L1', 'L2', 'L3', 'L4', 'L5']);
  assert.ok(recs.every((r) => r.estado === 'dominada' && r.proximoRepaso === null && r.cajaLeitner === 1 && r.perfilId === PERFIL_ID));
  assert.equal(recs[1].historial.length, 3, 'conserva lo que ya tenía');
  assert.equal(recs[0].id, `${PERFIL_ID}:mamá:L1`, 'mismo id: reemplaza al existente');
});

test('idsDeProgresoDe: solo los de esa palabra y sin los borrados', () => {
  const progresos = [...progresosDeEjemplo(), { ...progresoCon('mamá', 'L1', ESTADOS.NUEVA), id: 'x', deleted: true, elementoId: 'mamá' }];
  const ids = idsDeProgresoDe(progresos, 'mamá');
  assert.equal(ids.length, 5);
  assert.ok(ids.every((id) => id.includes('mamá')) && !ids.includes('x'));
  assert.deepEqual(idsDeProgresoDe(progresos, 'nadie'), []);
});

test('lo que se marca a mano lo entiende la sesión: una palabra "ya sabida" no se trata como nueva y se repasa', () => {
  const palabras = vocabulario(6);
  const progresos = marcarDominada({ perfilId: PERFIL_ID, elementoId: 'mamá' });
  const plan = crearSesion({ perfil: perfil(), elementos: palabras, progresos, niveles: [], actividades: ACTIVIDADES_ETAPA_1, hoy: HOY, aleatorio: crearAleatorio(1) });
  const deMama = plan.ensayos.filter((e) => e.elementoId === 'mamá');
  assert.ok(deMama.length > 0, 'se repasa (sin fecha de repaso cuenta como vencida)');
  assert.ok(deMama.every((e) => e.tipo === 'repaso'));
  assert.ok(plan.ensayos.filter((e) => e.tipo === 'nueva').every((e) => e.elementoId !== 'mamá'));
  assert.ok(Object.keys(ACTIVIDADES).length === 5);
});
