// Lista las sílabas del español que todavía no tienen mp3 (plan: docs/plan-silabas-diccionario.md, fase 1) y deja en
// data/voces/silabas-diccionario.json, para cada una: texto, frecuencia, ejemplos, riesgo y enviado (la «receta» de la
// fase 2: qué texto se manda a ElevenLabs). NO genera audio ni llama a ElevenLabs.
//
//   node herramientas/silabas-diccionario.mjs --hunspell=<carpeta con es_ES.dic y es_ES.aff>
//   node herramientas/silabas-diccionario.mjs --crea=<listado de frecuencias del CREA (txt)>
//   Opciones: --cobertura=99|99.9|100 (cuáles sílabas se escriben en el JSON; por defecto 100 = todas; cada sílaba
//             lleva su campo `cobertura`, así la fase 3 también puede filtrar después)   --sin-escribir (solo informe)   --informe=<archivo.json> (guarda también los números del informe)
//
// Las fuentes son datos no confiables: se leen como texto, nunca se ejecuta nada de ellas, y NO entran al repositorio
// (solo la lista de sílabas derivada). Hunspell no trae frecuencias: cada forma vale 1. Con el CREA cada forma vale su
// frecuencia absoluta.
//
// riesgo: «alto» = receta 1 a 6 (las que fallaron en las tandas anteriores) o sílaba sin vocal; «medio» = receta 8 que
// termina en «r» (las «anglo» más frecuentes); «bajo» = el resto. extranjerismo: true si TODAS las palabras que usan la
// sílaba están marcadas (con k, w, sh o terminadas en consonante doble); se marca, no se borra.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { silabear } from '../js/core/silabas.js';
import { LISTA_DE_SILABAS } from '../js/silabas-voz.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'data/voces/silabas-diccionario.json');
const KB_POR_MP3 = 12.5;

// ---------------------------------------------------------------- recetas (fase 2)

const TILDES = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };
const CON_TILDE = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', ü: 'ü' };
const INTERJECCIONES = new Set(['guau', 'miau', 'bua', 'buu', 'muu', 'cuac']);

export const sinTilde = (s) => s.replace(/[áéíóú]/g, (c) => TILDES[c]);
const llevaTilde = (s) => /[áéíóú]/.test(s);

/** Pone el acento en la vocal fuerte (en «ui»/«iu», la segunda; en «qu»/«gu» con e/i la «u» no cuenta). */
export function acentuar(s) {
  if (llevaTilde(s)) return s;
  const letras = [...s];
  const vocales = [];
  letras.forEach((c, i) => {
    if (!'aeiouü'.includes(c)) return;
    const muda = c === 'u' && /[qg]/.test(letras[i - 1] ?? '') && 'eiéí'.includes(letras[i + 1] ?? '-');
    if (!muda) vocales.push(i);
  });
  if (vocales.length === 0) return s;
  const fuerte = vocales.find((i) => 'aeo'.includes(letras[i]));
  const elegida = fuerte ?? vocales[vocales.length - 1];
  letras[elegida] = CON_TILDE[letras[elegida]];
  return letras.join('');
}

/** La receta de la fase 2 para una sílaba: la primera regla que calza manda. Devuelve { receta, enviado }. */
export function recetaDe(silaba) {
  const s = silaba.toLowerCase();
  if (/^h[aeiouáéíóúü]/.test(s)) return { receta: 1, enviado: acentuar(s.slice(1)) };
  if (s.endsWith('er')) return { receta: 2, enviado: sinTilde(s) };
  if (s.startsWith('j')) return { receta: 3, enviado: sinTilde(s) };
  if (s.includes('x')) return { receta: 4, enviado: acentuar(s.replaceAll('x', 'ks')) };
  if (/(eu|ei|oi)r$/.test(s)) {
    const cerrada = s.replace(/(eu|ei|oi)r$/, (m) => `${m[0]}${CON_TILDE[m[1]]}r`);
    return { receta: 5, enviado: cerrada.replace(/^c(?=[ei])/, 's') };
  }
  if (INTERJECCIONES.has(sinTilde(s))) return { receta: 6, enviado: sinTilde(s) };
  if (llevaTilde(s)) return { receta: 7, enviado: s };
  return { receta: 8, enviado: acentuar(s) };
}

