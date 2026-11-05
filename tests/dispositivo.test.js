// Pruebas de hardware.js, imagenes.js, audio.js y pictos.js (la parte que no necesita un dispositivo real).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ErrorHardware, soporte, motivoSinGrabacion, elegirMime, traducirErrorMedia, crearGrabadora,
} from '../js/hardware.js';
import { calcularRecorteCuadrado, ladoFinal } from '../js/imagenes.js';
import { elegirVoz } from '../js/audio.js';
import {
  urlBusqueda, urlImagen, normalizarResultados, buscarPictogramas, descargarPictograma, ErrorRed,
} from '../js/pictos.js';

// ---------- hardware: soporte y mensajes ----------

const entornoCompleto = {
  isSecureContext: true,
  MediaRecorder: class {},
  SpeechSynthesisUtterance: class {},
  speechSynthesis: {},
  navigator: { mediaDevices: { getUserMedia() {} }, vibrate() {}, storage: { persist() {} } },
};

test('soporte: detecta cada función', () => {
  assert.deepEqual(soporte(entornoCompleto), {
    contextoSeguro: true, microfono: true, grabacion: true, sintesisVoz: true, vibracion: true, almacenamientoPersistente: true,
  });
  assert.deepEqual(soporte({ navigator: {} }), {
    contextoSeguro: true, microfono: false, grabacion: false, sintesisVoz: false, vibracion: false, almacenamientoPersistente: false,
  });
  assert.equal(soporte({ isSecureContext: false, navigator: {} }).contextoSeguro, false);
});

test('motivoSinGrabacion: null si se puede; si no, explica por qué', () => {
  assert.equal(motivoSinGrabacion(soporte(entornoCompleto)), null);
  assert.match(motivoSinGrabacion(soporte({ ...entornoCompleto, isSecureContext: false })), /https/);
  assert.match(motivoSinGrabacion(soporte({ ...entornoCompleto, MediaRecorder: undefined })), /no permite grabar/);
  assert.match(motivoSinGrabacion(soporte({ navigator: {} })), /no permite grabar/);
});

test('elegirMime: primer formato soportado, o vacío', () => {
  assert.equal(elegirMime((t) => t === 'audio/mp4'), 'audio/mp4'); // Safari
  assert.equal(elegirMime(() => true), 'audio/webm;codecs=opus'); // Chrome
  assert.equal(elegirMime(() => false), '');
  assert.equal(elegirMime(() => { throw new Error('x'); }), '');
});

test('traducirErrorMedia: códigos y mensajes claros', () => {
  const caso = (name) => traducirErrorMedia(Object.assign(new Error('x'), { name }));
  assert.equal(caso('NotAllowedError').codigo, 'permiso-denegado');
  assert.match(caso('NotAllowedError').message, /permiso/);
  assert.equal(caso('SecurityError').codigo, 'permiso-denegado');
  assert.equal(caso('NotFoundError').codigo, 'sin-dispositivo');
  assert.equal(caso('NotReadableError').codigo, 'ocupado');
  assert.equal(caso('TypeError').codigo, 'sin-soporte');
  assert.equal(caso('Rara').codigo, 'otro');
  assert.ok(caso('NotAllowedError') instanceof ErrorHardware);
  const ya = new ErrorHardware('otro', 'm');
  assert.equal(traducirErrorMedia(ya), ya);
});

// ---------- hardware: grabadora con micrófono simulado ----------

function crearSimulacion() {
  const pistas = [{ detenida: false, stop() { this.detenida = true; } }];
  const stream = { getTracks: () => pistas };
  class GrabadorFalso {
    static isTypeSupported(t) { return t === 'audio/webm;codecs=opus'; }
    constructor(s, opciones) { this.stream = s; this.opciones = opciones; this.state = 'inactive'; this.mimeType = opciones?.mimeType ?? ''; }
    start() { this.state = 'recording'; }
    stop() {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])]) });
      queueMicrotask(() => this.onstop?.());
    }
  }
  return { pistas, stream, GrabadorFalso };
}

test('grabadora: iniciar y detener devuelve el audio, con el formato elegido, y suelta el micrófono', async () => {
  const { pistas, stream, GrabadorFalso } = crearSimulacion();
  const g = await crearGrabadora({ obtenerStream: async () => stream, MediaRecorderImpl: GrabadorFalso });
  assert.equal(g.mime, 'audio/webm;codecs=opus');
  assert.equal(g.grabando, false);
  g.iniciar();
  assert.equal(g.grabando, true);
  const r = await g.detener();
  assert.equal(r.blob.size, 3);
  assert.equal(r.mime, 'audio/webm;codecs=opus');
  assert.ok(r.ms >= 0);
  assert.equal(pistas[0].detenida, true, 'el micrófono debe quedar libre');
});

