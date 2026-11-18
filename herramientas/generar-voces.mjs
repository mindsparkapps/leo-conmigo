// Genera por la API de ElevenLabs las voces de data/escritura/faltan-voces.txt y las deja integradas en la app.
// Guía completa (voz, modelo, español forzado, clave): docs/voces-elevenlabs.md
//
//   node herramientas/listar-voces-escritura.mjs          (actualiza faltan-voces.txt)
//   node herramientas/generar-voces.mjs [--solo=1,3,4] [--max=N] [--probar]
//
// Lee las secciones 1 a 4 de faltan-voces.txt. Salta lo que ya tiene mp3. Por cada mp3 nuevo anota:
//  - sílabas (1, 2 y los ejemplos de una sola sílaba): SILABAS en js/silabas-voz.js + PRECACHE en sw.js
//  - palabras (3): data/voces/indice.json + PRECACHE
//  - ejemplos con varias palabras (4): FRASES en js/frases-voz.js + PRECACHE
// No sube VERSION ni hace commit: eso se hace después, a mano.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const VOZ = '5yNXxdAaHAkq8N8bGqwQ'; // Catalina
const MODELO = 'eleven_v4';
const CLAVE = process.env.ELEVENLABS_API_KEY;
if (!CLAVE) throw new Error('Falta la variable de entorno ELEVENLABS_API_KEY (ver docs/voces-elevenlabs.md)');

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const secciones = new Set((arg('solo') ?? '1,2,3,4').split(',').map(Number));
const MAX = Number(arg('max') ?? Infinity);
const PARALELO = 3; // el plan Starter admite pocas peticiones a la vez

const sinTildes = (t) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const ruta = (r) => join(RAIZ, r);

// ---- leer faltan-voces.txt ----
const trabajos = [];
let seccion = 0;
for (const linea of readFileSync(ruta('data/escritura/faltan-voces.txt'), 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
  const m = linea.match(/^## (\d)\./);
  if (m) { seccion = Number(m[1]); continue; }
  if (!linea.trim() || linea.startsWith('#') || !secciones.has(seccion)) continue;
  const [texto, archivo] = linea.split('\t');
  if (seccion === 4) {
    const silaba = !/[\s·]/.test(texto.trim());
    const e = texto.trim().replace(/ñ/g, 'ny'); // la ñ va como «ny» en los nombres de archivo
    const nombre = silaba ? sinTildes(e) + (sinTildes(e) !== e ? '-t' : '') : sinTildes(texto).replace(/[\s·]+/g, '-');
    trabajos.push({ seccion, tipo: silaba ? 'silaba' : 'frase', texto: texto.trim(), habla: texto.replace(/·/g, ''), archivo: silaba ? `data/voces/silabas/${nombre}.mp3` : `data/voces/frases/${nombre}.mp3` });
  } else {
    trabajos.push({ seccion, tipo: seccion === 3 ? 'palabra' : 'silaba', texto, habla: texto, archivo });
  }
}

// Para sílabas sueltas: sin normalización de texto (si no, «dra» → «doctora», «ed» → «edición», «vi» → «seis») y, si
// suena mal (inglés, francés), escribirla con acento en la vocal fuerte («drí», «cráz»). Ver docs/voces-elevenlabs.md.
async function generar(texto, silaba = false) {
  for (let intento = 1; intento <= 4; intento++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOZ}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': CLAVE, 'Content-Type': 'application/json' },
      // language_code: 'es' es obligatorio: sin él las palabras cortas se leen en inglés («mar» → «march»)
      body: JSON.stringify({ text: texto, model_id: MODELO, language_code: 'es', ...(silaba ? { apply_text_normalization: 'off' } : {}), voice_settings: { stability: silaba ? 0.6 : 0.5, similarity_boost: 0.75 } }),
    });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 2000 * intento)); continue; }
    throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  throw new Error('demasiados reintentos');
}