function riesgoDe(silaba, receta) {
  if (!/[aeiouáéíóúü]/.test(silaba)) return 'alto';
  if (receta <= 6) return 'alto';
  if (receta === 8 && silaba.endsWith('r')) return 'medio';
  return 'bajo';
}

// ---------------------------------------------------------------- palabras

const SOLO_ESPANOL = /^[a-záéíóúüñ]+$/;

/** ¿Palabra válida para el corpus? Fuera siglas (todo mayúsculas), dígitos y letras que no son del español. */
export function palabraValida(original) {
  if (original.length > 1 && original === original.toUpperCase()) return false;
  return SOLO_ESPANOL.test(original.toLowerCase());
}

/** Extranjerismo evidente: con k, w, sh o terminada en la misma consonante repetida (se marca, no se borra). */
export function esExtranjerismo(palabra) {
  return /[kw]|sh/.test(palabra) || /([^aeiouáéíóúü])\1$/.test(palabra);
}

// ---------------------------------------------------------------- Hunspell

/** Lee es_ES.aff: reglas PFX/SFX agrupadas por bandera. Las banderas son un carácter (FLAG UTF-8). */
export function leerAff(texto) {
  const reglas = { PFX: new Map(), SFX: new Map() };
  for (const linea of texto.split(/\r?\n/)) {
    const p = linea.trim().split(/\s+/);
    if (p[0] !== 'PFX' && p[0] !== 'SFX') continue;
    if (p.length === 4 && (p[2] === 'Y' || p[2] === 'N') && /^\d+$/.test(p[3])) {
      reglas[p[0]].set(p[1], { cruzan: p[2] === 'Y', lista: [] }); // cabecera
    } else if (p.length >= 5) {
      const grupo = reglas[p[0]].get(p[1]);
      if (!grupo) continue;
      const quitar = p[2] === '0' ? '' : p[2];
      const poner = p[3].split('/')[0] === '0' ? '' : p[3].split('/')[0];
      const condicion = p[4] === '.' ? null : new RegExp(p[0] === 'PFX' ? `^${p[4]}` : `${p[4]}$`, 'u');
      grupo.lista.push({ quitar, poner, condicion });
    }
  }
  return reglas;
}

function aplicar(tipo, regla, palabra) {
  if (regla.condicion && !regla.condicion.test(palabra)) return null;
  if (tipo === 'PFX') {
    if (regla.quitar && !palabra.startsWith(regla.quitar)) return null;
    return regla.poner + palabra.slice(regla.quitar.length);
  }
  if (regla.quitar && !palabra.endsWith(regla.quitar)) return null;
  return palabra.slice(0, palabra.length - regla.quitar.length) + regla.poner;
}

/** Todas las formas de una entrada del .dic con sus afijos (con combinación prefijo + sufijo si ambos la permiten). */
export function expandir(palabra, banderas, reglas) {
  const formas = new Set([palabra]);
  const sufijos = [];
  const prefijos = [];
  for (const b of banderas) {
    const s = reglas.SFX.get(b);
    if (s) for (const r of s.lista) { const f = aplicar('SFX', r, palabra); if (f) { formas.add(f); sufijos.push({ f, cruza: s.cruzan }); } }
    const p = reglas.PFX.get(b);
    if (p) for (const r of p.lista) { const f = aplicar('PFX', r, palabra); if (f) { formas.add(f); prefijos.push({ r, cruza: p.cruzan }); } }
  }
  for (const pre of prefijos) {
    if (!pre.cruza) continue;
    for (const suf of sufijos) {
      if (!suf.cruza) continue;
      const f = aplicar('PFX', pre.r, suf.f);
      if (f) formas.add(f);
    }
  }
  return formas;
}

export function cargarHunspell(carpeta) {
  const reglas = leerAff(readFileSync(join(carpeta, 'es_ES.aff'), 'utf8'));
  const lineas = readFileSync(join(carpeta, 'es_ES.dic'), 'utf8').split(/\r?\n/).slice(1);
  const palabras = new Map(); // forma original (conserva la mayúscula inicial) -> peso
  for (const linea of lineas) {
    if (!linea.trim()) continue;
    const [cabeza] = linea.split(/[\s\t]/);
    const corte = cabeza.indexOf('/');
    const palabra = corte === -1 ? cabeza : cabeza.slice(0, corte);
    const banderas = corte === -1 ? [] : [...cabeza.slice(corte + 1)];
    for (const forma of expandir(palabra, banderas, reglas)) palabras.set(forma, 1);
  }
  return palabras;
}

