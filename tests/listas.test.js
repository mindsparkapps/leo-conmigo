import test from 'node:test';
import assert from 'node:assert/strict';
import { colorDeIndice, filtrarMovimientos, filtrarPorRegion, letrasDeLista, ordenarVocabulario, paginar } from '../js/core/listas.js';
import { trocearTexto } from '../js/audio.js';

test('paginar parte la lista y ajusta la página al rango', () => {
  const lista = Array.from({ length: 25 }, (_, i) => i);
  const p2 = paginar(lista, 2, 10);
  assert.deepEqual(p2.items, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  assert.equal(p2.paginas, 3);
  assert.equal(p2.desde, 11);
  assert.equal(p2.hasta, 20);
  assert.equal(paginar(lista, 99, 10).pagina, 3);
  assert.equal(paginar(lista, -4, 10).pagina, 1);
  const vacia = paginar([], 1, 10);
  assert.equal(vacia.paginas, 1);
  assert.equal(vacia.desde, 0);
});

test('filtrarMovimientos filtra por tipo, signo, fechas y nota, lo nuevo primero', () => {
  const movs = [
    { id: 1, fecha: '2026-11-01T10:00:00', cantidad: 5, tipo: 'album', nota: 'Álbum completo' },
    { id: 2, fecha: '2026-11-03T10:00:00', cantidad: -3, tipo: 'sobre', nota: 'Sobre' },
    { id: 3, fecha: '2026-11-05T10:00:00', cantidad: 1, tipo: 'venta', nota: 'Venta de repetida' },
    { id: 4, fecha: '2026-11-04T10:00:00', cantidad: 9, tipo: 'regalo', deleted: true },
  ];
  assert.deepEqual(filtrarMovimientos(movs).map((m) => m.id), [3, 2, 1]);
  assert.deepEqual(filtrarMovimientos(movs, { tipo: 'sobre' }).map((m) => m.id), [2]);
  assert.deepEqual(filtrarMovimientos(movs, { signo: 'ganadas' }).map((m) => m.id), [3, 1]);
  assert.deepEqual(filtrarMovimientos(movs, { signo: 'gastadas' }).map((m) => m.id), [2]);
  assert.deepEqual(filtrarMovimientos(movs, { desde: '2026-11-02', hasta: '2026-11-03' }).map((m) => m.id), [2]);
  assert.deepEqual(filtrarMovimientos(movs, { texto: 'repetida' }).map((m) => m.id), [3]);
  // también se busca en el nombre del tipo que se ve en la lista, sin importar tildes ni mayúsculas
  const nombres = { album: 'Álbum completo', sobre: 'Sobre de láminas', venta: 'Venta de repetida' };
  assert.deepEqual(filtrarMovimientos(movs, { texto: 'album COMPLETO', nombres }).map((m) => m.id), [1]);
  assert.deepEqual(filtrarMovimientos(movs, { texto: 'sobre de laminas', nombres }).map((m) => m.id), [2]);
});

test('ordenarVocabulario: aprendizaje, alfabético y por uso', () => {
  const filas = [{ texto: 'zapato' }, { texto: 'árbol' }, { texto: 'casa' }, { texto: 'rareza' }];
  assert.deepEqual(ordenarVocabulario(filas).map((f) => f.texto), ['zapato', 'árbol', 'casa', 'rareza']);
  assert.deepEqual(ordenarVocabulario(filas, 'alfabetico').map((f) => f.texto), ['árbol', 'casa', 'rareza', 'zapato']);
  const uso = ordenarVocabulario(filas, 'uso', { casa: 10, zapato: 500, árbol: 900 });
  assert.deepEqual(uso.map((f) => f.texto), ['casa', 'zapato', 'árbol', 'rareza']);
});

test('letrasDeLista da cada letra con su primera posición', () => {
  const filas = [{ texto: 'árbol' }, { texto: 'agua' }, { texto: 'casa' }, { texto: 'ñandú' }, { texto: 'nube' }];
  assert.deepEqual(letrasDeLista(filas), [{ letra: 'A', indice: 0 }, { letra: 'C', indice: 2 }, { letra: 'N', indice: 3 }]);
});

test('filtrarPorRegion: una región, las generales o todas', () => {
  const filas = [{ texto: 'polera' }, { texto: 'casa' }, { texto: 'Palta' }];
  const regiones = { Chile: ['polera', 'palta'], Argentina: ['palta'] };
  assert.deepEqual(filtrarPorRegion(filas, 'todas', regiones).length, 3);
  assert.deepEqual(filtrarPorRegion(filas, 'Chile', regiones).map((f) => f.texto), ['polera', 'Palta']);
  assert.deepEqual(filtrarPorRegion(filas, 'Argentina', regiones).map((f) => f.texto), ['Palta']);
  assert.deepEqual(filtrarPorRegion(filas, 'general', regiones).map((f) => f.texto), ['casa']);
});

test('trocearTexto usa clips y junta lo demás para la voz sintética', () => {
  const clips = new Set(['bebe', 'leche']);
  const t = trocearTexto('¿Quién bebe leche hoy?', { clips });
  assert.deepEqual(t.map((x) => [x.tipo, x.texto]), [['sintetica', 'Quién'], ['clip', 'bebe'], ['clip', 'leche'], ['sintetica', 'hoy']]);
  assert.equal(t[1].ruta, 'data/voces/bebe.mp3');
  const propia = trocearTexto('mamá', { palabras: [{ texto: 'mamá', medioAudioId: 'm1' }], clips });
  assert.equal(propia[0].tipo, 'grabada');
});

test('colorDeIndice va de verde a rojo', () => {
  assert.equal(colorDeIndice(0), 'verde');
  assert.equal(colorDeIndice(30), 'amarillo');
  assert.equal(colorDeIndice(60), 'naranja');
  assert.equal(colorDeIndice(100), 'rojo');
});
