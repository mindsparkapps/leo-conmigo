import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORMATO, VERSION_RESPALDO, ErrorRespaldo, armarRespaldo, blobABase64, base64ABlob, decodificarRespaldo, fusionar, validarRespaldo,
} from '../js/core/respaldo.js';
import { exportarTodo, importarTodo, nombreDeArchivo, contarRespaldo } from '../js/respaldo.js';
import { crearAleatorio } from '../js/core/azar.js';
import { bytesDe, crearStoreEnMemoria } from './memoria.js';

const octetos = (n, semilla = 1) => {
  const azar = crearAleatorio(semilla);
  return Uint8Array.from({ length: n }, () => Math.floor(azar() * 256));
};

/** Un almacén con un niño completo: perfil, palabras, fotos, un audio, progreso, sesión y calcomanía. */
async function llenarAlmacen() {
  const s = crearStoreEnMemoria();
  const foto = await s.guardar('medios', { id: 'm-foto', tipo: 'imagen', mime: 'image/webp', origen: 'foto', subido: false, blob: new Blob([octetos(300, 1)], { type: 'image/webp' }) });
  const voz = await s.guardar('medios', { id: 'm-voz', tipo: 'audio', mime: 'audio/webm;codecs=opus', origen: 'grabacion', subido: false, blob: new Blob([octetos(40000, 2)], { type: 'audio/webm;codecs=opus' }) });
  await s.guardar('perfiles', { id: 'p1', nombre: 'Leo', fotoMedioId: foto.id, ajustes: { ensayosPorSesion: 10, mayusculas: true }, etapaActual: 1, creado: '2026-11-01T10:00:00.000Z' });
  await s.guardar('palabras', { id: 'w1', perfilId: 'p1', texto: 'mamá', silabas: ['ma', 'má'], medioImagenId: foto.id, medioAudioId: voz.id, orden: 0, activa: true });
  await s.guardar('palabras', { id: 'w2', perfilId: 'p1', texto: 'bebé', silabas: ['be', 'bé'], emoji: '👶', orden: 1, activa: true });
  await s.guardar('progresos', { id: 'p1:w1:L1', perfilId: 'p1', elementoId: 'w1', actividad: 'L1', estado: 'dominada', historial: [{ fecha: '2026-11-02T10:00:00', correctoAlPrimerIntento: true, opciones: 2 }], cajaLeitner: 2, proximoRepaso: '2026-11-09', fallosRepaso: 0 });
  await s.guardar('niveles', { id: 'p1:L1', perfilId: 'p1', actividad: 'L1', opciones: 3, ultimos: [true, true] });
  await s.guardar('sesiones', { id: 'ses1', perfilId: 'p1', inicio: '2026-11-02T10:00:00.000Z', fin: '2026-11-02T10:04:00.000Z', fatiga: false, ensayos: [{ elementoId: 'w1', actividad: 'L1', correctoAlPrimerIntento: true }] });
  await s.guardar('calcomanias', { id: 'c1', perfilId: 'p1', codigo: 'estrella', fecha: '2026-11-02T10:04:00.000Z' });
  await s.guardar('calcomaniasPropias', { id: 'cp1', perfilId: 'p1', nombre: 'Mi gato', emoji: '🐱' });
  await s.guardar('premios', { id: 'pr1', perfilId: 'p1', nombre: 'Helado', precio: 5, emoji: '🍦', activo: true, orden: 0 });
  await s.guardar('movimientos', { id: 'album:p1:1', perfilId: 'p1', fecha: '2026-11-02T10:04:00.000Z', cantidad: 10, tipo: 'album', albumNumero: 1 });
  await s.guardar('movimientos', { id: 'mv-canje', perfilId: 'p1', fecha: '2026-11-03T10:04:00.000Z', cantidad: -5, tipo: 'canje', premioId: 'pr1', estado: 'pendiente' });
  await s.guardar('respuestas', { id: 'ses1:1', perfilId: 'p1', sesionId: 'ses1', numeroEnSesion: 1, elementoId: 'w1', texto: 'mamá', actividad: 'L1', errores: [{ id: 'w2', texto: 'bebé', ms: 1800 }], msPrimerToque: 1800, msAcierto: 3200, repeticionesAudio: 1 });
  // algo borrado: no debe viajar en la copia
  await s.guardar('palabras', { id: 'w-borrada', perfilId: 'p1', texto: 'fuera', orden: 9, activa: true, deleted: true });
  await s.escribirMeta('perfilActivoId', 'p1');
  return s;
}

