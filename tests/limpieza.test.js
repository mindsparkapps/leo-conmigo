import test from 'node:test';
import assert from 'node:assert/strict';
import { clasificarEspacio, idDeMedioDeArchivo, seleccionVigente, textoDeTamano } from '../js/core/limpieza.js';

const f = (id, name, size, tipo, extra = {}) => ({ id, name, size, esCarpeta: false, espacio: tipo === 'respaldo' ? 'appdata' : 'drive', lugar: { tipo, cursoId: 'P1', nombre: 'Pedro' }, ...extra });
const ids = (g) => g.archivos.map((a) => a.id).sort();
const grupo = (r, id) => r.grupos.find((g) => g.id === id);

test('idDeMedioDeArchivo: solo los medio-<id>.<ext>', () => {
  assert.equal(idDeMedioDeArchivo('medio-abc-123.webp'), 'abc-123');
  assert.equal(idDeMedioDeArchivo('medio-catalogo:data/voces/mama.mp3.mp3'), 'catalogo:data/voces/mama.mp3');
  for (const n of ['data.json', 'adulto.json', 'aula.json', 'alumno.json', 'dispositivo-x.json', 'medio-sin-extension', '', undefined]) assert.equal(idDeMedioDeArchivo(n), null, String(n));
});

test('clasificarEspacio: cada grupo, con sus tamaños, y nada de lo que hoy se usa', () => {
  const medios = [
    { id: 'usado', origen: 'foto' },
    { id: 'borrado', origen: 'foto', deleted: true },
    { id: 'vieja-voz', origen: 'catalogo', deleted: true, conservarEnDrive: true },
    { id: 'voz-aun-usada', origen: 'catalogo' }, // un perfil todavía apunta a ella y no tiene `ruta`: se necesita
    { id: 'catalogo:data/voces/ma.mp3', origen: 'catalogo', ruta: 'data/voces/ma.mp3' },
    { id: 'existe-sin-uso', origen: 'foto' },
    { id: 'respaldo-vivo', origen: 'foto' },
  ];
  const usados = new Set(['usado', 'voz-aun-usada', 'respaldo-vivo']);
  const archivos = [
    f('b1', 'medio-usado.webp', 100, 'biblioteca'),
    f('b2', 'medio-existe-sin-uso.webp', 40, 'biblioteca'),
    f('b3', 'medio-no-existe.webp', 30, 'biblioteca'),
    f('b4', 'medio-vieja-voz.mp3', 500, 'biblioteca'),
    f('b5', 'medio-voz-aun-usada.mp3', 70, 'biblioteca'),
    f('c1', 'medio-usado.webp', 100, 'curso'), // resto dentro del curso: ya está en la Biblioteca
    f('c2', 'medio-borrado.webp', 20, 'curso'), // resto de un medio que ya no se usa
    f('c3', 'aula.json', 5, 'curso'),
    f('c4', 'adulto.json', 5, 'curso'),
    f('r1', 'medio-vieja-voz.mp3', 500, 'respaldo'),
    f('r2', 'medio-borrado.webp', 25, 'respaldo'),
    f('r3', 'medio-respaldo-vivo.webp', 60, 'respaldo'), // copia de seguridad de algo que existe: se queda
    f('r4', 'medio-catalogo:data/voces/ma.mp3.mp3', 80, 'respaldo'),
    f('r5', 'data.json', 9000, 'respaldo'),
    { id: 'L', name: 'del-alumno', size: 3000, esCarpeta: true, espacio: 'drive', lugar: { tipo: 'legado', cursoId: 'P1', nombre: 'Pedro' } },
  ];
  const r = clasificarEspacio({ archivos, medios, usados, aulas: [{ cursoId: 'P1', migrada: true, legadoSuperado: true }] });

  assert.deepEqual(ids(grupo(r, 'restos')), ['L', 'c1', 'c2']);
  assert.deepEqual(ids(grupo(r, 'catalogo')), ['b4', 'r1', 'r4']);
  assert.deepEqual(ids(grupo(r, 'sinUso')), ['b2', 'b3', 'r2']);
  assert.deepEqual(ids(grupo(r, 'repetidas')), []);
  const todos = r.grupos.flatMap((g) => g.archivos.map((a) => a.id));
  for (const intocable of ['b1', 'b5', 'r3', 'r5', 'c3', 'c4']) assert.ok(!todos.includes(intocable), `${intocable} no se toca`);
  assert.equal(grupo(r, 'restos').bytes, 3000 + 100 + 20);
  assert.equal(grupo(r, 'catalogo').bytes, 500 + 500 + 80);
  assert.equal(r.cantidad, 9);
  assert.equal(r.bytes, grupo(r, 'restos').bytes + grupo(r, 'catalogo').bytes + grupo(r, 'sinUso').bytes);
  assert.ok(grupo(r, 'restos').archivos.find((a) => a.id === 'L').lugar.includes('del-alumno'));
});

