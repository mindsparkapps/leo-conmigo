import test from 'node:test';
import assert from 'node:assert/strict';
import { ID_BASE, faltantesPorPegar, laminasDeColeccion, listarColecciones, normalizarColecciones, nuevaColeccion, opcionesDeRecompensa } from '../js/core/colecciones.js';
import { codigosEnJuego } from '../js/core/calcomanias.js';

const propia = (id, coleccionId) => ({ id, nombre: id, coleccionId });

test('normalizarColecciones descarta lo inválido y los ids repetidos', () => {
  const lista = normalizarColecciones([
    { id: 'a', nombre: ' Animales ' },
    { id: 'a', nombre: 'otra' },
    { id: ID_BASE, nombre: 'no' },
    { nombre: 'sin id' },
    null,
  ]);
  assert.deepEqual(lista, [{ id: 'a', nombre: 'Animales', medioPortadaId: null, medioSobreId: null }]);
  assert.deepEqual(normalizarColecciones(undefined), []);
});

test('nuevaColeccion exige nombre', () => {
  assert.throws(() => nuevaColeccion({ nombre: '  ' }));
  const c = nuevaColeccion({ nombre: 'Autos', medioPortadaId: 'm1', medioSobreId: 'm2' });
  assert.equal(c.nombre, 'Autos');
  assert.ok(c.id);
});

test('las láminas de un álbum cargado no entran al álbum de la app', () => {
  const propias = [propia('p1', null), propia('p2', 'c1')];
  assert.ok(codigosEnJuego(null, propias).includes('propia:p1'));
  assert.ok(!codigosEnJuego(null, propias).includes('propia:p2'));
});

test('listarColecciones: siempre el de la app y solo los cargados con láminas', () => {
  const perfil = { colecciones: [{ id: 'c1', nombre: 'Animales' }, { id: 'c2', nombre: 'Vacío' }] };
  const propias = [propia('a', 'c1'), propia('b', 'c1'), { ...propia('x', 'c1'), deleted: true }];
  const lista = listarColecciones({ perfil, propias });
  assert.equal(lista.length, 2);
  assert.equal(lista[0].id, ID_BASE);
  assert.equal(lista[0].esBase, true);
  assert.deepEqual(lista[1].codigos, ['propia:a', 'propia:b']);
  assert.equal(laminasDeColeccion(propias, 'c1').length, 2);
});

test('faltantesPorPegar cuenta lo que no está pegado (sueltas incluidas)', () => {
  const coleccion = { codigos: ['propia:a', 'propia:b', 'propia:c'] };
  const calcomanias = [
    { codigo: 'propia:a', pegada: true },
    { codigo: 'propia:b', pegada: false },
    { codigo: 'propia:z', pegada: true },
    { codigo: 'propia:a', pegada: true, deleted: true },
  ];
  assert.equal(faltantesPorPegar(coleccion, calcomanias), 2);
  assert.equal(faltantesPorPegar(coleccion, [{ codigo: 'propia:a' }, { codigo: 'propia:b' }, { codigo: 'propia:c' }]), 0); // sin el campo = pegada
});

test('opcionesDeRecompensa: hasta 3 distintos, o los que haya', () => {
  const cinco = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
  const tres = opcionesDeRecompensa(cinco, () => 0.3);
  assert.equal(tres.length, 3);
  assert.equal(new Set(tres.map((c) => c.id)).size, 3);
  assert.equal(opcionesDeRecompensa(cinco.slice(0, 2), () => 0.5).length, 2);
  assert.equal(opcionesDeRecompensa([], () => 0.5).length, 0);
});
