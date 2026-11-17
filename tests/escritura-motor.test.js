// Fase 28 (Ampliación 5): motor de escritura: intento, sesión, progreso, registro, autoajuste, ajustes y ficha de prueba.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crearAleatorio } from '../js/core/azar.js';
import { crearControlador, crearControladorEscritura } from '../js/core/controlador.js';
import { crearSesion } from '../js/core/sesion.js';
import { AJUSTES_POR_DEFECTO, normalizarAjustes, normalizarAjustesEscritura } from '../js/core/modelos.js';
import {
  ESTADOS, ajustarNivel, idNivel, idProgreso, nuevoNivel, nuevoProgreso, registrarEnNivel, registrarEnsayo, estaAprendida,
} from '../js/core/progreso.js';
import { construirRespuestaEscritura } from '../js/core/registro.js';
import { analizar, construirExportacion, respuestasAnalizables } from '../js/core/analisis.js';
import { avisosPendientes, deshacerCambio, evaluarAutoajuste, evaluarAutoajusteEscritura, avanceDeNivel } from '../js/core/autoajuste.js';
import { historialDeSesiones, precisionSemanal, resumenGeneral } from '../js/core/estadisticas.js';
import {
  AJUSTES_DE_ESCRITURA_DEL_ALUMNO, ALMACENES_DE_FICHA, aFicha, combinarPerfil, contenidoDe, esDePrueba, esIdDePrueba, fichaDePrueba, idDePrueba,
  perfilDePrueba, perfilPublicable, registrosDePrueba,
} from '../js/core/curso.js';
import { esDeEscritura } from '../js/core/escritura/comun.js';
import {
  nivelEfectivo, nivelesDisponibles, nivelesElegibles, elementosDeEscritura, palabrasPorNivel, siguienteNivelAbierto,
} from '../js/core/escritura/elementos.js';
import {
  BLOQUEO_MS, ERRORES_PARA_AYUDA, ayudaActual, completo, correctoAlPrimerIntento, crearIntentoEscritura, escuchar, fichaCorrectaPara, soltar,
} from '../js/core/escritura/intento.js';
import {
  armarEnsayoEscritura, aplicarResultadoEscritura, crearSesionEscritura, extrasEfectivos, nuevoNivelEscritura, registrarEnNivelEscritura,
} from '../js/core/escritura/sesion.js';
import { armarPiezas } from '../js/core/escritura/piezas.js';
import { simularEscritura } from './simulador.js';
import { PERFIL_ID, progresoCon, vocabulario, ACTIVIDADES } from './ayudas.js';

const banco = JSON.parse(readFileSync(new URL('../data/escritura/banco.json', import.meta.url), 'utf8'));
const elementos = elementosDeEscritura({ banco });
const HOY = new Date(2026, 10, 5, 10, 0, 0);
const perfilCon = (escritura = {}, resto = {}) => ({ id: PERFIL_ID, ajustes: { escritura, ...resto } });
const delNivel = (nivel) => elementos.filter((e) => e.nivel === nivel && e.activa);
const dominada = (e, extra = {}) => ({ ...progresoCon(e.id, e.nivel, ESTADOS.DOMINADA, extra) });

// ─── Intento ───────────────────────────────────────────────────────────────────────────────────────────────────

const visual = (silabas, extras = ['te']) => ({
  huecos: silabas,
  fichas: [...silabas, ...extras].map((texto, i) => ({ id: `f${i}`, texto, distractor: i >= silabas.length })),
});
// ms de cada toque: siempre 500 ms después del anterior (más que el bloqueo)
const t = (n) => 1000 + n * (BLOQUEO_MS + 100);

test('intento: una pieza correcta queda puesta y al llenar todas la palabra está completa', () => {
  let i = crearIntentoEscritura(visual(['ma', 'má']), 1000);
  let r = soltar(i, { fichaId: 'f0', hueco: 0, forma: 'arrastre' }, t(1));
  assert.equal(r.efecto, 'correcto');
  assert.equal(r.completo, false);
  assert.equal(r.intento.colocadas[0], 'f0');
  assert.equal(completo(r.intento), false);
  r = soltar(r.intento, { fichaId: 'f1', hueco: 1 }, t(2));
  assert.equal(r.efecto, 'correcto');
  assert.equal(r.completo, true);
  assert.equal(completo(r.intento), true);
  assert.equal(r.intento.estado, 'acertado');
  assert.equal(correctoAlPrimerIntento(r.intento), true);
  assert.deepEqual(r.intento.toques.map((x) => [x.texto, x.forma]), [['ma', 'arrastre'], ['má', 'toque']]);
  assert.deepEqual(r.intento.ordenLlenado, [0, 1]);
  assert.equal(r.intento.fin, t(2));
});

test('intento: se puede llenar en cualquier orden y se registra', () => {
  let i = crearIntentoEscritura(visual(['pa', 'ta', 'to']), 0);
  i = soltar(i, { fichaId: 'f2', hueco: 2 }, t(1)).intento;
  i = soltar(i, { fichaId: 'f0', hueco: 0 }, t(2)).intento;
  const r = soltar(i, { fichaId: 'f1', hueco: 1 }, t(3));
  assert.equal(r.completo, true);
  assert.deepEqual(r.intento.ordenLlenado, [2, 0, 1]);
});

test('intento: una pieza equivocada vuelve a su lugar, cuenta como error de esa caja y no se pierde nada', () => {
  const i = crearIntentoEscritura(visual(['ma', 'ta']), 0);
  const r = soltar(i, { fichaId: 'f2', hueco: 0, forma: 'arrastre' }, t(1)); // «te» en la caja de «ma»
  assert.equal(r.efecto, 'incorrecto');
  assert.deepEqual(r.intento.colocadas, [null, null]); // vuelve a su lugar: no queda en ninguna caja
  assert.deepEqual(r.intento.erroresPorHueco, [1, 0]);
  assert.deepEqual(r.intento.errores, [{ fichaId: 'f2', texto: 'te', hueco: 0 }]);
  assert.equal(r.intento.estado, 'ayuda');
  assert.equal(correctoAlPrimerIntento(r.intento), false);
  assert.equal(ayudaActual(r.intento), null); // con un solo error no se enciende la ayuda
  // y la misma pieza se puede volver a usar donde sí va
  const ok = soltar(r.intento, { fichaId: 'f0', hueco: 0 }, t(2));
  assert.equal(ok.efecto, 'correcto');
  assert.equal(ok.intento.estado, 'ayuda'); // sigue «con ayuda» hasta completar
});

test('intento: tras 2 errores en la MISMA caja se ilumina la pieza correcta; al ponerla la ayuda se apaga', () => {
  let i = crearIntentoEscritura(visual(['ma', 'ta'], ['te', 'ni']), 0);
  i = soltar(i, { fichaId: 'f2', hueco: 0 }, t(1)).intento;
  i = soltar(i, { fichaId: 'f3', hueco: 1 }, t(2)).intento; // error en OTRA caja: no suma a la primera
  assert.equal(ayudaActual(i), null);
  assert.equal(ERRORES_PARA_AYUDA, 2);
  i = soltar(i, { fichaId: 'f3', hueco: 0 }, t(3)).intento; // segundo error en la caja 0
  assert.deepEqual(ayudaActual(i), { hueco: 0, fichaId: 'f0' });
  assert.equal(i.conAyudaVisual, true);
  i = soltar(i, { fichaId: 'f0', hueco: 0 }, t(4)).intento;
  assert.equal(ayudaActual(i), null);
  assert.equal(i.conAyudaVisual, true); // queda anotado
  const fin = soltar(i, { fichaId: 'f1', hueco: 1 }, t(5));
  assert.equal(fin.completo, true);
  assert.equal(correctoAlPrimerIntento(fin.intento), false);
});

test('intento: una caja ya llena, una pieza ya puesta o algo que no existe se ignoran', () => {
  let i = crearIntentoEscritura(visual(['ma', 'ta']), 0);
  i = soltar(i, { fichaId: 'f0', hueco: 0 }, t(1)).intento;
  assert.equal(soltar(i, { fichaId: 'f2', hueco: 0 }, t(2)).efecto, 'ignorado'); // caja llena (no es un error)
  assert.equal(soltar(i, { fichaId: 'f0', hueco: 1 }, t(2)).efecto, 'ignorado'); // pieza ya puesta
  assert.equal(soltar(i, { fichaId: 'nada', hueco: 1 }, t(2)).efecto, 'ignorado');
  assert.equal(soltar(i, { fichaId: 'f1', hueco: 5 }, t(2)).efecto, 'ignorado');
  assert.equal(soltar(i, { fichaId: 'f1', hueco: -1 }, t(2)).efecto, 'ignorado');
  assert.equal(soltar(i, { fichaId: 'f1', hueco: 0.5 }, t(2)).efecto, 'ignorado');
  assert.equal(i.errores.length, 0);
  const listo = soltar(i, { fichaId: 'f1', hueco: 1 }, t(3)).intento;
  assert.equal(soltar(listo, { fichaId: 'f2', hueco: 0 }, t(4)).efecto, 'ignorado'); // ya terminó
});

