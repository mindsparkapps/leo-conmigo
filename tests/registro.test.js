import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crearIntento, crearIntentoLectura, crearIntentoSecuencia, decidirLectura, tocar, tocarSecuencia,
} from '../js/core/intento.js';
import { MS_DISTRAIDO, construirRespuesta, idDeRespuesta } from '../js/core/registro.js';
import { crearControlador } from '../js/core/controlador.js';
import { crearAleatorio } from '../js/core/azar.js';
import { ESTADOS } from '../js/core/progreso.js';
import { HOY, PERFIL_ID, perfil, vocabulario } from './ayudas.js';

const t0 = 10000;
const T = (ms) => t0 + ms;
const cartas = (ids = ['a', 'b', 'c']) => ids.map((id) => ({ id }));

// ---------- tiempos en el intento ----------

test('intento simple: guarda cuánto dudó (primer toque) y cuándo cometió cada error', () => {
  let i = crearIntento({ correctaId: 'a', cartas: cartas() }, t0);
  assert.equal(i.primerToque, null);
  i = tocar(i, 'b', T(1500)).intento;
  i = tocar(i, 'c', T(2500)).intento;
  i = tocar(i, 'a', T(4000)).intento;
  assert.equal(i.estado, 'acertado');
  assert.equal(i.primerToque, 1500);
  assert.deepEqual(i.errores, ['b', 'c']);
  assert.deepEqual(i.erroresMs, [1500, 2500]);
});

test('intento simple: un toque ignorado (muy seguido o repetido) no cuenta como primer toque ni como error', () => {
  let i = crearIntento({ correctaId: 'a', cartas: cartas() }, t0);
  i = tocar(i, 'b', T(100)).intento; // dentro de los primeros 400 ms: se ignora
  assert.equal(i.primerToque, null);
  assert.deepEqual(i.erroresMs, []);
  i = tocar(i, 'b', T(900)).intento;
  i = tocar(i, 'b', T(1600)).intento; // opción ya atenuada: se ignora
  assert.deepEqual(i.erroresMs, [900]);
  assert.equal(i.primerToque, 900);
});

test('intento simple: acertar a la primera deja primerToque igual al tiempo de acierto', () => {
  const i = tocar(crearIntento({ correctaId: 'a', cartas: cartas() }, t0), 'a', T(2200)).intento;
  assert.equal(i.primerToque, 2200);
  assert.deepEqual(i.erroresMs, []);
});

test('secuencia: guarda cada toque en orden, con su tiempo y si fue correcto', () => {
  const ens = { orden: ['a', 'b'], fichas: [{ id: 'f1', palabraId: 'b' }, { id: 'f0', palabraId: 'a' }, { id: 'f2', palabraId: 'c' }] };
  let i = crearIntentoSecuencia(ens, t0);
  i = tocarSecuencia(i, 'f2', T(1000)).intento; // error: la 'c' sobra
  i = tocarSecuencia(i, 'f0', T(2000)).intento;
  i = tocarSecuencia(i, 'f1', T(3000)).intento;
  assert.equal(i.estado, 'acertado');
  assert.deepEqual(i.toques, [
    { fichaId: 'f2', correcto: false, ms: 1000 },
    { fichaId: 'f0', correcto: true, ms: 2000 },
    { fichaId: 'f1', correcto: true, ms: 3000 },
  ]);
  assert.equal(i.primerToque, 1000);
  assert.deepEqual(i.erroresMs, [1000]);
});

test('lectura: guarda el primer toque del adulto y cuenta las repeticiones', () => {
  let i = crearIntentoLectura({}, t0);
  i = decidirLectura(i, 'otra', T(3000)).intento;
  i = decidirLectura(i, 'ok', T(7000)).intento;
  assert.equal(i.repeticiones, 1);
  assert.equal(i.primerToque, 3000);
});

// ---------- construirRespuesta ----------

const palabras = new Map([['a', 'mamá'], ['b', 'papá'], ['c', 'pan']]);
const base = (extra = {}) => ({
  perfilId: 'p1',
  sesionId: 'ses1',
  numeroEnSesion: 3,
  fecha: new Date(2026, 10, 5, 9, 30, 0), // jueves 5 de noviembre, hora local
  etapa: 1,
  ensayo: { elementoId: 'a', actividad: 'L2', tipo: 'practica', esFacil: false },
  elemento: { texto: 'mamá', esFrase: false, categoria: 'familia', silabas: ['ma', 'má'] },
  textoDe: (id) => palabras.get(id) ?? null,
  progresoAntes: { estado: ESTADOS.PRACTICA, cajaLeitner: 1 },
  progresoDespues: { estado: ESTADOS.DOMINADA, cajaLeitner: 2 },
  nivelOpciones: 3,
  ...extra,
});

