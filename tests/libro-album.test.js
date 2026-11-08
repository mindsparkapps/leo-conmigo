import test from 'node:test';
import assert from 'node:assert/strict';
import { POR_PAGINA, armarLibro, codigosDelLibro } from '../js/core/libro-album.js';
import { CODIGOS_CATALOGO, codigoDePropia } from '../js/core/calcomanias.js';

test('sin filtro el libro lleva todo el catálogo en su orden', () => {
  assert.deepEqual(codigosDelLibro({ album: { codigos: null } }), CODIGOS_CATALOGO);
});

test('las propias vigentes se agregan al final del catálogo', () => {
  const codigos = codigosDelLibro({ album: { codigos: null }, propias: [{ id: 'a1' }] });
  assert.equal(codigos.at(-1), codigoDePropia('a1'));
  assert.equal(codigos.length, CODIGOS_CATALOGO.length + 1);
});

test('si el adulto limita las calcomanías, el libro solo lleva esas y las ya ganadas que siguen existiendo', () => {
  const codigos = codigosDelLibro({
    album: { codigos: ['sol', 'luna'] },
    ganadas: ['estrella', 'sol', 'propia:borrada'],
  });
  assert.deepEqual(codigos, ['sol', 'luna', 'estrella']);
});

test('armarLibro reparte en páginas de 6 y marca las ganadas', () => {
  const codigos = CODIGOS_CATALOGO.slice(0, 8);
  const { paginas, total, conseguidas } = armarLibro({ codigos, ganadas: [codigos[0], codigos[1], 'inexistente'] });
  assert.equal(POR_PAGINA, 6);
  assert.deepEqual(paginas.map((p) => p.length), [6, 2]);
  assert.equal(total, 8);
  assert.equal(conseguidas, 2);
  assert.equal(paginas[0].find((i) => i.codigo === codigos[0]).ganada, true);
  assert.equal(paginas[0].find((i) => i.codigo === codigos[2]).ganada, false);
});

test('armarLibro ignora códigos repetidos y acepta un libro vacío', () => {
  assert.equal(armarLibro({ codigos: ['sol', 'sol'] }).total, 1);
  assert.deepEqual(armarLibro({ codigos: [] }), { paginas: [], total: 0, conseguidas: 0 });
});
