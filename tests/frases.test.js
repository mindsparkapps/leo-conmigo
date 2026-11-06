import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PAGINAS_LIBRO, MAX_PALABRAS_FRASE, MAX_PARTES_COLLAGE, frasePracticable, frasesComoElementos, librosParaElNino, paginasLeibles,
  palabrasDeFrase, partesDeCollage, textoDeFrase, validarFrase, validarLibro,
} from '../js/core/frases.js';
import { nuevaFrase, nuevoLibro } from '../js/core/modelos.js';
import { PREGUNTAS_CATEGORIA, preguntaDeCategoria, tieneImagen, tieneSimbolo } from '../js/core/vocabulario.js';
import { frase, frasesDelNino, palabrasDelNino } from './escenarios.js';

const porId = (lista) => new Map(lista.map((x) => [x.id, x]));
const palabras = porId(palabrasDelNino());

// ---------- imágenes y símbolos ----------

test('tieneImagen y tieneSimbolo', () => {
  assert.equal(tieneImagen({ medioImagenId: 'm' }), true);
  assert.equal(tieneImagen({ emoji: '🍎' }), true);
  assert.equal(tieneImagen({}), false);
  assert.equal(tieneSimbolo({ medioSimboloId: 's' }), true);
  assert.equal(tieneSimbolo({ emoji: '🍎' }), true);
  assert.equal(tieneSimbolo({ medioImagenId: 'm' }), false, 'una foto sola no es un símbolo');
});

test('preguntaDeCategoria: hay pregunta para las categorías que se pueden clasificar y no para las demás', () => {
  assert.equal(preguntaDeCategoria('comida'), '¿Cuál es una comida?');
  assert.equal(preguntaDeCategoria('animales'), '¿Cuál es un animal?');
  assert.equal(Object.keys(PREGUNTAS_CATEGORIA).length, 6);
  assert.ok(Object.values(PREGUNTAS_CATEGORIA).every((p) => p.startsWith('¿') && p.endsWith('?')));
  for (const c of ['otras', 'enlace', undefined, null, 'rara']) assert.equal(preguntaDeCategoria(c), null);
});

// ---------- frases ----------

test('textoDeFrase y palabrasDeFrase', () => {
  const f = frasesDelNino()[0];
  const lista = palabrasDeFrase(f, palabras);
  assert.deepEqual(lista.map((p) => p.id), ['papá', 'come', 'pan']);
  assert.equal(textoDeFrase(lista), 'papá come pan');
  assert.equal(palabrasDeFrase(frase('x', ['papá', 'inexistente']), palabras), null);
  const conBorrada = porId([...palabrasDelNino().filter((p) => p.id !== 'pan'), { ...palabras.get('pan'), deleted: true }]);
  assert.equal(palabrasDeFrase(f, conBorrada), null, 'una palabra borrada rompe la frase');
});

test('validarFrase: cantidad de palabras, palabras que existen y frases repetidas', () => {
  const ok = ['papá', 'come', 'pan'];
  assert.equal(validarFrase({ palabraIds: ok, palabrasPorId: palabras }), null);
  assert.match(validarFrase({ palabraIds: ['papá'], palabrasPorId: palabras }), /al menos 2/);
  assert.match(validarFrase({ palabraIds: Array(MAX_PALABRAS_FRASE + 1).fill('papá'), palabrasPorId: palabras }), /hasta 6/);
  assert.match(validarFrase({ palabraIds: ['papá', 'fantasma'], palabrasPorId: palabras }), /ya no está/);
  const frases = frasesDelNino();
  assert.match(validarFrase({ palabraIds: ok, palabrasPorId: palabras, frases }), /ya está/);
  assert.equal(validarFrase({ palabraIds: ok, palabrasPorId: palabras, frases, exceptoId: 'f1' }), null, 'al editar no choca consigo misma');
  assert.equal(validarFrase({ palabraIds: ['pan', 'come', 'papá'], palabrasPorId: palabras, frases }), null, 'otro orden es otra frase');
  assert.equal(validarFrase({ palabraIds: ok, palabrasPorId: palabras, frases: [{ ...frases[0], deleted: true }] }), null, 'una borrada no cuenta');
});

test('partesDeCollage: hasta 3 palabras con imagen, en orden', () => {
  const ps = [{ id: 'a', emoji: '🍎' }, { id: 'b' }, { id: 'c', medioImagenId: 'm' }, { id: 'd', emoji: '🍌' }, { id: 'e', emoji: '🍇' }];
  assert.deepEqual(partesDeCollage(ps).map((p) => p.id), ['a', 'c', 'd']);
  assert.equal(partesDeCollage(ps).length, MAX_PARTES_COLLAGE);
  assert.deepEqual(partesDeCollage([{ id: 'x' }]), []);
});

test('frasePracticable: necesita palabras que existan y algo que mostrar (imagen propia o collage)', () => {
  const f = frasesDelNino()[0];
  assert.equal(frasePracticable(f, palabras), true);
  assert.equal(frasePracticable({ ...f, activa: false }, palabras), false);
  assert.equal(frasePracticable({ ...f, deleted: true }, palabras), false);
  assert.equal(frasePracticable(frase('x', ['papá', 'fantasma']), palabras), false);
  const sinImagenes = porId([{ id: 'el', texto: 'el' }, { id: 'la', texto: 'la' }]);
  assert.equal(frasePracticable(frase('y', ['el', 'la']), sinImagenes), false, 'ninguna palabra tiene imagen');
  assert.equal(frasePracticable(frase('y', ['el', 'la'], { medioImagenId: 'foto' }), sinImagenes), true, 'pero con foto propia sí');
});