function acertar({ errores = [], ids = ['a', 'b', 'c'], tFin = 5000 } = {}) {
  let i = crearIntento({ correctaId: 'a', cartas: cartas(ids) }, t0);
  let t = 1000;
  for (const e of errores) {
    i = tocar(i, e, T(t)).intento;
    t += 1000;
  }
  i = tocar(i, 'a', T(Math.max(t, tFin))).intento;
  return i;
}

test('construirRespuesta: copia el texto, las opciones en su orden, los errores con su momento y los estados', () => {
  const visual = { cartas: [{ id: 'b' }, { id: 'a' }, { id: 'c' }], posicionCorrecta: 1 };
  const intento = acertar({ errores: ['b', 'c'], tFin: 6000 });
  const r = construirRespuesta(base({ visual, intento, repeticionesAudio: 2 }));
  assert.equal(r.id, 'ses1:3');
  assert.equal(r.perfilId, 'p1');
  assert.equal(r.sesionId, 'ses1');
  assert.equal(r.dia, '2026-11-05');
  assert.equal(r.hora, 9);
  assert.equal(r.diaSemana, 4);
  assert.equal(r.numeroEnSesion, 3);
  assert.equal(r.elementoId, 'a');
  assert.equal(r.texto, 'mamá');
  assert.equal(r.esFrase, false);
  assert.equal(r.categoria, 'familia');
  assert.deepEqual(r.silabas, ['ma', 'má']);
  assert.equal(r.etapa, 1);
  assert.equal(r.actividad, 'L2');
  assert.equal(r.tipo, 'practica');
  assert.deepEqual(r.opciones, [{ id: 'b', texto: 'papá' }, { id: 'a', texto: 'mamá' }, { id: 'c', texto: 'pan' }]);
  assert.equal(r.posicionCorrecta, 1);
  assert.equal(r.nivelOpciones, 3);
  assert.equal(r.correctoAlPrimerIntento, false);
  assert.equal(r.intentos, 3);
  assert.deepEqual(r.errores, [{ id: 'b', texto: 'papá', ms: 1000 }, { id: 'c', texto: 'pan', ms: 2000 }]);
  assert.equal(r.msPrimerToque, 1000);
  assert.equal(r.msAcierto, 6000);
  assert.equal(r.distraido, false);
  assert.equal(r.repeticionesAudio, 2);
  assert.equal(r.conAyudaVisual, true);
  assert.equal(r.estadoAntes, 'practica');
  assert.equal(r.estadoDespues, 'dominada');
  assert.equal(r.cajaLeitnerAntes, 1);
  assert.equal(r.cajaLeitnerDespues, 2);
  assert.equal(r.fatigaActiva, false);
  assert.equal(new Date(r.fecha).getTime(), base().fecha.getTime());
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r, 'se puede guardar como JSON sin perder nada');
});

test('construirRespuesta: acierto a la primera, sin ayuda visual', () => {
  const intento = acertar({ tFin: 2500 });
  const r = construirRespuesta(base({ visual: { cartas: cartas(), posicionCorrecta: 0 }, intento }));
  assert.equal(r.correctoAlPrimerIntento, true);
  assert.deepEqual(r.errores, []);
  assert.equal(r.conAyudaVisual, false);
  assert.equal(r.msPrimerToque, 2500);
  assert.equal(r.msAcierto, 2500);
  assert.equal(r.repeticionesAudio, 0);
});

test('construirRespuesta: las cartas con texto propio (sílabas) lo conservan', () => {
  const visual = { cartas: [{ id: 'a', texto: 'ma' }, { id: 'b', texto: 'pa' }], posicionCorrecta: 0 };
  const intento = acertar({ ids: ['a', 'b'], errores: ['b'] });
  const r = construirRespuesta(base({ visual, intento, textoDe: () => null }));
  assert.deepEqual(r.opciones.map((o) => o.texto), ['ma', 'pa']);
  assert.equal(r.errores[0].texto, 'pa');
});

