import test from 'node:test';
import assert from 'node:assert/strict';
import { crearSincronizador } from '../js/sync.js';
import { crearDrive } from '../js/drive.js';
import { ErrorSync } from '../js/core/sync.js';
import { ALMACENES_SYNC, datosMuyGrandes } from '../js/core/sync.js';
import { crearDriveFalso } from './drive-falso.js';
import { bytesDe, crearStoreEnMemoria } from './memoria.js';

/** Un dispositivo: su almacén propio, un cliente de Drive y el sincronizador. `desde` = segundo en que empieza su reloj. */
function dispositivo(falso, { desde = 0, prefijo = 'a' } = {}) {
  const store = crearStoreEnMemoria({ desde, prefijo });
  const drive = crearDrive({ obtenerToken: async () => 'token-1', fetchFn: falso.fetch });
  const sync = crearSincronizador({ store, drive, ahora: () => new Date(Date.UTC(2026, 10, 5, 11, 0, 0)) });
  return { store, drive, sync };
}

const foto = (...bytes) => new Blob([Uint8Array.from(bytes)], { type: 'image/webp' });
const ids = async (store, almacen, conBorrados = false) => (await store.listar(almacen, { conBorrados })).map((r) => r.id).sort();

async function sembrar(store) {
  await store.guardar('perfiles', { id: 'perfil', nombre: 'Leo' });
  await store.guardar('medios', { id: 'foto-perro', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: foto(1, 2, 3, 13, 10, 255) });
  await store.guardar('palabras', { id: 'perro', perfilId: 'perfil', texto: 'perro', medioImagenId: 'foto-perro' });
  await store.guardar('palabras', { id: 'gato', perfilId: 'perfil', texto: 'gato' });
}

test('primera sincronización: sube los datos y las imágenes y vacía la cola', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  await sembrar(A.store);
  assert.ok((await A.store.pendientesSync()).length > 0);

  const r = await A.sync.sincronizar();
  assert.deepEqual(falso.nombres(), ['data.json', 'medio-foto-perro.webp']);
  assert.equal(r.subioDatos, true);
  assert.equal(r.mediosSubidos, 1);
  assert.deepEqual(await A.store.pendientesSync(), []);
  assert.ok(await A.store.leerMeta('syncUltimo'));
  const doc = falso.json('data.json');
  assert.deepEqual(doc.almacenes.palabras.map((p) => p.id).sort(), ['gato', 'perro']);
  assert.equal('blob' in doc.almacenes.medios[0], false, 'el contenido va en su propio archivo');
  assert.equal(r.cuenta.palabras, 2);
});

test('al subir los datos se guarda cuánto pesa data.json, y desde 8 MB se avisa', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  await sembrar(A.store);
  await A.sync.sincronizar();
  const bytes = await A.store.leerMeta('syncBytesDatos');
  assert.equal(bytes, new TextEncoder().encode(JSON.stringify(falso.json('data.json'))).length);
  assert.equal(datosMuyGrandes(bytes), false);
  assert.equal(datosMuyGrandes(8 * 1024 * 1024), false);
  assert.equal(datosMuyGrandes(8 * 1024 * 1024 + 1), true);
  assert.equal(datosMuyGrandes(undefined), false);
});

test('un segundo dispositivo recibe todo, también el contenido de las imágenes', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  await sembrar(A.store);
  await A.sync.sincronizar();

  const B = dispositivo(falso, { desde: 100, prefijo: 'b' });
  const r = await B.sync.sincronizar();
  assert.deepEqual(await ids(B.store, 'palabras'), ['gato', 'perro']);
  assert.equal((await B.store.obtener('perfiles', 'perfil')).nombre, 'Leo');
  const medio = await B.store.obtener('medios', 'foto-perro');
  assert.deepEqual(await bytesDe(medio.blob), [1, 2, 3, 13, 10, 255]);
  assert.equal(r.mediosBajados, 1);
  assert.equal(r.subioDatos, false, 'no había nada nuevo que subir');
  assert.deepEqual(await B.store.pendientesSync(), [], 'lo traído de Drive no vuelve a subirse');
});

