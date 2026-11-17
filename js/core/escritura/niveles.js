// Los 20 niveles del modo Escritura (Ampliación 5) y la clasificación de palabras por nivel. Lógica pura, sin DOM.
//
// Una palabra pertenece al nivel MÁS ALTO de los rasgos que tiene («chocolate» → E03, «plátano» → E11), con dos
// excepciones que mandan a `E17` (Palabras): una mezcla de 3 rasgos especiales, o 4 o más sílabas sin ningún
// rasgo especial (solo sílabas directas). La división en sílabas es la escrita a mano (`palabra.silabas`); si
// falta, la automática de `core/silabas.js`.

import { silabasDe } from '../silabeo.js';

export const NIVELES = Object.freeze([
  { id: 'E01', numero: 1, nombre: 'Vocales', dificultad: 'Muy fácil', ejemplo: 'a e i', unidad: 'vocal' },
  { id: 'E02', numero: 2, nombre: 'Sílabas directas', dificultad: 'Fácil', ejemplo: 'ma', unidad: 'silaba' },
  { id: 'E03', numero: 3, nombre: 'Sílabas con CH', dificultad: 'Fácil', ejemplo: 'cha', unidad: 'silaba' },
  { id: 'E04', numero: 4, nombre: 'Sílabas con LL', dificultad: 'Fácil', ejemplo: 'lla', unidad: 'silaba' },
  { id: 'E05', numero: 5, nombre: 'Sílabas con Ñ', dificultad: 'Fácil', ejemplo: 'ña', unidad: 'silaba' },
  { id: 'E06', numero: 6, nombre: 'Sílabas con QU', dificultad: 'Media', ejemplo: 'que', unidad: 'silaba' },
  { id: 'E07', numero: 7, nombre: 'Sílabas con GU y GÜ', dificultad: 'Media', ejemplo: 'gue', unidad: 'silaba' },
  { id: 'E08', numero: 8, nombre: 'Sílabas con R y RR', dificultad: 'Media', ejemplo: 'rra', unidad: 'silaba' },
  { id: 'E09', numero: 9, nombre: 'Sílabas inversas', dificultad: 'Media', ejemplo: 'al', unidad: 'silaba' },
  { id: 'E10', numero: 10, nombre: 'Sílabas mixtas', dificultad: 'Media', ejemplo: 'sol', unidad: 'silaba' },
  { id: 'E11', numero: 11, nombre: 'Trabadas con L', dificultad: 'Difícil', ejemplo: 'pla', unidad: 'silaba' },
  { id: 'E12', numero: 12, nombre: 'Trabadas con R', dificultad: 'Difícil', ejemplo: 'tra', unidad: 'silaba' },
  { id: 'E13', numero: 13, nombre: 'Combinaciones TL', dificultad: 'Avanzada', ejemplo: 'tla', unidad: 'silaba' },
  { id: 'E14', numero: 14, nombre: 'Diptongos', dificultad: 'Avanzada', ejemplo: 'cie', unidad: 'silaba' },
  { id: 'E15', numero: 15, nombre: 'Triptongos', dificultad: 'Avanzada', ejemplo: 'guau', unidad: 'silaba' },
  { id: 'E16', numero: 16, nombre: 'Hiatos', dificultad: 'Avanzada', ejemplo: 'dí·a', unidad: 'silaba' },
  { id: 'E17', numero: 17, nombre: 'Palabras', dificultad: 'Progresiva', ejemplo: 'mariposa', unidad: 'silaba' },
  { id: 'E18', numero: 18, nombre: 'Oraciones', dificultad: 'Progresiva', ejemplo: 'Mamá toma leche', unidad: 'palabra' },
  { id: 'E19', numero: 19, nombre: 'Lectura de textos', dificultad: 'Progresiva', ejemplo: 'Mi gato duerme.', unidad: 'silaba' },
  { id: 'E20', numero: 20, nombre: 'Dictados', dificultad: 'Progresiva', ejemplo: '🔊', unidad: 'silaba' },
]);

export const IDS_DE_NIVELES = Object.freeze(NIVELES.map((n) => n.id));

const POR_ID = new Map(NIVELES.map((n) => [n.id, n]));

/** El nivel con ese id (`'E07'`), o `undefined`. */
export const nivelPorId = (id) => POR_ID.get(id);

/** Posición del nivel (0 a 19), o -1. */
export const indiceDeNivel = (id) => IDS_DE_NIVELES.indexOf(id);

/** El nivel siguiente, o `null` si es el último. */
export const nivelSiguiente = (id) => IDS_DE_NIVELES[indiceDeNivel(id) + 1] ?? null;

/** Los niveles cuyas palabras se clasifican solas por sus rasgos (E01–E17). */
export const ULTIMO_NIVEL_DE_PALABRAS = 'E17';

// ─── Análisis de una sílaba ───────────────────────────────────────────────────────────────────────────────────

const VOCALES = 'aeiou';
const TRABADAS_L = new Set(['pl', 'bl', 'cl', 'gl', 'fl']);
const TRABADAS_R = new Set(['pr', 'br', 'tr', 'dr', 'cr', 'gr', 'fr']);

/** En minúsculas y sin tildes en las vocales (conserva la ñ y la ü). */
const limpiar = (silaba) =>
  String(silaba)
    .toLowerCase()
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u');

