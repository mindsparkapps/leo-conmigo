import test from 'node:test';
import assert from 'node:assert/strict';
import { comprarSobre, cargarMonedas, reiniciarAlbumes, venderRepetida } from '../js/albumes.js';
import { LAMINAS_POR_SOBRE, precioDeSobre, registroAVender, repetidas, sacarSobre } from '../js/core/sobres.js';
import { crearRegalo } from '../js/core/album.js';
import { CODIGOS_CATALOGO } from '../js/core/calcomanias.js';
import { crearAleatorio } from '../js/core/azar.js';
import { crearStoreEnMemoria } from './memoria.js';

const perfil = { id: 'p1', nombre: 'Leo', album: {} };
let reloj = 0;
const ahora = () => new Date(Date.UTC(2026, 10, 1, 10, 0, 0, reloj++ * 10)).toISOString();

test('precioDeSobre: lo que se gana jugando cinco veces', () => {
  assert.equal(precioDeSobre({}), 5); // 5 × 10 / 12 = 4,17 → 5
  assert.equal(precioDeSobre({ tamano: 10, monedasPorAlbum: 10 }), 5);
  assert.equal(precioDeSobre({ tamano: 24, monedasPorAlbum: 1 }), 1);
});

test('sacarSobre: la cantidad pedida, todas de las que están en juego', () => {
  const enJuego = CODIGOS_CATALOGO.slice(0, 4);
  const sacadas = sacarSobre(enJuego, crearAleatorio(3));
  assert.equal(sacadas.length, LAMINAS_POR_SOBRE);
  for (const c of sacadas) assert.ok(enJuego.includes(c));
  assert.deepEqual(sacarSobre([], crearAleatorio(1)), []);
});

test('repetidas y registroAVender: se queda siempre con una copia', () => {
  const c = (codigo, fecha, pegada) => ({ id: `${codigo}${fecha}`, codigo, fecha, pegada });
  const lista = [c('a', '1', true), c('a', '2', false), c('b', '3', false), c('c', '1', true), c('c', '2', true), c('c', '3', true)];
  assert.deepEqual(repetidas(lista), [{ codigo: 'a', sobran: 1 }, { codigo: 'c', sobran: 2 }]);
  assert.equal(registroAVender(lista, 'a').fecha, '2', 'vende primero la suelta');
  assert.equal(registroAVender(lista, 'c').fecha, '3', 'si todas están pegadas, la más reciente');
  assert.equal(registroAVender(lista, 'b'), null);
});

test('comprarSobre: gasta, entrega láminas sueltas y avisa si no alcanza', async () => {
  const s = crearStoreEnMemoria();
  const sin = await comprarSobre(s, perfil, { aleatorio: crearAleatorio(1), ahora });
  assert.equal(sin.comprado, false);
  assert.equal(sin.faltan, 5);

  await s.guardar('movimientos', crearRegalo({ perfilId: 'p1', cantidad: 12 }));
  const r = await comprarSobre(s, perfil, { aleatorio: crearAleatorio(1), ahora });
  assert.equal(r.comprado, true);
  assert.equal(r.codigos.length, LAMINAS_POR_SOBRE);
  assert.equal(r.saldo, 7);
  const registros = await s.listar('calcomanias', { perfilId: 'p1' });
  assert.equal(registros.length, LAMINAS_POR_SOBRE);
  assert.ok(registros.every((x) => x.pegada === false));
  assert.equal((await cargarMonedas(s, perfil)).saldo, 7);
});

test('venderRepetida: paga una moneda, quita una copia y nunca la última', async () => {
  const s = crearStoreEnMemoria();
  await s.guardar('calcomanias', { perfilId: 'p1', codigo: 'gta001', fecha: ahora(), pegada: true });
  assert.equal((await venderRepetida(s, perfil, 'gta001', { ahora })).vendida, false);
  await s.guardar('calcomanias', { perfilId: 'p1', codigo: 'gta001', fecha: ahora(), pegada: false });
  const r = await venderRepetida(s, perfil, 'gta001', { ahora });
  assert.equal(r.vendida, true);
  assert.equal(r.saldo, 1);
  assert.equal((await s.listar('calcomanias', { perfilId: 'p1' })).length, 1);
  assert.equal((await venderRepetida(s, perfil, 'gta001', { ahora })).vendida, false);
});

test('reiniciarAlbumes: borra láminas y premios de álbum, deja el resto de las monedas', async () => {
  const s = crearStoreEnMemoria();
  await s.guardar('movimientos', crearRegalo({ perfilId: 'p1', cantidad: 20 }));
  for (let i = 0; i < 3; i++) await comprarSobre(s, perfil, { aleatorio: crearAleatorio(i), ahora });
  await reiniciarAlbumes(s, perfil);
  const datos = await cargarMonedas(s, perfil);
  assert.equal(datos.calcomanias.length, 0);
  assert.equal(datos.saldo, 5, '20 − 3 sobres de 5: el gasto no se devuelve');
});
