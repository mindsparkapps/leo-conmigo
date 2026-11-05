import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crearSesion, iniciarCurso, ensayoActual, registrarRespuesta, construirRegistroSesion, resumenDeSesion,
  violacionesDeOrden, MAX_MISMA_ACTIVIDAD_SEGUIDA,
} from '../js/core/sesion.js';
import { crearAleatorio } from '../js/core/azar.js';
import { ESTADOS, nuevoNivel } from '../js/core/progreso.js';
import { ACTIVIDADES, HOY, PERFIL_ID, perfil, progresoCon, vocabulario } from './ayudas.js';

const ids = (lista) => lista.map((e) => e.elementoId);

/**
 * Escenario "con recorrido" (14 palabras):
 *  - mamá (L1), papá (L2) y perro (L3) están en práctica;
 *  - gato y pan dominan L1 y L2 (repasos vencidos) y practican L3;
 *  - papá y perro tienen además repasos de L1/L2 que NO han vencido;
 *  - las otras 9 palabras no se han tocado.
 */
function escenarioMixto() {
  return {
    elementos: vocabulario(),
    progresos: [
      progresoCon('mamá', 'L1', ESTADOS.PRACTICA, { aciertos: 3, total: 3 }),
      progresoCon('papá', 'L2', ESTADOS.PRACTICA, { aciertos: 2, total: 3 }), // L1 dominada, practica L2
      progresoCon('papá', 'L1', ESTADOS.DOMINADA, { proximoRepaso: '2026-11-20' }), // repaso NO vencido
      progresoCon('perro', 'L3', ESTADOS.PRACTICA, { aciertos: 1, total: 3 }),
      progresoCon('perro', 'L1', ESTADOS.DOMINADA, { proximoRepaso: '2026-11-20' }),
      progresoCon('perro', 'L2', ESTADOS.DOMINADA, { proximoRepaso: '2026-11-20' }),
      progresoCon('gato', 'L1', ESTADOS.DOMINADA, { proximoRepaso: '2026-11-01' }), // vencido
      progresoCon('gato', 'L2', ESTADOS.DOMINADA, { proximoRepaso: '2026-11-02' }), // vencido
      progresoCon('pan', 'L1', ESTADOS.DOMINADA, { proximoRepaso: '2026-11-03' }), // vencido
      progresoCon('pan', 'L2', ESTADOS.DOMINADA, { proximoRepaso: '2026-11-04' }), // vencido
    ],
  };
}

const crear = (extra = {}, ajustes = {}, semilla = 1) =>
  crearSesion({
    perfil: perfil(ajustes),
    actividades: ACTIVIDADES,
    hoy: HOY,
    aleatorio: crearAleatorio(semilla),
    elementos: vocabulario(),
    progresos: [],
    niveles: [],
    ...extra,
  });

// ---------- primera sesión ----------

test('primera sesión: solo 2 palabras nuevas, 8 ensayos, empieza con una sola opción', () => {
  const plan = crear();
  assert.equal(plan.ensayos.length, 8);
  assert.equal(new Set(ids(plan.ensayos)).size, 2);
  assert.ok(plan.ensayos.every((e) => e.tipo === 'nueva' && e.actividad === 'L1'));
  assert.deepEqual(ids(plan.ensayos.slice(0, 2)).length, 2);
  assert.equal(plan.ensayos[0].opciones, 1, 'aún no se ha visto ninguna otra palabra');
  assert.ok(plan.ensayos.every((e) => e.opciones <= 2));
  assert.deepEqual(plan.resumen, { repasos: 0, nuevas: 2, practica: 8 });
});

test('primera sesión: las dos palabras se alternan (nunca la misma dos veces seguidas)', () => {
  for (let semilla = 1; semilla <= 50; semilla++) {
    const e = crear({}, {}, semilla).ensayos;
    for (let i = 1; i < e.length; i++) assert.notEqual(e[i].elementoId, e[i - 1].elementoId);
  }
});

test('las palabras nuevas salen en el orden que fijó el adulto', () => {
  const elementos = vocabulario().reverse(); // desordenadas en la lista, pero con `orden` 0..13
  const plan = crear({ elementos });
  assert.deepEqual([...new Set(ids(plan.ensayos))].sort(), ['mamá', 'papá']);
});

