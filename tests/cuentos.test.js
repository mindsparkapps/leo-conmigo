import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_OTRAS_OPCIONES, MAX_PREGUNTAS, armarCuentoDesdePlantilla, armarPregunta, plantillasDisponibles, preguntasLeibles,
  validarPreguntas,
} from '../js/core/cuentos.js';
import { crearAleatorio } from '../js/core/azar.js';
import { nuevoLibro } from '../js/core/modelos.js';
import { validarLibro, paginasLeibles } from '../js/core/frases.js';
import { PERFIL_ID } from './ayudas.js';

const PLANTILLAS = JSON.parse(readFileSync(new URL('../data/cuentos-iniciales.json', import.meta.url), 'utf8'));
const CATALOGO = JSON.parse(readFileSync(new URL('../data/vocabulario-inicial.json', import.meta.url), 'utf8'));

const palabra = (id, extra = {}) => ({ id, perfilId: PERFIL_ID, texto: id, emoji: '🍎', activa: true, orden: 0, ...extra });
const mapa = (lista) => new Map(lista.map((p) => [p.id, p]));
const base = mapa(['papá', 'mamá', 'gato', 'pan', 'leche'].map((id) => palabra(id)));
const pregunta = (extra = {}) => ({ texto: '¿Quién come pan?', correctaId: 'papá', distractorIds: ['mamá', 'gato'], ...extra });

// ---------- validar ----------

test('validarPreguntas: una pregunta completa es válida (y ninguna también)', () => {
  assert.equal(validarPreguntas({ preguntas: [pregunta()], palabrasPorId: base }), null);
  assert.equal(validarPreguntas({ preguntas: [], palabrasPorId: base }), null);
  assert.equal(validarPreguntas({ preguntas: [pregunta(), pregunta({ texto: '¿Quién bebe leche?', correctaId: 'mamá', distractorIds: ['papá'] })], palabrasPorId: base }), null);
});

test('validarPreguntas: dice qué falta, en español y con el número de la pregunta', () => {
  const v = (q, extra = {}) => validarPreguntas({ preguntas: Array.isArray(q) ? q : [q], palabrasPorId: base, ...extra });
  assert.match(v(pregunta({ texto: '  ' })), /Escribe la pregunta 1/);
  assert.match(v(pregunta({ texto: 'x'.repeat(81) })), /demasiado larga/);
  assert.match(v(pregunta({ correctaId: null })), /Elige la respuesta de la pregunta 1/);
  assert.match(v(pregunta({ correctaId: 'fantasma' })), /ya no está o no tiene imagen/);
  assert.match(v(pregunta({ distractorIds: [] })), /al menos otra opción/);
  assert.match(v(pregunta({ distractorIds: ['mamá', 'gato', 'pan', 'leche'] })), new RegExp(`hasta ${MAX_OTRAS_OPCIONES}`));
  assert.match(v(pregunta({ distractorIds: ['papá'] })), /repite/);
  assert.match(v(pregunta({ distractorIds: ['mamá', 'mamá'] })), /repite/);
  assert.match(v(pregunta({ distractorIds: ['fantasma'] })), /Una opción de la pregunta 1/);
  assert.match(v([pregunta(), pregunta({ texto: '' })]), /pregunta 2/);
  assert.match(v(Array(MAX_PREGUNTAS + 1).fill(pregunta())), new RegExp(`hasta ${MAX_PREGUNTAS}`));
});

test('validarPreguntas: las opciones necesitan imagen (se responde tocando dibujos)', () => {
  const sinImagen = mapa([palabra('papá'), palabra('mamá', { emoji: null }), palabra('gato')]);
  assert.match(validarPreguntas({ preguntas: [pregunta({ distractorIds: ['mamá'] })], palabrasPorId: sinImagen }), /no tiene imagen/);
  const conFoto = mapa([palabra('papá'), palabra('mamá', { emoji: null, medioImagenId: 'm1' })]);
  assert.equal(validarPreguntas({ preguntas: [pregunta({ distractorIds: ['mamá'] })], palabrasPorId: conFoto }), null);
});

// ---------- lo que se puede contestar ----------

