import test from 'node:test';
import assert from 'node:assert/strict';
import { acreditarAlbumesPendientes, cargarMonedas, ganarCalcomania } from '../js/albumes.js';
import { CODIGOS_CATALOGO } from '../js/core/calcomanias.js';
import { saldo, crearCanje } from '../js/core/album.js';
import { crearAleatorio } from '../js/core/azar.js';
import { crearStoreEnMemoria } from './memoria.js';

const perfilDe = (album) => ({ id: 'p1', nombre: 'Leo', album });
let reloj = 0;
const ahora = () => new Date(Date.UTC(2026, 10, 1, 10, 0, 0, reloj++)).toISOString();

test('ganarCalcomania: sin repetir dentro del álbum y el 12.º paga 10 monedas', async () => {
  const s = crearStoreEnMemoria();
  const perfil = perfilDe({});
  const azar = crearAleatorio(7);
  const vistas = new Set();
  let ultimo;
  for (let i = 1; i <= 12; i++) {
    ultimo = await ganarCalcomania(s, perfil, { aleatorio: azar, ahora });
    assert.ok(!vistas.has(ultimo.codigo), `repetida: ${ultimo.codigo}`);
    vistas.add(ultimo.codigo);
    assert.equal(ultimo.album === null, i < 12, `álbum completo solo en la 12 (i=${i})`);
  }
  assert.equal(ultimo.album.numero, 1);
  assert.equal(ultimo.album.monedas, 10);
  assert.equal(ultimo.saldo, 10);
  assert.equal(ultimo.album.codigos.length, 12);

  const datos = await cargarMonedas(s, perfil);
  assert.equal(datos.saldo, 10);
  assert.equal(datos.completos.length, 1);
  assert.equal(datos.actual.numero, 2);
  assert.equal(datos.actual.codigos.length, 0, 'el álbum nuevo empieza vacío');
});

test('ganarCalcomania: el segundo álbum es otro y paga otra vez', async () => {
  const s = crearStoreEnMemoria();
  const perfil = perfilDe({ tamano: 6, monedasPorAlbum: 4 });
  const azar = crearAleatorio(2);
  let r;
  for (let i = 0; i < 12; i++) r = await ganarCalcomania(s, perfil, { aleatorio: azar, ahora });
  assert.equal(r.album.numero, 2);
  assert.equal(r.saldo, 8);
  assert.equal((await cargarMonedas(s, perfil)).completos.length, 2);
});

test('ganarCalcomania: solo salen las calcomanías que el adulto dejó en juego', async () => {
  const s = crearStoreEnMemoria();
  const elegidas = ['sol', 'luna', 'flor', 'pez', 'casa', 'barco'];
  const perfil = perfilDe({ tamano: 6, codigos: elegidas });
  const azar = crearAleatorio(4);
  for (let i = 0; i < 6; i++) {
    const r = await ganarCalcomania(s, perfil, { aleatorio: azar, ahora });
    assert.ok(elegidas.includes(r.codigo), r.codigo);
  }
  assert.equal((await cargarMonedas(s, perfil)).saldo, 10);
});

test('ganarCalcomania: entra una calcomanía propia del adulto', async () => {
  const s = crearStoreEnMemoria();
  await s.guardar('calcomaniasPropias', { id: 'mi-gato', perfilId: 'p1', nombre: 'Mi gato', emoji: '🐱' });
  const perfil = perfilDe({ tamano: 6, codigos: ['sol', 'luna', 'flor', 'pez', 'casa', 'propia:mi-gato'] });
  const codigos = [];
  for (let i = 0; i < 6; i++) codigos.push((await ganarCalcomania(s, perfil, { aleatorio: crearAleatorio(i + 1), ahora })).codigo);
  assert.ok(codigos.includes('propia:mi-gato'), 'la propia sale dentro del álbum');
});

test('acreditarAlbumesPendientes: el niño que ya tenía el álbum lleno recibe sus monedas una sola vez', async () => {
  const s = crearStoreEnMemoria();
  for (let i = 0; i < 12; i++) await s.guardar('calcomanias', { perfilId: 'p1', codigo: CODIGOS_CATALOGO[i], fecha: ahora() });
  const perfil = perfilDe({});
  const primera = await acreditarAlbumesPendientes(s, perfil);
  assert.equal(primera.length, 1);
  assert.equal(saldo(await s.listar('movimientos', { perfilId: 'p1' })), 10);
  const segunda = await acreditarAlbumesPendientes(s, perfil);
  assert.equal(segunda.length, 0);
  assert.equal(saldo(await s.listar('movimientos', { perfilId: 'p1' })), 10);
});

test('ganarCalcomania: la sesión que completa el álbum es la única que lo anuncia', async () => {
  const s = crearStoreEnMemoria();
  // álbum viejo ya lleno, sin premio: hoy gana la 13.ª calcomanía
  for (let i = 0; i < 12; i++) await s.guardar('calcomanias', { perfilId: 'p1', codigo: CODIGOS_CATALOGO[i], fecha: ahora() });
  const r = await ganarCalcomania(s, perfilDe({}), { aleatorio: crearAleatorio(1), ahora });
  assert.equal(r.album, null, 'no es ella quien lo completó');
  assert.equal(r.saldo, 10, 'pero el premio atrasado ya está en el cofre');
});

test('el saldo cuenta el premio y el canje, y anular devuelve las monedas', async () => {
  const s = crearStoreEnMemoria();
  const perfil = perfilDe({ tamano: 6 });
  for (let i = 0; i < 6; i++) await ganarCalcomania(s, perfil, { aleatorio: crearAleatorio(i), ahora });
  const premio = await s.guardar('premios', { perfilId: 'p1', nombre: 'Helado', precio: 4, activo: true, orden: 0 });
  const canje = await s.guardar('movimientos', crearCanje({ perfilId: 'p1', premio }));
  assert.equal((await cargarMonedas(s, perfil)).saldo, 6);
  await s.guardar('movimientos', { ...canje, estado: 'anulado' });
  assert.equal((await cargarMonedas(s, perfil)).saldo, 10);
});

test('cambiar el tamaño del álbum no cambia el saldo ni reabre un álbum completo', async () => {
  const s = crearStoreEnMemoria();
  for (let i = 0; i < 12; i++) await ganarCalcomania(s, perfilDe({}), { aleatorio: crearAleatorio(i), ahora });
  const achicado = perfilDe({ tamano: 6 });
  const datos = await cargarMonedas(s, achicado);
  assert.equal(datos.saldo, 10);
  assert.equal(datos.completos.length, 1);
  assert.equal(datos.completos[0].codigos.length, 12);
  assert.equal(datos.actual.codigos.length, 0);
});
