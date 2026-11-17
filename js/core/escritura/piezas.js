// Armado de las cajas y las piezas del modo Escritura (Ampliación 5). Lógica pura, sin DOM.
//
// Una palabra tiene una caja por sílaba (`huecos`). Las piezas (`fichas`) son esas sílabas MÁS de 0 a 4 sílabas
// que no son de la palabra («distractoras»), mezcladas. Las distractoras son:
//  - «lejanas»: otra consonante y otra vocal («ma» frente a «te»); las fáciles, siempre primero;
//  - «parecidas»: la misma consonante con otra vocal («ma» → «me») o, en las inversas, la invertida («al» → «la»);
//    solo se usa UNA y solo cuando hay 2 o más sílabas extra.
// Nunca sale como distractora una sílaba que ya esté en la palabra (se comparan sin tilde: «ma» y «má» son iguales).

import { barajar, elegirUno } from '../azar.js';
import { claveSilaba, silabasDe } from '../silabeo.js';
import { analizarSilaba, nivelPorId } from './niveles.js';

export const MAX_SILABAS_EXTRA = 4;

const VOCALES = ['a', 'e', 'i', 'o', 'u'];
const DIPTONGOS = ['ia', 'ie', 'io', 'ua', 'ue', 'ui', 'uo', 'ai', 'ei', 'oi', 'au', 'eu'];
const CONSONANTES_SIMPLES = ['m', 'p', 't', 's', 'l', 'n', 'd', 'b', 'f', 'j', 'v', 'z', 'c', 'g'];
const CODAS_DE_INVERSA = 'lnrsdzm';
/** Palabras para rellenar las piezas de una oración cuando no se pasa una reserva propia. */
export const PALABRAS_DE_RELLENO = Object.freeze([
  'mamá', 'papá', 'casa', 'gato', 'perro', 'sol', 'luna', 'pan', 'leche', 'mesa', 'agua', 'mano', 'ojo', 'bebé', 'auto', 'flor', 'pato', 'sopa',
]);

/** Vocales que se pueden poner tras ese ataque sin cambiar el sonido del grupo. */
function vocalesValidas(ataque) {
  if (['qu', 'gu', 'gü'].includes(ataque)) return ['e', 'i'];
  if (ataque === 'g') return ['a', 'o', 'u'];
  return VOCALES;
}

function sinRepetir(lista, vetadas) {
  const vistas = new Set(vetadas);
  const salida = [];
  for (const s of lista) {
    const clave = claveSilaba(s);
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    salida.push(s);
  }
  return salida;
}

/**
 * Sílabas PARECIDAS a `silaba` (en orden de preferencia, sin azar): otra vocal con la misma consonante,
 * la invertida («al» ↔ «la»), sin la consonante final y la trabada sin su segunda consonante.
 * `excluir` son sílabas (o claves) que no pueden salir.
 */
export function silabasParecidas(silaba, { excluir = [] } = {}) {
  const { ataque, nucleo, coda } = analizarSilaba(silaba);
  if (!nucleo) return [];
  const candidatas = [];
  if (nucleo.length === 1) {
    for (const v of vocalesValidas(ataque)) candidatas.push(ataque + v + coda); // misma consonante, otra vocal
    if (!ataque && coda.length === 1 && coda !== 'y') candidatas.push(coda + nucleo); // inversa → directa («al» → «la»)
    if (ataque.length === 1 && !coda && CODAS_DE_INVERSA.includes(ataque)) candidatas.push(nucleo + ataque); // («la» → «al»)
    if (ataque && coda) candidatas.push(ataque + nucleo); // mixta → directa («sol» → «so»)
    if (ataque.length === 2 && 'lr'.includes(ataque[1]) && !['ch', 'll', 'rr', 'qu', 'gu'].includes(ataque)) candidatas.push(ataque[0] + nucleo + coda); // trabada → simple
  } else if (nucleo.length === 2 && !['qu', 'gu', 'gü'].includes(ataque)) {
    for (const d of DIPTONGOS) candidatas.push(ataque + d + coda);
  }
  return sinRepetir(candidatas, [claveSilaba(silaba), ...excluir.map(claveSilaba)]);
}

/** Sílabas LEJANAS a `silaba`: directas con otra consonante y otra vocal (las más fáciles de distinguir). */
export function silabasLejanas(silaba, { excluir = [], lejosDe = [] } = {}) {
  const todas = [silaba, ...lejosDe].map(analizarSilaba);
  const consonantes = new Set(todas.map((a) => a.ataque[0]));
  const vocales = new Set(todas.map((a) => a.nucleo[0]));
  const candidatas = [];
  for (const c of CONSONANTES_SIMPLES) {
    if (consonantes.has(c)) continue;
    for (const v of vocalesValidas(c)) if (!vocales.has(v)) candidatas.push(c + v);
  }
  return sinRepetir(candidatas, [claveSilaba(silaba), ...excluir.map(claveSilaba)]);
}

const aTexto = (s) => String(s);