test('construirRespuesta: una respuesta de más de 60 s se guarda tal cual y se marca distraída', () => {
  const intento = acertar({ tFin: MS_DISTRAIDO + 1 });
  const r = construirRespuesta(base({ visual: { cartas: cartas(), posicionCorrecta: 0 }, intento }));
  assert.equal(r.msAcierto, MS_DISTRAIDO + 1);
  assert.equal(r.distraido, true);
  const justo = construirRespuesta(base({ visual: { cartas: cartas(), posicionCorrecta: 0 }, intento: acertar({ tFin: MS_DISTRAIDO }) }));
  assert.equal(justo.distraido, false);
});

test('construirRespuesta: una frase (F3) guarda el orden esperado y cada toque en orden', () => {
  const visual = {
    orden: ['a', 'b'],
    fichas: [{ id: 'f1', palabraId: 'b', texto: 'papá' }, { id: 'f0', palabraId: 'a', texto: 'mamá' }, { id: 'f2', palabraId: 'c', texto: 'pan' }],
  };
  let i = crearIntentoSecuencia({ orden: visual.orden, fichas: visual.fichas }, t0);
  i = tocarSecuencia(i, 'f2', T(1000)).intento;
  i = tocarSecuencia(i, 'f0', T(2000)).intento;
  i = tocarSecuencia(i, 'f1', T(3500)).intento;
  const r = construirRespuesta(base({
    visual, intento: i, ensayo: { elementoId: 'frase1', actividad: 'F3', tipo: 'practica', esFacil: false }, elemento: { texto: 'mamá papá', esFrase: true },
  }));
  assert.equal(r.esFrase, true);
  assert.equal(r.silabas, null);
  assert.deepEqual(r.ordenEsperado, ['mamá', 'papá']);
  assert.deepEqual(r.toques, [
    { texto: 'pan', correcto: false, ms: 1000 },
    { texto: 'mamá', correcto: true, ms: 2000 },
    { texto: 'papá', correcto: true, ms: 3500 },
  ]);
  assert.deepEqual(r.errores, [{ id: 'c', texto: 'pan', ms: 1000 }]);
  assert.deepEqual(r.opciones.map((o) => o.texto), ['papá', 'mamá', 'pan']);
  assert.equal(r.posicionCorrecta, null);
  assert.equal(r.correctoAlPrimerIntento, false);
});

test('construirRespuesta: «Leo en voz alta» (L6) guarda las veces que el adulto tocó ↻', () => {
  let i = crearIntentoLectura({}, t0);
  i = decidirLectura(i, 'otra', T(2000)).intento;
  i = decidirLectura(i, 'otra', T(4000)).intento;
  i = decidirLectura(i, 'ok', T(6000)).intento;
  const r = construirRespuesta(base({
    visual: {}, intento: i, ensayo: { elementoId: 'a', actividad: 'L6', tipo: 'lectura', esFacil: false }, nivelOpciones: null,
  }));
  assert.equal(r.tipo, 'lectura');
  assert.equal(r.repeticiones, 2);
  assert.equal(r.correctoAlPrimerIntento, false);
  assert.deepEqual(r.opciones, []);
  assert.equal(r.msPrimerToque, 2000);
  assert.equal(r.msAcierto, 6000);
});

test('construirRespuesta: una pregunta de cuento (B2) acepta campos extra y no tiene progreso', () => {
  const intento = acertar({ errores: ['c'] });
  const r = construirRespuesta(base({
    visual: { cartas: cartas(), posicionCorrecta: 0 },
    intento,
    ensayo: { elementoId: 'a', actividad: 'B2', tipo: 'cuento', esFacil: false },
    progresoAntes: null,
    progresoDespues: null,
    nivelOpciones: null,
    etapa: 4,
    extra: { libroId: 'libro1', pregunta: '¿Quién come pan?' },
  }));
  assert.equal(r.actividad, 'B2');
  assert.equal(r.tipo, 'cuento');
  assert.equal(r.libroId, 'libro1');
  assert.equal(r.pregunta, '¿Quién come pan?');
  assert.equal(r.estadoAntes, null);
  assert.equal(r.cajaLeitnerDespues, null);
  assert.equal(r.nivelOpciones, null);
});

test('construirRespuesta: el mismo ensayo siempre da el mismo id (guardarlo dos veces no lo duplica)', () => {
  const visual = { cartas: cartas(), posicionCorrecta: 0 };
  const a = construirRespuesta(base({ visual, intento: acertar() }));
  const b = construirRespuesta(base({ visual, intento: acertar() }));
  assert.equal(a.id, b.id);
  assert.equal(a.id, idDeRespuesta('ses1', 3));
});

