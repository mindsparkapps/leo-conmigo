import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POR_PAGINA, armarLibro, codigosDelLibro, etiquetaDeLamina, letraDePagina, lugarDeLamina, registrosAlPegar, separarCalcomanias,
} from '../js/core/libro-album.js';
import { CODIGOS_CATALOGO, codigoDePropia } from '../js/core/calcomanias.js';

test('sin filtro el libro lleva todo el catálogo en su orden', () => {
  assert.deepEqual(codigosDelLibro({ album: { codigos: null } }), CODIGOS_CATALOGO);
});

test('las propias vigentes se agregan al final del catálogo', () => {
  const codigos = codigosDelLibro({ album: { codigos: null }, propias: [{ id: 'a1' }] });
  assert.equal(codigos.at(-1), codigoDePropia('a1'));
  assert.equal(codigos.length, CODIGOS_CATALOGO.length + 1);
});

test('los dibujos antiguos no entran al libro aunque el álbum los pida', () => {
  assert.deepEqual(codigosDelLibro({ album: { codigos: ['sol', 'luna', CODIGOS_CATALOGO[3]] } }), [CODIGOS_CATALOGO[3]]);
  // si lo único elegido ya no existe, vale todo el catálogo
  assert.deepEqual(codigosDelLibro({ album: { codigos: ['sol'] } }), CODIGOS_CATALOGO);
});

test('letras de página: A… Z, AA, AB…', () => {
  assert.equal(letraDePagina(0), 'A');
  assert.equal(letraDePagina(12), 'M');
  assert.equal(letraDePagina(25), 'Z');
  assert.equal(letraDePagina(26), 'AA');
  assert.equal(letraDePagina(27), 'AB');
  assert.equal(etiquetaDeLamina('B', 7), 'B-7');
});

test('armarLibro reparte en páginas de 6, con letra y número de lámina, y marca las pegadas', () => {
  const codigos = CODIGOS_CATALOGO.slice(0, 8);
  const libro = armarLibro({ codigos, pegadas: [codigos[0], codigos[1], 'inexistente'] });
  assert.equal(POR_PAGINA, 6);
  assert.deepEqual(libro.paginas.map((p) => p.items.length), [6, 2]);
  assert.deepEqual(libro.paginas.map((p) => p.letra), ['A', 'B']);
  assert.equal(libro.total, 8);
  assert.equal(libro.pegadas, 2);
  assert.deepEqual(libro.paginas[1].items.map((i) => i.numero), [7, 8]);
  assert.equal(libro.paginas[1].items[0].letra, 'B');
  assert.equal(libro.paginas[0].items[0].pegada, true);
  assert.equal(libro.paginas[0].items[2].pegada, false);
});

test('armarLibro ignora códigos repetidos y acepta un libro vacío', () => {
  assert.equal(armarLibro({ codigos: ['sol', 'sol'] }).total, 1);
  assert.deepEqual(armarLibro({ codigos: [] }), { paginas: [], total: 0, pegadas: 0 });
});

test('lugarDeLamina dice página, letra, número y posición', () => {
  const libro = armarLibro({ codigos: CODIGOS_CATALOGO.slice(0, 8) });
  assert.deepEqual(lugarDeLamina(libro, CODIGOS_CATALOGO[7]), { pagina: 1, letra: 'B', numero: 8, posicion: 1 });
  assert.equal(lugarDeLamina(libro, 'nada'), null);
});

test('separarCalcomanias: lo viejo cuenta como pegado y lo nuevo anda suelto hasta pegarlo', () => {
  const regs = [
    { codigo: 'a', fecha: '2026-01-01' }, // de antes: sin campo
    { codigo: 'b', fecha: '2026-01-03', pegada: false },
    { codigo: 'c', fecha: '2026-01-02', pegada: false },
    { codigo: 'd', fecha: '2026-01-04', pegada: true },
    { codigo: 'a', fecha: '2026-01-05', pegada: false }, // repetida de una ya pegada: no queda suelta
    { codigo: 'e', fecha: '2026-01-06', pegada: false, deleted: true },
  ];
  const { pegadas, sueltas } = separarCalcomanias(regs);
  assert.deepEqual([...pegadas].sort(), ['a', 'd']);
  assert.deepEqual(sueltas, ['c', 'b']);
});

test('registrosAlPegar cambia todos los sueltos de ese código y no toca los demás', () => {
  const regs = [
    { id: '1', codigo: 'b', pegada: false },
    { id: '2', codigo: 'b', pegada: false },
    { id: '3', codigo: 'c', pegada: false },
    { id: '4', codigo: 'b', pegada: true },
  ];
  const cambios = registrosAlPegar(regs, 'b', '2026-02-01T00:00:00.000Z');
  assert.deepEqual(cambios.map((c) => c.id), ['1', '2']);
  assert.ok(cambios.every((c) => c.pegada === true && c.fechaPegada === '2026-02-01T00:00:00.000Z'));
  assert.equal(regs[0].pegada, false); // no modifica el original
});