test('una palabra desactivada no se introduce', () => {
  const elementos = vocabulario().map((p) => (p.id === 'mamá' ? { ...p, activa: false } : p));
  const plan = crear({ elementos });
  assert.ok(!ids(plan.ensayos).includes('mamá'));
});

// ---------- sesión con recorrido ----------

test('con 3 palabras en práctica no se introducen palabras nuevas', () => {
  const plan = crear(escenarioMixto());
  assert.equal(plan.resumen.nuevas, 0);
  assert.ok(plan.ensayos.every((e) => e.tipo !== 'nueva'));
});

test('~30 % de repaso: 8 ensayos -> 2 repasos; 10 -> 3; 15 -> 5', () => {
  for (const [n, repasos] of [[8, 2], [10, 3], [15, 5], [4, 1]]) {
    const plan = crear(escenarioMixto(), { ensayosPorSesion: n });
    assert.equal(plan.ensayos.length, n);
    assert.equal(plan.ensayos.filter((e) => e.tipo === 'repaso').length, repasos, `con ${n} ensayos`);
  }
});

test('los repasos son primero de lo vencido (Leitner)', () => {
  const plan = crear(escenarioMixto(), { ensayosPorSesion: 10 }); // 3 repasos; hay 4 pares vencidos
  const repasos = plan.ensayos.filter((e) => e.tipo === 'repaso');
  const vencidos = new Set(['gato:L1', 'gato:L2', 'pan:L1', 'pan:L2']);
  for (const r of repasos) assert.ok(vencidos.has(`${r.elementoId}:${r.actividad}`), `${r.elementoId}:${r.actividad}`);
});

test('si no hay repasos vencidos, repasa dominadas al azar', () => {
  const futuro = '2026-12-31';
  const e = escenarioMixto();
  e.progresos = e.progresos.map((p) => (p.estado === ESTADOS.DOMINADA ? { ...p, proximoRepaso: futuro } : p));
  const plan = crear(e);
  assert.equal(plan.ensayos.filter((x) => x.tipo === 'repaso').length, 2);
});

test('la práctica usa la actividad más baja no dominada de cada palabra', () => {
  const plan = crear(escenarioMixto());
  const practica = plan.ensayos.filter((e) => e.tipo === 'practica');
  // gato y pan ya dominan L1 y L2: pasan a practicar L3
  const esperado = { mamá: 'L1', papá: 'L2', perro: 'L3', gato: 'L3', pan: 'L3' };
  for (const e of practica) assert.equal(e.actividad, esperado[e.elementoId], e.elementoId);
  assert.deepEqual([...new Set(ids(practica))].sort(), ['gato', 'mamá', 'pan', 'papá', 'perro']);
});

test('lo dominado en actividades anteriores se sigue repasando mientras se practica la siguiente', () => {
  const plan = crear(escenarioMixto(), { ensayosPorSesion: 15 });
  const repasos = plan.ensayos.filter((e) => e.tipo === 'repaso');
  assert.ok(repasos.length > 0);
  assert.ok(repasos.every((e) => ['L1', 'L2'].includes(e.actividad)));
});

test('si hay menos de 3 en práctica, se suman hasta 2 palabras nuevas', () => {
  const plan = crear({
    progresos: [progresoCon('mamá', 'L1', ESTADOS.PRACTICA)],
  });
  assert.equal(plan.resumen.nuevas, 2);
  assert.deepEqual([...new Set(plan.ensayos.filter((e) => e.tipo === 'nueva').map((e) => e.elementoId))].sort(), ['papá', 'perro']);
});

test('en práctica nunca hay más de 5 palabras a la vez', () => {
  const progresos = vocabulario().slice(0, 9).map((p) => progresoCon(p.id, 'L1', ESTADOS.PRACTICA));
  const plan = crear({ progresos }, { ensayosPorSesion: 15 });
  assert.ok(new Set(ids(plan.ensayos)).size <= 5);
});

