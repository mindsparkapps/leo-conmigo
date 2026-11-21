// Regenera sílabas que sonaban mal, con el texto corregido de data/voces/correcciones-silabas.json.
// Guía (qué texto enviar según el problema): docs/voces-elevenlabs.md
//
//   node herramientas/regenerar-silabas.mjs             (todas las de la lista)
//   node herramientas/regenerar-silabas.mjs so ca nú    (solo esas)
//   node herramientas/regenerar-silabas.mjs --lista=data/voces/silabas-nuevas.json   (sílabas nuevas)
//
// Si la sílaba no estaba en SILABAS (js/silabas-voz.js) ni su mp3 en PRECACHE (sw.js), la agrega.
//
// Sobrescribe el mp3 de cada sílaba (mismo archivo, solo cambia el texto enviado). Cada entrada lleva `texto` (la
// sílaba de la app), `enviado` (lo que se manda a ElevenLabs) y, si hace falta, `contexto: true` (frase previa en
// español que no se pronuncia y stability 0.9) o `stability`. Se oyen en «Probar sílabas» del revisor.
// No sube VERSION ni hace commit.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const VOZ = '5yNXxdAaHAkq8N8bGqwQ'; // Catalina
const CLAVE = process.env.ELEVENLABS_API_KEY;
if (!CLAVE) throw new Error('Falta la variable de entorno ELEVENLABS_API_KEY (ver docs/voces-elevenlabs.md)');
const CONTEXTO = 'Ahora repite la sílaba en español, con voz tranquila y neutra: ';

/** Igual que archivoDe en js/silabas-voz.js. */
function archivoDe(silaba) {
  const sinEne = silaba.replace(/ñ/g, 'ny');
  const base = sinEne.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  return `data/voces/silabas/${base}${base !== sinEne ? '-t' : ''}.mp3`;
}

async function generar(c) {
  const cuerpo = {
    text: c.enviado,
    model_id: 'eleven_v4',
    language_code: 'es',
    apply_text_normalization: 'off',
    ...(c.contexto ? { previous_text: CONTEXTO } : {}),
    voice_settings: { stability: c.stability ?? (c.contexto ? 0.9 : 0.6), similarity_boost: 0.75 },
  };
  for (let intento = 1; intento <= 4; intento++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOZ}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': CLAVE, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
    });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 2000 * intento)); continue; }
    throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  throw new Error('demasiados reintentos');
}

// --lista=data/voces/silabas-nuevas.json usa otra lista con el mismo formato
const archivoLista = process.argv.find((a) => a.startsWith('--lista='))?.slice(8) ?? 'data/voces/correcciones-silabas.json';
const lista = JSON.parse(readFileSync(join(RAIZ, archivoLista), 'utf8'));
const pedidas = new Set(process.argv.slice(2).filter((a) => !a.startsWith('--')));
const trabajos = lista.filter((c) => !pedidas.size || pedidas.has(c.texto));
let siguiente = 0;
const fallos = [];
async function obrero() {
  while (siguiente < trabajos.length) {
    const c = trabajos[siguiente++];
    try {
      writeFileSync(join(RAIZ, archivoDe(c.texto)), await generar(c));
      console.log(`  ${c.texto} ← «${c.enviado}»${c.contexto ? ' (contexto)' : ''}`);
    } catch (e) { fallos.push(`${c.texto}: ${e.message}`); }
  }
}
await Promise.all(Array.from({ length: 3 }, obrero));
console.log(`regeneradas: ${trabajos.length - fallos.length} de ${trabajos.length}`);

// ---- anotar las sílabas nuevas en la app (igual que generar-voces.mjs) ----
const fallidas = new Set(fallos.map((f) => f.split(':')[0]));
const hechas = trabajos.filter((c) => !fallidas.has(c.texto));
let s = readFileSync(join(RAIZ, 'js/silabas-voz.js'), 'utf8');
let agregadas = 0;
s = s.replace(/const SILABAS = new Set\((\[.*?\])\);/, (_, l) => {
  const todas = JSON.parse(l);
  for (const c of hechas) if (!todas.includes(c.texto)) { todas.push(c.texto); agregadas++; }
  return `const SILABAS = new Set(${JSON.stringify(todas)});`;
});
if (agregadas) writeFileSync(join(RAIZ, 'js/silabas-voz.js'), s);
let sw = readFileSync(join(RAIZ, 'sw.js'), 'utf8');
const crlf = sw.includes('\r\n');
sw = sw.replace(/\r\n/g, '\n');
const lineas = hechas.map((c) => archivoDe(c.texto)).filter((a) => !sw.includes(`'${a}'`)).map((a) => `  '${a}',\n`).join('');
if (lineas) writeFileSync(join(RAIZ, 'sw.js'), (crlf ? (x) => x.replace(/\n/g, '\r\n') : (x) => x)(sw.replace("  'data/voces/indice.json',\n", `  'data/voces/indice.json',\n${lineas}`)));
if (agregadas || lineas) console.log(`anotadas en SILABAS: ${agregadas}; en PRECACHE: ${lineas.split('\n').length - 1}. Falta subir VERSION.`);
for (const f of fallos) console.log('ERROR', f);