test('intento: dos cajas con la misma sílaba aceptan cualquiera de las dos piezas iguales', () => {
  let i = crearIntentoEscritura(visual(['pa', 'pa'], []), 0);
  const r = soltar(i, { fichaId: 'f1', hueco: 0 }, t(1)); // la segunda pieza en la primera caja
  assert.equal(r.efecto, 'correcto');
  const fin = soltar(r.intento, { fichaId: 'f0', hueco: 1 }, t(2));
  assert.equal(fin.efecto, 'correcto');
  assert.equal(fin.completo, true);
  assert.equal(correctoAlPrimerIntento(fin.intento), true);
  // mayúsculas de la primera palabra de una oración: «Ma» es «ma»
  const m = crearIntentoEscritura({ huecos: ['Ma'], fichas: [{ id: 'f0', texto: 'ma', distractor: false }] }, 0);
  assert.equal(soltar(m, { fichaId: 'f0', hueco: 0 }, t(1)).efecto, 'correcto');
});

test('intento: un toque menos de 400 ms después del anterior (o de los primeros 400 ms) se ignora', () => {
  let i = crearIntentoEscritura(visual(['ma', 'ta']), 1000);
  assert.equal(soltar(i, { fichaId: 'f0', hueco: 0 }, 1000 + BLOQUEO_MS - 1).efecto, 'ignorado');
  const r = soltar(i, { fichaId: 'f0', hueco: 0 }, 1000 + BLOQUEO_MS);
  assert.equal(r.efecto, 'correcto');
  assert.equal(soltar(r.intento, { fichaId: 'f1', hueco: 1 }, r.intento.ultimoToque + 399).efecto, 'ignorado');
  assert.equal(soltar(r.intento, { fichaId: 'f1', hueco: 1 }, r.intento.ultimoToque + 400).efecto, 'correcto');
  // un error también bloquea el siguiente toque
  const e = soltar(crearIntentoEscritura(visual(['ma', 'ta']), 0), { fichaId: 'f2', hueco: 0 }, 500);
  assert.equal(soltar(e.intento, { fichaId: 'f0', hueco: 0 }, 800).efecto, 'ignorado');
});

test('intento: tocar una pieza solo para oírla se anota pero no es un error ni mueve el bloqueo', () => {
  let i = crearIntentoEscritura(visual(['ma', 'ta']), 1000);
  const r = escuchar(i, 'f2', 1300);
  assert.equal(r.efecto, 'escuchada');
  assert.deepEqual(r.intento.escuchasPieza, [{ texto: 'te', ms: 300 }]);
  assert.equal(r.intento.errores.length, 0);
  assert.equal(r.intento.ultimoToque, 1000); // no cuenta como toque válido
  assert.equal(r.intento.primerToque, null);
  assert.equal(escuchar(i, 'nada', 1300).efecto, 'ignorado');
  const ok = soltar(r.intento, { fichaId: 'f0', hueco: 0 }, 1400);
  assert.equal(ok.efecto, 'correcto');
  assert.equal(ok.intento.primerToque, 400);
});

test('intento: fichaCorrectaPara elige una pieza libre con el texto de la caja', () => {
  let i = crearIntentoEscritura(visual(['pa', 'pa'], ['te']), 0);
  assert.equal(fichaCorrectaPara(i, 1), 'f0');
  i = soltar(i, { fichaId: 'f0', hueco: 0 }, t(1)).intento;
  assert.equal(fichaCorrectaPara(i, 1), 'f1');
});

// ─── Nivel de sílabas extra: la misma regla del nivel de opciones ─────────────────────────────────────────────

test('nivel de extras: empieza en 0, sube 1 con >= 80 % de 10, baja 1 con < 50 % y respeta el máximo', () => {
  let n = nuevoNivelEscritura('p1', 'E02');
  assert.equal(n.extras, 0);
  assert.equal(n.id, idNivel('p1', 'E02'));
  const dar = (nivel, aciertos, max = 4) => {
    let x = nivel;
    for (let k = 0; k < 10; k++) x = registrarEnNivelEscritura(x, k < aciertos, max);
    return x;
  };
  n = dar(n, 8);
  assert.equal(n.extras, 1);
  assert.deepEqual(n.ultimos, []); // la ventana se reinicia al cambiar
  n = dar(n, 10);
  assert.equal(n.extras, 2);
  assert.equal(dar(n, 4).extras, 1); // < 50 %
  assert.equal(dar(n, 6).extras, 2); // entre 50 y 80: igual
  assert.equal(dar({ ...n, extras: 4 }, 10).extras, 4); // tope absoluto
  assert.equal(dar(n, 10, 2).extras, 2); // el máximo del adulto
  assert.equal(registrarEnNivelEscritura({ ...n, extras: 4 }, true, 1).extras, 1); // si bajó el máximo, se acota
  assert.equal(dar(nuevoNivelEscritura('p1', 'E02'), 0).extras, 0); // nunca por debajo de 0
});

test('ajustarNivel es la misma lógica que usa la lectura (y su resultado no cambió)', () => {
  let a = nuevoNivel('p1', 'L1');
  let b = nuevoNivel('p1', 'L1');
  for (let k = 0; k < 25; k++) {
    const ok = k % 5 !== 0;
    a = registrarEnNivel(a, ok, 3);
    b = ajustarNivel(b, ok, { min: 2, max: 3, tope: 4 });
  }
  assert.deepEqual(a, b);
  assert.ok(a.opciones >= 2 && a.opciones <= 3);
});

test('extrasEfectivos: automático (del nivel, con tope) o fijo si el adulto lo eligió', () => {
  const nivel = { extras: 3 };
  assert.equal(extrasEfectivos(nivel, perfilCon().ajustes), 3);
  assert.equal(extrasEfectivos(nivel, perfilCon({ maxSilabasExtra: 1 }).ajustes), 1);
  assert.equal(extrasEfectivos(undefined, perfilCon().ajustes), 0);
  assert.equal(extrasEfectivos(nivel, perfilCon({ silabasExtraManual: 4 }).ajustes), 3, 'el valor fijo solo vale con «Lo elijo yo»');
  assert.equal(extrasEfectivos(nivel, { escritura: { silabasExtraManual: 2 }, automaticos: { silabasExtra: false } }), 2);
  assert.equal(extrasEfectivos(nivel, { escritura: { silabasExtraManual: 0, maxSilabasExtra: 0 }, automaticos: { silabasExtra: false } }), 0);
});

// ─── Dominio, Leitner y «aprendida» sobre E* ───────────────────────────────────────────────────────────────────

const ensayoE = (progreso, dia, ok, extra = {}) => registrarEnsayo(progreso, { fecha: new Date(2026, 10, dia, 10), correctoAlPrimerIntento: ok, opciones: 3, ...extra }, { avanceRapido: extra.avance ?? false });

test('dominio sobre una palabra de escritura: 4 de 5 al primer intento en 2 días, y Leitner de 1 a 16 días', () => {
  let p = nuevoProgreso({ perfilId: 'p1', elementoId: 'esc:mamá', actividad: 'E02' });
  p = ensayoE(p, 1, true);
  p = ensayoE(p, 1, true);
  assert.equal(p.estado, ESTADOS.PRACTICA);
  p = ensayoE(p, 2, false);
  p = ensayoE(p, 2, true);
  p = ensayoE(p, 2, true);
  assert.equal(p.estado, ESTADOS.DOMINADA);
  assert.equal(p.proximoRepaso, '2026-11-03');
  p = ensayoE(p, 3, true);
  assert.equal(p.cajaLeitner, 2);
  assert.equal(p.proximoRepaso, '2026-11-05');
});

test('avance rápido en escritura: 3 primeros ensayos perfectos con 2 piezas o más → dominada provisional; con 1 pieza no cuentan', () => {
  let p = nuevoProgreso({ perfilId: 'p1', elementoId: 'esc:mamá', actividad: 'E02' });
  for (let k = 0; k < 3; k++) p = registrarEnsayo(p, { fecha: new Date(2026, 10, 1, 10, k), correctoAlPrimerIntento: true, opciones: 1 }, { avanceRapido: true });
  assert.equal(p.estado, ESTADOS.PRACTICA, 'una sola pieza es trivial: no acelera');
  let q = nuevoProgreso({ perfilId: 'p1', elementoId: 'esc:papá', actividad: 'E02' });
  for (let k = 0; k < 3; k++) q = aplicarResultadoEscritura({ progreso: q, nivel: nuevoNivelEscritura('p1', 'E02'), resultado: { fecha: new Date(2026, 10, 1, 10, k), correctoAlPrimerIntento: true, opciones: 2 }, avanceRapido: true }).progreso;
  assert.equal(q.estado, ESTADOS.DOMINADA);
  assert.equal(q.provisional, true);
});

test('«aprendida» en escritura: dominada de verdad y un repaso acertado en la caja 5 (la misma estaAprendida de la lectura)', () => {
  let p = { ...nuevoProgreso({ perfilId: 'p1', elementoId: 'esc:mamá', actividad: 'E02' }), estado: ESTADOS.DOMINADA, cajaLeitner: 5, proximoRepaso: '2026-11-01', historial: [] };
  assert.equal(estaAprendida([p]), false);
  p = ensayoE(p, 5, true);
  assert.equal(p.aciertosEnCaja5, 1);
  assert.equal(estaAprendida([p]), true);
});

