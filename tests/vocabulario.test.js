import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  CATEGORIAS, MAX_LARGO_PALABRA, nombreDeCategoria, normalizarTexto, clavePalabra, existeTexto, validarTexto, parsearSilabas,
  silabasForman, siguienteOrden, ordenadas, mover, agruparPorCategoria, armarPalabrasDelAsistente,
} from '../js/core/vocabulario.js';
import { silabear } from '../js/core/silabas.js';

const CATALOGO = JSON.parse(readFileSync(new URL('../data/vocabulario-inicial.json', import.meta.url), 'utf8'));
const pal = (id, texto, orden, extra = {}) => ({ id, texto, orden, perfilId: 'p1', ...extra });

// ---------- catálogo inicial ----------

test('catálogo inicial: 48 entradas completas, sin repetir y con sílabas que forman la palabra', () => {
  assert.equal(CATALOGO.length, 48);
  const ids = CATEGORIAS.map((c) => c.id);
  const vistos = new Set();
  for (const e of CATALOGO) {
    const { voz, ...basicos } = e; // `voz` es opcional: ruta de un mp3 de la app
    assert.deepEqual(Object.keys(basicos).sort(), ['arasaacBusqueda', 'categoria', 'emoji', 'silabas', 'texto', 'tipo']);
    if (voz !== undefined) assert.ok(existsSync(new URL(`../${voz}`, import.meta.url)), `falta el audio ${voz}`);
    assert.ok(ids.includes(e.categoria), `${e.texto}: categoría ${e.categoria}`);
    assert.ok(['sustantivo', 'enlace'].includes(e.tipo));
    assert.equal(silabasForman(e.silabas, e.texto), true, e.texto);
    assert.deepEqual(e.silabas, silabear(e.texto), e.texto);
    assert.ok(e.arasaacBusqueda.length > 0);
    assert.ok(!vistos.has(clavePalabra(e.texto)), `repetida: ${e.texto}`);
    vistos.add(clavePalabra(e.texto));
  }
  // «bebé» (persona) y «bebe» (verbo) son palabras distintas y conviven
  assert.ok(vistos.has('bebé') && vistos.has('bebe'));
});

test('catálogo inicial: contiene las palabras del plan y las de enlace van como tipo "enlace"', () => {
  const textos = CATALOGO.map((e) => e.texto);
  for (const t of ['mamá', 'papá', 'abuela', 'mano', 'ojo', 'pan', 'leche', 'casa', 'perro', 'gato', 'pelota', 'auto', 'libro']) {
    assert.ok(textos.includes(t), t);
  }
  const enlace = CATALOGO.filter((e) => e.categoria === 'enlace');
  assert.equal(enlace.length, 10);
  assert.ok(enlace.every((e) => e.tipo === 'enlace'));
  assert.ok(CATALOGO.filter((e) => e.categoria !== 'enlace').every((e) => e.tipo === 'sustantivo'));
});

// ---------- texto ----------

test('normalizarTexto: sin tildes, minúsculas y espacios normalizados', () => {
  assert.equal(normalizarTexto('  MAMÁ  '), 'mama');
  assert.equal(normalizarTexto('Muñeca'), 'muneca');
  assert.equal(normalizarTexto('María   José'), 'maria jose');
  assert.equal(normalizarTexto(null), '');
});

test('clavePalabra: ignora mayúsculas y espacios, pero no las tildes', () => {
  assert.equal(clavePalabra('  MAMÁ '), 'mamá');
  assert.notEqual(clavePalabra('bebé'), clavePalabra('bebe'));
  assert.equal(clavePalabra('María   José'), 'maría josé');
  assert.equal(clavePalabra('mamá'), clavePalabra('mamá'), 'tilde escrita como carácter combinado');
});

test('existeTexto: ignora mayúsculas, borradas y la palabra que se está editando; las tildes sí cuentan', () => {
  const lista = [pal('a', 'mamá', 0), pal('b', 'papá', 1, { deleted: true })];
  assert.equal(existeTexto(lista, 'MAMÁ'), true);
  assert.equal(existeTexto(lista, 'mama'), false, 'sin tilde es otra palabra');
  assert.equal(existeTexto([pal('x', 'bebé', 0)], 'bebe'), false);
  assert.equal(existeTexto(lista, 'papá'), false, 'una palabra borrada no cuenta');
  assert.equal(existeTexto(lista, 'mamá', { exceptoId: 'a' }), false, 'al editar, no choca consigo misma');
  assert.equal(existeTexto(lista, 'casa'), false);
});