test('grabadora: cancelar descarta la grabación y suelta el micrófono', async () => {
  const { pistas, stream, GrabadorFalso } = crearSimulacion();
  const g = await crearGrabadora({ obtenerStream: async () => stream, MediaRecorderImpl: GrabadorFalso });
  g.iniciar();
  assert.equal(await g.cancelar(), null);
  assert.equal(pistas[0].detenida, true);
});

test('grabadora: cancelar sin haber iniciado también libera el micrófono', async () => {
  const { pistas, stream, GrabadorFalso } = crearSimulacion();
  const g = await crearGrabadora({ obtenerStream: async () => stream, MediaRecorderImpl: GrabadorFalso });
  assert.equal(await g.cancelar(), null);
  assert.equal(pistas[0].detenida, true);
});

test('grabadora: se detiene sola al llegar al límite y avisa', async () => {
  const { stream, GrabadorFalso } = crearSimulacion();
  const g = await crearGrabadora({ obtenerStream: async () => stream, MediaRecorderImpl: GrabadorFalso, maxMs: 20 });
  let avisado = false;
  g.iniciar(() => { avisado = true; });
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(avisado, true);
  assert.equal(g.grabando, false);
  const r = await g.detener(); // detener después del límite devuelve lo grabado
  assert.equal(r.blob.size, 3);
});

test('grabadora: permiso denegado, sin micrófono y sin soporte dan errores claros', async () => {
  const denegar = (name) => async () => { throw Object.assign(new Error('x'), { name }); };
  await assert.rejects(crearGrabadora({ obtenerStream: denegar('NotAllowedError'), MediaRecorderImpl: class {} }), (e) => e.codigo === 'permiso-denegado');
  await assert.rejects(crearGrabadora({ obtenerStream: denegar('NotFoundError'), MediaRecorderImpl: class {} }), (e) => e.codigo === 'sin-dispositivo');
  // sin inyectar nada, en Node no hay micrófono ni MediaRecorder
  await assert.rejects(crearGrabadora(), (e) => e instanceof ErrorHardware && e.codigo === 'sin-soporte' && /no permite grabar/.test(e.message));
});

test('grabadora: si falla al crear el MediaRecorder, libera el micrófono', async () => {
  const { pistas, stream } = crearSimulacion();
  class Roto { constructor() { throw Object.assign(new Error('x'), { name: 'NotSupportedError' }); } }
  await assert.rejects(crearGrabadora({ obtenerStream: async () => stream, MediaRecorderImpl: Roto }), ErrorHardware);
  assert.equal(pistas[0].detenida, true);
});

// ---------- imágenes ----------

test('recorte cuadrado: centrado en fotos horizontales, verticales y cuadradas', () => {
  assert.deepEqual(calcularRecorteCuadrado(400, 300), { sx: 50, sy: 0, tam: 300 });
  assert.deepEqual(calcularRecorteCuadrado(300, 400), { sx: 0, sy: 50, tam: 300 });
  assert.deepEqual(calcularRecorteCuadrado(300, 300), { sx: 0, sy: 0, tam: 300 });
  assert.deepEqual(calcularRecorteCuadrado(4000, 3001), { sx: 499, sy: 0, tam: 3001 });
});

test('ladoFinal: reduce las grandes y no agranda las pequeñas', () => {
  assert.equal(ladoFinal(3000), 512);
  assert.equal(ladoFinal(200), 200);
  assert.equal(ladoFinal(1000, 256), 256);
});

// ---------- voz ----------

const voz = (lang, name = lang, localService = true) => ({ lang, name, localService });

test('elegirVoz: prefiere es-CL, luego es-419, es-US, es-MX, es-ES y luego cualquier español', () => {
  const todas = [voz('en-US'), voz('es-ES'), voz('es-MX'), voz('es-US'), voz('es-419'), voz('es-CL')];
  assert.equal(elegirVoz(todas).lang, 'es-CL');
  assert.equal(elegirVoz(todas.filter((v) => v.lang !== 'es-CL')).lang, 'es-419');
  assert.equal(elegirVoz(todas.filter((v) => !['es-CL', 'es-419'].includes(v.lang))).lang, 'es-US');
  assert.equal(elegirVoz([voz('en-US'), voz('es-ES'), voz('es-MX')]).lang, 'es-MX');
  assert.equal(elegirVoz([voz('en-US'), voz('es-AR')]).lang, 'es-AR');
  assert.equal(elegirVoz([voz('es')]).lang, 'es');
});

