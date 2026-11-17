import test from 'node:test';
import assert from 'node:assert/strict';
import { crearSincronizador } from '../js/sync.js';
import { crearDrive } from '../js/drive.js';
import { planDeMedios } from '../js/core/sync.js';
import {
  idMedioDeCatalogo, medioDeCatalogo, migrarCatalogoUnaVez, migrarMediosDelCatalogo, ponerVocesIniciales,
} from '../js/medios.js';
import { crearDriveFalso } from './drive-falso.js';
import { bytesDe, crearStoreEnMemoria } from './memoria.js';

const CATALOGO = [
  { texto: 'mamá', voz: 'data/voces/mama.mp3' },
  { texto: 'papá', voz: 'data/voces/papa.mp3' },
  { texto: 'sin voz' },
];
const mp3 = (...bytes) => new Blob([Uint8Array.from(bytes)], { type: 'audio/mpeg' });

/** Una «app» falsa: sirve cada ruta con sus bytes y cuenta cuántas veces se pidió. */
function appFalsa(rutas = { 'data/voces/mama.mp3': [1, 2], 'data/voces/papa.mp3': [3, 4] }) {
  const pedidos = [];
  const traerDeApp = async (ruta) => {
    pedidos.push(ruta);
    return rutas[ruta] ? mp3(...rutas[ruta]) : null;
  };
  return { traerDeApp, pedidos };
}

const palabra = (id, perfilId, texto, extra = {}) => ({ id, perfilId, texto, ...extra });

test('crear voces para un perfil nuevo no baja ni crea audios que ya existían', async () => {
  const store = crearStoreEnMemoria();
  const app = appFalsa();
  const p1 = [palabra('a1', 'P1', 'mamá'), palabra('a2', 'P1', 'papá'), palabra('a3', 'P1', 'sin voz')];
  assert.equal(await ponerVocesIniciales(store, p1, CATALOGO, { traerDeApp: app.traerDeApp }), 2);
  assert.deepEqual(app.pedidos, ['data/voces/mama.mp3', 'data/voces/papa.mp3']);
  assert.equal((await store.listar('medios')).length, 2);

  // un segundo perfil con las mismas palabras: se reutilizan, sin pedir nada a la app ni crear medios
  const p2 = [palabra('b1', 'P2', 'mamá'), palabra('b2', 'P2', 'papá')];
  assert.equal(await ponerVocesIniciales(store, p2, CATALOGO, { traerDeApp: app.traerDeApp }), 2);
  assert.equal(app.pedidos.length, 2, 'no se volvió a sacar nada de la app');
  assert.equal((await store.listar('medios')).length, 2, 'no se creó ningún medio nuevo');
  assert.equal(p1[0].medioAudioId, p2[0].medioAudioId, 'dos perfiles comparten el mismo medio de «mamá»');
  assert.equal(p1[0].medioAudioId, idMedioDeCatalogo('data/voces/mama.mp3'));
  const medio = await store.obtener('medios', p1[0].medioAudioId);
  assert.equal(medio.origen, 'catalogo');
  assert.equal(medio.ruta, 'data/voces/mama.mp3');
  assert.deepEqual(await bytesDe(medio.blob), [1, 2], 'el contenido queda guardado en local para jugar sin red');
});

test('si no se puede sacar la voz de la app, la palabra queda sin audio y se reintenta después', async () => {
  const store = crearStoreEnMemoria();
  const sin = appFalsa({});
  const p = [palabra('a1', 'P1', 'mamá')];
  assert.equal(await ponerVocesIniciales(store, p, CATALOGO, { traerDeApp: sin.traerDeApp }), 0);
  assert.equal(p[0].medioAudioId, undefined);
  assert.equal((await store.listar('medios')).length, 0);
  const con = appFalsa();
  assert.equal(await ponerVocesIniciales(store, p, CATALOGO, { traerDeApp: con.traerDeApp }), 1);
});

test('un medio del catálogo que llegó sin contenido lo recibe de la app sin tocar su fecha ni la cola', async () => {
  const store = crearStoreEnMemoria();
  await store.importar('medios', [{ id: idMedioDeCatalogo('data/voces/mama.mp3'), tipo: 'audio', mime: 'audio/mpeg', origen: 'catalogo', ruta: 'data/voces/mama.mp3', updatedAt: '2026-11-05T10:00:01.000Z', deleted: false }]);
  const app = appFalsa();
  const medio = await medioDeCatalogo(store, 'data/voces/mama.mp3', { traerDeApp: app.traerDeApp });
  assert.deepEqual(await bytesDe(medio.blob), [1, 2]);
  assert.equal(medio.updatedAt, '2026-11-05T10:00:01.000Z');
  assert.deepEqual(await store.pendientesSync(), []);
});

