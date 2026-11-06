import test from 'node:test';
import assert from 'node:assert/strict';
import { ErrorDrive, crearDrive } from '../js/drive.js';
import { crearDriveFalso } from './drive-falso.js';
import { bytesDe } from './memoria.js';

const crear = (opciones = {}, tokens = {}) => {
  const falso = crearDriveFalso(opciones);
  const pedidos = [];
  const drive = crearDrive({
    obtenerToken: async (forzar) => { pedidos.push(forzar); return forzar ? tokens.nuevo ?? 'token-1' : tokens.inicial ?? 'token-1'; },
    fetchFn: falso.fetch,
  });
  return { falso, drive, pedidos };
};

test('crear y leer un JSON en la carpeta de la app', async () => {
  const { falso, drive } = crear();
  const id = await drive.crear('data.json', JSON.stringify({ a: 1, texto: 'ñandú' }), 'application/json');
  assert.deepEqual(falso.nombres(), ['data.json']);
  assert.deepEqual(await drive.leerJson(id), { a: 1, texto: 'ñandú' });
});

test('crear y leer un archivo binario (los bytes llegan intactos)', async () => {
  const { drive } = crear();
  const bytes = Uint8Array.from({ length: 300 }, (_, i) => (i * 7) % 256); // incluye 0, 13, 10, 255…
  const id = await drive.crear('medio-x.png', new Blob([bytes], { type: 'image/png' }), 'image/png');
  const blob = await drive.leerBlob(id);
  assert.deepEqual(await bytesDe(blob), Array.from(bytes));
});

test('actualizar reemplaza el contenido y borrar lo quita (borrar uno inexistente no falla)', async () => {
  const { falso, drive } = crear();
  const id = await drive.crear('data.json', '{"v":1}', 'application/json');
  await drive.actualizar(id, '{"v":2}', 'application/json');
  assert.deepEqual(await drive.leerJson(id), { v: 2 });
  await drive.borrar(id);
  assert.deepEqual(falso.nombres(), []);
  await drive.borrar(id); // ya no existe: no es un error
});

test('listar junta todas las páginas', async () => {
  const { drive } = crear({ tamanoPagina: 2 });
  for (let i = 0; i < 5; i++) await drive.crear(`medio-${i}.png`, 'x', 'image/png');
  const archivos = await drive.listar();
  assert.deepEqual(archivos.map((a) => a.name).sort(), ['medio-0.png', 'medio-1.png', 'medio-2.png', 'medio-3.png', 'medio-4.png']);
});

test('un token vencido (401) se renueva y la petición se repite una vez', async () => {
  const { falso, drive, pedidos } = crear({ tokenValido: 'token-2' }, { inicial: 'token-viejo', nuevo: 'token-2' });
  const archivos = await drive.listar();
  assert.deepEqual(archivos, []);
  assert.deepEqual(pedidos, [false, true], 'primero el token en memoria y después uno renovado');
  assert.equal(falso.contar('GET'), 2);
});

test('si el token renovado tampoco sirve, pide volver a iniciar sesión', async () => {
  const { drive } = crear({ tokenValido: 'otro' }, { inicial: 'a', nuevo: 'b' });
  await assert.rejects(() => drive.listar(), (e) => e instanceof ErrorDrive && e.sesion === true && e.estado === 401);
});

test('errores de Drive: sin permiso, saturado y sin conexión', async () => {
  const { falso, drive } = crear();
  falso.estado.fallar = () => 403;
  await assert.rejects(() => drive.listar(), (e) => e.sesion === true && /permiso/.test(e.message));
  falso.estado.fallar = () => 503;
  await assert.rejects(() => drive.listar(), (e) => !e.sesion && !e.sinConexion && /no responde/.test(e.message));
  falso.estado.fallar = () => 429;
  await assert.rejects(() => drive.listar(), (e) => /no responde/.test(e.message));
  falso.estado.fallar = null;
  falso.estado.sinRed = true;
  await assert.rejects(() => drive.listar(), (e) => e.sinConexion === true);
});

test('el token viaja en la cabecera Authorization y nunca en la URL', async () => {
  const urls = [];
  const drive = crearDrive({
    obtenerToken: async () => 'secreto',
    fetchFn: async (url, op) => { urls.push([url, op.headers.Authorization]); return new Response(JSON.stringify({ files: [] })); },
  });
  await drive.listar();
  assert.equal(urls[0][1], 'Bearer secreto');
  assert.ok(!urls[0][0].includes('secreto'));
  assert.ok(urls[0][0].includes('spaces=appDataFolder'));
});