test('sin cambios, sincronizar otra vez no sube ni borra nada', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  await sembrar(A.store);
  await A.sync.sincronizar();
  falso.reiniciarPeticiones();
  const r = await A.sync.sincronizar();
  assert.equal(r.subioDatos, false);
  assert.equal(falso.contar('POST') + falso.contar('PATCH') + falso.contar('DELETE'), 0);
  assert.equal(r.registrosTraidos, 0);
});

test('una edición en un dispositivo llega al otro', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  const B = dispositivo(falso, { desde: 100, prefijo: 'b' });
  await sembrar(A.store);
  await A.sync.sincronizar();
  await B.sync.sincronizar();

  const perro = await B.store.obtener('palabras', 'perro');
  await B.store.guardar('palabras', { ...perro, texto: 'perrito' });
  await B.sync.sincronizar();
  await A.sync.sincronizar();
  assert.equal((await A.store.obtener('palabras', 'perro')).texto, 'perrito');
});

test('un borrado viaja: la palabra desaparece en el otro dispositivo', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  const B = dispositivo(falso, { desde: 100, prefijo: 'b' });
  await sembrar(A.store);
  await A.sync.sincronizar();
  await B.sync.sincronizar();

  await B.store.borrar('palabras', 'gato');
  await B.sync.sincronizar();
  await A.sync.sincronizar();
  assert.deepEqual(await ids(A.store, 'palabras'), ['perro']);
  assert.deepEqual(await ids(A.store, 'palabras', true), ['gato', 'perro'], 'queda la marca de borrado');
});

test('un medio borrado se quita de Drive y su contenido del otro dispositivo', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  const B = dispositivo(falso, { desde: 100, prefijo: 'b' });
  await sembrar(A.store);
  await A.sync.sincronizar();
  await B.sync.sincronizar();

  await A.store.guardar('medios', { ...(await A.store.obtener('medios', 'foto-perro')), blob: null, deleted: true });
  await A.store.guardar('palabras', { ...(await A.store.obtener('palabras', 'perro')), medioImagenId: null });
  await A.sync.sincronizar();
  assert.deepEqual(falso.nombres(), ['data.json'], 'el archivo de la imagen se borró de Drive');
  await B.sync.sincronizar();
  assert.equal(await B.store.obtener('medios', 'foto-perro'), undefined);
  const guardado = (await B.store.listar('medios', { conBorrados: true }))[0];
  assert.equal(guardado.deleted, true);
  assert.equal(guardado.blob, null);
});

test('cosas distintas creadas en cada dispositivo se juntan en los dos', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  const B = dispositivo(falso, { desde: 100, prefijo: 'b' });
  await A.store.guardar('perfiles', { id: 'perfil', nombre: 'Leo' });
  await A.store.guardar('palabras', { id: 'a-mama', perfilId: 'perfil', texto: 'mamá' });
  await B.store.guardar('perfiles', { id: 'perfil', nombre: 'Leo' });
  await B.store.guardar('palabras', { id: 'b-papa', perfilId: 'perfil', texto: 'papá' });
  await B.store.guardar('medios', { id: 'foto-b', tipo: 'imagen', mime: 'image/webp', blob: foto(9, 9) });

  await A.sync.sincronizar();
  await B.sync.sincronizar();
  await A.sync.sincronizar(); // A se entera de lo que B subió
  for (const D of [A, B]) {
    assert.deepEqual(await ids(D.store, 'palabras'), ['a-mama', 'b-papa']);
    assert.deepEqual(await bytesDe((await D.store.obtener('medios', 'foto-b')).blob), [9, 9]);
  }
  assert.deepEqual(falso.nombres(), ['data.json', 'medio-foto-b.webp']);
});