test('preguntasLeibles: quita lo que ya no existe y deja las que aún tienen respuesta y otra opción', () => {
  const libro = { preguntas: [pregunta(), pregunta({ texto: 'otra', correctaId: 'fantasma' }), pregunta({ texto: 'sin opciones', distractorIds: ['fantasma'] })] };
  const r = preguntasLeibles(libro, base);
  assert.deepEqual(r.map((q) => q.texto), ['¿Quién come pan?']);
  const parcial = preguntasLeibles({ preguntas: [pregunta({ distractorIds: ['mamá', 'fantasma', 'gato'] })] }, base);
  assert.deepEqual(parcial[0].distractorIds, ['mamá', 'gato'], 'las opciones que ya no están se quitan');
});

test('preguntasLeibles: un libro sin preguntas (de antes de esta versión) simplemente no tiene', () => {
  assert.deepEqual(preguntasLeibles({ titulo: 'viejo', paginas: [] }, base), []);
  const borrada = mapa([palabra('papá', { deleted: true }), palabra('mamá')]);
  assert.deepEqual(preguntasLeibles({ preguntas: [pregunta({ distractorIds: ['mamá'] })] }, borrada), []);
});

// ---------- armar la pregunta ----------

test('armarPregunta: la correcta y las demás, mezcladas, sin repetir y siempre con imagen', () => {
  const lugares = new Set();
  for (let semilla = 1; semilla <= 60; semilla++) {
    const q = armarPregunta({ pregunta: pregunta(), aleatorio: crearAleatorio(semilla) });
    assert.equal(q.texto, '¿Quién come pan?');
    assert.equal(q.correctaId, 'papá');
    assert.deepEqual(q.cartas.map((c) => c.id).sort(), ['gato', 'mamá', 'papá']);
    assert.ok(q.cartas.every((c) => c.forma === 'imagen'));
    lugares.add(q.cartas.findIndex((c) => c.id === 'papá'));
  }
  assert.equal(lugares.size, 3, 'la correcta cae en todos los lugares');
});

// ---------- el libro guarda las preguntas ----------

test('nuevoLibro: guarda las preguntas limpias (y un libro sin preguntas sigue siendo válido)', () => {
  const l = nuevoLibro({ perfilId: 'p1', titulo: 'Cuento', paginas: [{ fraseId: 'f1' }], preguntas: [{ texto: ' ¿Quién? ', correctaId: 'a', distractorIds: ['b'], extra: 'x' }] });
  assert.deepEqual(l.preguntas, [{ texto: '¿Quién?', correctaId: 'a', distractorIds: ['b'] }]);
  assert.deepEqual(nuevoLibro({ perfilId: 'p1', titulo: 'Sin preguntas' }).preguntas, []);
});

// ---------- cuentos de ejemplo ----------

const vocabularioCompleto = () => CATALOGO.map((e, i) => palabra(`id-${e.texto}`, { texto: e.texto, emoji: e.emoji ?? '🍎', orden: i }));

test('los cuentos de ejemplo son válidos: 3 a 6 páginas de hasta 6 palabras y 2 preguntas con una sola respuesta', () => {
  assert.ok(PLANTILLAS.length >= 3);
  const textos = new Set(CATALOGO.map((e) => e.texto));
  for (const c of PLANTILLAS) {
    assert.ok(c.titulo.length > 0 && c.titulo.length <= 40, c.titulo);
    assert.ok(c.paginas.length >= 3 && c.paginas.length <= 6, `${c.titulo}: páginas`);
    for (const pag of c.paginas) {
      const ps = pag.split(' ');
      assert.ok(ps.length >= 2 && ps.length <= 6, pag);
      for (const t of ps) assert.ok(textos.has(t), `«${t}» no está en el vocabulario inicial (${c.titulo})`);
    }
    assert.ok(c.preguntas.length >= 1 && c.preguntas.length <= MAX_PREGUNTAS);
    for (const q of c.preguntas) {
      assert.ok(textos.has(q.respuesta), q.respuesta);
      assert.ok(q.otras.length >= 1 && q.otras.length <= MAX_OTRAS_OPCIONES);
      assert.ok(q.otras.every((t) => textos.has(t) && t !== q.respuesta));
      // la respuesta tiene que salir en el cuento
      assert.ok(c.paginas.some((p) => p.split(' ').includes(q.respuesta)), `${c.titulo}: «${q.respuesta}» no aparece en el cuento`);
      // y las otras opciones no pueden ser también respuestas correctas: no aparecen en la misma página que la respuesta
      for (const otra of q.otras) {
        const pagRespuesta = c.paginas.filter((p) => p.split(' ').includes(q.respuesta));
        assert.ok(pagRespuesta.every((p) => !p.split(' ').includes(otra)), `${c.titulo}: «${otra}» comparte página con «${q.respuesta}»`);
      }
    }
  }
});