test('validarTexto: vacío, largo, repetido y válido', () => {
  const lista = [pal('a', 'mamá', 0)];
  assert.match(validarTexto('   ', lista), /Escribe/);
  assert.match(validarTexto('x'.repeat(MAX_LARGO_PALABRA + 1), lista), /demasiado larga/);
  assert.match(validarTexto('Mamá', lista), /ya está/);
  assert.equal(validarTexto('papá', lista), null);
  assert.equal(validarTexto('mamá', lista, { exceptoId: 'a' }), null);
});

test('nombreDeCategoria: conocida y desconocida', () => {
  assert.equal(nombreDeCategoria('animales'), 'Animales');
  assert.equal(nombreDeCategoria('inventada'), 'Otras');
});

// ---------- sílabas editables ----------

test('parsearSilabas: acepta guiones, puntos medios, puntos y espacios', () => {
  assert.deepEqual(parsearSilabas('ma-má'), ['ma', 'má']);
  assert.deepEqual(parsearSilabas(' ma · má '), ['ma', 'má']);
  assert.deepEqual(parsearSilabas('bi-ci-cle-ta'), ['bi', 'ci', 'cle', 'ta']);
  assert.deepEqual(parsearSilabas('a.gua'), ['a', 'gua']);
  assert.deepEqual(parsearSilabas('--'), []);
  assert.deepEqual(parsearSilabas(null), []);
});

test('silabasForman: las tildes cuentan y las mayúsculas no', () => {
  assert.equal(silabasForman(['ma', 'má'], 'mamá'), true);
  assert.equal(silabasForman(['Le', 'o'], 'Leo'), true);
  assert.equal(silabasForman(['ma', 'ma'], 'mamá'), false);
  assert.equal(silabasForman(['ma'], 'mamá'), false);
  assert.equal(silabasForman([], ''), false);
  assert.equal(silabasForman(['ma', 'rí', 'a'], 'María'), true);
});

// ---------- orden ----------

test('siguienteOrden y ordenadas', () => {
  assert.equal(siguienteOrden([]), 0);
  assert.equal(siguienteOrden([pal('a', 'x', 0), pal('b', 'y', 4)]), 5);
  const lista = [pal('c', 'casa', 2), pal('a', 'ala', 0), pal('b', 'bota', 1), pal('z', 'zorro', 3, { deleted: true })];
  assert.deepEqual(ordenadas(lista).map((p) => p.id), ['a', 'b', 'c']);
});

test('ordenadas: a igual orden desempata por texto', () => {
  assert.deepEqual(ordenadas([pal('b', 'bota', 0), pal('a', 'ala', 0)]).map((p) => p.id), ['a', 'b']);
});

const lista4 = () => [pal('a', 'a', 0), pal('b', 'b', 1), pal('c', 'c', 2), pal('d', 'd', 3)];
const aplicar = (lista, cambios) => lista.map((p) => ({ ...p, orden: cambios.find((c) => c.id === p.id)?.orden ?? p.orden }));

test('mover: sube y baja una posición y solo cambia lo necesario', () => {
  assert.deepEqual(mover(lista4(), 'c', -1), [{ id: 'c', orden: 1 }, { id: 'b', orden: 2 }]);
  assert.deepEqual(mover(lista4(), 'b', 1), [{ id: 'c', orden: 1 }, { id: 'b', orden: 2 }]);
  assert.deepEqual(ordenadas(aplicar(lista4(), mover(lista4(), 'd', -3))).map((p) => p.id), ['d', 'a', 'b', 'c']);
});

test('mover: en los extremos o con un id desconocido no cambia nada', () => {
  assert.deepEqual(mover(lista4(), 'a', -1), []);
  assert.deepEqual(mover(lista4(), 'd', 1), []);
  assert.deepEqual(mover(lista4(), 'nadie', 1), []);
  assert.deepEqual(mover([], 'a', 1), []);
});

test('mover: renumera de forma consecutiva aunque el orden tuviera huecos o repetidos', () => {
  const rara = [pal('a', 'a', 5), pal('b', 'b', 5), pal('c', 'c', 20)];
  const resultado = ordenadas(aplicar(rara, mover(rara, 'c', -1)));
  assert.deepEqual(resultado.map((p) => p.id), ['a', 'c', 'b']);
  assert.deepEqual(resultado.map((p) => p.orden), [0, 1, 2]);
});

test('mover: las palabras borradas no cuentan', () => {
  const lista = [pal('a', 'a', 0), pal('x', 'x', 1, { deleted: true }), pal('c', 'c', 2)];
  assert.deepEqual(mover(lista, 'c', -1).map((c) => c.id).sort(), ['a', 'c']);
});

