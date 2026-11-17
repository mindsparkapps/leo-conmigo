// Fase 30 (Ampliación 5): estadísticas de escritura, lista de administradores que viaja con la sincronización,
// rutas del celular del alumno y «Borrar los datos de prueba».
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { crearStoreEnMemoria } from './memoria.js';
import { borrarDatosDePrueba, borrarPerfil, contarDatosDePrueba } from '../js/core/borrar-perfil.js';
import { rutaPermitidaAlumno } from '../js/core/dispositivo-alumno.js';
import { armarDocumento, fusionarAdministradores } from '../js/core/sync.js';
import { idDePrueba } from '../js/core/curso.js';
import { estadoDeEscritura, historialDeEscritura, resumenDeEscritura, resumenPorNivel, tablaDeEscritura } from '../js/core/escritura/estadisticas.js';

const prog = (elementoId, actividad, extra = {}) => ({ id: `P:${elementoId}:${actividad}`, perfilId: 'P', elementoId, actividad, estado: 'practica', historial: [{ fecha: '2026-11-01T10:00:00Z', correctoAlPrimerIntento: true }], ...extra });
const elementos = [
  { id: 'esc:mama', texto: 'mamá', nivel: 'E02', origen: 'banco' },
  { id: 'esc:pato', texto: 'pato', nivel: 'E02', origen: 'banco' },
  { id: 'esc:casa', texto: 'casa', nivel: 'E02', origen: 'banco' },
  { id: 'esc:chala', texto: 'chala', nivel: 'E03', origen: 'banco', activa: false },
  { id: 'esc:mama', texto: 'mamá', nivel: 'E20', origen: 'banco', dictado: true },
];

describe('estadísticas de escritura', () => {
  test('estado: nueva, práctica, dominada y aprendida', () => {
    assert.equal(estadoDeEscritura(undefined), 'nueva');
    assert.equal(estadoDeEscritura(prog('a', 'E02')), 'practica');
    assert.equal(estadoDeEscritura(prog('a', 'E02', { estado: 'dominada' })), 'dominada');
    assert.equal(estadoDeEscritura(prog('a', 'E02', { estado: 'dominada', aciertosEnCaja5: 1 })), 'aprendida');
    assert.equal(estadoDeEscritura(prog('a', 'E02', { estado: 'dominada', aciertosEnCaja5: 1, provisional: true })), 'dominada');
  });

  test('la tabla cruza cada elemento con el progreso de su nivel (el dictado es aparte) y salta lo apagado', () => {
    const filas = tablaDeEscritura({ elementos, progresos: [prog('esc:mama', 'E02', { estado: 'dominada' }), prog('esc:mama', 'E20'), { ...prog('esc:pato', 'E02'), deleted: true }, { id: 'x', actividad: 'L4', elementoId: 'esc:casa', historial: [] }] });
    assert.equal(filas.length, 4); // sin la apagada
    assert.deepEqual(filas.map((f) => [f.elemento.texto, f.nivel, f.estado]), [['mamá', 'E02', 'dominada'], ['pato', 'E02', 'nueva'], ['casa', 'E02', 'nueva'], ['mamá', 'E20', 'practica']]);
    assert.equal(filas[0].aciertos, 1);
  });

  test('por nivel y resumen general', () => {
    const filas = tablaDeEscritura({ elementos, progresos: [prog('esc:mama', 'E02', { estado: 'dominada' }), prog('esc:pato', 'E02')] });
    const e02 = resumenPorNivel(filas).find((n) => n.id === 'E02');
    assert.deepEqual([e02.total, e02.nuevas, e02.practica, e02.dominadas, e02.aprendidas], [3, 1, 1, 1, 0]);
    const sesiones = [{ id: 's1', tipo: 'escritura', inicio: '2026-11-02T10:00:00Z' }, { id: 's2', inicio: '2026-11-05T10:00:00Z' }];
    const r = resumenDeEscritura({ filas, sesiones });
    assert.equal(r.sesiones, 1); // la de lectura no cuenta
    assert.equal(r.dominadas, 1);
    assert.equal(r.practicadas, 2);
  });

  test('el historial solo trae sesiones de escritura, la más reciente primero', () => {
    const s = (id, inicio, extra = {}) => ({ id, tipo: 'escritura', nivel: 'E02', inicio, fin: new Date(Date.parse(inicio) + 120000).toISOString(), ensayos: [{ correctoAlPrimerIntento: true }, { correctoAlPrimerIntento: false }], ...extra });
    const h = historialDeEscritura([s('a', '2026-11-01T10:00:00Z'), s('b', '2026-11-03T10:00:00Z', { interrumpida: true }), { id: 'l', inicio: '2026-11-04T10:00:00Z', ensayos: [] }]);
    assert.deepEqual(h.map((x) => x.id), ['b', 'a']);
    assert.equal(h[0].interrumpida, true);
    assert.equal(h[0].aciertos, 1);
    assert.equal(h[0].conAyuda, 1);
    assert.equal(h[0].segundos, 120);
  });
});