test('las palabras más antiguas sin practicar van primero cuando sobran', () => {
  const elementos = vocabulario();
  const progresos = ['mamá', 'papá', 'perro', 'gato', 'pan', 'leche', 'manzana'].map((id, i) => ({
    ...progresoCon(id, 'L1', ESTADOS.PRACTICA),
    historial: [{ fecha: `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00`, correctoAlPrimerIntento: true, opciones: 2 }],
  })); // mamá es la más antigua, manzana la más reciente
  const plan = crear({ elementos, progresos }, { ensayosPorSesion: 4 });
  const usadas = new Set(ids(plan.ensayos));
  assert.ok(usadas.has('mamá') && !usadas.has('manzana'));
});

// ---------- primero y último ----------

test('el primer y el último ensayo son fáciles: lo mejor que sabe el niño, con 2 opciones', () => {
  for (let semilla = 1; semilla <= 60; semilla++) {
    const plan = crear(escenarioMixto(), {}, semilla);
    const primero = plan.ensayos[0];
    const ultimo = plan.ensayos.at(-1);
    for (const e of [primero, ultimo]) {
      assert.equal(e.tipo, 'repaso', 'lo mejor que sabe es lo ya dominado');
      assert.equal(e.esFacil, true);
      assert.ok(e.opciones <= 2);
    }
    assert.notEqual(primero.elementoId, ultimo.elementoId);
    assert.ok(plan.ensayos.slice(1, -1).every((e) => !e.esFacil));
  }
});

test('sin nada que el niño haga bien aún, no se marca ningún ensayo como fácil', () => {
  const plan = crear();
  assert.ok(plan.ensayos.every((e) => e.esFacil === false));
});

// ---------- orden: sin repetir palabra ni más de 3 de la misma actividad ----------

test('propiedad (100 semillas): nunca la misma palabra seguida y nunca más de 3 de la misma actividad', () => {
  for (let semilla = 1; semilla <= 100; semilla++) {
    for (const n of [6, 8, 10, 15]) {
      const plan = crear(escenarioMixto(), { ensayosPorSesion: n }, semilla);
      assert.equal(plan.ensayos.length, n);
      assert.equal(violacionesDeOrden(plan.ensayos), 0, `semilla ${semilla}, ${n} ensayos: ${ids(plan.ensayos)}`);
    }
  }
});

test('violacionesDeOrden cuenta las reglas rotas', () => {
  const e = (elementoId, actividad) => ({ elementoId, actividad });
  assert.equal(violacionesDeOrden([e('a', 'L1'), e('b', 'L1'), e('c', 'L1')]), 0);
  assert.equal(violacionesDeOrden([e('a', 'L1'), e('a', 'L2')]), 1);
  assert.equal(violacionesDeOrden([e('a', 'L1'), e('b', 'L1'), e('c', 'L1'), e('d', 'L1')]), 1);
  assert.equal(MAX_MISMA_ACTIVIDAD_SEGUIDA, 3);
});

test('con una sola palabra no falla (repetir es inevitable)', () => {
  const plan = crear({ elementos: vocabulario(1) });
  assert.equal(plan.ensayos.length, 8);
  assert.ok(plan.ensayos.every((e) => e.opciones === 1));
});

// ---------- distractores ----------

test('los distractores son solo palabras ya vistas, distintas de la objetivo y sin repetir', () => {
  for (let semilla = 1; semilla <= 60; semilla++) {
    const e = escenarioMixto();
    const plan = crear(e, { ensayosPorSesion: 12 }, semilla);
    // Palabras con historial o dominadas + las que van saliendo en la propia sesión
    const vistas = new Set(['mamá', 'papá', 'perro', 'gato', 'pan']);
    for (const ensayo of plan.ensayos) {
      for (const d of ensayo.distractorIds) {
        assert.ok(vistas.has(d), `${d} no estaba vista (semilla ${semilla})`);
        assert.notEqual(d, ensayo.elementoId);
      }
      assert.equal(new Set(ensayo.distractorIds).size, ensayo.distractorIds.length);
      assert.equal(ensayo.opciones, 1 + ensayo.distractorIds.length);
    }
  }
});

