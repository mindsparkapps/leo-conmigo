import test from 'node:test';
import assert from 'node:assert/strict';
import { crearControlador, esPracticable, actividadesDeLaEtapa } from '../js/core/controlador.js';
import { crearAleatorio } from '../js/core/azar.js';
import { ELOGIOS } from '../js/core/elogios.js';
import { ESTADOS } from '../js/core/progreso.js';
import { HOY, PERFIL_ID, perfil, vocabulario } from './ayudas.js';

// Todas las palabras de prueba tienen emoji, así se pueden practicar
const conEmoji = (cantidad) => vocabulario(cantidad).map((p) => ({ ...p, emoji: '🍎' }));
const crear = (extra = {}, ajustes = {}, semilla = 1) =>
  crearControlador({
    perfil: perfil(ajustes), palabras: conEmoji(14), progresos: [], niveles: [], hoy: HOY, aleatorio: crearAleatorio(semilla),
    reloj: () => HOY, ...extra,
  });

/**
 * Juega una sesión entera como un niño: `errar(n)` dice si en el ensayo n (desde 0) toca primero una opción equivocada.
 * Devuelve lo que la pantalla habría guardado.
 */
function jugar(ctl, { errar = () => false, ahora = 1000 } = {}) {
  const guardados = [];
  const vistos = [];
  let ensayo = ctl.iniciar(ahora);
  let n = 0;
  while (ensayo && !ctl.terminada) {
    vistos.push(ensayo);
    ahora += 1000;
    if (errar(n) && ensayo.cartas.length > 1) {
      const mala = ensayo.cartas.find((c) => c.id !== ensayo.correctaId);
      const r = ctl.tocar(mala.id, ahora);
      assert.equal(r.efecto, 'ayuda');
      assert.ok(r.atenuadas.includes(mala.id));
      assert.equal(r.correctaId, ensayo.correctaId);
      ahora += 600;
    }
    const r = ctl.tocar(ensayo.correctaId, ahora);
    assert.equal(r.efecto, 'correcto');
    assert.ok(ELOGIOS.includes(r.elogio));
    ahora += 800;
    const sig = ctl.avanzar(ahora);
    guardados.push(sig.guardar);
    ensayo = sig.siguiente;
    n += 1;
    if (sig.terminada) break;
  }
  return { guardados, vistos, ahora };
}

// ---------- qué se puede practicar ----------

test('esPracticable: necesita imagen o emoji, y estar activa y no borrada', () => {
  const base = { id: 'x', texto: 'x', activa: true };
  assert.equal(esPracticable({ ...base, medioImagenId: 'm1' }), true);
  assert.equal(esPracticable({ ...base, emoji: '🍎' }), true);
  assert.equal(esPracticable(base), false);
  assert.equal(esPracticable({ ...base, emoji: '🍎', activa: false }), false);
  assert.equal(esPracticable({ ...base, emoji: '🍎', deleted: true }), false);
});

test('las palabras sin imagen ni emoji no se practican (ni salen como distractores)', () => {
  const palabras = conEmoji(14).map((p) => (['mamá', 'papá'].includes(p.id) ? { ...p, emoji: null } : p));
  for (let semilla = 1; semilla <= 20; semilla++) {
    const ctl = crear({ palabras }, {}, semilla);
    const { vistos } = jugar(ctl);
    for (const v of vistos) {
      for (const c of v.cartas) assert.ok(!['mamá', 'papá'].includes(c.id), `${c.id} no tiene imagen`);
    }
  }
});

test('sin ninguna palabra practicable: no hay ensayos y la sesión ya está terminada', () => {
  const ctl = crear({ palabras: vocabulario(5) }); // sin emoji ni imagen
  assert.equal(ctl.iniciar(0), null);
  assert.equal(ctl.terminada, true);
  assert.equal(ctl.actual(), null);
  const vacio = crear({ palabras: [] });
  assert.equal(vacio.iniciar(0), null);
});