test('clasificarEspacio: un curso sin migrar y la carpeta de antes con avance sin pasar no se tocan', () => {
  const medios = [{ id: 'm', origen: 'foto' }];
  const archivos = [
    f('c1', 'medio-m.webp', 100, 'curso'), // en un aula versión 1 sin Biblioteca: sus alumnos todavía lo leen de ahí
    f('c2', 'medio-huerfano.webp', 10, 'curso'),
    { id: 'L', name: 'del-alumno', size: 3000, esCarpeta: true, espacio: 'drive', lugar: { tipo: 'legado', cursoId: 'P1' } },
  ];
  const sinMigrar = clasificarEspacio({ archivos, medios, usados: new Set(['m']), aulas: [{ cursoId: 'P1', migrada: false, legadoSuperado: false }] });
  assert.equal(sinMigrar.cantidad, 0);
  assert.deepEqual(sinMigrar.sinMigrar, ['P1']);
  const sinSuperar = clasificarEspacio({ archivos, medios, usados: new Set(['m']), aulas: [{ cursoId: 'P1', migrada: true, legadoSuperado: false }] });
  assert.ok(!ids(grupo(sinSuperar, 'restos')).includes('L'), 'la carpeta de antes se queda mientras algún alumno no tenga su archivo nuevo');
  assert.deepEqual(ids(grupo(sinSuperar, 'restos')), ['c2'], 'c1 se usa y se queda; c2 no lo usa nadie');
});

test('clasificarEspacio: dos copias del mismo archivo en la Biblioteca y un curso: se queda la de la Biblioteca', () => {
  const medios = [{ id: 'm', origen: 'foto' }];
  const r = clasificarEspacio({
    archivos: [f('b', 'medio-m.webp', 100, 'biblioteca'), f('c', 'medio-m.webp', 100, 'curso')],
    medios, usados: new Set(['m']), aulas: [{ cursoId: 'P1', migrada: true, legadoSuperado: false }],
  });
  assert.deepEqual(ids(grupo(r, 'restos')), ['c']);
  assert.ok(!r.grupos.flatMap((g) => g.archivos).some((a) => a.id === 'b'));
  // dos en la misma carpeta (no pasa con la app, pero Drive lo permite): una repetida
  const r2 = clasificarEspacio({
    archivos: [f('b', 'medio-m.webp', 100, 'biblioteca'), f('b2', 'medio-m.webp', 100, 'biblioteca')],
    medios, usados: new Set(['m']), aulas: [{ cursoId: 'P1', migrada: true, legadoSuperado: false }],
  });
  assert.equal(grupo(r2, 'repetidas').archivos.length, 1);
});

test('seleccionVigente: solo lo marcado que sigue siendo eliminable ahora; textoDeTamano', () => {
  const g = { archivos: [{ id: 'a', size: 1 }, { id: 'b', size: 2 }] };
  assert.deepEqual(seleccionVigente(['a', 'x', 'a', 'b'], g).map((a) => a.id), ['a', 'b']);
  assert.deepEqual(seleccionVigente(['a'], undefined), []);
  assert.equal(textoDeTamano(0), '0 B');
  assert.equal(textoDeTamano(2048), '2 KB');
  assert.equal(textoDeTamano(1572864), '1,5 MB');
});