test('construirRespuesta: no se puede registrar un ensayo que aún no se acertó', () => {
  const intento = crearIntento({ correctaId: 'a', cartas: cartas() }, t0);
  assert.throws(() => construirRespuesta(base({ visual: { cartas: cartas() }, intento })), /todavía no se resolvió/);
});

// ---------- el controlador arma el registro de una sesión ----------

const conEmoji = (cantidad) => vocabulario(cantidad).map((p) => ({ ...p, emoji: '🍎' }));
const crearCtl = (extra = {}) =>
  crearControlador({
    perfil: perfil({}), palabras: conEmoji(14), progresos: [], niveles: [], hoy: HOY, aleatorio: crearAleatorio(1), reloj: () => HOY, ...extra,
  });

/** Juega una sesión: `errores` = números de ensayo (desde 0) donde toca primero una opción equivocada; `audios` = cuántas veces toca el altavoz. */
function jugarSesion(ctl, { errores = [], audios = {} } = {}) {
  let ahora = 1000;
  let ensayo = ctl.iniciar(ahora);
  let inicioEnsayo = ahora;
  const guardados = [];
  const momentosDeError = [];
  for (let n = 0; ensayo && !ctl.terminada; n++) {
    for (let k = 0; k < (audios[n] ?? 0); k++) ctl.oirOtraVez();
    ahora += 1200;
    if (errores.includes(n) && ensayo.cartas.length > 1) {
      const mala = ensayo.cartas.find((c) => c.id !== ensayo.correctaId);
      ctl.tocar(mala.id, ahora);
      momentosDeError.push({ n, mala: mala.id, ms: Math.round(ahora - inicioEnsayo) });
      ahora += 700;
    }
    assert.equal(ctl.tocar(ensayo.correctaId, ahora).efecto, 'correcto');
    ahora += 800;
    const r = ctl.avanzar(ahora);
    guardados.push(r.guardar);
    ensayo = r.siguiente;
    inicioEnsayo = ahora;
    if (r.terminada) break;
  }
  return { guardados, momentosDeError };
}