test('actividadesDeLaEtapa: cada etapa con sus actividades; las que aún no existen usan la 1', () => {
  assert.deepEqual(actividadesDeLaEtapa(0), ['P1', 'P2', 'P3']);
  assert.deepEqual(actividadesDeLaEtapa(1), ['L1', 'L2', 'L3', 'L4', 'L5']);
  assert.deepEqual(actividadesDeLaEtapa(2), ['F1', 'F2', 'F3']);
  assert.deepEqual(actividadesDeLaEtapa(3), ['L1', 'L2', 'L3', 'L4', 'L5'], 'la etapa 3 llega en la fase 8');
  assert.deepEqual(actividadesDeLaEtapa(undefined), ['L1', 'L2', 'L3', 'L4', 'L5']);
});

// ---------- una sesión completa ----------

test('una sesión completa de 8 ensayos se juega solo con toques y se guarda cada resultado', () => {
  const ctl = crear();
  const { guardados, vistos } = jugar(ctl);
  assert.equal(vistos.length, 8);
  assert.equal(ctl.terminada, true);
  assert.equal(ctl.ensayosHechos, 8);
  assert.equal(guardados.length, 8);
  assert.equal(ctl.actual(), null);
  for (const g of guardados) {
    assert.equal(g.progreso.perfilId, PERFIL_ID);
    assert.ok([ESTADOS.PRACTICA, ESTADOS.DOMINADA].includes(g.progreso.estado));
    assert.ok(g.progreso.historial.length >= 1);
    assert.equal(g.nivel.perfilId, PERFIL_ID);
  }
  assert.deepEqual(ctl.resumen(), { total: 8, aciertosPrimerIntento: 8, conAyuda: 0, fatiga: false });
});

test('la primera sesión empieza con una sola opción y solo con palabras de L1', () => {
  const ctl = crear();
  const primero = ctl.iniciar(0);
  assert.equal(primero.cartas.length, 1);
  assert.equal(primero.actividad, 'L1');
  assert.equal(primero.tipo, 'nueva');
});

test('un error pone el ensayo «con ayuda» y queda registrado así', () => {
  const ctl = crear();
  const { guardados } = jugar(ctl, { errar: (n) => n === 2 });
  const conAyuda = guardados.filter((g) => !g.progreso.historial.at(-1).correctoAlPrimerIntento);
  assert.equal(conAyuda.length, 1);
  assert.deepEqual(ctl.resumen(), { total: 8, aciertosPrimerIntento: 7, conAyuda: 1, fatiga: false });
});

test('equivocarse nunca saca al niño del ensayo: la respuesta al error es siempre "ayuda", jamás un castigo', () => {
  const ctl = crear({}, {}, 4);
  let ensayo = ctl.iniciar(0);
  let ahora = 1000;
  for (let n = 0; n < 6 && ensayo; n++) {
    ahora += 1000;
    for (const mala of ensayo.cartas.filter((c) => c.id !== ensayo.correctaId)) {
      const r = ctl.tocar(mala.id, ahora);
      assert.ok(['ayuda'].includes(r.efecto), r.efecto);
      assert.deepEqual(Object.keys(r).sort(), ['atenuadas', 'correctaId', 'efecto'], 'un error no trae elogio ni resultado');
      ahora += 500;
    }
    assert.equal(ctl.tocar(ensayo.correctaId, ahora).efecto, 'correcto');
    ahora += 700;
    ensayo = ctl.avanzar(ahora).siguiente;
  }
});

test('la consigna se dice solo la primera vez de cada actividad', () => {
  // 15 ensayos con progreso previo para que salgan varias actividades
  const progresos = [];
  const ctl = crearControlador({
    perfil: perfil({ ensayosPorSesion: 15 }), palabras: conEmoji(14), progresos, niveles: [], hoy: HOY, aleatorio: crearAleatorio(2), reloj: () => HOY,
  });
  const { vistos } = jugar(ctl);
  const conConsigna = vistos.filter((v) => v.decirConsigna).map((v) => v.actividad);
  const actividades = [...new Set(vistos.map((v) => v.actividad))];
  assert.deepEqual([...conConsigna].sort(), [...actividades].sort());
  assert.equal(vistos[0].decirConsigna, true);
});

// ---------- toques ----------

test('toques dobles y rápidos no cuentan dos veces', () => {
  const ctl = crear();
  const ensayo = ctl.iniciar(0);
  assert.equal(ctl.tocar(ensayo.correctaId, 100).efecto, 'ignorado', 'dentro de los primeros 400 ms');
  assert.equal(ctl.tocar(ensayo.correctaId, 1000).efecto, 'correcto');
  assert.equal(ctl.tocar(ensayo.correctaId, 1100).efecto, 'ignorado', 'doble toque');
  assert.equal(ctl.tocar(ensayo.correctaId, 1200).efecto, 'ignorado');
  const sig = ctl.avanzar(2000);
  assert.equal(sig.guardar.progreso.historial.length, 1, 'un solo ensayo registrado');
  assert.equal(ctl.ensayosHechos, 1);
});