test('si se edita lo mismo en los dos lados, gana lo más reciente', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  const B = dispositivo(falso, { desde: 100, prefijo: 'b' });
  await sembrar(A.store);
  await A.sync.sincronizar();
  await B.sync.sincronizar();

  await A.store.guardar('palabras', { ...(await A.store.obtener('palabras', 'gato')), texto: 'gato-de-A' }); // más viejo
  await B.store.guardar('palabras', { ...(await B.store.obtener('palabras', 'gato')), texto: 'gato-de-B' }); // más nuevo
  await A.sync.sincronizar();
  await B.sync.sincronizar();
  await A.sync.sincronizar();
  assert.equal((await A.store.obtener('palabras', 'gato')).texto, 'gato-de-B');
  assert.equal((await B.store.obtener('palabras', 'gato')).texto, 'gato-de-B');
});

test('no se pisa un archivo de Drive dañado ni de una versión más nueva', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  await sembrar(A.store);
  await A.drive.crear('data.json', '{"cualquier":"cosa"}', 'application/json');
  await assert.rejects(() => A.sync.sincronizar(), (e) => e instanceof ErrorSync && /no es de Leo Conmigo/.test(e.message));
  assert.deepEqual(falso.json('data.json'), { cualquier: 'cosa' }, 'Drive quedó igual');
  assert.ok((await A.store.pendientesSync()).length > 0, 'nada se quitó de la cola');

  const falso2 = crearDriveFalso();
  const A2 = dispositivo(falso2);
  await A2.drive.crear('data.json', JSON.stringify({ formato: 'leo-conmigo-sync', version: 99, almacenes: {} }), 'application/json');
  await assert.rejects(() => A2.sync.sincronizar(), (e) => /más nueva/.test(e.message));
});

test('si Drive falla a mitad, no se pierde nada y el siguiente intento termina el trabajo', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  await sembrar(A.store);
  falso.estado.fallar = (metodo, ruta) => (metodo === 'POST' && falso.estado.archivos.size >= 1 ? 503 : undefined); // sube la imagen, falla el data.json
  await assert.rejects(() => A.sync.sincronizar(), (e) => /no responde/.test(e.message));
  assert.ok((await A.store.pendientesSync()).length > 0, 'la cola sigue llena');
  assert.equal(await A.store.leerMeta('syncUltimo'), undefined);

  falso.estado.fallar = null;
  const r = await A.sync.sincronizar();
  assert.equal(r.subioDatos, true);
  assert.equal(r.mediosSubidos, 0, 'la imagen ya estaba subida');
  assert.deepEqual(falso.nombres(), ['data.json', 'medio-foto-perro.webp']);
  assert.deepEqual(await A.store.pendientesSync(), []);
});

test('lo que cambia mientras se sincroniza no se pierde ni sale de la cola', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  await sembrar(A.store);
  const original = A.drive.actualizar;
  // el niño termina un ensayo justo cuando se está subiendo
  const editarDuranteLaSubida = async () => A.store.guardar('palabras', { ...(await A.store.obtener('palabras', 'gato')), texto: 'gatito' });
  const driveConEdicion = { ...A.drive, crear: async (...args) => { const id = await A.drive.crear(...args); if (args[0] === 'data.json') await editarDuranteLaSubida(); return id; } };
  const sync = crearSincronizador({ store: A.store, drive: driveConEdicion });
  await sync.sincronizar();
  const pendientes = await A.store.pendientesSync();
  assert.deepEqual(pendientes.map((p) => p.clave), ['palabras/gato'], 'la edición sigue esperando su turno');
  assert.equal((await A.store.obtener('palabras', 'gato')).texto, 'gatito');
  await A.sync.sincronizar();
  assert.equal(falso.json('data.json').almacenes.palabras.find((p) => p.id === 'gato').texto, 'gatito');
  assert.deepEqual(await A.store.pendientesSync(), []);
  void original;
});