test('plantillasDisponibles: con todo el vocabulario inicial, todos los cuentos se pueden agregar', () => {
  const r = plantillasDisponibles(PLANTILLAS, vocabularioCompleto());
  assert.ok(r.every((x) => x.completa), JSON.stringify(r.map((x) => x.faltan)));
});

test('plantillasDisponibles: avisa qué palabras faltan (y las que no tienen imagen si van en una pregunta)', () => {
  const palabras = vocabularioCompleto().filter((p) => p.texto !== 'queso').map((p) => (p.texto === 'gato' ? { ...p, emoji: null } : p));
  const comida = plantillasDisponibles(PLANTILLAS, palabras).find((x) => x.plantilla.titulo === 'La comida');
  assert.equal(comida.completa, false);
  assert.deepEqual(comida.faltan.sort(), ['gato', 'queso']);
  const borrada = vocabularioCompleto().map((p) => (p.texto === 'perro' ? { ...p, deleted: true } : p));
  assert.ok(plantillasDisponibles(PLANTILLAS, borrada).find((x) => x.plantilla.titulo === 'El perro').faltan.includes('perro'));
});

test('armarCuentoDesdePlantilla: crea las frases, el libro y las preguntas con los ids del niño', () => {
  const palabras = vocabularioCompleto();
  const porTexto = new Map(palabras.map((p) => [p.texto, p.id]));
  const { frasesNuevas, libro } = armarCuentoDesdePlantilla({ plantilla: PLANTILLAS[0], perfilId: PERFIL_ID, palabras });
  assert.equal(frasesNuevas.length, 4);
  assert.deepEqual(frasesNuevas[0].palabraIds, ['papá', 'come', 'pan'].map((t) => porTexto.get(t)));
  assert.equal(frasesNuevas[0].texto, 'papá come pan');
  assert.deepEqual(frasesNuevas.map((f) => f.orden), [0, 1, 2, 3].map((n) => n + (frasesNuevas[0].orden)), 'órdenes seguidos');
  assert.equal(libro.titulo, 'La comida');
  assert.deepEqual(libro.paginas.map((p) => p.fraseId), frasesNuevas.map((f) => f.id));
  assert.equal(libro.preguntas[0].correctaId, porTexto.get('mamá'));
  assert.deepEqual(libro.preguntas[0].distractorIds, [porTexto.get('papá'), porTexto.get('gato')]);
  // el resultado pasa las validaciones de la app
  const frasesPorId = mapa(frasesNuevas);
  const palabrasPorId = mapa(palabras);
  assert.equal(validarLibro({ titulo: libro.titulo, paginas: libro.paginas, frasesPorId }), null);
  assert.equal(validarPreguntas({ preguntas: libro.preguntas, palabrasPorId }), null);
  assert.equal(paginasLeibles(libro, frasesPorId, palabrasPorId).length, 4);
});

test('armarCuentoDesdePlantilla: reutiliza las frases que ya existen y no repite las nuevas', () => {
  const palabras = vocabularioCompleto();
  const primero = armarCuentoDesdePlantilla({ plantilla: PLANTILLAS[0], perfilId: PERFIL_ID, palabras });
  const otra = armarCuentoDesdePlantilla({ plantilla: PLANTILLAS[0], perfilId: PERFIL_ID, palabras, frases: primero.frasesNuevas });
  assert.equal(otra.frasesNuevas.length, 0);
  assert.deepEqual(otra.libro.paginas.map((p) => p.fraseId), primero.frasesNuevas.map((f) => f.id));
  const repetida = { titulo: 'R', paginas: ['papá come pan', 'papá come pan'], preguntas: [] };
  assert.equal(armarCuentoDesdePlantilla({ plantilla: repetida, perfilId: PERFIL_ID, palabras }).frasesNuevas.length, 1);
});

test('armarCuentoDesdePlantilla: si faltan palabras, no inventa nada y explica cuáles', () => {
  const sinQueso = vocabularioCompleto().filter((p) => p.texto !== 'queso');
  assert.throws(() => armarCuentoDesdePlantilla({ plantilla: PLANTILLAS[0], perfilId: PERFIL_ID, palabras: sinQueso }), /Faltan palabras: queso/);
});