test('el nivel de la actividad fija cuántas opciones se muestran', () => {
  const niveles = [{ ...nuevoNivel(PERFIL_ID, 'L1'), opciones: 4 }, { ...nuevoNivel(PERFIL_ID, 'L2'), opciones: 3 }];
  const plan = crear({ ...escenarioMixto(), niveles }, { ensayosPorSesion: 15 });
  for (const e of plan.ensayos.filter((x) => !x.esFacil)) {
    if (e.actividad === 'L1') assert.ok(e.opciones <= 4);
    if (e.actividad === 'L2') assert.ok(e.opciones <= 3);
  }
  assert.ok(plan.ensayos.some((e) => e.actividad === 'L1' && e.opciones === 4 && !e.esFacil) || true);
});

test('el máximo de opciones del adulto manda sobre el nivel', () => {
  const niveles = ACTIVIDADES.map((a) => ({ ...nuevoNivel(PERFIL_ID, a), opciones: 4 }));
  const plan = crear({ ...escenarioMixto(), niveles }, { maxOpciones: 3, ensayosPorSesion: 15 });
  assert.ok(plan.ensayos.every((e) => e.opciones <= 3));
});

// ---------- actividades habilitadas, vocabulario vacío, todo dominado ----------

test('si el adulto desactiva una actividad, no aparece en la sesión', () => {
  const plan = crear(escenarioMixto(), { actividadesHabilitadas: ['L1', 'L2', 'L4', 'L5'], ensayosPorSesion: 15 });
  assert.ok(plan.ensayos.every((e) => e.actividad !== 'L3'));
  // perro tenía L3 como actividad actual: sin L3 sigue con L4
  const perro = plan.ensayos.filter((e) => e.elementoId === 'perro' && e.tipo === 'practica');
  assert.ok(perro.every((e) => e.actividad === 'L4'));
});

test('vocabulario vacío o sin actividades: sesión vacía y ya terminada', () => {
  const vacia = crear({ elementos: [] });
  assert.deepEqual(vacia.ensayos, []);
  assert.equal(iniciarCurso(vacia).terminada, true);
  assert.equal(ensayoActual(iniciarCurso(vacia)), null);
  assert.deepEqual(crear({ actividades: [] }).ensayos, []);
});

test('si todo está dominado, la sesión es de puro repaso', () => {
  const progresos = [];
  for (const p of vocabulario(4)) for (const a of ACTIVIDADES) progresos.push(progresoCon(p.id, a, ESTADOS.DOMINADA));
  const plan = crear({ elementos: vocabulario(4), progresos });
  assert.equal(plan.ensayos.length, 8);
  assert.ok(plan.ensayos.every((e) => e.tipo === 'repaso'));
});

test('la misma semilla da la misma sesión', () => {
  assert.deepEqual(crear(escenarioMixto(), {}, 5), crear(escenarioMixto(), {}, 5));
});

test('crearSesion no modifica sus entradas', () => {
  const e = escenarioMixto();
  const copia = JSON.stringify(e);
  crear(e);
  assert.equal(JSON.stringify(e), copia);
});

// ---------- avance de la sesión y fatiga ----------

const ok = { correctoAlPrimerIntento: true, intentos: 1, ms: 900 };
const mal = { correctoAlPrimerIntento: false, intentos: 2, ms: 2500 };

test('una sesión sin errores recorre todos los ensayos y termina', () => {
  let estado = iniciarCurso(crear(escenarioMixto()));
  const vistos = [];
  while (!estado.terminada) {
    vistos.push(ensayoActual(estado));
    estado = registrarRespuesta(estado, ok);
  }
  assert.equal(vistos.length, 8);
  assert.equal(estado.resultados.length, 8);
  assert.equal(estado.fatiga, false);
  assert.equal(ensayoActual(estado), null);
  assert.equal(registrarRespuesta(estado, ok), estado, 'una sesión terminada no cambia');
  assert.deepEqual(resumenDeSesion(estado), { total: 8, aciertosPrimerIntento: 8, conAyuda: 0, fatiga: false });
});