// ---------------------------------------------------------------- CREA (listado de frecuencias)

/** Cada línea del listado: orden, forma, frecuencia absoluta, frecuencia normalizada (separadas por tabulador o 2+ espacios). */
export function leerCrea(texto) {
  const palabras = new Map();
  for (const linea of texto.split(/\r?\n/)) {
    const campos = linea.trim().split(/\t+|\s{2,}|\s+/);
    if (campos.length < 3) continue;
    const forma = campos[1];
    const frecuencia = Number(campos[2].replace(/[.,\s]/g, ''));
    if (!forma || !Number.isFinite(frecuencia) || frecuencia <= 0) continue;
    palabras.set(forma, (palabras.get(forma) ?? 0) + frecuencia);
  }
  return palabras;
}

function cargarCrea(ruta) {
  let texto = readFileSync(ruta, 'utf8');
  if (texto.includes('�')) texto = readFileSync(ruta, 'latin1');
  return leerCrea(texto);
}

// ---------------------------------------------------------------- análisis

/** Junta palabras (forma -> peso) en sílabas que faltan y calcula cuántas hacen falta para cada cobertura. */
export function analizar(palabras, grabadas) {
  const porPalabra = []; // { palabra, peso, marcada, faltan: [silaba] }
  const silabas = new Map(); // texto -> { frecuencia, usos: [{palabra, peso}], soloMarcadas }
  const vistas = new Map(); // minúscula -> índice (si una forma aparece con y sin mayúscula se suma una vez)
  for (const [original, peso] of palabras) {
    if (!palabraValida(original)) continue;
    const palabra = original.toLowerCase();
    if (vistas.has(palabra)) continue;
    vistas.set(palabra, true);
    const marcada = esExtranjerismo(palabra);
    const faltan = [...new Set(silabear(palabra))].filter((s) => !grabadas.has(s));
    porPalabra.push({ palabra, peso, marcada, faltan });
    for (const s of faltan) {
      let e = silabas.get(s);
      if (!e) silabas.set(s, (e = { frecuencia: 0, usos: [], soloMarcadas: true }));
      e.frecuencia += peso;
      e.usos.push({ palabra, peso });
      if (!marcada) e.soloMarcadas = false;
    }
  }
  const orden = [...silabas.entries()].sort((a, b) => b[1].frecuencia - a[1].frecuencia || a[0].localeCompare(b[0], 'es'));
  const rango = new Map(orden.map(([s], i) => [s, i + 1]));

  const cobertura = (filtro) => {
    const total = porPalabra.filter(filtro).reduce((n, p) => n + p.peso, 0);
    const porRango = new Map(); // rango de la última sílaba que falta -> peso que se completa
    let completas = 0;
    for (const p of porPalabra.filter(filtro)) {
      if (p.faltan.length === 0) { completas += p.peso; continue; }
      const r = Math.max(...p.faltan.map((s) => rango.get(s)));
      porRango.set(r, (porRango.get(r) ?? 0) + p.peso);
    }
    const metas = { 99: null, 99.9: null, 100: null };
    let acumulado = completas;
    const alcanza = (pct) => acumulado >= total * (pct / 100) - 1e-9;
    for (const pct of Object.keys(metas)) if (alcanza(Number(pct))) metas[pct] = 0;
    for (let r = 1; r <= orden.length; r += 1) {
      acumulado += porRango.get(r) ?? 0;
      for (const pct of Object.keys(metas)) if (metas[pct] === null && alcanza(Number(pct))) metas[pct] = r;
    }
    return { palabras: porPalabra.filter(filtro).length, peso: total, yaCubierto: (completas / total) * 100, necesarias: metas };
  };

  return {
    orden, // [[silaba, {frecuencia, usos, soloMarcadas}]] de la más a la menos frecuente
    porPalabra,
    todas: cobertura(() => true),
    sinExtranjerismos: cobertura((p) => !p.marcada),
  };
}