// ---------- migración ----------

async function sembrarViejo(store) {
  // como antes: un medio por palabra y por perfil, sin `ruta`
  await store.guardar('medios', { id: 'v1', tipo: 'audio', mime: 'audio/mpeg', origen: 'catalogo', blob: mp3(1, 2) });
  await store.guardar('medios', { id: 'v2', tipo: 'audio', mime: 'audio/mpeg', origen: 'catalogo', blob: mp3(1, 2) });
  await store.guardar('medios', { id: 'v3', tipo: 'audio', mime: 'audio/mpeg', origen: 'catalogo', blob: mp3(3, 4) });
  await store.guardar('medios', { id: 'propio', tipo: 'audio', mime: 'audio/webm', origen: 'grabacion', blob: new Blob(['x']) });
  await store.guardar('palabras', palabra('a1', 'P1', 'mamá', { medioAudioId: 'v1' }));
  await store.guardar('palabras', palabra('b1', 'P2', 'mamá', { medioAudioId: 'v2' }));
  await store.guardar('palabras', palabra('a2', 'P1', 'papá', { medioAudioId: 'v3' }));
  await store.guardar('palabras', palabra('a3', 'P1', 'mamá chica', { medioAudioId: 'propio' }));
}

test('migración: los repetidos se unen en uno por ruta, se reescriben las palabras y los sobrantes se borran del almacén', async () => {
  const store = crearStoreEnMemoria();
  await sembrarViejo(store);
  const r = await migrarMediosDelCatalogo(store, CATALOGO);
  assert.deepEqual(r, { palabras: 3, medios: 3 });
  const vivos = await store.listar('medios');
  assert.deepEqual(vivos.map((m) => m.id).sort(), ['catalogo:data/voces/mama.mp3', 'catalogo:data/voces/papa.mp3', 'propio']);
  assert.equal((await store.obtener('palabras', 'a1')).medioAudioId, 'catalogo:data/voces/mama.mp3');
  assert.equal((await store.obtener('palabras', 'b1')).medioAudioId, 'catalogo:data/voces/mama.mp3');
  assert.equal((await store.obtener('palabras', 'a2')).medioAudioId, 'catalogo:data/voces/papa.mp3');
  assert.equal((await store.obtener('palabras', 'a3')).medioAudioId, 'propio', 'una grabación del adulto no se toca');
  const canonico = await store.obtener('medios', 'catalogo:data/voces/mama.mp3');
  assert.deepEqual(await bytesDe(canonico.blob), [1, 2], 'se aprovecha el contenido que ya estaba en local');
  const v1 = await store.obtener('medios', 'v1', { conBorrados: true });
  assert.equal(v1.deleted, true);
  assert.equal(v1.blob, null);
  assert.equal(v1.conservarEnDrive, true);
  // segunda pasada: nada que hacer
  assert.deepEqual(await migrarMediosDelCatalogo(store, CATALOGO), { palabras: 0, medios: 0 });
});

test('migración: lo que no se puede emparejar no se toca (texto cambiado o medio sin contenido)', async () => {
  const store = crearStoreEnMemoria();
  await store.guardar('medios', { id: 'x', tipo: 'audio', mime: 'audio/mpeg', origen: 'catalogo', blob: mp3(9) });
  await store.guardar('medios', { id: 'y', tipo: 'audio', mime: 'audio/mpeg', origen: 'catalogo' });
  await store.guardar('palabras', palabra('a', 'P1', 'otra cosa', { medioAudioId: 'x' }));
  await store.guardar('palabras', palabra('b', 'P1', 'mamá', { medioAudioId: 'y' }));
  assert.deepEqual(await migrarMediosDelCatalogo(store, CATALOGO), { palabras: 0, medios: 0 });
  assert.equal((await store.obtener('palabras', 'a')).medioAudioId, 'x');
  assert.equal((await store.obtener('medios', 'x')).deleted, false);
});