test('con dos opciones, dos toques seguidos a distintas cartas cuentan como un solo toque', () => {
  const ctl = crear({}, {}, 3);
  let ensayo = ctl.iniciar(0);
  // avanzar hasta un ensayo con 2 opciones
  let ahora = 1000;
  while (ensayo.cartas.length < 2) {
    ctl.tocar(ensayo.correctaId, ahora);
    ahora += 1000;
    ensayo = ctl.avanzar(ahora).siguiente;
    ahora += 1000;
  }
  const mala = ensayo.cartas.find((c) => c.id !== ensayo.correctaId).id;
  assert.equal(ctl.tocar(mala, ahora).efecto, 'ayuda');
  assert.equal(ctl.tocar(ensayo.correctaId, ahora + 150).efecto, 'ignorado', 'segundo toque pegado al primero');
  assert.equal(ctl.tocar(ensayo.correctaId, ahora + 700).efecto, 'correcto');
});

test('avanzar antes de acertar es un error de programación, no un avance', () => {
  const ctl = crear();
  ctl.iniciar(0);
  assert.throws(() => ctl.avanzar(1000), /aún no se resolvió/);
});

test('el elogio nunca se repite dos veces seguidas', () => {
  const ctl = crear({}, { ensayosPorSesion: 15 });
  let ensayo = ctl.iniciar(0);
  let ahora = 1000;
  let anterior = null;
  while (ensayo) {
    const r = ctl.tocar(ensayo.correctaId, ahora);
    assert.notEqual(r.elogio, anterior);
    anterior = r.elogio;
    ahora += 1000;
    ensayo = ctl.avanzar(ahora).siguiente;
    ahora += 1000;
  }
});

// ---------- fatiga ----------

test('fatiga: con 3 errores seguidos el siguiente ensayo es fácil y la sesión termina con ese acierto', () => {
  // un niño con cosas ya dominadas, para que exista algo fácil que ofrecerle
  const progresos = [];
  for (const id of ['mamá', 'papá', 'perro']) {
    progresos.push({
      id: `${PERFIL_ID}:${id}:L1`, perfilId: PERFIL_ID, elementoId: id, actividad: 'L1', estado: ESTADOS.DOMINADA, cajaLeitner: 1,
      proximoRepaso: '2026-10-30', fallosRepaso: 0, historial: [{ fecha: '2026-10-01T10:00:00', correctoAlPrimerIntento: true, opciones: 2 }],
    });
  }
  const ctl = crear({ progresos });
  let ensayo = ctl.iniciar(0);
  let ahora = 1000;
  // primer ensayo bien; luego 3 errores seguidos
  ctl.tocar(ensayo.correctaId, ahora);
  ahora += 1000;
  ensayo = ctl.avanzar(ahora).siguiente;
  for (let k = 0; k < 3; k++) {
    ahora += 1000;
    const mala = ensayo.cartas.find((c) => c.id !== ensayo.correctaId);
    if (mala) { ctl.tocar(mala.id, ahora); ahora += 600; }
    ctl.tocar(ensayo.correctaId, ahora);
    ahora += 800;
    const sig = ctl.avanzar(ahora);
    ensayo = sig.siguiente;
    if (k < 2) assert.equal(sig.fatiga, false);
    else assert.equal(sig.fatiga, true);
  }
  assert.equal(ctl.fatiga, true);
  assert.equal(ensayo.tipo, 'cierre');
  assert.equal(ensayo.cartas.length, 2);
  assert.equal(ctl.terminada, false);
  ahora += 1000;
  ctl.tocar(ensayo.correctaId, ahora);
  const fin = ctl.avanzar(ahora + 800);
  assert.equal(fin.terminada, true);
  assert.equal(fin.siguiente, null);
  assert.equal(ctl.resumen().total, 5);
});

// ---------- el nivel sube con los buenos resultados ----------