test('aplicarResultadoEscritura: los ensayos fáciles no mueven el nivel de extras', () => {
  const n0 = nuevoNivelEscritura('p1', 'E02');
  const r = aplicarResultadoEscritura({ progreso: nuevoProgreso({ perfilId: 'p1', elementoId: 'a', actividad: 'E02' }), nivel: n0, resultado: { fecha: HOY, correctoAlPrimerIntento: true, opciones: 2, esFacil: true }, contarParaNivel: false });
  assert.deepEqual(r.nivel, n0);
  assert.equal(r.progreso.historial[0].esFacil, true);
});

// ─── Sesión ────────────────────────────────────────────────────────────────────────────────────────────────────

const PRACTICADOS = delNivel('E02').map((e) => dominada(e)); // todo E02 ya dominado y vencido

test('sesión de escritura: 6 palabras por defecto, máximo 2 nuevas, ~30 % de repaso de niveles anteriores', () => {
  const plan = crearSesionEscritura({ perfil: perfilCon(), palabras: elementos, progresos: PRACTICADOS, nivel: 'E03', hoy: HOY, aleatorio: crearAleatorio(7) });
  assert.equal(plan.tipo, 'escritura');
  assert.equal(plan.nivel, 'E03');
  assert.equal(plan.ensayos.length, 6);
  const nuevas = new Set(plan.ensayos.filter((e) => e.tipo === 'nueva').map((e) => e.elementoId));
  assert.ok(nuevas.size >= 1 && nuevas.size <= 2, `nuevas: ${nuevas.size}`);
  const repasos = plan.ensayos.filter((e) => e.tipo === 'repaso');
  assert.equal(repasos.length, 2); // 30 % de 6, redondeado
  assert.ok(repasos.every((e) => e.actividad === 'E02'), 'los repasos son de niveles anteriores');
  assert.ok(plan.ensayos.filter((e) => e.tipo !== 'repaso').every((e) => e.actividad === 'E03'), 'la práctica es del nivel elegido');
  assert.equal(plan.ensayos[0].esFacil, true, 'abre con algo que ya sabe');
  assert.ok(plan.ensayos.filter((e) => e.esFacil).every((e) => e === plan.ensayos[0] || e === plan.ensayos.at(-1)), 'solo la primera y la última son fáciles');
  for (let i = 1; i < 6; i++) assert.notEqual(plan.ensayos[i].elementoId, plan.ensayos[i - 1].elementoId, 'sin repetir seguidas');
  assert.ok(plan.reservaFacil.length > 0);
  assert.ok(plan.reservaFacil.every((e) => e.extras === 0 && e.tipo === 'cierre'));
  assert.ok(plan.ensayos.every((e) => !('distractorIds' in e) && Number.isInteger(e.extras)));
});

test('sesión: los niveles anteriores NO se practican, solo se repasan (y las no dominadas no entran)', () => {
  const plan = crearSesionEscritura({ perfil: perfilCon(), palabras: elementos, progresos: [], nivel: 'E04', hoy: HOY, aleatorio: crearAleatorio(3) });
  assert.ok(plan.ensayos.every((e) => e.actividad === 'E04'), 'sin nada dominado, todo es del nivel elegido');
  assert.equal(plan.ensayos.filter((e) => e.tipo === 'repaso').length, 0);
});

test('sesión: palabrasPorSesion del adulto (4 a 12) manda sobre los ensayos de la lectura', () => {
  const n = (palabras, ensayos = 8) => crearSesionEscritura({ perfil: perfilCon({ palabrasPorSesion: palabras }, { ensayosPorSesion: ensayos }), palabras: elementos, progresos: PRACTICADOS, nivel: 'E03', hoy: HOY, aleatorio: crearAleatorio(2) }).ensayos.length;
  assert.equal(n(4), 4);
  assert.equal(n(10, 4), 10);
  assert.equal(n(99), 12);
  assert.equal(n(1), 4);
});

test('sesión: sílabas extra según el nivel de cada palabra, 0 en los ensayos fáciles y fijas con «Lo elijo yo»', () => {
  const niveles = [{ ...nuevoNivelEscritura('p1', 'E03'), extras: 3 }, { ...nuevoNivelEscritura('p1', 'E02'), extras: 2 }];
  const plan = crearSesionEscritura({ perfil: perfilCon(), palabras: elementos, progresos: PRACTICADOS, niveles, nivel: 'E03', hoy: HOY, aleatorio: crearAleatorio(7) });
  for (const e of plan.ensayos) {
    const esperado = e.esFacil ? 0 : e.actividad === 'E03' ? 3 : 2;
    assert.equal(e.extras, esperado, `${e.elementoId} ${e.actividad}`);
  }
  assert.ok(plan.ensayos.some((e) => e.extras > 0));
  const tope = crearSesionEscritura({ perfil: perfilCon({ maxSilabasExtra: 1 }), palabras: elementos, progresos: PRACTICADOS, niveles, nivel: 'E03', hoy: HOY, aleatorio: crearAleatorio(7) });
  assert.ok(tope.ensayos.every((e) => e.extras <= 1));
  const fijo = crearSesionEscritura({ perfil: perfilCon({ silabasExtraManual: 4 }, { automaticos: { silabasExtra: false } }), palabras: elementos, progresos: PRACTICADOS, niveles, nivel: 'E03', hoy: HOY, aleatorio: crearAleatorio(7) });
  assert.ok(fijo.ensayos.filter((e) => !e.esFacil).every((e) => e.extras === 4));
  assert.ok(fijo.ensayos.filter((e) => e.esFacil).every((e) => e.extras === 0));
});

test('sesión: sin nivel pedido usa el efectivo (el del perfil, saltando bloqueados y los que tienen pocas palabras)', () => {
  const plan = crearSesionEscritura({ perfil: perfilCon({ nivelEscritura: 'E05', nivelesBloqueados: ['E05'] }), palabras: elementos, hoy: HOY, aleatorio: crearAleatorio(1) });
  assert.equal(plan.nivel, 'E06');
  const vacia = crearSesionEscritura({ perfil: perfilCon(), palabras: [], hoy: HOY });
  assert.equal(vacia.ensayos.length, 0);
  assert.equal(vacia.nivel, null);
});

test('sesión: ignora las palabras apagadas del banco y la lectura no estorba', () => {
  const apagadas = delNivel('E02').slice(0, 5).map((e) => e.id);
  const todos = elementosDeEscritura({ banco, bancoApagado: apagadas });
  assert.ok(apagadas.every((id) => todos.find((e) => e.id === id).activa === false));
  const plan = crearSesionEscritura({ perfil: perfilCon(), palabras: todos, progresos: [progresoCon('mamá', 'L1', ESTADOS.DOMINADA)], nivel: 'E02', hoy: HOY, aleatorio: crearAleatorio(5) });
  assert.ok(plan.ensayos.every((e) => !apagadas.includes(e.elementoId) && e.actividad === 'E02'));
});

test('la fatiga: con 3 palabras seguidas con error, la siguiente es una ya dominada con 0 extras y la sesión termina', () => {
  const niveles = [{ ...nuevoNivelEscritura(PERFIL_ID, 'E03'), extras: 3 }, { ...nuevoNivelEscritura(PERFIL_ID, 'E02'), extras: 3 }];
  const ctl = crearControladorEscritura({ perfil: perfilCon({ silabasExtraManual: 3 }, { automaticos: { silabasExtra: false } }), palabras: elementos, progresos: PRACTICADOS, niveles, nivel: 'E03', hoy: HOY, aleatorio: crearAleatorio(11) });
  let ms = 0;
  let visualActual = ctl.iniciar(ms);
  let errores = 0;
  while (!ctl.terminada && errores < 3) {
    ms = jugarEnsayo(ctl, ms, { errar: true });
    const sig = ctl.avanzar(ms);
    errores += 1;
    visualActual = sig.siguiente;
  }
  assert.equal(ctl.fatiga, true);
  assert.equal(ctl.terminada, false);
  assert.ok(visualActual, 'queda un ensayo de cierre');
  assert.equal(visualActual.ensayo.tipo, 'cierre');
  assert.equal(visualActual.extras, 0);
  assert.equal(visualActual.ensayo.esFacil, true);
  ms = jugarEnsayo(ctl, ms, {});
  const fin = ctl.avanzar(ms);
  assert.equal(fin.terminada, true);
  assert.equal(fin.fatiga, true);
  assert.equal(ctl.registro({ inicio: HOY, fin: HOY }).fatiga, true);
});

// ─── Piezas por palabra o por sílaba (oraciones) ──────────────────────────────────────────────────────────────

