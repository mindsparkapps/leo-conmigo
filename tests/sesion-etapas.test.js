import test from 'node:test';
import assert from 'node:assert/strict';
import { crearControlador, hayQuePracticar, MAX_LECTURAS_POR_SESION } from '../js/core/controlador.js';
import { crearAleatorio } from '../js/core/azar.js';
import { ESTADOS } from '../js/core/progreso.js';
import { HOY, PERFIL_ID, progresoCon } from './ayudas.js';
import { frasesDelNino, palabrasDelNino } from './escenarios.js';
import { jugarSesion } from './jugar.js';

const palabrasLeidas = (n) => palabrasDelNino().slice(0, n);
const dominadasEnL4 = (n) => palabrasLeidas(n).map((p) => progresoCon(p.id, 'L4', ESTADOS.DOMINADA, { proximoRepaso: '2026-12-31' }));

const crear = ({ etapa = 1, ajustes = {}, progresos = [], frases = frasesDelNino(), semilla = 3 } = {}) =>
  crearControlador({
    perfil: { id: PERFIL_ID, etapaActual: etapa, ajustes },
    palabras: palabrasDelNino(),
    frases,
    progresos,
    niveles: [],
    hoy: HOY,
    aleatorio: crearAleatorio(semilla),
    reloj: () => HOY,
  });

const actividadesJugadas = (ctl) => new Set(ctl.plan.ensayos.map((e) => e.actividad));

test('etapa 1 (por defecto): solo L1–L5', () => {
  const ctl = crear();
  assert.equal(ctl.etapa, 1);
  for (const a of actividadesJugadas(ctl)) assert.match(a, /^L[1-5]$/);
});

test('etapa 0: solo P1–P3, y P2 únicamente con palabras que tienen foto y símbolo', () => {
  const ctl = crear({ etapa: 0 });
  assert.equal(ctl.etapa, 0);
  const usadas = actividadesJugadas(ctl);
  assert.ok(usadas.size > 0);
  for (const a of usadas) assert.match(a, /^P[1-3]$/);
  for (const e of ctl.plan.ensayos.filter((x) => x.actividad === 'P2')) {
    assert.ok(ctl.palabras.get(e.elementoId).medioImagenId, 'P2 necesita foto');
  }
});

test('etapa 0: la sesión se juega entera, con y sin errores, y nunca muestra rojo ni error', () => {
  for (const errar of [() => false, (n) => n % 2 === 0]) {
    const ctl = crear({ etapa: 0 });
    const { vistos, guardados } = jugarSesion(ctl, { errar });
    assert.ok(vistos.length >= 6);
    assert.ok(ctl.terminada);
    assert.ok(guardados.every((g) => g.progreso && g.nivel));
  }
});

test('etapa 2 cerrada (menos de 10 palabras leídas): se practica la etapa 1 aunque el adulto haya elegido la 2', () => {
  const ctl = crear({ etapa: 2, progresos: dominadasEnL4(9) });
  assert.equal(ctl.etapa, 1);
});

test('etapa 2 abierta por 10 palabras dominadas en L4: se juega con frases y se resuelve solo con toques', () => {
  // F1 y F2 ya dominadas en todas las frases: la cadena de la etapa llega a F3 («armo la frase»)
  const previas = frasesDelNino().flatMap((f) => ['F1', 'F2'].map((a) => progresoCon(f.id, a, ESTADOS.DOMINADA, { proximoRepaso: '2026-12-31' })));
  const ctl = crear({ etapa: 2, progresos: [...dominadasEnL4(10), ...previas] });
  assert.equal(ctl.etapa, 2);
  for (const a of actividadesJugadas(ctl)) assert.match(a, /^F[1-3]$/);
  for (const e of ctl.plan.ensayos) assert.ok(frasesDelNino().some((f) => f.id === e.elementoId), 'los elementos son frases');
  const { vistos, guardados } = jugarSesion(ctl, { errar: (n) => n === 1 });
  assert.ok(vistos.some((v) => v.modo === 'secuencia'), 'hay al menos un «armo la frase»');
  assert.ok(ctl.terminada);
  assert.ok(guardados.length > 0);
});

test('etapa 2 forzada por el adulto: se abre sin llegar al umbral', () => {
  const ctl = crear({ etapa: 2, ajustes: { etapasForzadas: [2] } });
  assert.equal(ctl.etapa, 2);
});

test('etapa 2 bloqueada por el adulto: no se usa aunque se haya llegado al umbral', () => {
  const ctl = crear({ etapa: 2, ajustes: { etapasBloqueadas: [2] }, progresos: dominadasEnL4(12) });
  assert.equal(ctl.etapa, 1);
});

test('etapa 2 sin frases que practicar: baja a la etapa 1 para no dejar al niño sin nada', () => {
  const ctl = crear({ etapa: 2, ajustes: { etapasForzadas: [2] }, frases: [] });
  assert.equal(ctl.etapa, 1);
  assert.ok(ctl.plan.ensayos.length > 0);
});

test('etapa 1 bloqueada: se practica la etapa 0', () => {
  const ctl = crear({ etapa: 1, ajustes: { etapasBloqueadas: [1] } });
  assert.equal(ctl.etapa, 0);
});

test('hayQuePracticar: hay algo en cualquier etapa con palabras', () => {
  assert.equal(hayQuePracticar({ perfil: { id: PERFIL_ID, ajustes: {} }, palabras: palabrasDelNino(), hoy: HOY, aleatorio: crearAleatorio(1) }), true);
  assert.equal(hayQuePracticar({ perfil: { id: PERFIL_ID, ajustes: {} }, palabras: [], hoy: HOY, aleatorio: crearAleatorio(1) }), false);
});

// ---------- L6: «Leo en voz alta» ----------

test('L6 desactivada (por defecto): nunca aparece', () => {
  const ctl = crear({ progresos: dominadasEnL4(10) });
  assert.ok(!actividadesJugadas(ctl).has('L6'));
});

test('L6 activada: solo con palabras leídas, como mucho dos, ni al principio ni al final de la sesión', () => {
  const ctl = crear({ ajustes: { habilitarL6: true }, progresos: dominadasEnL4(10) });
  const lecturas = ctl.plan.ensayos.map((e, i) => ({ e, i })).filter(({ e }) => e.actividad === 'L6');
  assert.ok(lecturas.length >= 1 && lecturas.length <= MAX_LECTURAS_POR_SESION);
  const leidas = new Set(palabrasLeidas(10).map((p) => p.id));
  for (const { e, i } of lecturas) {
    assert.ok(leidas.has(e.elementoId));
    assert.ok(i > 0 && i < ctl.plan.ensayos.length - 1);
  }
});

test('L6 activada sin palabras leídas: no hay lecturas', () => {
  const ctl = crear({ ajustes: { habilitarL6: true } });
  assert.ok(!actividadesJugadas(ctl).has('L6'));
});

test('L6: el adulto confirma; no cambia el nivel y «otra vez» cuenta como ayuda', () => {
  const ctl = crear({ ajustes: { habilitarL6: true }, progresos: dominadasEnL4(10) });
  const { vistos, guardados } = jugarSesion(ctl, { errar: (n) => n % 2 === 1 });
  const lecturas = vistos.map((v, i) => ({ v, i })).filter(({ v }) => v.modo === 'lectura');
  assert.ok(lecturas.length >= 1);
  for (const { i } of lecturas) {
    assert.equal(guardados[i].nivel, null, 'la lectura no mueve el nivel');
    assert.equal(guardados[i].progreso.actividad, 'L6');
  }
});