describe('administradores en la sincronización', () => {
  const lista = (l, fecha) => ({ lista: l, fecha });
  test('gana la más reciente y avisa qué lado cambia', () => {
    assert.deepEqual(fusionarAdministradores(null, null), { ganador: null, cambiaLocal: false, cambiaRemoto: false });
    assert.deepEqual(fusionarAdministradores(lista(['a'], '2026-11-02'), null), { ganador: lista(['a'], '2026-11-02'), cambiaLocal: false, cambiaRemoto: true });
    assert.equal(fusionarAdministradores(null, lista(['b'], '2026-11-02')).cambiaLocal, true);
    const r = fusionarAdministradores(lista(['a'], '2026-11-01'), lista(['b'], '2026-11-03'));
    assert.deepEqual(r.ganador.lista, ['b']);
    assert.equal(r.cambiaLocal, true);
    assert.equal(fusionarAdministradores(lista([], '2026-11-05'), lista(['b'], '2026-11-03')).cambiaRemoto, true); // quitar al último también viaja
    assert.equal(fusionarAdministradores(lista(['a'], 'x'), lista(['a'], 'x')).cambiaRemoto, false);
  });
  test('el documento de Drive lleva la lista solo si se la dan', () => {
    const almacenes = {};
    assert.equal('administradores' in armarDocumento({ almacenes }), false);
    assert.deepEqual(armarDocumento({ almacenes, administradores: lista(['a'], 'f') }).administradores, lista(['a'], 'f'));
  });
});

describe('celular del alumno', () => {
  test('de Escritura solo abre su progreso', () => {
    assert.equal(rutaPermitidaAlumno('#/adulto/escritura/progreso'), true);
    assert.equal(rutaPermitidaAlumno('/adulto/escritura/progreso/ficha/x'), true);
    assert.equal(rutaPermitidaAlumno('/adulto/escritura'), false);
    assert.equal(rutaPermitidaAlumno('/adulto/escritura/progreso/prueba'), false);
    assert.equal(rutaPermitidaAlumno('/adulto/progreso'), true); // lo de siempre no cambia
  });
});

describe('datos de prueba', () => {
  async function conDatos() {
    const store = crearStoreEnMemoria();
    await store.guardar('perfiles', { id: 'P', nombre: 'Pedro' });
    for (const [almacen, perfilId] of [['progresos', 'P'], ['progresos', idDePrueba('P')], ['sesiones', idDePrueba('P')], ['respuestas', idDePrueba('P')], ['calcomanias', idDePrueba('P')], ['movimientos', idDePrueba('P')], ['niveles', idDePrueba('P')], ['sesiones', 'P']]) {
      await store.guardar(almacen, { perfilId, elementoId: 'e', actividad: 'E02' });
    }
    return store;
  }

  test('se cuentan y se borran solo los de prueba', async () => {
    const store = await conDatos();
    assert.equal(await contarDatosDePrueba(store, 'P'), 6);
    assert.equal((await borrarDatosDePrueba(store, 'P')).registros, 6);
    assert.equal(await contarDatosDePrueba(store, 'P'), 0);
    assert.equal((await store.listar('progresos', { perfilId: 'P' })).length, 1);
    assert.equal((await store.listar('sesiones', { perfilId: 'P' })).length, 1);
  });

  test('borrar el perfil también borra su prueba', async () => {
    const store = await conDatos();
    await borrarPerfil(store, 'P');
    assert.equal(await contarDatosDePrueba(store, 'P'), 0);
  });
});