test('un registro que cambió aquí durante la bajada no se pisa con la versión de Drive', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  const B = dispositivo(falso, { desde: 100, prefijo: 'b' });
  await sembrar(A.store);
  await A.sync.sincronizar();
  await B.sync.sincronizar();
  // B sube una versión nueva de «gato» y una imagen nueva
  await B.store.guardar('palabras', { ...(await B.store.obtener('palabras', 'gato')), texto: 'gato-remoto' });
  await B.store.guardar('medios', { id: 'foto-nueva', tipo: 'imagen', mime: 'image/webp', blob: foto(5) });
  await B.sync.sincronizar();
  // A, mientras baja la imagen, edita «gato» localmente
  const driveConEdicion = {
    ...A.drive,
    leerBlob: async (id) => {
      const blob = await A.drive.leerBlob(id);
      await A.store.guardar('palabras', { ...(await A.store.obtener('palabras', 'gato')), texto: 'gato-local' });
      return blob;
    },
  };
  await crearSincronizador({ store: A.store, drive: driveConEdicion }).sincronizar();
  assert.equal((await A.store.obtener('palabras', 'gato')).texto, 'gato-local', 'la edición local no se pierde');
  assert.ok((await A.store.pendientesSync()).some((p) => p.clave === 'palabras/gato'));
  assert.ok(await A.store.obtener('medios', 'foto-nueva'), 'lo demás sí se trajo');
});

test('dos sincronizaciones a la vez comparten el mismo trabajo', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  await sembrar(A.store);
  const [r1, r2] = await Promise.all([A.sync.sincronizar(), A.sync.sincronizar()]);
  assert.equal(r1, r2);
  assert.equal(falso.contar('POST'), 2, 'una imagen y el data.json, una sola vez');
  assert.equal(A.sync.ocupado, false);
});

test('un medio que no está en ningún dispositivo se avisa pero no rompe la sincronización', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  const B = dispositivo(falso, { desde: 100, prefijo: 'b' });
  await sembrar(A.store);
  await A.sync.sincronizar();
  falso.estado.archivos.delete([...falso.estado.archivos.values()].find((a) => a.name.startsWith('medio-')).id); // se perdió el archivo
  const r = await B.sync.sincronizar();
  assert.equal(r.mediosSinArchivo, 1);
  assert.deepEqual(await ids(B.store, 'palabras'), ['gato', 'perro']);
});

test('con muchas imágenes (varias páginas de Drive) se sincroniza todo', async () => {
  const falso = crearDriveFalso({ tamanoPagina: 3 });
  const A = dispositivo(falso);
  const B = dispositivo(falso, { desde: 100, prefijo: 'b' });
  for (let i = 0; i < 8; i++) await A.store.guardar('medios', { id: `m${i}`, tipo: 'imagen', mime: 'image/webp', blob: foto(i) });
  await A.sync.sincronizar();
  const r = await B.sync.sincronizar();
  assert.equal(r.mediosBajados, 8);
  assert.equal((await B.store.listar('medios')).length, 8);
  falso.reiniciarPeticiones();
  await B.sync.sincronizar();
  assert.equal(falso.contar('POST') + falso.contar('PATCH'), 0);
});

test('todos los almacenes de la app viajan', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  const B = dispositivo(falso, { desde: 100, prefijo: 'b' });
  for (const almacen of ALMACENES_SYNC) {
    if (almacen === 'medios') continue;
    await A.store.guardar(almacen, { id: `${almacen}-1`, perfilId: 'perfil' });
  }
  await A.sync.sincronizar();
  await B.sync.sincronizar();
  for (const almacen of ALMACENES_SYNC) {
    if (almacen === 'medios') continue;
    assert.deepEqual(await ids(B.store, almacen), [`${almacen}-1`], almacen);
  }
});