const igualAlmacen = async (a, b, nombres) => {
  for (const n of nombres) {
    const la = (await a.listar(n)).sort((x, y) => x.id.localeCompare(y.id));
    const lb = (await b.listar(n)).sort((x, y) => x.id.localeCompare(y.id));
    assert.equal(lb.length, la.length, `${n}: cantidad`);
    for (let i = 0; i < la.length; i++) {
      const { blob: ba, ...ra } = la[i];
      const { blob: bb, ...rb } = lb[i];
      assert.deepEqual(rb, ra, `${n}[${i}]`);
      if (ba) {
        assert.ok(bb instanceof Blob, `${n}[${i}]: vuelve como Blob`);
        assert.equal(bb.type, ba.type, `${n}[${i}]: tipo`);
        assert.deepEqual(await bytesDe(bb), await bytesDe(ba), `${n}[${i}]: contenido`);
      }
    }
  }
};
const NOMBRES = ['perfiles', 'palabras', 'progresos', 'niveles', 'sesiones', 'calcomanias', 'calcomaniasPropias', 'premios', 'movimientos', 'respuestas', 'medios'];

// ---------- base64 ----------

test('base64: ida y vuelta de un Blob, también con tamaños que cruzan el tamaño de trozo', async () => {
  for (const n of [0, 1, 2, 3, 100, 0x8000 - 1, 0x8000, 0x8000 + 1, 100000]) {
    const original = new Blob([octetos(n, n + 1)], { type: 'audio/mp4' });
    const vuelta = base64ABlob(await blobABase64(original), 'audio/mp4');
    assert.equal(vuelta.type, 'audio/mp4');
    assert.deepEqual(await bytesDe(vuelta), await bytesDe(original), `${n} bytes`);
  }
});

// ---------- armar ----------

test('armarRespaldo: sin borrados, con las imágenes y voces en base64 y convertible a JSON', async () => {
  const s = await llenarAlmacen();
  const respaldo = await exportarTodo(s, new Date(2026, 10, 5, 12, 0, 0));
  assert.equal(respaldo.formato, FORMATO);
  assert.equal(respaldo.version, VERSION_RESPALDO);
  assert.equal(respaldo.meta.perfilActivoId, 'p1');
  assert.deepEqual(contarRespaldo(respaldo), { medios: 2, perfiles: 1, palabras: 2, progresos: 1, niveles: 1, frases: 0, libros: 0, sesiones: 1, calcomanias: 1, calcomaniasPropias: 1, premios: 1, movimientos: 2, respuestas: 1 });
  assert.ok(!respaldo.almacenes.palabras.some((p) => p.id === 'w-borrada'));
  for (const m of respaldo.almacenes.medios) {
    assert.equal(typeof m.blobBase64, 'string');
    assert.ok(!('blob' in m));
  }
  const texto = JSON.stringify(respaldo);
  assert.ok(!texto.includes('"blob":'), 'ningún Blob suelto en el JSON');
  assert.equal(JSON.parse(texto).almacenes.perfiles[0].nombre, 'Leo');
});

test('armarRespaldo: un medio sin contenido o borrado no se incluye', async () => {
  const r = await armarRespaldo({ almacenes: { medios: [{ id: 'a', blob: null }, { id: 'b', deleted: true, blob: new Blob(['x']) }, { id: 'c', mime: 'x/y', blob: new Blob(['hola']) }] } });
  assert.deepEqual(r.almacenes.medios.map((m) => m.id), ['c']);
});

test('nombreDeArchivo lleva la fecha', () => {
  assert.equal(nombreDeArchivo(new Date(2026, 10, 5)), 'leo-conmigo-respaldo-2026-11-05.json');
});

// ---------- exportar -> importar ----------