const vistos = new Set();
const pendientes = trabajos
  .filter((t) => !existsSync(ruta(t.archivo)) && !vistos.has(t.archivo) && vistos.add(t.archivo))
  .slice(0, MAX);
console.log(`${pendientes.length} por generar (de ${trabajos.length} en la lista)`);
if (process.argv.includes('--probar')) process.exit(0);

// lo que ya tenía mp3 pero no estaba anotado también se integra (la integración no repite nada)
const hechos = trabajos.filter((t) => existsSync(ruta(t.archivo)));
let siguiente = 0;
let fallo = null;
async function obrero() {
  while (!fallo && siguiente < pendientes.length) {
    const t = pendientes[siguiente++];
    try {
      const mp3 = await generar(t.habla, t.tipo === 'silaba');
      mkdirSync(dirname(ruta(t.archivo)), { recursive: true });
      writeFileSync(ruta(t.archivo), mp3);
      hechos.push(t);
      if (hechos.length % 25 === 0) console.log(`  ${hechos.length}/${pendientes.length}`);
    } catch (e) { fallo = `${t.texto}: ${e.message}`; }
  }
}
await Promise.all(Array.from({ length: PARALELO }, obrero));
if (fallo) console.log('ERROR:', fallo, '(lo ya generado se integra igual)');

// ---- integrar lo generado ----
const nuevosPrecache = hechos.map((t) => t.archivo);

const silabas = hechos.filter((t) => t.tipo === 'silaba').map((t) => t.texto.trim());
if (silabas.length) {
  let s = readFileSync(ruta('js/silabas-voz.js'), 'utf8');
  s = s.replace(/const SILABAS = new Set\((\[.*?\])\);/, (_, lista) => {
    const todas = JSON.parse(lista);
    for (const x of silabas) if (!todas.includes(x)) todas.push(x);
    return `const SILABAS = new Set(${JSON.stringify(todas)});`;
  });
  writeFileSync(ruta('js/silabas-voz.js'), s);
}

const palabras = hechos.filter((t) => t.tipo === 'palabra');
if (palabras.length) {
  const bruto = readFileSync(ruta('data/voces/indice.json'), 'utf8');
  const bom = bruto.startsWith('﻿') ? '﻿' : '';
  const indice = JSON.parse(bruto.replace(/^﻿/, ''));
  for (const p of palabras) { const k = sinTildes(p.texto); if (!indice.includes(k)) indice.push(k); }
  writeFileSync(ruta('data/voces/indice.json'), bom + JSON.stringify(indice.sort()));
}

const frases = hechos.filter((t) => t.tipo === 'frase');
if (frases.length) {
  let f = readFileSync(ruta('js/frases-voz.js'), 'utf8');
  const entradas = frases.filter((t) => !f.includes(`'${t.archivo.replace('data/voces/frases/', '').replace('.mp3', '')}'],`)).map((t) => `  ['${t.texto.replace(/'/g, "\\'")}', '${t.archivo.replace('data/voces/frases/', '').replace('.mp3', '')}'],\n`).join('');
  f = f.replace('const FRASES = [\n', `const FRASES = [\n  // ejemplos del menú de niveles de Escritura\n${entradas}`);
  writeFileSync(ruta('js/frases-voz.js'), f);
}

if (nuevosPrecache.length) {
  let sw = readFileSync(ruta('sw.js'), 'utf8');
  const crlf = sw.includes('\r\n');
  sw = sw.replace(/\r\n/g, '\n');
  const ya = (a) => sw.includes(`'${a}'`);
  const lineas = nuevosPrecache.filter((a) => !ya(a)).map((a) => `  '${a}',\n`).join('');
  sw = sw.replace("  'data/voces/indice.json',\n", `  'data/voces/indice.json',\n${lineas}`);
  writeFileSync(ruta('sw.js'), crlf ? sw.replace(/\n/g, '\r\n') : sw);
}

console.log(`generadas e integradas: ${hechos.length}. Falta: subir VERSION en js/config.js, npm test y commit.`);