/**
 * Parte una sílaba en ataque (consonantes del inicio), núcleo (vocales) y coda (consonantes del final).
 * `qu`/`gu` antes de `e`/`i` y `gü` cuentan como ataque (la `u` no suena o es parte del dígrafo).
 * Una `y` al final detrás de una vocal («ley», «guay») es vocal; la `y` inicial es consonante.
 */
export function analizarSilaba(silaba) {
  const s = limpiar(silaba);
  const letras = [...s];
  let i = 0;
  let ataque = '';
  const esVocal = (k) => {
    const c = letras[k];
    if (VOCALES.includes(c)) return true;
    if (c === 'y') return letras.length === 1 || (k > 0 && k === letras.length - 1 && VOCALES.includes(letras[k - 1]));
    return false;
  };
  // Consonantes iniciales
  while (i < letras.length && !esVocal(i)) {
    const c = letras[i];
    // «qu» y «gu» + e/i, y «gü»: la u va con el ataque
    if ((c === 'q' || c === 'g') && letras[i + 1] === 'u' && 'ei'.includes(letras[i + 2] ?? '#')) {
      ataque += c + 'u';
      i += 2;
      break;
    }
    if (c === 'g' && letras[i + 1] === 'ü') {
      ataque += 'gü';
      i += 2;
      break;
    }
    ataque += c;
    i++;
  }
  let nucleo = '';
  while (i < letras.length && esVocal(i)) nucleo += letras[i++];
  const coda = letras.slice(i).join('');
  return { ataque, nucleo, coda };
}

/** Lo que aporta una sílaba al nivel (sin mirar a sus vecinas). */
function rasgosDeSilaba({ ataque, nucleo, coda }, { inicioDePalabra, codaAnterior }) {
  const r = new Set();
  // ataque
  if (ataque === 'ch') r.add('E03');
  else if (ataque === 'll') r.add('E04');
  else if (ataque === 'ñ') r.add('E05');
  else if (ataque === 'qu') r.add('E06');
  else if (ataque === 'gu' || ataque === 'gü') r.add('E07');
  else if (ataque === 'rr') r.add('E08');
  else if (ataque === 'r' && (inicioDePalabra || /[nls]$/.test(codaAnterior))) r.add('E08');
  else if (TRABADAS_L.has(ataque)) r.add('E11');
  else if (TRABADAS_R.has(ataque)) r.add('E12');
  else if (ataque === 'tl') r.add('E13');
  else r.add('E02'); // consonante simple o ninguna: sílaba directa (si no tiene coda)
  // coda
  if (coda) {
    r.add(ataque ? 'E10' : 'E09'); // mixta (consonante + vocal + consonante) o inversa (vocal + consonante)
    r.delete('E02'); // «sol» y «al» ya no son directas
  }
  // núcleo
  if (nucleo.length === 2) r.add('E14');
  else if (nucleo.length >= 3) r.add('E15');
  if (nucleo.length >= 2) r.delete('E02'); // «cie» no es una directa simple
  return r;
}

/**
 * Los rasgos que tiene una palabra (lista de ids de nivel, de menor a mayor): `E01` si es una vocal sola,
 * `E02` si tiene sílabas directas, `E03`–`E16` por cada rasgo especial. Recibe las sílabas ya divididas.
 */
export function rasgosDe(silabas) {
  const lista = (silabas ?? []).map(String).filter(Boolean);
  if (!lista.length) return [];
  if (lista.length === 1) {
    const a = analizarSilaba(lista[0]);
    if (!a.ataque && !a.coda && a.nucleo.length === 1) return ['E01'];
  }
  const rasgos = new Set();
  let codaAnterior = '';
  lista.forEach((silaba, k) => {
    const a = analizarSilaba(silaba);
    for (const r of rasgosDeSilaba(a, { inicioDePalabra: k === 0, codaAnterior })) rasgos.add(r);
    // Hiato: esta sílaba empieza con vocal y la anterior terminó en vocal
    if (k > 0 && !a.ataque && !codaAnterior && anteriorTerminaEnVocal(lista[k - 1])) rasgos.add('E16');
    codaAnterior = a.coda;
  });
  return IDS_DE_NIVELES.filter((id) => rasgos.has(id));
}

function anteriorTerminaEnVocal(silaba) {
  const a = analizarSilaba(silaba);
  return a.nucleo.length > 0 && !a.coda;
}

/**
 * El nivel de una palabra (`E01`–`E17`). Recibe la palabra (`{ texto, silabas? }`) o directamente sus sílabas.
 *  - Una vocal sola → `E01`.
 *  - El rasgo más alto entre `E02` y `E16`.
 *  - `E17` si mezcla 3 rasgos especiales (`E03`–`E16`) o si tiene 4 o más sílabas y ninguno especial.
 */
export function nivelDe(palabra) {
  const silabas = Array.isArray(palabra) ? palabra : silabasDe(palabra);
  const rasgos = rasgosDe(silabas);
  if (!rasgos.length) return null;
  if (rasgos[0] === 'E01') return 'E01';
  const especiales = rasgos.filter((r) => r !== 'E02');
  if (especiales.length >= 3) return 'E17';
  if (silabas.length >= 4 && especiales.length === 0) return 'E17';
  return rasgos[rasgos.length - 1];
}
