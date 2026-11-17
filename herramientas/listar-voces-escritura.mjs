// Lista las voces que le faltan al modo Escritura (Ampliación 5, fase 32) y las deja en data/escritura/faltan-voces.txt.
//
//   node herramientas/listar-voces-escritura.mjs            escribe data/escritura/faltan-voces.txt
//   node herramientas/listar-voces-escritura.mjs --solo-resumen   solo imprime los números
//
// Mientras no existan, la app usa la voz sintética (una sílaba suelta en voz sintética puede sonar mal). Para cada una:
//  - SÍLABAS: el mp3 va en data/voces/silabas/<sílaba sin tildes>.mp3 (con «-t» si la sílaba llevaba tilde: «pá» → «pa-t.mp3»);
//    después hay que anotarla en LISTA_DE_SILABAS de js/silabas-voz.js y en PRECACHE de sw.js.
//  - PALABRAS: el mp3 va en data/voces/<palabra sin tildes>.mp3 y se anota en data/voces/indice.json.
// Es de solo lectura sobre la app: nunca cambia nada salvo faltan-voces.txt.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rutaDeSilaba } from '../js/silabas-voz.js';
import { rutaDeFrase } from '../js/frases-voz.js';
import { silabasLejanas, silabasParecidas } from '../js/core/escritura/piezas.js';
import { NIVELES } from '../js/core/escritura/niveles.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leerJson = (ruta) => JSON.parse(readFileSync(join(RAIZ, ruta), 'utf8').replace(/^﻿/, '')); // algunos archivos traen BOM

const sinTildes = (t) => String(t).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
/** Nombre del archivo de una sílaba (igual que `archivoDe` de js/silabas-voz.js). */
const archivoDeSilaba = (s) => { const e = s.replace(/ñ/g, 'ny'); const base = sinTildes(e); return base + (base !== e ? '-t' : ''); };
const claveDeClip = (palabra) => sinTildes(palabra);

const banco = leerJson('data/escritura/banco.json');
const clips = new Set(leerJson('data/voces/indice.json'));

// ---- sílabas ----
const delBanco = new Set();
const agregarSilabas = (lista) => (lista ?? []).forEach((s) => delBanco.add(String(s).toLowerCase()));
for (const p of banco.palabras ?? []) agregarSilabas(p.silabas);
for (const f of banco.frases ?? []) for (const p of f.palabras ?? []) agregarSilabas(p.silabas);
for (const t of banco.textos ?? []) agregarSilabas(t.falta?.silabas);
for (const v of ['a', 'e', 'i', 'o', 'u']) delBanco.add(v); // las piezas de E01 y sus distractoras

// Las que pueden salir de «sílabas que no son»: parecidas y lejanas de cada sílaba del banco
const distractoras = new Set();
for (const s of delBanco) {
  for (const x of [...silabasParecidas(s), ...silabasLejanas(s)]) distractoras.add(x.toLowerCase());
}
for (const s of delBanco) distractoras.delete(s);

const sinMp3 = (conjunto) => [...conjunto].filter((s) => !rutaDeSilaba(s)).sort((a, b) => a.localeCompare(b, 'es'));
const silabasBanco = sinMp3(delBanco);
const silabasDistractoras = sinMp3(distractoras);

// ---- palabras del catálogo (data/voces/) ----
const palabrasSinVoz = new Map(); // clave de archivo → texto
const revisar = (texto) => {
  for (const token of String(texto ?? '').match(/[\p{L}\p{N}]+/gu) ?? []) {
    const clave = claveDeClip(token);
    if (!clips.has(clave)) palabrasSinVoz.set(clave, token.toLowerCase());
  }
};
for (const p of banco.palabras ?? []) revisar(p.modelo ?? p.texto); // en E01 se dice la imagen («abeja»)
for (const f of banco.frases ?? []) { if (!rutaDeFrase(f.texto)) revisar(f.texto); }
for (const t of banco.textos ?? []) for (const f of t.frases ?? []) { if (!rutaDeFrase(f)) revisar(f); }
// el menú de niveles dice el ejemplo de cada nivel (menos el dictado, que es un altavoz)
const ejemplos = NIVELES.filter((n) => n.id !== 'E20').map((n) => n.ejemplo).filter((e) => !rutaDeSilaba(e) && !rutaDeFrase(e));
const ejemplosSinVoz = ejemplos.filter((e) => ![...String(e).match(/[\p{L}\p{N}]+/gu) ?? []].every((t) => clips.has(claveDeClip(t))));

const lista = [...palabrasSinVoz.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));

const resumen = {
  silabasDelBanco: silabasBanco.length,
  silabasDistractoras: silabasDistractoras.length,
  palabras: lista.length,
  ejemplosDeNivel: ejemplosSinVoz.length,
};
console.log(JSON.stringify(resumen));

if (!process.argv.includes('--solo-resumen')) {
  const lineas = [
    '# Voces que faltan para el modo Escritura (generado por herramientas/listar-voces-escritura.mjs)',
    `# Banco: ${(banco.palabras ?? []).length} palabras, ${(banco.frases ?? []).length} frases, ${(banco.textos ?? []).length} textos.`,
    '# Mientras no existan, la app usa la voz sintética (una sílaba suelta en voz sintética puede sonar mal).',
    '# Vuelve a correr el script después de generar las voces para ver qué queda.',
    '',
    `## 1. SÍLABAS de las palabras del banco sin mp3 (${silabasBanco.length})`,
    '# Archivo: data/voces/silabas/<archivo>.mp3 · luego anótala en js/silabas-voz.js (SILABAS) y en sw.js (PRECACHE).',
    ...silabasBanco.map((s) => `${s}\tdata/voces/silabas/${archivoDeSilaba(s)}.mp3`),
    '',
    `## 2. SÍLABAS que pueden salir como «sílabas que no son» y no tienen mp3 (${silabasDistractoras.length})`,
    '# Menos urgentes: solo suenan si el niño toca una pieza que no era de la palabra.',
    ...silabasDistractoras.map((s) => `${s}\tdata/voces/silabas/${archivoDeSilaba(s)}.mp3`),
    '',
    `## 3. PALABRAS sin voz en data/voces/ (${lista.length})`,
    '# Archivo: data/voces/<palabra sin tildes>.mp3 · luego anótala en data/voces/indice.json.',
    ...lista.map(([clave, texto]) => `${texto}\tdata/voces/${clave}.mp3`),
    '',
    `## 4. EJEMPLOS del menú de niveles que no tienen voz (${ejemplosSinVoz.length})`,
    '# Se dicen al tocar un nivel; sin voz propia usan la voz sintética.',
    ...ejemplosSinVoz,
    '',
  ];
  const destino = join(RAIZ, 'data/escritura/faltan-voces.txt');
  writeFileSync(destino, lineas.join('\n'), 'utf8');
  console.log(`Escrito: data/escritura/faltan-voces.txt${existsSync(destino) ? '' : ' (no se pudo comprobar)'}`);
}