test('elegirVoz: sin voces en español devuelve null; acepta es_CL con guion bajo (Android)', () => {
  assert.equal(elegirVoz([]), null);
  assert.equal(elegirVoz([voz('en-US'), voz('fr-FR')]), null);
  assert.equal(elegirVoz([voz('es_ES'), voz('es_CL')]).lang, 'es_CL');
  assert.equal(elegirVoz([voz('essay-XX')]), null, 'no confundir con otros códigos que empiezan con "es"');
});

test('elegirVoz: a igual idioma prefiere la voz del propio dispositivo', () => {
  const r = elegirVoz([voz('es-CL', 'remota', false), voz('es-CL', 'local', true)]);
  assert.equal(r.name, 'local');
});

// ---------- pictogramas ----------

test('urls de ARASAAC', () => {
  assert.equal(urlBusqueda(' mamá '), 'https://api.arasaac.org/v1/pictograms/es/search/mam%C3%A1');
  assert.equal(urlImagen(2458), 'https://static.arasaac.org/pictograms/2458/2458_500.png');
  assert.equal(urlImagen(2458, 300), 'https://static.arasaac.org/pictograms/2458/2458_300.png');
});

const item = (_id, keywords, extra = {}) => ({ _id, keywords: keywords.map((keyword) => ({ keyword })), ...extra });

test('normalizarResultados: coincidencias exactas primero, sin repetidos y sin violencia ni contenido sexual', () => {
  const json = [
    item(6144, ['Mamá Osa']),
    item(2458, ['mamá', 'madre']),
    item(2458, ['mamá']), // repetido
    item(1, ['mamá'], { violence: true }),
    item(2, ['mamá'], { sex: true }),
    { _id: 'x', keywords: [] }, // id inválido
    { keywords: [] }, // sin id
    item(7, ['MAMA']),
  ];
  const r = normalizarResultados(json, { texto: 'mamá' });
  assert.deepEqual(r.map((x) => x.id), [2458, 7, 6144]);
  assert.deepEqual(r[0].palabras, ['mamá', 'madre']);
});

test('normalizarResultados: respeta el máximo y tolera respuestas raras', () => {
  const muchos = Array.from({ length: 30 }, (_, i) => item(i + 1, ['x']));
  assert.equal(normalizarResultados(muchos, { texto: 'y', max: 5 }).length, 5);
  assert.equal(normalizarResultados(muchos).length, 12);
  assert.deepEqual(normalizarResultados(null), []);
  assert.deepEqual(normalizarResultados({ error: 'x' }), []);
  assert.deepEqual(normalizarResultados([null, undefined, 3]), []);
});

const respuesta = (cuerpo, { status = 200 } = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => cuerpo,
  blob: async () => cuerpo,
});

test('buscarPictogramas: busca, ordena y no llama a la red con texto vacío', async () => {
  const llamadas = [];
  const fetchImpl = async (url) => { llamadas.push(url); return respuesta([item(2458, ['mamá'])]); };
  const r = await buscarPictogramas('mamá', { fetchImpl });
  assert.deepEqual(r, [{ id: 2458, palabras: ['mamá'] }]);
  assert.deepEqual(llamadas, ['https://api.arasaac.org/v1/pictograms/es/search/mam%C3%A1']);
  assert.deepEqual(await buscarPictogramas('   ', { fetchImpl }), []);
  assert.equal(llamadas.length, 1);
});

test('buscarPictogramas: 404 es "sin resultados"; otros errores y la red caída son ErrorRed', async () => {
  assert.deepEqual(await buscarPictogramas('zzz', { fetchImpl: async () => respuesta([], { status: 404 }) }), []);
  await assert.rejects(buscarPictogramas('x', { fetchImpl: async () => respuesta([], { status: 500 }) }), (e) => e instanceof ErrorRed && e.codigo === 'servicio');
  await assert.rejects(buscarPictogramas('x', { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), (e) => e.codigo === 'sin-conexion');
  await assert.rejects(buscarPictogramas('x', { fetchImpl: async () => ({ status: 200, ok: true, json: async () => { throw new Error('no json'); } }) }), (e) => e.codigo === 'servicio');
});

test('descargarPictograma: devuelve el blob; falla si está vacío o el servidor responde error', async () => {
  const png = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
  const r = await descargarPictograma(2458, { fetchImpl: async () => respuesta(png) });
  assert.equal(r.blob.size, 4);
  assert.equal(r.mime, 'image/png');
  assert.equal(r.arasaacId, 2458);
  await assert.rejects(descargarPictograma(1, { fetchImpl: async () => respuesta(new Blob([])) }), ErrorRed);
  await assert.rejects(descargarPictograma(1, { fetchImpl: async () => respuesta(png, { status: 404 }) }), ErrorRed);
  await assert.rejects(descargarPictograma(1, { fetchImpl: async () => { throw new TypeError('x'); } }), (e) => e.codigo === 'sin-conexion');
});