test('frasesComoElementos: elementos del motor, con collage solo si no tienen imagen propia', () => {
  const frases = [...frasesDelNino(), frase('con-foto', ['mamá', 'come', 'pan'], { medioImagenId: 'foto-1', orden: 9 }), frase('rota', ['papá', 'fantasma'])];
  const elementos = frasesComoElementos(frases, palabras);
  assert.deepEqual(elementos.map((e) => e.id), ['f1', 'f2', 'f3', 'f4', 'con-foto'], 'la rota no se incluye');
  const f1 = elementos[0];
  assert.deepEqual([f1.texto, f1.esFrase, f1.categoria, f1.activa], ['papá come pan', true, null, true]);
  assert.deepEqual(f1.palabraIds, ['papá', 'come', 'pan']);
  assert.equal(f1.partes.length, 3);
  assert.deepEqual(elementos[4].partes, [], 'con foto propia no hace falta collage');
  assert.equal(elementos[4].medioImagenId, 'foto-1');
});

test('nuevaFrase: valida y arma el registro', () => {
  const f = nuevaFrase({ perfilId: 'p1', palabraIds: ['a', 'b'], texto: ' a b ', orden: 3 });
  assert.deepEqual([f.texto, f.orden, f.activa, f.medioImagenId], ['a b', 3, true, null]);
  assert.ok(f.id);
  assert.throws(() => nuevaFrase({ perfilId: 'p1', palabraIds: ['a'], texto: 'a' }), /dos palabras/);
  assert.throws(() => nuevaFrase({ palabraIds: ['a', 'b'], texto: 'a b' }), /perfil/);
  assert.throws(() => nuevaFrase({ perfilId: 'p1', palabraIds: ['a', 'b'], texto: '  ' }), /texto/);
});

// ---------- libros ----------

const frasesPorId = porId(frasesDelNino());

test('validarLibro: título, páginas y frases que existan', () => {
  const pag = (fraseId) => ({ fraseId, medioImagenId: null });
  assert.equal(validarLibro({ titulo: 'Mi día', paginas: [pag('f1'), pag('f2')], frasesPorId }), null);
  assert.match(validarLibro({ titulo: '  ', paginas: [pag('f1')], frasesPorId }), /título/);
  assert.match(validarLibro({ titulo: 'x'.repeat(41), paginas: [pag('f1')], frasesPorId }), /demasiado largo/);
  assert.match(validarLibro({ titulo: 'Mi día', paginas: [], frasesPorId }), /al menos una página/);
  assert.match(validarLibro({ titulo: 'Mi día', paginas: Array(MAX_PAGINAS_LIBRO + 1).fill(pag('f1')), frasesPorId }), /hasta 10/);
  assert.match(validarLibro({ titulo: 'Mi día', paginas: [pag('f1'), pag(null)], frasesPorId }), /página 2 necesita una frase/);
  assert.match(validarLibro({ titulo: 'Mi día', paginas: [pag('fantasma')], frasesPorId }), /página 1/);
});

test('nuevoLibro: arma el registro con sus páginas', () => {
  const l = nuevoLibro({ perfilId: 'p1', titulo: ' Mi día ', paginas: [{ fraseId: 'f1', medioImagenId: 'm1' }, { fraseId: 'f2' }] });
  assert.equal(l.titulo, 'Mi día');
  assert.deepEqual(l.paginas, [{ medioImagenId: 'm1', fraseId: 'f1' }, { medioImagenId: null, fraseId: 'f2' }]);
  assert.throws(() => nuevoLibro({ perfilId: 'p1', titulo: '' }), /título/);
  assert.throws(() => nuevoLibro({ titulo: 'x' }), /perfil/);
});

test('paginasLeibles y librosParaElNino: solo lo que todavía se puede leer', () => {
  const libroBueno = { id: 'l1', titulo: 'A', paginas: [{ fraseId: 'f1' }, { fraseId: 'f2' }] };
  const libroMedio = { id: 'l2', titulo: 'B', paginas: [{ fraseId: 'f1' }, { fraseId: 'borrada' }] };
  const libroVacio = { id: 'l3', titulo: 'C', paginas: [{ fraseId: 'borrada' }] };
  const libroBorrado = { id: 'l4', titulo: 'D', paginas: [{ fraseId: 'f1' }], deleted: true };
  assert.equal(paginasLeibles(libroMedio, frasesPorId, palabras).length, 1);
  assert.deepEqual(
    librosParaElNino([libroBueno, libroMedio, libroVacio, libroBorrado], frasesPorId, palabras).map((l) => l.id),
    ['l1', 'l2'],
  );
  const sinPan = porId([...palabrasDelNino().filter((p) => p.id !== 'pan')]);
  assert.equal(paginasLeibles(libroBueno, frasesPorId, sinPan).length, 1, 'una frase con una palabra borrada no se lee');
});
