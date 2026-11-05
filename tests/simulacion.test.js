// Simula a un niño practicando durante semanas con el motor completo y comprueba que avanza.
// Los umbrales salen de explorar 8 semillas por perfil (ver tests/simulador.js) y llevan margen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { simular } from './simulador.js';
import { etapasDesbloqueadas } from '../js/core/etapas.js';
import { ESTADOS } from '../js/core/progreso.js';

const SEMILLAS = [1, 2, 3, 4, 5];

test('niño lento (acierta 40 % al empezar): 8 semanas -> al menos 4 palabras leídas (L4)', () => {
  for (const semilla of SEMILLAS) {
    const r = simular({ dias: 56, semilla, inicio: 0.4, aprendizaje: 0.08 });
    assert.ok(r.dominadasL4 >= 4, `semilla ${semilla}: L4=${r.dominadasL4}`);
    assert.ok(r.dominadasL1 >= 7, `semilla ${semilla}: L1=${r.dominadasL1}`);
  }
});

test('niño medio: 12 semanas -> lee todo el vocabulario y se desbloquea la etapa 2', () => {
  for (const semilla of SEMILLAS) {
    const r = simular({ dias: 84, semilla, inicio: 0.5, aprendizaje: 0.12 });
    assert.ok(r.dominadasL4 >= 12, `semilla ${semilla}: L4=${r.dominadasL4}`);
    assert.ok(etapasDesbloqueadas({ progresos: r.progresos }).includes(2), `semilla ${semilla}: etapa 2`);
  }
});

test('niño rápido: 8 semanas -> al menos 6 leídas; 12 semanas -> etapa 2; las fatigas son raras', () => {
  for (const semilla of SEMILLAS) {
    const corto = simular({ dias: 56, semilla, inicio: 0.6, aprendizaje: 0.2 });
    assert.ok(corto.dominadasL4 >= 6, `semilla ${semilla}: L4=${corto.dominadasL4}`);
    assert.ok(corto.fatigas <= 4, `semilla ${semilla}: fatigas=${corto.fatigas}`);

    const largo = simular({ dias: 84, semilla, inicio: 0.6, aprendizaje: 0.2 });
    assert.ok(etapasDesbloqueadas({ progresos: largo.progresos }).includes(2), `semilla ${semilla}: L4=${largo.dominadasL4}`);
  }
});

test('el progreso no se estanca: cada 4 semanas aparecen palabras nuevas leídas', () => {
  const r = simular({ dias: 84, semilla: 2, inicio: 0.4, aprendizaje: 0.08 });
  const porSesion = r.dominadasL4PorSesion;
  const aLas = (n) => porSesion[Math.min(n, porSesion.length) - 1];
  assert.ok(aLas(24) > aLas(12) || aLas(12) >= 2, 'estancado entre la semana 2 y la 4');
  assert.ok(aLas(48) > aLas(24), 'estancado entre la semana 4 y la 8');
  assert.ok(aLas(72) > aLas(48), 'estancado entre la semana 8 y la 12');
});

test('el nivel sube con el uso (llega a 4 opciones) y el adulto puede limitarlo a 2', () => {
  assert.equal(simular({ dias: 56, semilla: 3, inicio: 0.6, aprendizaje: 0.2 }).maxOpciones, 4);
  assert.equal(simular({ dias: 56, semilla: 3, inicio: 0.6, aprendizaje: 0.2, ajustes: { maxOpciones: 2 } }).maxOpciones, 2);
});

test('funciona con sesiones cortas (4 ensayos) y largas (15)', () => {
  for (const ensayosPorSesion of [4, 15]) {
    const r = simular({ dias: 42, semilla: 1, inicio: 0.5, aprendizaje: 0.12, ajustes: { ensayosPorSesion } });
    assert.ok(r.dominadasL4 >= 1, `${ensayosPorSesion} ensayos: L4=${r.dominadasL4}`);
  }
});

test('con un vocabulario pequeño (3 palabras) la sesión sigue funcionando', () => {
  const r = simular({ dias: 42, semilla: 1, inicio: 0.5, aprendizaje: 0.12, palabras: 3 });
  assert.ok(r.palabrasConProgreso === 3);
  assert.ok(r.progresos.some((p) => p.estado === ESTADOS.DOMINADA));
});

test('un niño que casi nunca acierta no avanza, pero la app no se rompe ni se encierra en la fatiga', () => {
  const r = simular({ dias: 28, semilla: 1, inicio: 0.1, aprendizaje: 0 });
  assert.ok(r.dominadasL4 === 0);
  assert.ok(r.sesiones > 20, 'debe seguir ofreciendo sesiones');
});
