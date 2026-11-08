import test from 'node:test';
import assert from 'node:assert/strict';
import { mediosDeRegistro, planDeBorradoDePerfil, borrarPerfil, ALMACENES_DEL_PERFIL } from '../js/core/borrar-perfil.js';

const perfiles = [{ id: 'A', fotoMedioId: 'fA' }, { id: 'B', fotoMedioId: 'fB' }];
const todos = () => ({
  palabras: [
    { id: 'p1', perfilId: 'A', medioImagenId: 'm1', medioAudioId: 'm2', medioSimboloId: null },
    { id: 'p2', perfilId: 'A', medioImagenId: 'compartido' },
    { id: 'p3', perfilId: 'B', medioImagenId: 'compartido', medioAudioId: 'm3' },
  ],
  libros: [{ id: 'l1', perfilId: 'A', paginas: [{ medioImagenId: 'm4', fraseId: 'x' }, { medioImagenId: null, fraseId: 'y' }] }],
  respuestas: [{ id: 'r1', perfilId: 'A' }, { id: 'r2', perfilId: 'B' }],
});

test('mediosDeRegistro: encuentra fotos, audios, símbolos y páginas', () => {
  assert.deepEqual(mediosDeRegistro({ fotoMedioId: 'a', medioAudioId: 'b', medioSimboloId: null, otro: 'c' }), ['a', 'b']);
  assert.deepEqual(mediosDeRegistro({ paginas: [{ medioImagenId: 'x' }, {}] }), ['x']);
  assert.deepEqual(mediosDeRegistro(null), []);
});

test('plan: solo lo del perfil, y conserva los medios que usa otro perfil', () => {
  const plan = planDeBorradoDePerfil({ perfilId: 'A', perfiles, todos: todos() });
  assert.deepEqual(plan.registros.perfiles, ['A']);
  assert.deepEqual(plan.registros.palabras, ['p1', 'p2']);
  assert.deepEqual(plan.registros.libros, ['l1']);
  assert.deepEqual(plan.registros.respuestas, ['r1']);
  assert.deepEqual(plan.medios.sort(), ['fA', 'm1', 'm2', 'm4']);
});

test('plan: un perfil que no existe no borra nada', () => {
  const plan = planDeBorradoDePerfil({ perfilId: 'Z', perfiles, todos: todos() });
  assert.deepEqual(plan.registros.perfiles, []);
  assert.deepEqual(plan.registros.palabras, []);
  assert.deepEqual(plan.medios, []);
});

test('borrarPerfil: borra con el almacén y no toca al otro perfil', async () => {
  const datos = { perfiles: structuredClone(perfiles), medios: ['fA', 'fB', 'm1', 'm2', 'm4', 'm3', 'compartido'].map((id) => ({ id, blob: 'x' })), ...todos() };
  for (const a of ALMACENES_DEL_PERFIL) datos[a] ??= [];
  const store = {
    listar: async (a) => datos[a].filter((r) => !r.deleted),
    borrar: async (a, id) => { const r = datos[a].find((x) => x.id === id); if (!r) return false; r.deleted = true; return true; },
    obtener: async (a, id) => datos[a].find((x) => x.id === id) ?? null,
    guardar: async (a, r) => { const i = datos[a].findIndex((x) => x.id === r.id); datos[a][i] = r; return r; },
  };
  const res = await borrarPerfil(store, 'A');
  assert.equal(res.registros, 1 + 2 + 1 + 1);
  assert.equal(res.medios, 4);
  assert.deepEqual(datos.perfiles.filter((p) => !p.deleted).map((p) => p.id), ['B']);
  assert.deepEqual(datos.palabras.filter((p) => !p.deleted).map((p) => p.id), ['p3']);
  assert.equal(datos.medios.find((m) => m.id === 'm1').deleted, true);
  assert.equal(datos.medios.find((m) => m.id === 'm1').blob, null);
  assert.equal(datos.medios.find((m) => m.id === 'compartido').deleted, undefined);
  assert.deepEqual(await borrarPerfil(store, 'A'), { registros: 0, medios: 0 });
});