test('migrarCatalogoUnaVez: corre una sola vez y, si falla el catálogo, se reintenta', async () => {
  const store = crearStoreEnMemoria();
  await sembrarViejo(store);
  assert.equal(await migrarCatalogoUnaVez(store, { leerCatalogo: async () => { throw new Error('sin red'); } }), null);
  assert.equal(await store.leerMeta('catalogoSinCopias1'), undefined);
  assert.deepEqual(await migrarCatalogoUnaVez(store, { leerCatalogo: async () => CATALOGO }), { palabras: 3, medios: 3 });
  assert.equal(await migrarCatalogoUnaVez(store, { leerCatalogo: async () => CATALOGO }), null);
});

// ---------- planDeMedios ----------

test('planDeMedios: un medio con ruta nunca se sube ni se baja; se pide a la app si falta su contenido', () => {
  const medios = [
    { id: 'catalogo:a', mime: 'audio/mpeg', ruta: 'a', deleted: false },
    { id: 'catalogo:b', mime: 'audio/mpeg', ruta: 'b', deleted: false },
    { id: 'catalogo:c', mime: 'audio/mpeg', ruta: 'c', deleted: true },
    { id: 'foto', mime: 'image/webp', deleted: false },
  ];
  const archivos = new Map([['medio-catalogo:b.mp3', { id: 'arch-b' }], ['medio-catalogo:c.mp3', { id: 'arch-c' }]]);
  const plan = planDeMedios({ medios, archivos, conBlobLocal: new Set(['catalogo:a', 'foto']) });
  assert.deepEqual(plan.subir.map((s) => s.medio.id), ['foto']);
  assert.deepEqual(plan.bajar, []);
  assert.deepEqual(plan.borrarRemotos, []);
  assert.deepEqual(plan.deApp.map((m) => m.id), ['catalogo:b']);
});

test('planDeMedios: un medio borrado con `conservarEnDrive` deja su archivo en Drive (lo decide la limpieza)', () => {
  const medios = [
    { id: 'v1', mime: 'audio/mpeg', deleted: true, conservarEnDrive: true },
    { id: 'v2', mime: 'audio/mpeg', deleted: true },
  ];
  const archivos = new Map([['medio-v1.mp3', { id: 'a1' }], ['medio-v2.mp3', { id: 'a2' }]]);
  const plan = planDeMedios({ medios, archivos, conBlobLocal: new Set() });
  assert.deepEqual(plan.borrarRemotos.map((b) => b.archivoId), ['a2']);
});

// ---------- sincronización ----------

function dispositivo(falso, { desde = 0, prefijo = 'a', app = appFalsa() } = {}) {
  const store = crearStoreEnMemoria({ desde, prefijo });
  const drive = crearDrive({ obtenerToken: async () => 'token-1', fetchFn: falso.fetch });
  const sync = crearSincronizador({ store, drive, ahora: () => new Date(Date.UTC(2026, 10, 5, 11, 0, 0)), traerDeApp: app.traerDeApp });
  return { store, drive, sync, app };
}

test('sincronización personal: una voz del catálogo no se sube a Drive y el otro dispositivo la toma de su app', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  await A.store.guardar('perfiles', { id: 'P1', nombre: 'Leo' });
  const palabras = [palabra('a1', 'P1', 'mamá'), palabra('a2', 'P1', 'papá')];
  await ponerVocesIniciales(A.store, palabras, CATALOGO, { traerDeApp: A.app.traerDeApp });
  for (const p of palabras) await A.store.guardar('palabras', p);
  const r = await A.sync.sincronizar();
  assert.deepEqual(falso.nombres(), ['data.json'], 'ningún medio-* del catálogo en Drive');
  assert.equal(r.mediosSubidos, 0);

  const B = dispositivo(falso, { desde: 100, prefijo: 'b' });
  const rb = await B.sync.sincronizar();
  assert.equal(rb.mediosBajados, 0);
  const medio = await B.store.obtener('medios', 'catalogo:data/voces/mama.mp3');
  assert.deepEqual(await bytesDe(medio.blob), [1, 2], 'el dispositivo B tiene la voz guardada en local');
  assert.deepEqual(B.app.pedidos.sort(), ['data/voces/mama.mp3', 'data/voces/papa.mp3']);
  assert.deepEqual(await B.store.pendientesSync(), []);
});