test('armarEnsayoEscritura: la oración va por palabras o por sílabas según piezasOracion', () => {
  const frase = elementos.find((e) => e.nivel === 'E18');
  const ensayo = { elementoId: frase.id, actividad: 'E18', extras: 2, tipo: 'practica' };
  const palabras = armarEnsayoEscritura({ ensayo, elemento: frase, ajustes: perfilCon({ piezasOracion: 'palabras' }).ajustes, aleatorio: crearAleatorio(1) });
  assert.equal(palabras.unidad, 'palabra');
  assert.equal(palabras.huecos.length, frase.palabra.palabras.length);
  assert.equal(palabras.extras, 2);
  assert.equal(palabras.opciones, palabras.huecos.length + 2);
  const silabas = armarEnsayoEscritura({ ensayo, elemento: frase, ajustes: perfilCon({ piezasOracion: 'silabas' }).ajustes, aleatorio: crearAleatorio(1) });
  assert.equal(silabas.unidad, 'silaba');
  assert.equal(silabas.porSilabas, true);
  assert.equal(silabas.huecos.length, frase.palabra.palabras.reduce((s, p) => s + p.silabas.length, 0));
  assert.equal(silabas.inicioDePalabra.filter(Boolean).length, frase.palabra.palabras.length); // el espacio visible entre palabras
  assert.ok(silabas.huecos.length > palabras.huecos.length);
  // por defecto, por palabras
  assert.equal(armarEnsayoEscritura({ ensayo, elemento: frase, ajustes: {}, aleatorio: crearAleatorio(1) }).unidad, 'palabra');
});

test('elementosDeEscritura: perfil primero, banco completa; E20 son las mismas palabras sin imagen; E19 una palabra que falta', () => {
  const mamá = { id: 'w1', texto: 'mamá', silabas: ['ma', 'má'], emoji: '👩', activa: true };
  const chocolate = { id: 'w2', texto: 'chocolate', silabas: ['cho', 'co', 'la', 'te'], emoji: '🍫', activa: true };
  const sinImagen = { id: 'w3', texto: 'zapato', silabas: ['za', 'pa', 'to'], activa: true };
  const borrada = { id: 'w4', texto: 'sapo', silabas: ['sa', 'po'], emoji: '🐸', deleted: true };
  const todos = elementosDeEscritura({ palabras: [mamá, chocolate, sinImagen, borrada], banco });
  const m = todos.filter((e) => e.texto === 'mamá' && e.nivel !== 'E20');
  assert.equal(m.length, 1, 'la del perfil gana sobre la del banco');
  assert.equal(m[0].id, 'w1');
  assert.equal(m[0].origen, 'perfil');
  assert.equal(todos.find((e) => e.id === 'w2').nivel, 'E03'); // CH, aunque tenga 4 sílabas
  assert.equal(todos.some((e) => e.id === 'w3' || e.id === 'w4'), false, 'sin imagen o borrada no entra');
  assert.ok(todos.filter((e) => e.nivel === 'E20').every((e) => e.dictado === true));
  assert.ok(todos.filter((e) => e.nivel === 'E19').every((e) => e.palabra.silabas?.length && e.frases?.length));
  const e01 = todos.filter((e) => e.nivel === 'E01');
  assert.ok(e01.length >= 5);
  assert.ok(e01.every((e) => e.id.startsWith('esc:') && e.modelo));
  // ids únicos por (id, nivel)
  const claves = todos.map((e) => `${e.id}:${e.nivel}`);
  assert.equal(new Set(claves).size, claves.length);
  // una frase del perfil se arma con sus palabras
  const frase = { id: 'fr1', palabraIds: ['w1', 'w2'], texto: 'mamá chocolate', activa: true };
  const conFrase = elementosDeEscritura({ palabras: [mamá, chocolate], frases: [frase], banco: {} });
  const fe = conFrase.find((e) => e.id === 'fr1');
  assert.equal(fe.nivel, 'E18');
  assert.deepEqual(fe.palabra.palabras.map((p) => p.texto), ['mamá', 'chocolate']);
});

test('niveles disponibles, efectivo, siguiente y elegibles (bloqueados, forzados y poca cantidad)', () => {
  const cuenta = palabrasPorNivel(elementos);
  assert.ok(cuenta.E02 >= 12 && cuenta.E13 >= 4);
  const disponibles = nivelesDisponibles(elementos);
  assert.ok(disponibles.includes('E01') && disponibles.includes('E17'));
  const pocos = ['E01', 'E02', 'E04'];
  assert.equal(nivelEfectivo({ nivelEscritura: 'E03', disponibles: pocos }), 'E04', 'sin palabras suficientes se salta');
  assert.equal(nivelEfectivo({ nivelEscritura: 'E02', disponibles: pocos, bloqueados: ['E02'] }), 'E04');
  assert.equal(nivelEfectivo({ nivelEscritura: 'E05', disponibles: pocos }), 'E04', 'si no hay más arriba, el anterior');
  assert.equal(nivelEfectivo({ nivelEscritura: 'E03', disponibles: pocos, forzados: ['E03'] }), 'E03');
  assert.equal(nivelEfectivo({ nivelEscritura: 'E01', disponibles: [] }), null);
  assert.equal(siguienteNivelAbierto({ nivel: 'E02', disponibles: pocos }), 'E04');
  assert.equal(siguienteNivelAbierto({ nivel: 'E04', disponibles: pocos }), null);
  assert.deepEqual(nivelesElegibles({ eleccionNino: 'alcanzados', nivelActual: 'E04', disponibles: ['E01', 'E02', 'E03', 'E04', 'E05'], bloqueados: ['E02'] }), ['E01', 'E03', 'E04']);
  assert.deepEqual(nivelesElegibles({ eleccionNino: 'todos', nivelActual: 'E01', disponibles: ['E01', 'E02'] }), ['E01', 'E02']);
  assert.deepEqual(nivelesElegibles({ eleccionNino: 'ninguno', nivelActual: 'E04', disponibles: ['E01'] }), []);
  assert.deepEqual(nivelesElegibles({ eleccionNino: 'alcanzados', nivelActual: 'E02', disponibles: ['E01', 'E02', 'E06'], forzados: ['E06'] }), ['E01', 'E02', 'E06']);
});

// ─── Registro fino ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Juega un ensayo del controlador: pone cada pieza en su caja (o, si `errar`, primero una equivocada en la caja 0).
 * Devuelve el ms actual. Cada gesto va 500 ms después del anterior.
 */
function jugarEnsayo(ctl, msInicial, { errar = false, oir = false } = {}) {
  let ms = msInicial;
  const v = ctl.actual();
  const libres = () => ctl.intento().fichas.filter((f) => !ctl.intento().colocadas.includes(f.id));
  if (oir) { ctl.oirOtraVez(); ctl.escuchar(v.fichas[0].id, ms + 50); }
  if (errar) {
    const mala = libres().find((f) => f.texto.toLowerCase() !== v.huecos[0].toLowerCase());
    if (mala) { ms += 500; ctl.soltar({ fichaId: mala.id, hueco: 0, forma: 'arrastre' }, ms); }
  }
  for (let h = 0; h < v.huecos.length; h++) {
    const ficha = libres().find((f) => f.texto.toLowerCase() === v.huecos[h].toLowerCase());
    ms += 500;
    ctl.soltar({ fichaId: ficha.id, hueco: h, forma: errar ? 'toque' : 'arrastre' }, ms);
  }
  return ms + 500;
}

test('controlador de escritura: una sesión completa guarda progreso, nivel y respuesta de cada palabra', () => {
  const ctl = crearControladorEscritura({
    perfil: perfilCon({ palabrasPorSesion: 4 }), palabras: elementos, nivel: 'E02', hoy: HOY, aleatorio: crearAleatorio(21), sesionId: 'ses1', reloj: () => HOY,
  });
  assert.equal(ctl.esPrueba, false);
  let ms = 1000;
  let v = ctl.iniciar(ms);
  const guardados = [];
  let fin = null;
  while (v) {
    ms = jugarEnsayo(ctl, ms, { errar: guardados.length === 1, oir: guardados.length === 2 });
    const r = ctl.avanzar(ms);
    guardados.push(r.guardar);
    v = r.siguiente;
    fin = r;
  }
  assert.equal(fin.terminada, true);
  assert.equal(guardados.length, 4);
  const r1 = guardados[1].respuesta;
  assert.equal(r1.modo, 'escritura');
  assert.equal(r1.correctoAlPrimerIntento, false);
  assert.ok(r1.errores.length >= 1 || r1.huecos.length === 1);
  assert.equal(guardados[0].respuesta.id, 'ses1:1');
  assert.equal(guardados[0].respuesta.primeraVez, true);
  assert.equal(guardados[3].respuesta.id, 'ses1:4');
  assert.equal(guardados[2].respuesta.repeticionesAudio, 1);
  assert.equal(guardados[2].respuesta.escuchasPieza.length, 1);
  for (const g of guardados) {
    assert.equal(g.progreso.perfilId, PERFIL_ID);
    assert.match(g.progreso.id, /^p1:.+:E02$/);
    assert.ok(g.progreso.historial.length >= 1);
    assert.equal(g.nivel.actividad, 'E02');
    assert.ok('extras' in g.nivel && !('opciones' in g.nivel));
  }
  const sesion = ctl.registro({ inicio: HOY, fin: HOY });
  assert.equal(sesion.tipo, 'escritura');
  assert.equal(sesion.nivel, 'E02');
  assert.equal(sesion.ensayos.length, 4);
  assert.equal(esDeEscritura(sesion), true);
  assert.equal('nivelElegidoPorNino' in sesion, false);
  assert.equal(crearControladorEscritura({ perfil: perfilCon(), palabras: elementos, nivel: 'E02', nivelElegidoPorNino: true, hoy: HOY }).registro({ inicio: HOY, fin: HOY }).nivelElegidoPorNino, true);
  assert.equal(ctl.resumen().total, 4);
});

