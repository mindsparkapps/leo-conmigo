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
// español que no se pronuncia y stability 0.9; si es un texto, esa frase) o `stability`. Con `ruta` sobrescribe ese
// mp3 en vez del de la sílaba (para una palabra que ya está en la app). Se oyen en «Probar sílabas» del revisor.
// No sube VERSION ni hace commit.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const VOZ = '5yNXxdAaHAkq8N8bGqwQ'; // Catalina
const CLAVE = process.env.ELEVENLABS_API_KEY;
if (!CLAVE) throw new Error('Falta la variable de entorno ELEVENLABS_API_KEY (ver docs/voces-elevenlabs.md)');
const CONTEXTO = 'Ahora repite la sílaba en español, con voz tranquila y neutra: ';

/** Igual que archivoDe en js/silabas-voz.js. */
function archivoDe(silaba) {
  const sinEne = silaba.replace(/ñ/g, 'ny').replace(/ü/g, 'uu');
  const base = sinEne.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  return `data/voces/silabas/${base}${base !== sinEne ? '-t' : ''}.mp3`;
}

async function generar(c) {
  const cuerpo = {
    text: c.enviado,
    model_id: 'eleven_v4',
    language_code: 'es',
    apply_text_normalization: 'off',
    ...(c.contexto ? { previous_text: typeof c.contexto === 'string' ? c.contexto : CONTEXTO } : {}),
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
let trabajos = lista.filter((c) => !pedidas.size || pedidas.has(c.texto));

// Lista del diccionario (docs/plan-silabas-diccionario.md, fase 3). Opciones:
//   --cobertura=99|99.9|100  solo las sílabas de ese corte o menor (campo `cobertura` del JSON)
//   --desde=N --hasta=M      tanda: posiciones N a M (desde 1) de la lista ya filtrada, que va en orden alfabético
//   --sin-precache           las anota en SILABAS pero NO en PRECACHE (se guardan en caché al oírlas)
//   --probar                 solo cuenta lo que haría, sin llamar a ElevenLabs
const opcion = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const SIN_PRECACHE = process.argv.includes('--sin-precache');
const SOLO_PROBAR = process.argv.includes('--probar');
if (archivoLista.includes('silabas-diccionario')) {
  const { LISTA_DE_SILABAS } = await import(pathToFileURL(join(RAIZ, 'js/silabas-voz.js')).href);
  const yaAnotadas = new Set(LISTA_DE_SILABAS.map((s) => s.texto));
  const archivosUsados = new Map(LISTA_DE_SILABAS.map((s) => [archivoDe(s.texto), s.texto]));
  const tope = Number(opcion('cobertura') ?? 100);
  trabajos = trabajos.filter((c) => (c.cobertura ?? 100) <= tope);
  trabajos = trabajos.slice(Number(opcion('desde') ?? 1) - 1, Number(opcion('hasta') ?? trabajos.length));
  const omitidas = [];
  trabajos = trabajos.filter((c) => {
    if (yaAnotadas.has(c.texto)) return false; // ya está hecha
    if (!/[aeiouáéíóúü]/.test(c.texto)) { omitidas.push(`${c.texto} (sin vocal)`); return false; }
    const a = archivoDe(c.texto);
    const otra = archivosUsados.get(a);
    if (otra && otra !== c.texto) { omitidas.push(`${c.texto} (su archivo ya es de «${otra}»)`); return false; }
    archivosUsados.set(a, c.texto);
    return true;
  });
  if (omitidas.length) console.log(`omitidas por choque de archivo o sin vocal: ${omitidas.join(', ')}`);
  // Si un intento anterior dejó el mp3 pero no llegó a anotarlo, no se vuelve a pagar: solo se anota.
  for (const c of trabajos) c.yaGenerada = existsSync(join(RAIZ, archivoDe(c.texto)));
  console.log(`tanda: ${trabajos.length} sílabas (${trabajos.filter((c) => c.yaGenerada).length} ya tenían mp3), ${trabajos.reduce((n, c) => n + [...c.enviado].length, 0)} caracteres`);
  if (SOLO_PROBAR) process.exit(0);
}
let siguiente = 0;
const fallos = [];
async function obrero() {
  while (siguiente < trabajos.length) {
    const c = trabajos[siguiente++];
    try {
      if (!c.yaGenerada) writeFileSync(join(RAIZ, c.ruta ?? archivoDe(c.texto)), await generar(c));
      console.log(`  ${c.texto} ← «${c.enviado}»${c.contexto ? ' (contexto)' : ''}${c.yaGenerada ? ' (ya existía)' : ''}`);
    } catch (e) { fallos.push(`${c.texto}: ${e.message}`); }
  }
}
await Promise.all(Array.from({ length: 3 }, obrero));
console.log(`regeneradas: ${trabajos.length - fallos.length} de ${trabajos.length}`);

// ---- anotar las sílabas nuevas en la app (igual que generar-voces.mjs) ----
const fallidas = new Set(fallos.map((f) => f.split(':')[0]));
// (las que traen `ruta` son palabras que ya estaban en la app: no se anotan como sílabas)
const hechas = trabajos.filter((c) => !fallidas.has(c.texto) && !c.ruta);
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
const lineas = (SIN_PRECACHE ? [] : hechas).map((c) => archivoDe(c.texto)).filter((a) => !sw.includes(`'${a}'`)).map((a) => `  '${a}',\n`).join('');
if (lineas) writeFileSync(join(RAIZ, 'sw.js'), (crlf ? (x) => x.replace(/\n/g, '\r\n') : (x) => x)(sw.replace("  'data/voces/indice.json',\n", `  'data/voces/indice.json',\n${lineas}`)));
if (agregadas || lineas) console.log(`anotadas en SILABAS: ${agregadas}; en PRECACHE: ${lineas.split('\n').length - 1}. Falta subir VERSION.`);
for (const f of fallos) console.log('ERROR', f);