test('exportar y luego importar en un almacén vacío deja todo igual (fotos y voces incluidas)', async () => {
  const origen = await llenarAlmacen();
  const texto = JSON.stringify(await exportarTodo(origen));
  const destino = crearStoreEnMemoria();
  const resumen = await importarTodo(destino, texto);

  await igualAlmacen(origen, destino, NOMBRES);
  assert.equal(await destino.leerMeta('perfilActivoId'), 'p1');
  assert.deepEqual(resumen.palabras, { nuevos: 2, omitidos: 0 });
  assert.deepEqual(resumen.medios, { nuevos: 2, omitidos: 0 });
  assert.equal((await destino.listar('palabras', { conBorrados: true })).length, 2, 'lo borrado no viaja');
});

test('importar dos veces el mismo archivo no cambia nada (la segunda vez todo se omite)', async () => {
  const texto = JSON.stringify(await exportarTodo(await llenarAlmacen()));
  const destino = crearStoreEnMemoria();
  await importarTodo(destino, texto);
  const segunda = await importarTodo(destino, texto);
  for (const n of NOMBRES) assert.equal(segunda[n].nuevos, 0, `${n}: nada nuevo`);
  assert.equal(segunda.palabras.omitidos, 2);
});

test('importar no borra lo que ya había: suma lo que falta', async () => {
  const texto = JSON.stringify(await exportarTodo(await llenarAlmacen()));
  const destino = crearStoreEnMemoria();
  await destino.guardar('perfiles', { id: 'otro', nombre: 'Ana', creado: '2026-10-01T10:00:00.000Z' });
  await destino.guardar('palabras', { id: 'solo-aqui', perfilId: 'otro', texto: 'sol', orden: 0, activa: true });
  await destino.escribirMeta('perfilActivoId', 'otro');
  await importarTodo(destino, texto);
  assert.deepEqual((await destino.listar('perfiles')).map((p) => p.id).sort(), ['otro', 'p1']);
  assert.ok(await destino.obtener('palabras', 'solo-aqui'));
  assert.equal(await destino.leerMeta('perfilActivoId'), 'otro', 'el niño activo de este dispositivo no se pisa');
});

test('si un registro está en los dos lados gana el más reciente', async () => {
  const origen = crearStoreEnMemoria();
  await origen.importar('palabras', [
    { id: 'a', texto: 'nuevo-de-la-copia', updatedAt: '2026-11-05T12:00:00.000Z' },
    { id: 'b', texto: 'viejo-de-la-copia', updatedAt: '2026-10-01T12:00:00.000Z' },
    { id: 'c', texto: 'igual-fecha-copia', updatedAt: '2026-11-01T12:00:00.000Z' },
  ]);
  const texto = JSON.stringify(await exportarTodo(origen));
  const destino = crearStoreEnMemoria();
  await destino.importar('palabras', [
    { id: 'a', texto: 'viejo-local', updatedAt: '2026-10-01T12:00:00.000Z' },
    { id: 'b', texto: 'nuevo-local', updatedAt: '2026-11-05T12:00:00.000Z' },
    { id: 'c', texto: 'igual-fecha-local', updatedAt: '2026-11-01T12:00:00.000Z' },
  ]);
  const r = await importarTodo(destino, texto);
  assert.equal((await destino.obtener('palabras', 'a')).texto, 'nuevo-de-la-copia');
  assert.equal((await destino.obtener('palabras', 'b')).texto, 'nuevo-local');
  assert.equal((await destino.obtener('palabras', 'c')).texto, 'igual-fecha-local', 'empate: se queda lo local');
  assert.deepEqual(r.palabras, { nuevos: 1, omitidos: 2 });
});

test('una eliminación más nueva que la copia no se deshace', async () => {
  const origen = crearStoreEnMemoria();
  await origen.importar('palabras', [{ id: 'a', texto: 'x', updatedAt: '2026-10-01T10:00:00.000Z', deleted: false }]);
  const texto = JSON.stringify(await exportarTodo(origen));
  const destino = crearStoreEnMemoria();
  await destino.importar('palabras', [{ id: 'a', texto: 'x', updatedAt: '2026-11-01T10:00:00.000Z', deleted: true }]);
  await importarTodo(destino, texto);
  assert.equal(await destino.obtener('palabras', 'a'), undefined, 'sigue borrada');
});

test('el niño activo de la copia solo se usa si existe ese perfil', async () => {
  const origen = await llenarAlmacen();
  const respaldo = await exportarTodo(origen);
  respaldo.meta.perfilActivoId = 'no-existe';
  const destino = crearStoreEnMemoria();
  await importarTodo(destino, JSON.stringify(respaldo));
  assert.equal(await destino.leerMeta('perfilActivoId'), undefined);
});