test('registro de escritura: todos los campos de la fase 12 más los propios', () => {
  const ctl = crearControladorEscritura({
    perfil: perfilCon({ silabasExtraManual: 2 }, { automaticos: { silabasExtra: false } }), palabras: elementos, nivel: 'E03', hoy: HOY, aleatorio: crearAleatorio(4), sesionId: 'sx', reloj: () => new Date(2026, 10, 5, 15, 30),
  });
  let ms = 0;
  ctl.iniciar(ms);
  const v = ctl.actual();
  ms = jugarEnsayo(ctl, ms, { errar: v.huecos.length > 1, oir: true });
  const { guardar } = ctl.avanzar(ms);
  const r = guardar.respuesta;
  for (const campo of ['id', 'perfilId', 'sesionId', 'fecha', 'dia', 'hora', 'diaSemana', 'numeroEnSesion', 'elementoId', 'texto', 'esFrase', 'categoria', 'silabas',
    'etapa', 'actividad', 'tipo', 'esFacil', 'opciones', 'posicionCorrecta', 'nivelOpciones', 'correctoAlPrimerIntento', 'intentos', 'errores', 'msPrimerToque',
    'msAcierto', 'distraido', 'repeticionesAudio', 'conAyudaVisual', 'estadoAntes', 'estadoDespues', 'cajaLeitnerAntes', 'cajaLeitnerDespues', 'fatigaActiva']) {
    assert.ok(campo in r, `falta ${campo}`);
  }
  for (const campo of ['modo', 'unidad', 'huecos', 'fichas', 'extras', 'toques', 'escuchasPieza', 'erroresPorHueco', 'ordenLlenado', 'primeraVez', 'nivelExtras']) assert.ok(campo in r, `falta ${campo}`);
  assert.equal(r.modo, 'escritura');
  assert.equal(r.actividad, 'E03');
  assert.equal(r.etapa, null);
  assert.equal(r.nivelOpciones, null);
  assert.equal(r.hora, 15);
  assert.equal(r.unidad, 'silaba');
  assert.equal(r.huecos.length, v.huecos.length);
  assert.equal(r.fichas.length, v.fichas.length);
  assert.equal(r.fichas.filter((f) => f.distractor).length, r.extras);
  assert.equal(r.nivelExtras, 2);
  assert.equal(r.toques.length, r.huecos.length + r.errores.length);
  assert.equal(r.ordenLlenado.length, r.huecos.length);
  assert.equal(r.erroresPorHueco.reduce((a, b) => a + b, 0), r.errores.length);
  assert.equal(r.conAyudaVisual, false); // un solo error no enciende la ayuda
  assert.equal(r.repeticionesAudio, 1);
  assert.equal(r.escuchasPieza.length, 1);
  assert.equal(esDeEscritura(r), true);
  assert.equal(r.estadoAntes, 'nueva');
  assert.equal(r.estadoDespues, 'practica');
  for (const e of r.errores) assert.deepEqual(Object.keys(e).sort(), ['hueco', 'id', 'ms', 'texto']);
  assert.throws(() => construirRespuestaEscritura({ perfilId: 'p', sesionId: 's', numeroEnSesion: 1, fecha: HOY, ensayo: {}, elemento: {}, visual: {}, intento: { estado: 'ayuda' } }));
});

test('el controlador no deja avanzar un ensayo sin resolver y las llamadas sueltas no rompen', () => {
  const ctl = crearControladorEscritura({ perfil: perfilCon(), palabras: elementos, nivel: 'E02', hoy: HOY, aleatorio: crearAleatorio(1) });
  assert.deepEqual(ctl.soltar({ fichaId: 'f0', hueco: 0 }, 0).efecto, 'ignorado'); // antes de iniciar
  assert.equal(ctl.escuchar('f0', 0).efecto, 'ignorado');
  ctl.iniciar(0);
  assert.throws(() => ctl.avanzar(1000), /aún no se resolvió/);
  const vacio = crearControladorEscritura({ perfil: perfilCon(), palabras: [], hoy: HOY });
  assert.equal(vacio.terminada, true);
  assert.equal(vacio.iniciar(0), null);
});

// ─── Ajustes de escritura ─────────────────────────────────────────────────────────────────────────────────────

test('ajustes.escritura: valores por defecto de la aprobación (tocar, suave, palabras) y límites', () => {
  const e = normalizarAjustes().escritura;
  assert.deepEqual(e, {
    habilitada: false, nivelEscritura: 'E01', palabrasPorSesion: 6, maxSilabasExtra: 4, silabasExtraManual: null, colorError: 'suave', formaDeMover: 'tocar',
    eleccionNino: 'alcanzados', piezasOracion: 'palabras', nivelesForzados: [], nivelesBloqueados: [], bancoApagado: [],
  });
  assert.deepEqual(normalizarAjustes().automaticos, { ensayosPorSesion: true, maxOpciones: true, etapa: true, palabrasNuevas: true, nivelEscritura: true, palabrasEscritura: true, silabasExtra: true });
  assert.deepEqual(AJUSTES_POR_DEFECTO.escritura, e);
  const raro = normalizarAjustesEscritura({
    habilitada: 1, nivelEscritura: 'E99', palabrasPorSesion: 1, maxSilabasExtra: 9, silabasExtraManual: '7', colorError: 'rosa', formaDeMover: 'volar', eleccionNino: 'x',
    piezasOracion: 'letras', nivelesBloqueados: ['E03', 'E03', 'E99', 'E05'], nivelesForzados: ['E05', 'E40'], bancoApagado: ['esc:sol', 3, '', 'esc:sol'],
  });
  assert.equal(raro.habilitada, true);
  assert.equal(raro.nivelEscritura, 'E01');
  assert.equal(raro.palabrasPorSesion, 4);
  assert.equal(raro.maxSilabasExtra, 4);
  assert.equal(raro.silabasExtraManual, 4);
  assert.equal(raro.colorError, 'suave');
  assert.equal(raro.formaDeMover, 'tocar');
  assert.equal(raro.eleccionNino, 'alcanzados');
  assert.equal(raro.piezasOracion, 'palabras');
  assert.deepEqual(raro.nivelesBloqueados, ['E03']); // lo forzado gana sobre lo bloqueado
  assert.deepEqual(raro.nivelesForzados, ['E05']);
  assert.deepEqual(raro.bancoApagado, ['esc:sol']);
  assert.equal(normalizarAjustes({ escritura: { palabrasPorSesion: 99 } }).escritura.palabrasPorSesion, 12);
  assert.equal(normalizarAjustes({ escritura: { maxSilabasExtra: -3 } }).escritura.maxSilabasExtra, 0);
  assert.equal(normalizarAjustes({ escritura: { silabasExtraManual: 0 } }).escritura.silabasExtraManual, 0);
  assert.equal(normalizarAjustes({ escritura: 'basura' }).escritura.palabrasPorSesion, 6);
  assert.deepEqual(normalizarAjustes(normalizarAjustes({ escritura: { formaDeMover: 'arrastrar', colorError: 'rojo' } })).escritura.formaDeMover, 'arrastrar');
  assert.equal(normalizarAjustes({ escritura: { colorError: 'rojo' } }).escritura.colorError, 'rojo');
});

// ─── Curso y alumno ───────────────────────────────────────────────────────────────────────────────────────────