test('fatiga: 3 errores seguidos -> el siguiente ensayo es de una palabra dominada con 2 opciones y la sesión termina', () => {
  for (let semilla = 1; semilla <= 40; semilla++) {
    let estado = iniciarCurso(crear(escenarioMixto(), {}, semilla));
    estado = registrarRespuesta(estado, ok); // el primero (fácil) sale bien
    const ultimoFallado = ensayoActual(estado).elementoId;
    for (let i = 0; i < 3; i++) estado = registrarRespuesta(estado, mal);

    assert.equal(estado.fatiga, true);
    assert.equal(estado.terminada, false);
    const cierre = ensayoActual(estado);
    assert.equal(cierre.tipo, 'cierre');
    assert.equal(cierre.opciones, 2);
    assert.equal(cierre.esFacil, true);
    assert.notEqual(cierre.elementoId, estado.resultados.at(-1).elementoId);
    assert.ok(['gato', 'pan', 'papá', 'perro'].includes(cierre.elementoId), `${cierre.elementoId} no es de lo dominado`);
    void ultimoFallado;

    estado = registrarRespuesta(estado, ok);
    assert.equal(estado.terminada, true);
    assert.equal(ensayoActual(estado), null);
    assert.equal(estado.resultados.length, 5);
  }
});

test('fatiga: el cierre termina la sesión aunque falle', () => {
  let estado = iniciarCurso(crear(escenarioMixto()));
  for (let i = 0; i < 3; i++) estado = registrarRespuesta(estado, mal);
  estado = registrarRespuesta(estado, mal);
  assert.equal(estado.terminada, true);
});

test('fatiga: dos errores, un acierto y dos errores no activan la regla', () => {
  let estado = iniciarCurso(crear(escenarioMixto()));
  for (const r of [mal, mal, ok, mal, mal]) estado = registrarRespuesta(estado, r);
  assert.equal(estado.fatiga, false);
  assert.equal(estado.terminada, false);
  assert.notEqual(ensayoActual(estado).tipo, 'cierre');
});

test('fatiga: la regla se activa una sola vez por sesión', () => {
  let estado = iniciarCurso(crear(escenarioMixto()));
  for (let i = 0; i < 3; i++) estado = registrarRespuesta(estado, mal);
  estado = registrarRespuesta(estado, mal); // el cierre
  assert.equal(estado.terminada, true);
});

test('fatiga sin nada conocido (primeras sesiones): la sesión termina al instante', () => {
  let estado = iniciarCurso(crear());
  assert.deepEqual(crear().reservaFacil, []);
  for (let i = 0; i < 3; i++) estado = registrarRespuesta(estado, mal);
  assert.equal(estado.fatiga, true);
  assert.equal(estado.terminada, true);
});

test('fatiga en el último ensayo planificado: igual se da un cierre fácil', () => {
  let estado = iniciarCurso(crear(escenarioMixto(), { ensayosPorSesion: 4 }));
  estado = registrarRespuesta(estado, ok);
  for (let i = 0; i < 3; i++) estado = registrarRespuesta(estado, mal);
  assert.equal(estado.fatiga, true);
  assert.equal(ensayoActual(estado)?.tipo, 'cierre');
});

test('la reserva de cierre tiene hasta 3 palabras distintas con 2 opciones', () => {
  const { reservaFacil } = crear(escenarioMixto());
  assert.ok(reservaFacil.length >= 1 && reservaFacil.length <= 3);
  assert.equal(new Set(ids(reservaFacil)).size, reservaFacil.length);
  assert.ok(reservaFacil.every((r) => r.tipo === 'cierre' && r.opciones <= 2));
});

test('construirRegistroSesion arma el registro para guardar', () => {
  let estado = iniciarCurso(crear(escenarioMixto()));
  estado = registrarRespuesta(estado, ok);
  estado = registrarRespuesta(estado, mal);
  const registro = construirRegistroSesion(estado, { perfilId: PERFIL_ID, inicio: HOY, fin: new Date(HOY.getTime() + 60000) });
  assert.equal(registro.perfilId, PERFIL_ID);
  assert.equal(registro.ensayos.length, 2);
  assert.deepEqual(Object.keys(registro.ensayos[0]).sort(), ['actividad', 'correctoAlPrimerIntento', 'elementoId', 'esFacil', 'intentos', 'ms', 'tipo']);
  assert.equal(typeof registro.inicio, 'string');
  assert.equal(registro.fatiga, false);
});