function entradaDe([texto, e]) {
  const { receta, enviado } = recetaDe(texto);
  const ejemplos = [...e.usos]
    .sort((a, b) => b.peso - a.peso || a.palabra.length - b.palabra.length || a.palabra.localeCompare(b.palabra, 'es'))
    .slice(0, 3)
    .map((u) => u.palabra);
  return {
    texto,
    frecuencia: e.frecuencia,
    ejemplos,
    riesgo: riesgoDe(texto, receta),
    enviado,
    receta,
    contexto: true,
    stability: 0.9,
    extranjerismo: e.soloMarcadas,
  };
}

// ---------------------------------------------------------------- programa

function principal(argv) {
  const arg = (nombre) => argv.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3);
  const hunspell = arg('hunspell');
  const crea = arg('crea');
  if (!hunspell && !crea) {
    console.error('Uso: node herramientas/silabas-diccionario.mjs --hunspell=<carpeta> | --crea=<archivo> [--sin-escribir] [--informe=<json>]');
    process.exit(1);
  }
  const palabras = crea ? cargarCrea(resolve(crea)) : cargarHunspell(resolve(hunspell));
  const grabadas = new Set(LISTA_DE_SILABAS.map((s) => s.texto));
  const r = analizar(palabras, grabadas);
  // `cobertura` de cada sílaba: la opción más pequeña que la incluye (99, 99.9 o 100). Así quien genera el audio
  // (fase 3) puede quedarse con las de 99, las de 99 y 99.9, o todas.
  const { necesarias } = r.todas;
  const entradas = r.orden.map(entradaDe).map((e, i) => ({
    ...e,
    cobertura: i < necesarias[99] ? 99 : i < necesarias[99.9] ? 99.9 : 100,
  }));
  const elegida = Number(arg('cobertura') ?? 100);
  if (![99, 99.9, 100].includes(elegida)) throw new Error('--cobertura debe ser 99, 99.9 o 100');
  const caracteres = (n) => entradas.slice(0, n).reduce((suma, e) => suma + [...e.enviado].length, 0);

  const filas = (cob) => [99, 99.9, 100].map((pct) => {
    const n = cob.necesarias[pct];
    return { cobertura: `${pct} %`, silabas: n, mb: +((n * KB_POR_MP3) / 1024).toFixed(2), caracteres: caracteres(n) };
  });
  const informe = {
    fuente: crea ? 'CREA' : 'Hunspell es_ES',
    palabras: r.todas.palabras,
    marcadasComoExtranjerismo: r.porPalabra.filter((p) => p.marcada).length,
    silabasQueFaltan: entradas.length,
    extranjerismos: entradas.filter((e) => e.extranjerismo).length,
    porReceta: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [n, entradas.filter((e) => e.receta === n).length])),
    cubiertoHoy: { todas: +r.todas.yaCubierto.toFixed(2), sinExtranjerismos: +r.sinExtranjerismos.yaCubierto.toFixed(2) },
    cobertura: { todas: filas(r.todas), sinExtranjerismos: filas(r.sinExtranjerismos) },
    totalMb: +((entradas.length * KB_POR_MP3) / 1024).toFixed(2),
    totalCaracteres: caracteres(entradas.length),
    ejemplos: Array.from({ length: 30 }, (_, i) => {
      const e = entradas[Math.floor((i * entradas.length) / 30)];
      return `${e.texto} (envía «${e.enviado}», receta ${e.receta}) ← ${e.ejemplos[0]}`;
    }),
  };

  if (!argv.includes('--sin-escribir')) {
    const alfabetico = entradas.filter((e) => e.cobertura <= elegida).sort((a, b) => a.texto.localeCompare(b.texto, 'es'));
    writeFileSync(SALIDA, `[\n${alfabetico.map((e) => `  ${JSON.stringify(e)}`).join(',\n')}\n]\n`);
  }
  const rutaInforme = arg('informe');
  if (rutaInforme) writeFileSync(resolve(rutaInforme), JSON.stringify(informe, null, 2));
  console.log(JSON.stringify(informe, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal(process.argv.slice(2));