test('curso y alumno: el nivel y las palabras por sesión de escritura son del alumno; todo lo demás, del curso', () => {
  assert.deepEqual(Object.keys(AJUSTES_DE_ESCRITURA_DEL_ALUMNO).sort(), ['nivelEscritura', 'palabrasPorSesion']);
  const curso = { id: 'C1', nombre: 'Curso', ajustes: { escritura: { habilitada: true, nivelEscritura: 'E01', palabrasPorSesion: 6, formaDeMover: 'arrastrar', maxSilabasExtra: 2 }, automaticos: {} } };
  const propio = { id: 'C1', ajustes: { escritura: { nivelEscritura: 'E05', palabrasPorSesion: 8, habilitada: false, formaDeMover: 'tocar' } } };
  const mezcla = combinarPerfil(curso, propio);
  assert.equal(mezcla.ajustes.escritura.nivelEscritura, 'E05'); // del alumno
  assert.equal(mezcla.ajustes.escritura.palabrasPorSesion, 8);
  assert.equal(mezcla.ajustes.escritura.habilitada, true); // del curso: el alumno no lo puede cambiar
  assert.equal(mezcla.ajustes.escritura.formaDeMover, 'arrastrar');
  assert.equal(mezcla.ajustes.escritura.maxSilabasExtra, 2);
  // con «Lo elijo yo» manda el curso
  const manual = { ...curso, ajustes: { ...curso.ajustes, escritura: { ...curso.ajustes.escritura, nivelEscritura: 'E03' }, automaticos: { nivelEscritura: false } } };
  const m2 = combinarPerfil(manual, propio);
  assert.equal(m2.ajustes.escritura.nivelEscritura, 'E03');
  assert.equal(m2.ajustes.escritura.palabrasPorSesion, 8);
  // lo que publica el alumno: solo lo suyo
  const pub = perfilPublicable({ ...curso, ajustes: { ...curso.ajustes, escritura: { habilitada: true, nivelEscritura: 'E04', palabrasPorSesion: 7, bancoApagado: ['esc:sol'] } } });
  assert.deepEqual(pub.ajustes.escritura, { nivelEscritura: 'E04', palabrasPorSesion: 7 });
  const sinAuto = perfilPublicable({ ...curso, ajustes: { ...curso.ajustes, automaticos: { nivelEscritura: false, palabrasEscritura: false } } });
  assert.equal('escritura' in sinAuto.ajustes, false);
  assert.equal(JSON.stringify(pub).includes('bancoApagado'), false);
});

// ─── Ficha de prueba ───────────────────────────────────────────────────────────────────────────────────────────

test('ficha de prueba: id determinista, lee el contenido del perfil y se reconoce', () => {
  assert.equal(idDePrueba('P1'), 'prueba:P1');
  assert.equal(esIdDePrueba('prueba:P1'), true);
  assert.equal(esIdDePrueba('prueba:'), false);
  assert.equal(esIdDePrueba('ficha:P1:a@b.c'), false);
  assert.equal(esIdDePrueba(null), false);
  assert.equal(perfilDePrueba('prueba:P1'), 'P1');
  assert.equal(perfilDePrueba('P1'), null);
  const f = fichaDePrueba({ id: 'P1', nombre: 'Curso' });
  assert.equal(f.id, 'prueba:P1');
  assert.equal(f.nombre, 'Perfil de prueba');
  assert.equal(contenidoDe(f), 'P1'); // las palabras, frases y libros son los del perfil real
  assert.deepEqual(fichaDePrueba('P1'), f);
  assert.throws(() => fichaDePrueba(null));
  assert.equal(esDePrueba({ perfilId: 'prueba:P1' }), true);
  assert.equal(esDePrueba({ perfilId: 'P1' }), false);
  const regs = [{ id: 1, perfilId: 'P1' }, { id: 2, perfilId: 'prueba:P1' }, { id: 3, perfilId: 'prueba:P2' }];
  assert.deepEqual(registrosDePrueba(regs, 'P1').map((r) => r.id), [2]);
  assert.deepEqual(registrosDePrueba(regs).map((r) => r.id), [2, 3]);
  for (const a of ['progresos', 'niveles', 'sesiones', 'respuestas', 'calcomanias', 'movimientos']) assert.ok(ALMACENES_DE_FICHA.includes(a));
});

test('una sesión de prueba guarda todo con perfilId prueba:<perfil> y no se parece en nada al avance real', () => {
  const ctl = crearControladorEscritura({
    perfil: perfilCon({ palabrasPorSesion: 4 }), perfilId: idDePrueba(PERFIL_ID), palabras: elementos, nivel: 'E02', hoy: HOY, aleatorio: crearAleatorio(2), sesionId: 'sp',
  });
  assert.equal(ctl.esPrueba, true);
  let ms = 0;
  let v = ctl.iniciar(ms);
  const guardados = [];
  while (v) {
    ms = jugarEnsayo(ctl, ms, {});
    const r = ctl.avanzar(ms);
    guardados.push(r.guardar);
    v = r.siguiente;
  }
  const sesion = ctl.registro({ inicio: HOY, fin: HOY });
  assert.equal(sesion.perfilId, 'prueba:p1');
  for (const g of guardados) {
    assert.equal(g.progreso.perfilId, 'prueba:p1');
    assert.match(g.progreso.id, /^prueba:p1:/);
    assert.equal(g.nivel.perfilId, 'prueba:p1');
    assert.equal(g.nivel.id, idNivel('prueba:p1', g.nivel.actividad));
    assert.equal(g.respuesta.perfilId, 'prueba:p1');
  }
  assert.ok([...guardados.map((g) => g.progreso), ...guardados.map((g) => g.respuesta), sesion].every(esDePrueba));
  // los progresos del perfil real no cambian lo que la prueba ve: su ficha parte de cero
  const real = [dominada(delNivel('E02')[0])];
  const conPrueba = crearControladorEscritura({ perfil: perfilCon(), perfilId: 'prueba:p1', palabras: elementos, progresos: real.map((p) => ({ ...p, perfilId: 'prueba:p1', id: idProgreso('prueba:p1', p.elementoId, p.actividad) })), nivel: 'E02', hoy: HOY });
  assert.ok(conPrueba.plan.ensayos.some((e) => e.tipo === 'repaso' || e.tipo === 'practica'));
});

test('el autoajuste de escritura ignora al perfil de prueba y las sesiones de otros perfiles', () => {
  const sesion = (i, perfilId, extra = {}) => ({ id: `s${i}`, perfilId, tipo: 'escritura', nivel: 'E01', inicio: new Date(2026, 10, i, 10).toISOString(), fin: new Date(2026, 10, i, 10, 4).toISOString(), ensayos: Array.from({ length: 6 }, () => ({ correctoAlPrimerIntento: true })), ...extra });
  const sesionesPrueba = [1, 2, 3].map((i) => sesion(i, 'prueba:p1'));
  const real = evaluarAutoajusteEscritura({ perfil: { ...perfilCon(), id: 'p1' }, sesiones: sesionesPrueba, elementos, hoy: HOY });
  assert.deepEqual(real.cambios, [], 'las sesiones de prueba no cuentan para el perfil real');
  const prueba = evaluarAutoajusteEscritura({ perfil: { ...perfilCon(), id: 'prueba:p1' }, sesiones: sesionesPrueba, elementos, hoy: HOY });
  assert.deepEqual(prueba.cambios, [], 'la ficha de prueba no se autoajusta');
  const propias = evaluarAutoajusteEscritura({ perfil: perfilCon(), sesiones: [1, 2, 3].map((i) => sesion(i, 'p1')), elementos, hoy: HOY });
  assert.ok(propias.cambios.some((c) => c.ajuste === 'palabrasEscritura'));
});

// ─── Autoajuste de escritura ───────────────────────────────────────────────────────────────────────────────────

const sesionE = (i, { ok = 6, de = 6, minutos = 5, nivel = 'E02', fatiga = false, interrumpida = false } = {}) => ({
  id: `se${i}`, perfilId: PERFIL_ID, tipo: 'escritura', nivel, fatiga, interrumpida,
  inicio: new Date(2026, 10, i, 10).toISOString(), fin: new Date(2026, 10, i, 10, minutos).toISOString(),
  ensayos: Array.from({ length: de }, (_, k) => ({ tipo: 'practica', actividad: nivel, correctoAlPrimerIntento: k < ok })),
});
const TRES = (opciones) => [1, 2, 3].map((i) => sesionE(i, opciones));
const dominadasDeNivel = (nivel, cuantas) => delNivel(nivel).map((e, i) => (i < cuantas ? dominada(e) : null)).filter(Boolean);
const HOY_AUTO = new Date(2026, 10, 10, 12);

test('autoajuste de escritura: sube el nivel con >= 80 % de las palabras del nivel dominadas', () => {
  const total = delNivel('E02').length;
  const perfil = perfilCon({ nivelEscritura: 'E02' });
  const casi = evaluarAutoajusteEscritura({ perfil, sesiones: [], elementos, progresos: dominadasDeNivel('E02', Math.ceil(total * 0.8) - 1), hoy: HOY_AUTO });
  assert.equal(casi.cambios.length, 0);
  const r = evaluarAutoajusteEscritura({ perfil, sesiones: [], elementos, progresos: dominadasDeNivel('E02', Math.ceil(total * 0.8)), hoy: HOY_AUTO });
  assert.equal(r.cambios.length, 1);
  assert.equal(r.cambios[0].ajuste, 'nivelEscritura');
  assert.equal(r.cambios[0].antes, 'E02');
  assert.equal(r.cambios[0].despues, 'E03');
  assert.equal(r.perfil.ajustes.escritura.nivelEscritura, 'E03');
  assert.equal(r.perfil.cambiosAutomaticos.length, 1);
  assert.equal(avisosPendientes(r.perfil).length, 1);
  const av = avanceDeNivel({ elementos, progresos: dominadasDeNivel('E02', 3), perfilId: PERFIL_ID, nivel: 'E02' });
  assert.equal(av.dominadas, 3);
  assert.equal(av.total, total);
});