test('sincronización personal: si la app no puede dar la voz, se reintenta en la siguiente', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  await A.store.guardar('perfiles', { id: 'P1', nombre: 'Leo' });
  const p = [palabra('a1', 'P1', 'mamá')];
  await ponerVocesIniciales(A.store, p, CATALOGO, { traerDeApp: A.app.traerDeApp });
  await A.store.guardar('palabras', p[0]);
  await A.sync.sincronizar();

  const B = dispositivo(falso, { desde: 100, prefijo: 'b', app: appFalsa({}) });
  await B.sync.sincronizar();
  assert.equal((await B.store.obtener('medios', 'catalogo:data/voces/mama.mp3')).blob ?? null, null);
  // la siguiente sincronización, ya con una app que sí responde
  const B2 = crearSincronizador({
    store: B.store, drive: B.drive, ahora: () => new Date(Date.UTC(2026, 10, 5, 11, 0, 0)), traerDeApp: appFalsa().traerDeApp,
  });
  await B2.sincronizar();
  assert.deepEqual(await bytesDe((await B.store.obtener('medios', 'catalogo:data/voces/mama.mp3')).blob), [1, 2]);
});

test('sincronización: tras la migración los archivos viejos siguen en Drive y ningún medio del catálogo se sube', async () => {
  const falso = crearDriveFalso();
  const A = dispositivo(falso);
  await A.store.guardar('perfiles', { id: 'P1', nombre: 'Leo' });
  await sembrarViejo(A.store);
  await A.sync.sincronizar(); // como antes de la migración: sube los medios viejos
  const antes = falso.nombres();
  assert.ok(antes.includes('medio-v1.mp3'));

  await migrarMediosDelCatalogo(A.store, CATALOGO);
  const r = await A.sync.sincronizar();
  assert.equal(r.mediosSubidos, 0, 'ningún medio nuevo del catálogo se sube');
  const despues = falso.nombres();
  assert.deepEqual(despues, antes, 'no se borró ni se subió ningún archivo: la limpieza es de la fase 26');
  assert.ok(!despues.some((n) => n.includes('catalogo')));
});

// ---------- el alumno recibe la voz sin que exista su `medio-*` en Drive ----------

test('un alumno recibe la voz del catálogo sin archivo en Drive y la deja guardada en local (juega sin red)', async () => {
  const { crearNubeFalsa } = await import('./drive-falso.js');
  const { crearAulas } = await import('../js/aulas.js');
  const ADULTO = 'adulto@ejemplo.com';
  const ALUMNO = 'pedro@gmail.com';
  const nube = crearNubeFalsa();
  const tienda = crearStoreEnMemoria({ prefijo: 'ad' });
  await tienda.guardar('perfiles', { id: 'P1', nombre: 'Pedro' });
  const palabras = [palabra('w1', 'P1', 'mamá')];
  await ponerVocesIniciales(tienda, palabras, CATALOGO, { traerDeApp: appFalsa().traerDeApp });
  await tienda.guardar('palabras', palabras[0]);
  const adulto = crearAulas({ store: tienda, ...nube.dep(ADULTO), emailAdulto: ADULTO, versionApp: '0.37.0' });
  await adulto.crearAula(await tienda.obtener('perfiles', 'P1'));
  await adulto.invitar('P1', ALUMNO);
  await adulto.sincronizarAula('P1');
  assert.ok(!nube.estado.archivos.size || ![...nube.estado.archivos.values()].some((a) => a.name.includes('catalogo')), 'ningún medio-* del catálogo en Drive');

  const app = appFalsa();
  const store = crearStoreEnMemoria({ prefijo: 'al', desde: 100 });
  const alumno = crearAulas({ store, ...nube.dep(ALUMNO), idDispositivo: 'disp-a', nombreDispositivo: 'Tablet', versionApp: '0.37.0', traerDeApp: app.traerDeApp });
  const [aula] = await alumno.buscarMiAula();
  const r = await alumno.sincronizarComoAlumno({ aula, email: ALUMNO });
  assert.equal(r.desvinculado, false);
  assert.equal((await store.obtener('palabras', 'w1')).medioAudioId, 'catalogo:data/voces/mama.mp3');
  const medio = await store.obtener('medios', 'catalogo:data/voces/mama.mp3');
  assert.deepEqual(await bytesDe(medio.blob), [1, 2], 'la voz está guardada en el almacén del alumno');
  assert.deepEqual(app.pedidos, ['data/voces/mama.mp3']);
});