// ---------- agrupar ----------

test('agruparPorCategoria: respeta el orden de las categorías y manda lo desconocido a "otras"', () => {
  const grupos = agruparPorCategoria([
    { texto: 'perro', categoria: 'animales' }, { texto: 'mamá', categoria: 'personas' },
    { texto: 'x', categoria: 'rara' }, { texto: 'gato', categoria: 'animales' },
  ]);
  assert.deepEqual(grupos.map((g) => g.categoria.id), ['personas', 'animales', 'otras']);
  assert.deepEqual(grupos[1].items.map((i) => i.texto), ['perro', 'gato']);
  assert.deepEqual(agruparPorCategoria([]), []);
});

// ---------- asistente de primer uso ----------

test('asistente: nombre del niño primero, luego su gente y luego el catálogo, con orden consecutivo', () => {
  const catalogo = CATALOGO.filter((e) => ['pan', 'casa', 'perro'].includes(e.texto)); // en el orden del catálogo
  const { palabras, omitidas } = armarPalabrasDelAsistente({
    perfilId: 'p1',
    nino: { nombre: ' Leo ', medioImagenId: 'm1' },
    personales: [
      { texto: 'Mamá', medioImagenId: 'm2' },
      { texto: 'Rocky', categoria: 'animales' },
      { texto: '   ' }, // fila vacía: se ignora
    ],
    catalogo,
  });
  assert.deepEqual(palabras.map((p) => p.texto), ['Leo', 'Mamá', 'Rocky', 'pan', 'casa', 'perro']);
  assert.deepEqual(palabras.map((p) => p.orden), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(omitidas, []);
  assert.equal(palabras[0].medioImagenId, 'm1');
  assert.equal(palabras[0].categoria, 'personas');
  assert.equal(palabras[2].categoria, 'animales');
  assert.deepEqual(palabras[0].silabas, ['Le', 'o']);
  assert.deepEqual(palabras[3].silabas, ['pan']);
  assert.equal(palabras[3].emoji, '🍞');
  assert.equal(palabras[3].busquedaPicto, 'pan');
  assert.equal(palabras[0].busquedaPicto, null, 'las palabras personales se buscan por su propio texto');
  assert.ok(palabras.every((p) => p.perfilId === 'p1' && p.activa === true));
  assert.equal(new Set(palabras.map((p) => p.id)).size, palabras.length);
});

test('asistente: no repite palabras (ni las de la familia con las del catálogo, ni las que ya existen)', () => {
  const catalogo = CATALOGO.filter((e) => ['mamá', 'papá', 'pan'].includes(e.texto));
  const { palabras, omitidas } = armarPalabrasDelAsistente({
    perfilId: 'p1',
    nino: { nombre: 'Leo' },
    personales: [{ texto: 'MAMÁ', medioImagenId: 'm2' }],
    catalogo,
    existentes: [pal('x', 'Papá', 7)],
  });
  assert.deepEqual(palabras.map((p) => p.texto), ['Leo', 'MAMÁ', 'pan']);
  assert.deepEqual(omitidas, ['mamá', 'papá']);
  assert.equal(palabras[1].medioImagenId, 'm2', 'gana la de la familia, que lleva su foto');
  assert.deepEqual(palabras.map((p) => p.orden), [8, 9, 10], 'sigue el orden de las existentes');
});

test('asistente: «bebé» y «bebe» conviven (la tilde las distingue)', () => {
  const catalogo = CATALOGO.filter((e) => ['bebé', 'bebe'].includes(e.texto));
  const { palabras, omitidas } = armarPalabrasDelAsistente({ perfilId: 'p1', nino: {}, catalogo });
  assert.deepEqual(palabras.map((p) => p.texto), ['bebé', 'bebe']);
  assert.deepEqual(omitidas, []);
});

test('asistente: sin nombre ni palabras no crea nada', () => {
  assert.deepEqual(armarPalabrasDelAsistente({ perfilId: 'p1', nino: {} }).palabras, []);
  assert.deepEqual(armarPalabrasDelAsistente({ perfilId: 'p1' }).palabras, []);
});

test('asistente: ignora textos demasiado largos', () => {
  const { palabras } = armarPalabrasDelAsistente({ perfilId: 'p1', nino: { nombre: 'x'.repeat(31) }, personales: [{ texto: 'ok' }] });
  assert.deepEqual(palabras.map((p) => p.texto), ['ok']);
});