test('autoajuste de escritura: con pocas palabras (< 4) no sube; salta los niveles bloqueados; el último no tiene siguiente', () => {
  const pocos = elementos.filter((e) => e.nivel !== 'E02').concat(delNivel('E02').slice(0, 3));
  const p3 = delNivel('E02').slice(0, 3).map((e) => dominada(e));
  assert.equal(evaluarAutoajusteEscritura({ perfil: perfilCon({ nivelEscritura: 'E02' }), elementos: pocos, progresos: p3, hoy: HOY_AUTO }).cambios.length, 0);
  const bloqueado = evaluarAutoajusteEscritura({ perfil: perfilCon({ nivelEscritura: 'E02', nivelesBloqueados: ['E03'] }), elementos, progresos: dominadasDeNivel('E02', delNivel('E02').length), hoy: HOY_AUTO });
  assert.equal(bloqueado.perfil.ajustes.escritura.nivelEscritura, 'E04');
  const ultimo = evaluarAutoajusteEscritura({ perfil: perfilCon({ nivelEscritura: 'E20' }), elementos, progresos: dominadasDeNivel('E20', delNivel('E20').length), hoy: HOY_AUTO });
  assert.equal(ultimo.cambios.length, 0);
});

test('autoajuste de escritura: un solo cambio por día y solo si está en «Automático»', () => {
  const progresos = dominadasDeNivel('E02', delNivel('E02').length);
  const primero = evaluarAutoajusteEscritura({ perfil: perfilCon({ nivelEscritura: 'E02' }), elementos, progresos, hoy: HOY_AUTO });
  assert.equal(primero.perfil.ajustes.escritura.nivelEscritura, 'E03');
  const otraVez = evaluarAutoajusteEscritura({ perfil: { ...primero.perfil, ajustes: { ...primero.perfil.ajustes, escritura: { ...primero.perfil.ajustes.escritura, nivelEscritura: 'E02' } } }, elementos, progresos, hoy: HOY_AUTO });
  assert.equal(otraVez.cambios.filter((c) => c.ajuste === 'nivelEscritura').length, 0, 'ya cambió hoy');
  const mañana = evaluarAutoajusteEscritura({ perfil: { ...primero.perfil, ajustes: { ...primero.perfil.ajustes, escritura: { ...primero.perfil.ajustes.escritura, nivelEscritura: 'E02' } } }, elementos, progresos, hoy: new Date(2026, 10, 11, 12) });
  assert.equal(mañana.cambios.filter((c) => c.ajuste === 'nivelEscritura').length, 1);
  const manual = evaluarAutoajusteEscritura({ perfil: perfilCon({ nivelEscritura: 'E02' }, { automaticos: { nivelEscritura: false } }), elementos, progresos, hoy: HOY_AUTO });
  assert.equal(manual.cambios.length, 0);
});

test('autoajuste de escritura: con < 50 % en las últimas 3 sesiones del nivel solo sugiere (el nivel nunca baja solo) y una vez', () => {
  const perfil = perfilCon({ nivelEscritura: 'E03' });
  const r = evaluarAutoajusteEscritura({ perfil, sesiones: TRES({ ok: 1, de: 6, nivel: 'E03' }), elementos, hoy: HOY_AUTO });
  const sugerencia = r.cambios.find((c) => c.ajuste === 'nivelEscritura');
  assert.equal(sugerencia.sugerencia, true);
  assert.equal(r.perfil.ajustes.escritura.nivelEscritura, 'E03');
  const repetida = evaluarAutoajusteEscritura({ perfil: r.perfil, sesiones: TRES({ ok: 1, de: 6, nivel: 'E03' }), elementos, hoy: HOY_AUTO });
  assert.equal(repetida.cambios.filter((c) => c.ajuste === 'nivelEscritura').length, 0);
  // sesiones de otro nivel no cuentan para esta sugerencia
  assert.equal(evaluarAutoajusteEscritura({ perfil, sesiones: TRES({ ok: 1, de: 6, nivel: 'E02' }), elementos, hoy: HOY_AUTO }).cambios.filter((c) => c.ajuste === 'nivelEscritura').length, 0);
  // deshacer una sugerencia solo la marca como vista
  assert.equal(deshacerCambio(r.perfil, 0).ajustes.escritura.nivelEscritura, 'E03');
});

test('autoajuste de escritura: palabras por sesión (±1, entre 4 y 10)', () => {
  const sube = evaluarAutoajusteEscritura({ perfil: perfilCon({ palabrasPorSesion: 6 }), sesiones: TRES({ ok: 6, de: 6, minutos: 5 }), elementos, hoy: HOY_AUTO });
  assert.equal(sube.perfil.ajustes.escritura.palabrasPorSesion, 7);
  assert.equal(sube.cambios[0].ajuste, 'palabrasEscritura');
  const lento = evaluarAutoajusteEscritura({ perfil: perfilCon({ palabrasPorSesion: 6 }), sesiones: TRES({ ok: 6, de: 6, minutos: 20 }), elementos, hoy: HOY_AUTO });
  assert.equal(lento.perfil.ajustes.escritura.palabrasPorSesion, 5);
  const cansado = evaluarAutoajusteEscritura({ perfil: perfilCon({ palabrasPorSesion: 6 }), sesiones: [sesionE(1, { fatiga: true }), sesionE(2, { fatiga: true }), sesionE(3)], elementos, hoy: HOY_AUTO });
  assert.equal(cansado.perfil.ajustes.escritura.palabrasPorSesion, 5);
  const cortada = evaluarAutoajusteEscritura({ perfil: perfilCon({ palabrasPorSesion: 6 }), sesiones: [sesionE(1, { interrumpida: true }), sesionE(2), sesionE(3)], elementos, hoy: HOY_AUTO });
  assert.equal(cortada.perfil.ajustes.escritura.palabrasPorSesion, 5);
  assert.equal(evaluarAutoajusteEscritura({ perfil: perfilCon({ palabrasPorSesion: 4 }), sesiones: TRES({ minutos: 20 }), elementos, hoy: HOY_AUTO }).cambios.length, 0, 'no baja de 4');
  assert.equal(evaluarAutoajusteEscritura({ perfil: perfilCon({ palabrasPorSesion: 10 }), sesiones: TRES({}), elementos, hoy: HOY_AUTO }).cambios.length, 0, 'solo el adulto pasa de 10');
  assert.equal(evaluarAutoajusteEscritura({ perfil: perfilCon({ palabrasPorSesion: 6 }, { automaticos: { palabrasEscritura: false } }), sesiones: TRES({}), elementos, hoy: HOY_AUTO }).cambios.length, 0);
  assert.equal(evaluarAutoajusteEscritura({ perfil: perfilCon({ palabrasPorSesion: 6 }), sesiones: [sesionE(1), sesionE(2)], elementos, hoy: HOY_AUTO }).cambios.length, 0, 'hacen falta 3 sesiones');
});

test('autoajuste de escritura: «Deshacer» devuelve el valor y lo deja en «Lo elijo yo»', () => {
  const r = evaluarAutoajusteEscritura({ perfil: perfilCon({ palabrasPorSesion: 6 }), sesiones: TRES({}), elementos, hoy: HOY_AUTO });
  const d = deshacerCambio(r.perfil, 0);
  assert.equal(d.ajustes.escritura.palabrasPorSesion, 6);
  assert.equal(d.ajustes.automaticos.palabrasEscritura, false);
  assert.equal(d.cambiosAutomaticos[0].deshecho, true);
  const n = evaluarAutoajusteEscritura({ perfil: perfilCon({ nivelEscritura: 'E02' }), elementos, progresos: dominadasDeNivel('E02', delNivel('E02').length), hoy: HOY_AUTO });
  const dn = deshacerCambio(n.perfil, 0);
  assert.equal(dn.ajustes.escritura.nivelEscritura, 'E02');
  assert.equal(dn.ajustes.automaticos.nivelEscritura, false);
});

// ─── La lectura no cambia con registros de escritura en el almacén ────────────────────────────────────────────

const respuestaL = (i, ok = true, texto = 'mamá') => ({
  id: `l${i}`, perfilId: PERFIL_ID, sesionId: 'sl', fecha: new Date(2026, 10, 4, 10, i).toISOString(), dia: '2026-11-04', hora: 10, elementoId: texto, texto, esFrase: false,
  actividad: 'L2', tipo: 'practica', esFacil: false, opciones: [], errores: ok ? [] : [{ id: 'papá', texto: 'papá', ms: 800 }], correctoAlPrimerIntento: ok, intentos: 1,
  msAcierto: 2000, distraido: false, repeticionesAudio: 0,
});
const respuestasDeEscritura = () => {
  const ctl = crearControladorEscritura({ perfil: perfilCon({ palabrasPorSesion: 6 }), palabras: elementos, nivel: 'E02', hoy: HOY, aleatorio: crearAleatorio(9), sesionId: 'se', reloj: () => new Date(2026, 10, 4, 11) });
  let ms = 0;
  let v = ctl.iniciar(ms);
  const salida = [];
  while (v) {
    ms = jugarEnsayo(ctl, ms, { errar: salida.length % 2 === 1 });
    const r = ctl.avanzar(ms);
    salida.push(r.guardar);
    v = r.siguiente;
  }
  return { guardados: salida, sesion: ctl.registro({ inicio: new Date(2026, 10, 4, 11), fin: new Date(2026, 10, 4, 11, 6) }) };
};