// ---------- archivos dañados: no se toca nada ----------

const intentar = async (texto) => {
  const destino = crearStoreEnMemoria();
  await destino.guardar('palabras', { id: 'previa', texto: 'previa', orden: 0 });
  let error = null;
  try {
    await importarTodo(destino, texto);
  } catch (e) {
    error = e;
  }
  assert.equal((await destino.listar('palabras')).length, 1, 'un archivo dañado no debe cambiar nada');
  assert.equal((await destino.listar('medios')).length, 0);
  return error;
};
const respaldoBueno = async () => JSON.parse(JSON.stringify(await exportarTodo(await llenarAlmacen())));

test('archivos que no son una copia: mensajes claros y nada cambia', async () => {
  for (const texto of ['', 'esto no es json', '[]', 'null', '{"hola":1}', JSON.stringify({ formato: 'otra-app', version: 1, almacenes: {} })]) {
    const e = await intentar(texto);
    assert.ok(e instanceof ErrorRespaldo, `debía fallar: ${texto}`);
    assert.match(e.message, /no es una copia|no se pudo leer/i);
  }
});

test('una copia de una versión más nueva se rechaza pidiendo actualizar la app', async () => {
  const r = await respaldoBueno();
  r.version = VERSION_RESPALDO + 1;
  const e = await intentar(JSON.stringify(r));
  assert.match(e.message, /versión más nueva/);
});

test('copias dañadas por dentro: falta de datos, registros sin id, base64 roto', async () => {
  let r = await respaldoBueno();
  delete r.almacenes;
  assert.match((await intentar(JSON.stringify(r))).message, /dañada/);

  r = await respaldoBueno();
  r.almacenes.palabras = 'no es una lista';
  assert.match((await intentar(JSON.stringify(r))).message, /dañada/);

  r = await respaldoBueno();
  r.almacenes.palabras.push({ texto: 'sin id' });
  assert.match((await intentar(JSON.stringify(r))).message, /sin identificador/);

  r = await respaldoBueno();
  delete r.almacenes.medios[0].blobBase64;
  assert.match((await intentar(JSON.stringify(r))).message, /falta el contenido/);

  r = await respaldoBueno();
  r.almacenes.medios[1].blobBase64 = '@@@no es base64@@@';
  const e = await intentar(JSON.stringify(r)); // el medio roto es el segundo: las palabras ya leídas tampoco se escriben
  assert.match(e.message, /no se puede leer/);
});

test('una copia sin algunos almacenes se acepta (los que faltan se toman como vacíos)', async () => {
  const destino = crearStoreEnMemoria();
  const resumen = await importarTodo(destino, JSON.stringify({ formato: FORMATO, version: 1, almacenes: { palabras: [{ id: 'a', texto: 'x', updatedAt: '2026-11-01T00:00:00.000Z' }] } }));
  assert.equal(resumen.palabras.nuevos, 1);
  assert.equal(resumen.perfiles.nuevos, 0);
});

// ---------- piezas sueltas ----------

test('validarRespaldo: acepta una copia buena', async () => {
  assert.equal(validarRespaldo(await respaldoBueno()), null);
});

test('decodificarRespaldo: devuelve los Blob listos y conserva el resto de los datos', async () => {
  const { almacenes, meta } = decodificarRespaldo(await respaldoBueno());
  assert.ok(almacenes.medios.every((m) => m.blob instanceof Blob && m.blob.size > 0));
  assert.equal(meta.perfilActivoId, 'p1');
  assert.equal(almacenes.palabras.length, 2);
});

test('fusionar: devuelve qué escribir y cuántos se omiten', () => {
  const r = fusionar([{ id: 'a', updatedAt: '2026-11-01' }], [{ id: 'a', updatedAt: '2026-11-02' }, { id: 'b', updatedAt: '' }, { id: 'a2' }]);
  assert.deepEqual(r.aEscribir.map((x) => x.id), ['a', 'b', 'a2']);
  assert.equal(r.omitidos, 0);
  assert.deepEqual(fusionar([], []), { aEscribir: [], omitidos: 0 });
});
