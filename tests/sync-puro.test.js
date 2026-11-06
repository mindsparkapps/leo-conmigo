import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALMACENES_SYNC, FORMATO_SYNC, VERSION_SYNC, armarDocumento, contarRegistros, fusionarAlmacen, nombreArchivoMedio, planDeMedios,
  validarDocumento,
} from '../js/core/sync.js';

const reg = (id, updatedAt, extra = {}) => ({ id, updatedAt, deleted: false, ...extra });
const t = (s) => `2026-11-05T10:00:${String(s).padStart(2, '0')}.000Z`;

test('nombreArchivoMedio: medio-<id>.<extensión> según el tipo', () => {
  assert.equal(nombreArchivoMedio({ id: 'a1', mime: 'image/webp' }), 'medio-a1.webp');
  assert.equal(nombreArchivoMedio({ id: 'a2', mime: 'image/jpeg' }), 'medio-a2.jpg');
  assert.equal(nombreArchivoMedio({ id: 'a3', mime: 'audio/webm;codecs=opus' }), 'medio-a3.webm');
  assert.equal(nombreArchivoMedio({ id: 'a4', mime: 'audio/mp4' }), 'medio-a4.m4a');
  assert.equal(nombreArchivoMedio({ id: 'a5', mime: 'algo/raro' }), 'medio-a5.bin');
  assert.equal(nombreArchivoMedio({ id: 'a6' }), 'medio-a6.bin');
});

test('armarDocumento: incluye los borrados, quita el contenido de los medios y trae todos los almacenes', () => {
  const doc = armarDocumento({
    almacenes: {
      palabras: [reg('p1', t(1)), reg('p2', t(2), { deleted: true })],
      medios: [reg('m1', t(1), { mime: 'image/png', blob: new Blob(['x']) })],
    },
    ahora: new Date('2026-11-05T12:00:00Z'),
  });
  assert.equal(doc.formato, FORMATO_SYNC);
  assert.equal(doc.version, VERSION_SYNC);
  assert.equal(doc.actualizado, '2026-11-05T12:00:00.000Z');
  assert.deepEqual(Object.keys(doc.almacenes), [...ALMACENES_SYNC]);
  assert.equal(doc.almacenes.palabras.length, 2, 'el borrado viaja');
  assert.equal('blob' in doc.almacenes.medios[0], false);
  assert.equal(doc.almacenes.medios[0].mime, 'image/png');
  assert.deepEqual(doc.almacenes.libros, []);
  JSON.stringify(doc); // se puede serializar
});

test('validarDocumento: acepta uno bueno y rechaza lo dañado o de otra versión', () => {
  const bueno = armarDocumento({ almacenes: { palabras: [reg('p1', t(1))] } });
  assert.equal(validarDocumento(bueno), null);
  assert.match(validarDocumento(null), /no es de Leo Conmigo/);
  assert.match(validarDocumento({ formato: 'otro' }), /no es de Leo Conmigo/);
  assert.match(validarDocumento({ ...bueno, version: 0 }), /sin versión|no tienen versión/);
  assert.match(validarDocumento({ ...bueno, version: VERSION_SYNC + 1 }), /más nueva/);
  assert.match(validarDocumento({ ...bueno, almacenes: undefined }), /no traen registros/);
  assert.match(validarDocumento({ ...bueno, almacenes: { palabras: 'no' } }), /dañados \(palabras\)/);
  assert.match(validarDocumento({ ...bueno, almacenes: { palabras: [{ texto: 'sin id' }] } }), /sin identificador/);
  assert.equal(validarDocumento({ ...bueno, almacenes: { palabras: [] } }), null, 'los almacenes que faltan no son un error');
});

test('fusionarAlmacen: lo que solo está en un lado se agrega al otro', () => {
  const { resultado, paraLocal, paraRemoto } = fusionarAlmacen([reg('a', t(1))], [reg('b', t(1))]);
  assert.deepEqual(resultado.map((r) => r.id).sort(), ['a', 'b']);
  assert.deepEqual(paraLocal.map((r) => r.id), ['b']);
  assert.equal(paraRemoto, 1);
});

test('fusionarAlmacen: gana el updatedAt más reciente, de cualquier lado', () => {
  const l = [reg('x', t(5), { v: 'local' }), reg('y', t(1), { v: 'local' })];
  const r = [reg('x', t(2), { v: 'remoto' }), reg('y', t(9), { v: 'remoto' })];
  const { resultado, paraLocal, paraRemoto } = fusionarAlmacen(l, r);
  const por = Object.fromEntries(resultado.map((x) => [x.id, x.v]));
  assert.deepEqual(por, { x: 'local', y: 'remoto' });
  assert.deepEqual(paraLocal.map((x) => x.id), ['y']);
  assert.equal(paraRemoto, 1);
});