test('separación: el análisis, la exportación y las estadísticas de lectura no cambian con registros de escritura', () => {
  const { guardados, sesion } = respuestasDeEscritura();
  const rs = guardados.map((g) => g.respuesta);
  const lectura = Array.from({ length: 8 }, (_, i) => respuestaL(i, i % 3 !== 0));
  const sesionL = { id: 'sl', perfilId: PERFIL_ID, inicio: new Date(2026, 10, 4, 10).toISOString(), fin: new Date(2026, 10, 4, 10, 5).toISOString(), fatiga: false, ensayos: lectura.map((r) => ({ correctoAlPrimerIntento: r.correctoAlPrimerIntento, tipo: 'practica' })) };
  const hoy = new Date(2026, 10, 5);

  assert.deepEqual(analizar([...lectura, ...rs], { hoy }), analizar(lectura, { hoy }));
  assert.equal(respuestasAnalizables([...lectura, ...rs], { hoy }).length, lectura.length);
  assert.equal(respuestasAnalizables([...lectura, ...rs], { hoy, escritura: true }).length, rs.filter((r) => !r.esFacil).length);
  const perfil = { id: PERFIL_ID, nombre: 'Leo', ajustes: {} };
  const exp = (respuestas, sesiones) => construirExportacion({ perfil, sesiones, respuestas, hoy });
  // la parte de lectura de la exportación es la misma; la escritura va en su propia sección `escritura` (fase 31)
  const { escritura: seccion, ...lecturaConEscritura } = exp([...lectura, ...rs], [sesionL, sesion]);
  assert.deepEqual(lecturaConEscritura, exp(lectura, [sesionL]));
  assert.equal(seccion.respuestas.length, rs.length);

  const filas = [];
  assert.deepEqual(resumenGeneral({ filas, sesiones: [sesionL, sesion] }), resumenGeneral({ filas, sesiones: [sesionL] }));
  assert.deepEqual(precisionSemanal([sesionL, sesion], { hoy }), precisionSemanal([sesionL], { hoy }));
  assert.deepEqual(historialDeSesiones([sesionL, sesion]), historialDeSesiones([sesionL]));
  // …y con la opción, la escritura tiene lo suyo
  assert.equal(historialDeSesiones([sesionL, sesion], 20, { escritura: true }).length, 1);
  assert.ok(precisionSemanal([sesionL, sesion], { hoy, escritura: true }).some((s) => s.ensayos > 0));
});

test('separación: el autoajuste de la lectura ignora sesiones y niveles de escritura (y al revés)', () => {
  const sl = (i, minutos = 5) => ({ id: `l${i}`, perfilId: PERFIL_ID, inicio: new Date(2026, 10, i, 10).toISOString(), fin: new Date(2026, 10, i, 10, minutos).toISOString(), fatiga: false, ensayos: Array.from({ length: 8 }, () => ({ correctoAlPrimerIntento: true, tipo: 'practica' })) });
  const lectura = [sl(1), sl(2), sl(3)];
  const hoy = new Date(2026, 10, 10, 12);
  const base = evaluarAutoajuste({ perfil: { id: PERFIL_ID, ajustes: {} }, sesiones: lectura, hoy });
  assert.ok(base.cambios.length > 0);
  // tres sesiones de escritura cansadas e interrumpidas, MÁS RECIENTES que las de lectura: no deben cambiar nada
  const ruido = [4, 5, 6].map((i) => sesionE(i, { fatiga: true, interrumpida: true, minutos: 30, ok: 0 }));
  const conRuido = evaluarAutoajuste({ perfil: { id: PERFIL_ID, ajustes: {} }, sesiones: [...lectura, ...ruido], hoy });
  assert.deepEqual(conRuido.cambios, base.cambios);
  assert.deepEqual(conRuido.perfil.ajustes.ensayosPorSesion, base.perfil.ajustes.ensayosPorSesion);
  // niveles de escritura (extras, sin `opciones`) no frenan «máximo de opciones»
  const nl = (a) => ({ id: `p1:${a}`, perfilId: PERFIL_ID, actividad: a, opciones: 3, ultimos: Array(10).fill(true) });
  const ne = { id: 'p1:E02', perfilId: PERFIL_ID, actividad: 'E02', extras: 1, ultimos: Array(10).fill(false) };
  const perfil3 = { id: PERFIL_ID, ajustes: { maxOpciones: 3 } };
  const a = evaluarAutoajuste({ perfil: perfil3, niveles: [nl('L1'), nl('L2')], hoy });
  const b = evaluarAutoajuste({ perfil: perfil3, niveles: [nl('L1'), nl('L2'), ne], hoy });
  assert.deepEqual(b.cambios.map((c) => c.ajuste), a.cambios.map((c) => c.ajuste));
  assert.ok(a.cambios.some((c) => c.ajuste === 'maxOpciones'));
  // y las de lectura no cuentan para el autoajuste de escritura
  const delLectura = evaluarAutoajusteEscritura({ perfil: perfilCon({ palabrasPorSesion: 6 }), sesiones: lectura, elementos, hoy });
  assert.equal(delLectura.cambios.length, 0);
});

test('separación: crearSesion y el controlador de la lectura no ven los progresos ni los niveles de escritura', () => {
  const palabras = vocabulario(8);
  const ruido = [...delNivel('E02').map((e) => dominada(e)), { id: 'p1:E02', perfilId: PERFIL_ID, actividad: 'E02', extras: 3, ultimos: [] }];
  const progresos = ruido.filter((x) => x.estado);
  const niveles = ruido.filter((x) => !x.estado);
  const args = { perfil: { id: PERFIL_ID, ajustes: {} }, elementos: palabras, actividades: ACTIVIDADES, hoy: HOY };
  assert.deepEqual(crearSesion({ ...args, aleatorio: crearAleatorio(5) }), crearSesion({ ...args, progresos, niveles, aleatorio: crearAleatorio(5) }));
  const conCtl = (extra) => crearControlador({ perfil: { id: PERFIL_ID, ajustes: {} }, palabras: palabras.map((p) => ({ ...p, emoji: '🙂' })), hoy: HOY, aleatorio: crearAleatorio(5), ...extra });
  assert.deepEqual(conCtl({}).plan, conCtl({ progresos, niveles, respuestas: respuestasDeEscritura().guardados.map((g) => g.respuesta) }).plan);
});

test('separación: esDeEscritura reconoce progresos, niveles, sesiones y respuestas de escritura y nada de la lectura', () => {
  assert.equal(esDeEscritura({ actividad: 'E07' }), true);
  assert.equal(esDeEscritura({ actividad: 'L4' }), false);
  assert.equal(esDeEscritura({ actividad: 'S3', tipo: 'practica' }), false);
  assert.equal(esDeEscritura({ tipo: 'escritura' }), true);
  assert.equal(esDeEscritura({ modo: 'escritura' }), true);
  assert.equal(esDeEscritura(null), false);
  const { guardados, sesion } = respuestasDeEscritura();
  assert.ok(guardados.every((g) => esDeEscritura(g.progreso) && esDeEscritura(g.nivel) && esDeEscritura(g.respuesta)));
  assert.equal(esDeEscritura(sesion), true);
  assert.equal(aFicha({ progresos: guardados.map((g) => ({ ...g.progreso, perfilId: 'C' })) }, { cursoId: 'C', fichaId: 'prueba:C' }).almacenes.progresos[0].perfilId, 'prueba:C');
});

// ─── Simulador: el ritmo ───────────────────────────────────────────────────────────────────────────────────────

test('simulador: un niño virtual escribe sesiones completas y pasa de E02 a E03 solo', () => {
  const r = simularEscritura({ dias: 60, semilla: 3 });
  assert.ok(r.sesiones > 5);
  assert.ok(r.ensayos > 30);
  assert.ok(r.sesionesHastaE03 !== null, 'llega a E03');
  assert.equal(r.violaciones, 0);
  assert.ok(r.progresos.every((p) => p.actividad.startsWith('E')));
  const igual = simularEscritura({ dias: 60, semilla: 3 });
  assert.equal(igual.sesionesHastaE03, r.sesionesHastaE03, 'reproducible con semilla');
});

test('simulador: un niño más rápido llega antes a E03 que uno lento', () => {
  const lento = simularEscritura({ dias: 120, semilla: 4, inicio: 0.3, aprendizaje: 0.04 });
  const medio = simularEscritura({ dias: 120, semilla: 4, inicio: 0.4, aprendizaje: 0.08 });
  const rapido = simularEscritura({ dias: 120, semilla: 4, inicio: 0.6, aprendizaje: 0.12 });
  assert.ok(rapido.sesionesHastaE03 !== null && medio.sesionesHastaE03 !== null);
  assert.ok(rapido.sesionesHastaE03 <= medio.sesionesHastaE03);
  assert.ok(lento.sesionesHastaE03 === null || lento.sesionesHastaE03 >= medio.sesionesHastaE03);
});
