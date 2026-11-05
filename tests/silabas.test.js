import test from 'node:test';
import assert from 'node:assert/strict';
import { silabear, unirSilabas } from '../js/core/silabas.js';

// palabra -> división esperada con guiones
const CASOS = {
  // Las 20 del plan
  mamá: 'ma-má', papá: 'pa-pá', perro: 'pe-rro', casa: 'ca-sa', pelota: 'pe-lo-ta',
  leche: 'le-che', chocolate: 'cho-co-la-te', llave: 'lla-ve', guitarra: 'gui-ta-rra',
  queso: 'que-so', agua: 'a-gua', auto: 'au-to', oreja: 'o-re-ja', maíz: 'ma-íz',
  tía: 'tí-a', flor: 'flor', plátano: 'plá-ta-no', bicicleta: 'bi-ci-cle-ta',
  zanahoria: 'za-na-ho-ria', cuaderno: 'cua-der-no',
  // Vocabulario inicial
  muñeca: 'mu-ñe-ca', manzana: 'man-za-na', ventana: 'ven-ta-na', puerta: 'puer-ta',
  sopa: 'so-pa', pan: 'pan', mesa: 'me-sa', silla: 'si-lla', taza: 'ta-za',
  gato: 'ga-to', pato: 'pa-to', vaca: 'va-ca', oso: 'o-so', pez: 'pez',
  globo: 'glo-bo', libro: 'li-bro', polera: 'po-le-ra', bebé: 'be-bé',
  abuela: 'a-bue-la', nariz: 'na-riz', mano: 'ma-no', pie: 'pie', ojo: 'o-jo',
  boca: 'bo-ca', jugo: 'ju-go', plátanos: 'plá-ta-nos',
  // Diptongos e hiatos
  cielo: 'cie-lo', país: 'pa-ís', río: 'rí-o', león: 'le-ón', baúl: 'ba-úl',
  poeta: 'po-e-ta', teatro: 'te-a-tro', aire: 'ai-re', veinte: 'vein-te',
  ciudad: 'ciu-dad', cuídate: 'cuí-da-te', huir: 'huir', leo: 'le-o', oído: 'o-í-do',
  // h intercalada
  ahora: 'a-ho-ra', ahí: 'a-hí', vehículo: 've-hí-cu-lo', prohibir: 'prohi-bir',
  deshacer: 'des-ha-cer', hielo: 'hie-lo', búho: 'bú-ho',
  // qu, gu, ü
  guerra: 'gue-rra', quiero: 'quie-ro', pingüino: 'pin-güi-no', guion: 'guion',
  // y
  hoy: 'hoy', muy: 'muy', rey: 'rey', estoy: 'es-toy', playa: 'pla-ya', yo: 'yo', y: 'y',
  // Grupos de consonantes
  construir: 'cons-truir', transporte: 'trans-por-te', instrumento: 'ins-tru-men-to',
  obstáculo: 'obs-tá-cu-lo', otro: 'o-tro', honra: 'hon-ra', ancho: 'an-cho', calle: 'ca-lle',
  // Con mayúscula (nombres)
  Leo: 'Le-o', María: 'Ma-rí-a', Andrés: 'An-drés', Josefa: 'Jo-se-fa',
};

test(`silabear: ${Object.keys(CASOS).length} palabras de prueba`, () => {
  assert.ok(Object.keys(CASOS).length >= 40);
  const fallos = [];
  for (const [palabra, esperado] of Object.entries(CASOS)) {
    const obtenido = unirSilabas(silabear(palabra));
    if (obtenido !== esperado) fallos.push(`${palabra}: esperaba ${esperado}, obtuvo ${obtenido}`);
  }
  assert.deepEqual(fallos, []);
});

test('silabear: las sílabas vuelven a formar la palabra original', () => {
  for (const palabra of Object.keys(CASOS)) {
    assert.equal(silabear(palabra).join(''), palabra);
  }
});

test('silabear: varias palabras, espacios y vacío', () => {
  assert.deepEqual(silabear('mi casa'), ['mi', 'ca', 'sa']);
  assert.deepEqual(silabear('  papá  '), ['pa', 'pá']);
  assert.deepEqual(silabear(''), []);
  assert.deepEqual(silabear(null), []);
  assert.deepEqual(silabear('123'), []);
});

test('silabear: sin vocales devuelve la palabra entera', () => {
  assert.deepEqual(silabear('sh'), ['sh']);
});

test('unirSilabas', () => {
  assert.equal(unirSilabas(['ma', 'má']), 'ma-má');
});