test('una sesión de 8 ensayos con 2 errores y 3 toques al altavoz deja 8 registros completos', () => {
  const ctl = crearCtl();
  const { guardados, momentosDeError } = jugarSesion(ctl, { errores: [1, 4], audios: { 0: 1, 2: 2 } });
  assert.equal(guardados.length, 8);
  const respuestas = guardados.map((g) => g.respuesta);
  assert.deepEqual(respuestas.map((r) => r.numeroEnSesion), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(respuestas.every((r) => r.sesionId === ctl.sesionId && r.id === `${ctl.sesionId}:${r.numeroEnSesion}`));
  assert.ok(respuestas.every((r) => r.perfilId === PERFIL_ID && r.actividad === 'L1' && r.etapa === 1));
  assert.equal(respuestas.reduce((s, r) => s + r.repeticionesAudio, 0), 3);
  assert.deepEqual(respuestas.map((r) => r.repeticionesAudio), [1, 0, 2, 0, 0, 0, 0, 0]);

  const conError = respuestas.filter((r) => r.errores.length);
  assert.deepEqual(conError.map((r) => r.numeroEnSesion), [2, 5]);
  for (const r of conError) {
    const esperado = momentosDeError.find((m) => m.n === r.numeroEnSesion - 1);
    assert.equal(r.errores.length, 1);
    assert.equal(r.errores[0].id, esperado.mala);
    assert.equal(r.errores[0].ms, esperado.ms);
    assert.equal(typeof r.errores[0].texto, 'string');
    assert.equal(r.msPrimerToque, esperado.ms);
    assert.equal(r.conAyudaVisual, true);
    assert.equal(r.correctoAlPrimerIntento, false);
  }
  assert.ok(respuestas.filter((r) => !r.errores.length).every((r) => r.correctoAlPrimerIntento && r.msPrimerToque === r.msAcierto));
  assert.ok(respuestas.every((r) => r.opciones.some((o) => o.id === r.elementoId) && r.opciones[r.posicionCorrecta].id === r.elementoId));
  assert.ok(respuestas.every((r) => r.texto && r.opciones.every((o) => o.texto)));
});

test('el registro fino repite lo que hace el progreso: estados y caja antes y después', () => {
  const ctl = crearCtl();
  const { guardados } = jugarSesion(ctl);
  for (const { progreso, respuesta } of guardados) {
    assert.equal(respuesta.estadoDespues, progreso.estado);
    assert.equal(respuesta.cajaLeitnerDespues, progreso.cajaLeitner);
    assert.ok([ESTADOS.NUEVA, ESTADOS.PRACTICA, ESTADOS.DOMINADA].includes(respuesta.estadoAntes));
  }
  // la primera vez que se ve una palabra, su estado antes es «nueva»
  assert.equal(guardados[0].respuesta.estadoAntes, ESTADOS.NUEVA);
});

test('los toques al altavoz se cuentan por ensayo y no pasan al siguiente', () => {
  const ctl = crearCtl();
  const e = ctl.iniciar(0);
  ctl.oirOtraVez();
  ctl.oirOtraVez();
  ctl.tocar(e.correctaId, 1500);
  const r = ctl.avanzar(2000);
  assert.equal(r.guardar.respuesta.repeticionesAudio, 2);
  ctl.tocar(r.siguiente.correctaId, 4000);
  assert.equal(ctl.avanzar(4500).guardar.respuesta.repeticionesAudio, 0);
});

test('el id de la sesión se genera al empezar y el registro de la sesión lo usa', () => {
  const ctl = crearCtl();
  assert.match(ctl.sesionId, /^[0-9a-f-]{36}$/);
  jugarSesion(ctl);
  assert.equal(ctl.registro({ inicio: HOY, fin: HOY }).id, ctl.sesionId);
  assert.equal(crearCtl({ sesionId: 'mi-sesion' }).registro({ inicio: HOY, fin: HOY }).id, 'mi-sesion');
});

test('el ensayo de cierre por fatiga queda marcado en el registro', () => {
  // un niño con cosas ya dominadas, para que exista algo fácil que ofrecerle
  const progresos = ['mamá', 'papá', 'perro'].map((id) => ({
    id: `${PERFIL_ID}:${id}:L1`, perfilId: PERFIL_ID, elementoId: id, actividad: 'L1', estado: ESTADOS.DOMINADA, cajaLeitner: 1,
    proximoRepaso: '2026-10-30', fallosRepaso: 0, historial: [{ fecha: '2026-10-01T10:00:00', correctoAlPrimerIntento: true, opciones: 2 }],
  }));
  const ctl = crearCtl({ progresos });
  let ensayo = ctl.iniciar(0);
  let ahora = 1000;
  const respuestas = [];
  ctl.tocar(ensayo.correctaId, ahora);
  let r = ctl.avanzar((ahora += 1000));
  respuestas.push(r.guardar.respuesta);
  ensayo = r.siguiente;
  for (let k = 0; k < 3; k++) {
    ahora += 1000;
    const mala = ensayo.cartas.find((c) => c.id !== ensayo.correctaId);
    ctl.tocar(mala.id, ahora);
    ctl.tocar(ensayo.correctaId, (ahora += 1000));
    r = ctl.avanzar((ahora += 800));
    respuestas.push(r.guardar.respuesta);
    ensayo = r.siguiente;
  }
  assert.equal(ensayo.tipo, 'cierre');
  ctl.tocar(ensayo.correctaId, (ahora += 1000));
  respuestas.push(ctl.avanzar(ahora + 800).guardar.respuesta);
  assert.deepEqual(respuestas.map((x) => x.fatigaActiva), [false, false, false, false, true]);
  assert.equal(respuestas.at(-1).tipo, 'cierre');
});

// ---------- viaja en la copia de seguridad y en la sincronización ----------

test('el almacén de respuestas tiene índices por niño y por palabra, y viaja en la copia y la sincronización', async () => {
  const { ALMACENES } = await import('../js/store.js');
  const { ALMACENES_RESPALDO } = await import('../js/core/respaldo.js');
  const { ALMACENES_SYNC } = await import('../js/core/sync.js');
  assert.deepEqual(ALMACENES.respuestas, ['perfilId', 'elementoId']);
  assert.ok(ALMACENES_RESPALDO.includes('respuestas'));
  assert.ok(ALMACENES_SYNC.includes('respuestas'));
  for (const almacen of Object.keys(ALMACENES)) assert.ok(ALMACENES_RESPALDO.includes(almacen), `${almacen} falta en la copia de seguridad`);
});