test('las opciones pasan de 2 a 3 tras 10 buenos resultados en la actividad (varias sesiones)', () => {
  let progresos = new Map();
  let niveles = new Map();
  const contados = {}; // ensayos "normales" (no fáciles) resueltos por actividad
  let primeraConTres = null;

  for (let dia = 0; dia < 40 && !primeraConTres; dia++) {
    const hoy = new Date(2026, 9, 1 + dia, 10, 0, 0);
    const ctl = crearControlador({
      perfil: perfil(), palabras: conEmoji(14), progresos: [...progresos.values()], niveles: [...niveles.values()],
      hoy, aleatorio: crearAleatorio(100 + dia), reloj: () => new Date(hoy.getTime() + 1000),
    });
    let ensayo = ctl.iniciar(0);
    let ahora = 1000;
    while (ensayo) {
      if (ensayo.cartas.length >= 3 && !ensayo.esFacil && !primeraConTres) {
        primeraConTres = { actividad: ensayo.actividad, antes: contados[ensayo.actividad] ?? 0 };
      }
      if (!ensayo.esFacil) contados[ensayo.actividad] = (contados[ensayo.actividad] ?? 0) + 1;
      ahora += 1000;
      ctl.tocar(ensayo.correctaId, ahora); // siempre acierta a la primera
      ahora += 800;
      const sig = ctl.avanzar(ahora);
      progresos.set(sig.guardar.progreso.id, sig.guardar.progreso);
      niveles.set(sig.guardar.nivel.id, sig.guardar.nivel);
      ensayo = sig.siguiente;
    }
  }
  assert.ok(primeraConTres, 'nunca llegó a mostrar 3 opciones');
  assert.ok(primeraConTres.antes >= 10, `subió a 3 opciones tras solo ${primeraConTres.antes} ensayos`);
  const nivelesGuardados = [...niveles.values()];
  assert.ok(nivelesGuardados.some((n) => n.opciones >= 3));
  assert.ok(nivelesGuardados.every((n) => n.opciones >= 2 && n.opciones <= 4));
});

test('el máximo de opciones del adulto limita lo que se le muestra al niño', () => {
  let progresos = new Map();
  let niveles = new Map();
  let maximo = 0;
  for (let dia = 0; dia < 25; dia++) {
    const hoy = new Date(2026, 9, 1 + dia, 10, 0, 0);
    const ctl = crearControlador({
      perfil: perfil({ maxOpciones: 2 }), palabras: conEmoji(14), progresos: [...progresos.values()], niveles: [...niveles.values()],
      hoy, aleatorio: crearAleatorio(dia + 1), reloj: () => hoy,
    });
    let ensayo = ctl.iniciar(0);
    let ahora = 1000;
    while (ensayo) {
      maximo = Math.max(maximo, ensayo.cartas.length);
      ahora += 1000;
      ctl.tocar(ensayo.correctaId, ahora);
      ahora += 800;
      const sig = ctl.avanzar(ahora);
      progresos.set(sig.guardar.progreso.id, sig.guardar.progreso);
      niveles.set(sig.guardar.nivel.id, sig.guardar.nivel);
      ensayo = sig.siguiente;
    }
  }
  assert.equal(maximo, 2);
});

// ---------- registro de la sesión ----------

test('registro(): datos de la sesión para guardar, con cada ensayo', () => {
  const ctl = crear();
  jugar(ctl, { errar: (n) => n === 1 });
  const r = ctl.registro({ inicio: HOY, fin: new Date(HOY.getTime() + 90000) });
  assert.equal(r.perfilId, PERFIL_ID);
  assert.equal(r.ensayos.length, 8);
  assert.equal(r.fatiga, false);
  assert.equal(typeof r.inicio, 'string');
  assert.ok(r.ensayos.every((e) => e.actividad === 'L1'));
  assert.equal(r.ensayos.filter((e) => !e.correctoAlPrimerIntento).length, 1);
});

test('una sesión interrumpida también se puede registrar con lo que alcanzó a hacer', () => {
  const ctl = crear();
  const ensayo = ctl.iniciar(0);
  ctl.tocar(ensayo.correctaId, 1000);
  ctl.avanzar(2000);
  const r = ctl.registro({ inicio: HOY, fin: HOY });
  assert.equal(r.ensayos.length, 1);
  assert.equal(ctl.terminada, false);
});