test('fusionarAlmacen: un borrado más nuevo gana, y uno más viejo no deshace una edición', () => {
  const borradoNuevo = fusionarAlmacen([reg('x', t(1))], [reg('x', t(4), { deleted: true })]);
  assert.equal(borradoNuevo.resultado[0].deleted, true);
  assert.equal(borradoNuevo.paraLocal.length, 1);
  const borradoViejo = fusionarAlmacen([reg('x', t(8), { v: 'editado' })], [reg('x', t(4), { deleted: true })]);
  assert.equal(borradoViejo.resultado[0].deleted, false);
  assert.equal(borradoViejo.paraRemoto, 1);
});

test('fusionarAlmacen: iguales no generan trabajo, y repetir la fusión no cambia nada', () => {
  const igual = [reg('a', t(1)), reg('b', t(2))];
  const r1 = fusionarAlmacen(igual, igual);
  assert.equal(r1.paraLocal.length, 0);
  assert.equal(r1.paraRemoto, 0);
  const mezcla = fusionarAlmacen([reg('a', t(3)), reg('c', t(1))], [reg('a', t(1)), reg('b', t(2))]);
  const otra = fusionarAlmacen(mezcla.resultado, mezcla.resultado);
  assert.equal(otra.paraLocal.length + otra.paraRemoto, 0);
});

test('fusionarAlmacen: registros sin updatedAt pierden contra los que sí lo tienen', () => {
  const { resultado } = fusionarAlmacen([{ id: 'a', v: 'viejo' }], [reg('a', t(1), { v: 'nuevo' })]);
  assert.equal(resultado[0].v, 'nuevo');
});

// ---------- imágenes y audios ----------

const medio = (id, extra = {}) => ({ id, mime: 'image/webp', updatedAt: t(1), deleted: false, ...extra });
const archivos = (...nombres) => new Map(nombres.map((n, i) => [n, { id: `f${i}` }]));

test('planDeMedios: sube lo que solo está aquí, baja lo que solo está en Drive', () => {
  const plan = planDeMedios({
    medios: [medio('a'), medio('b'), medio('c')],
    archivos: archivos('medio-b.webp'),
    conBlobLocal: new Set(['a', 'b']),
  });
  assert.deepEqual(plan.subir.map((x) => x.medio.id), ['a']);
  assert.equal(plan.subir[0].nombre, 'medio-a.webp');
  assert.deepEqual(plan.bajar, [], 'c no tiene archivo en Drive');
  assert.deepEqual(plan.faltantes.map((m) => m.id), ['c']);
});

test('planDeMedios: baja lo que hay en Drive y no aquí', () => {
  const plan = planDeMedios({ medios: [medio('a')], archivos: archivos('medio-a.webp'), conBlobLocal: new Set() });
  assert.deepEqual(plan.bajar.map((x) => [x.medio.id, x.archivoId]), [['a', 'f0']]);
  assert.deepEqual(plan.subir, []);
});

test('planDeMedios: los borrados no se suben ni se bajan y su archivo se borra de Drive', () => {
  const plan = planDeMedios({
    medios: [medio('a', { deleted: true }), medio('b', { deleted: true })],
    archivos: archivos('medio-a.webp'),
    conBlobLocal: new Set(['b']),
  });
  assert.deepEqual(plan.borrarRemotos.map((x) => x.archivoId), ['f0']);
  assert.deepEqual([plan.subir, plan.bajar, plan.faltantes], [[], [], []]);
});

test('planDeMedios: lo que ya está en los dos lados no genera trabajo', () => {
  const plan = planDeMedios({ medios: [medio('a')], archivos: archivos('medio-a.webp'), conBlobLocal: new Set(['a']) });
  assert.deepEqual([plan.subir, plan.bajar, plan.borrarRemotos, plan.faltantes], [[], [], [], []]);
});

test('contarRegistros: solo cuenta los vigentes', () => {
  const c = contarRegistros({ palabras: [reg('a', t(1)), reg('b', t(1), { deleted: true })], libros: [reg('l', t(1))] });
  assert.equal(c.palabras, 1);
  assert.equal(c.libros, 1);
  assert.equal(c.perfiles, 0);
});