/** Elige `cantidad` sílabas que no son, en el orden en que se eligen (la parecida primero si corresponde). */
function elegirDistractoras({ silabas, cantidad, aleatorio, vetadas, incluir = [] }) {
  const elegidas = [];
  const vistas = new Set(vetadas);
  const tomar = (s) => {
    elegidas.push(s);
    vistas.add(claveSilaba(s));
  };
  const base = barajar([...new Set(silabas.map(aTexto))], aleatorio);
  // Una sílaba que se pidió usar a propósito (una confusión que ya domina, fase 31): va primero
  if (cantidad >= 1) {
    const pedida = incluir.find((s) => !vistas.has(claveSilaba(s)));
    if (pedida) tomar(pedida);
  }

  if (cantidad >= 2) {
    for (const s of base) {
      const parecidas = silabasParecidas(s, { excluir: [...vistas] });
      if (parecidas.length) {
        tomar(elegirUno(parecidas, aleatorio));
        break;
      }
    }
  }
  // Lejanas de TODA la palabra primero (otra consonante y otra vocal que cualquiera de sus sílabas)
  for (const s of barajar(silabasLejanas(base[0], { excluir: [...vistas], lejosDe: base }), aleatorio)) {
    if (elegidas.length >= cantidad) break;
    if (!vistas.has(claveSilaba(s))) tomar(s);
  }
  // Si no alcanzan: lejanas de a una sílaba, dando vueltas, para que no salgan todas del mismo lado
  const reparto = base.map((s) => barajar(silabasLejanas(s, { excluir: [...vistas] }), aleatorio));
  for (let k = 0; elegidas.length < cantidad && k < 200; k++) {
    const lista = reparto[k % reparto.length];
    const s = lista.find((x) => !vistas.has(claveSilaba(x)));
    if (s) tomar(s);
    else if (reparto.every((l) => l.every((x) => vistas.has(claveSilaba(x))))) break;
  }
  return elegidas;
}

/** Mezcla las piezas procurando que las primeras no queden ya en el orden de las cajas (como en S3). */
function mezclar(hechas, huecos, aleatorio) {
  const enOrden = (lista) => lista.slice(0, huecos.length).every((f, i) => f.texto === huecos[i]);
  const hayAlgoQueMover = new Set(huecos).size > 1;
  let fichas = barajar(hechas, aleatorio);
  for (let k = 0; k < 20 && enOrden(fichas) && hayAlgoQueMover; k++) fichas = barajar(hechas, aleatorio);
  if (enOrden(fichas) && hayAlgoQueMover) fichas = [...fichas.slice(1), fichas[0]];
  return fichas;
}

/**
 * Arma las cajas y las piezas de una palabra.
 *  - `palabra`: `{ texto, silabas? }` (la división escrita a mano manda), o una oración `{ texto, palabras: [{ texto, silabas }] }`.
 *  - `extras`: sílabas que no son (0 a 4).
 *  - `nivel`: id del nivel (`E01` pieza = vocal; `E18` pieza = palabra; el resto, sílabas).
 *  - `por`: solo en oraciones: `'palabras'` (una caja por palabra) o `'silabas'` (una por sílaba).
 *  - `evitar`: sílabas que no deben salir de distractoras (p. ej. las que ya confunde).
 *  - `reserva`: palabras para rellenar las piezas de una oración.
 * Devuelve `{ unidad, huecos: [texto], inicioDePalabra: [bool], fichas: [{ id, texto, distractor }], extras }`.
 */
export function armarPiezas({ palabra, extras = 0, aleatorio = Math.random, nivel, por, evitar = [], incluir = [], reserva = PALABRAS_DE_RELLENO }) {
  if (!palabra) throw new Error('armarPiezas: falta la palabra');
  const cantidad = Math.max(0, Math.min(MAX_SILABAS_EXTRA, Math.trunc(Number(extras) || 0)));
  const esOracion = Array.isArray(palabra.palabras);
  let unidad = nivelPorId(nivel)?.unidad ?? (esOracion ? 'palabra' : 'silaba');
  if (unidad === 'palabra' && por === 'silabas') unidad = 'silaba';
  if (unidad === 'palabra' && !esOracion) unidad = 'silaba';

  let huecos;
  let inicioDePalabra;
  let distractoras;
  if (unidad === 'palabra') {
    huecos = palabra.palabras.map((p) => p.texto);
    inicioDePalabra = huecos.map(() => true);
    const propias = new Set(huecos.map((t) => t.toLowerCase()));
    const posibles = [...new Set(reserva.map(aTexto))].filter((t) => !propias.has(t.toLowerCase()) && !evitar.includes(t));
    distractoras = barajar(posibles, aleatorio).slice(0, cantidad);
  } else {
    if (esOracion) {
      huecos = [];
      inicioDePalabra = [];
      for (const p of palabra.palabras) {
        silabasDe(p).forEach((s, i) => {
          huecos.push(s);
          inicioDePalabra.push(i === 0);
        });
      }
    } else {
      huecos = silabasDe(palabra);
      inicioDePalabra = huecos.map((_, i) => i === 0);
    }
    const vetadas = [...huecos, ...evitar].map(claveSilaba);
    if (unidad === 'vocal') {
      const otras = VOCALES.filter((v) => !vetadas.includes(claveSilaba(v)));
      distractoras = barajar(otras, aleatorio).slice(0, cantidad);
    } else {
      distractoras = elegirDistractoras({ silabas: huecos, cantidad, aleatorio, vetadas, incluir });
    }
  }

  const hechas = [
    ...huecos.map((texto, i) => ({ id: `f${i}`, texto, distractor: false })),
    ...distractoras.map((texto, i) => ({ id: `f${huecos.length + i}`, texto, distractor: true })),
  ];
  return { unidad, huecos, inicioDePalabra, fichas: mezclar(hechas, huecos, aleatorio), extras: distractoras.length };
}

