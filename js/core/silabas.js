// División silábica del español (PLAN.md §7). Lógica pura, sin DOM.
//
// Reglas implementadas:
//  - Grupos inseparables: pr br tr dr cr gr fr kr pl bl cl gl fl kl.
//  - Dígrafos ch, ll, rr: cuentan como una sola consonante.
//  - "qu" y "gu" delante de e/i: la u es muda y forma parte de la consonante.
//  - Una consonante entre vocales pasa a la sílaba siguiente.
//  - Diptongos: vocal fuerte (a e o) + débil (i u), o dos débiles distintas.
//  - Hiatos: dos fuertes, o una débil con tilde (í ú) junto a una fuerte.
//  - La "h" intercalada no impide el diptongo (prohi-bir).
//  - La "y" al final de palabra es vocal (hoy, muy, rey).
// El adulto siempre puede corregir el resultado a mano.

const FUERTES = new Set(['a', 'e', 'o', 'á', 'é', 'ó']);
const DEBILES = new Set(['i', 'u', 'ü']);
const DEBILES_TILDE = new Set(['í', 'ú']);
const VOCALES = new Set([...FUERTES, ...DEBILES, ...DEBILES_TILDE]);
const GRUPOS_INSEPARABLES = new Set(['pr', 'br', 'tr', 'dr', 'cr', 'gr', 'fr', 'kr', 'pl', 'bl', 'cl', 'gl', 'fl', 'kl']);

const letraBase = (v) => ({ í: 'i', ú: 'u', ü: 'u' })[v] ?? v;

/** Convierte la palabra en una lista de fichas: vocales ('v') y consonantes ('c'). */
function tokenizar(palabra) {
  const bajo = palabra.toLowerCase();
  const tokens = [];
  let i = 0;
  while (i < palabra.length) {
    const c = bajo[i];
    const dos = bajo.slice(i, i + 2);
    const siguiente = bajo[i + 2];

    if (dos === 'ch' || dos === 'll' || dos === 'rr') {
      tokens.push({ tipo: 'c', texto: palabra.slice(i, i + 2), base: dos });
      i += 2;
    } else if ((dos === 'qu' || dos === 'gu') && siguiente && 'eéií'.includes(siguiente)) {
      tokens.push({ tipo: 'c', texto: palabra.slice(i, i + 2), base: dos });
      i += 2;
    } else if (c === 'y' && i === palabra.length - 1) {
      tokens.push({ tipo: 'v', texto: palabra[i], base: 'i' });
      i += 1;
    } else if (VOCALES.has(c)) {
      tokens.push({ tipo: 'v', texto: palabra[i], base: c });
      i += 1;
    } else {
      tokens.push({ tipo: 'c', texto: palabra[i], base: c });
      i += 1;
    }
  }
  return tokens;
}

/** ¿Dos vocales seguidas forman diptongo (true) o hiato (false)? */
function formanDiptongo(a, b) {
  const x = a.base;
  const y = b.base;
  const fuerteX = FUERTES.has(x);
  const fuerteY = FUERTES.has(y);
  if (fuerteX && fuerteY) return false;
  if (DEBILES_TILDE.has(x) || DEBILES_TILDE.has(y)) {
    if (fuerteX || fuerteY) return false; // í/ú junto a vocal fuerte: hiato
    return letraBase(x) !== letraBase(y); // cuídate: diptongo; ii/uu: hiato
  }
  if (!fuerteX && !fuerteY) return letraBase(x) !== letraBase(y); // ui, iu: diptongo; ii, uu: hiato
  return true; // fuerte + débil
}

/** Índice de la vocal que sigue a `idx`, pegada o separada por una sola "h"; -1 si no hay. */
function siguienteVocal(tokens, idx) {
  const a = tokens[idx + 1];
  if (!a) return -1;
  if (a.tipo === 'v') return idx + 1;
  if (a.tipo === 'c' && a.base === 'h' && tokens[idx + 2]?.tipo === 'v') return idx + 2;
  return -1;
}

function silabearPalabra(palabra) {
  const tokens = tokenizar(palabra);

  // 1. Núcleos: grupos de vocales (con su "h" intermedia) que forman una sola sílaba.
  const nucleos = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i].tipo !== 'v') { i += 1; continue; }
    const ini = i;
    let fin = i;
    for (;;) {
      const sig = siguienteVocal(tokens, fin);
      if (sig === -1 || !formanDiptongo(tokens[fin], tokens[sig])) break;
      fin = sig;
    }
    nucleos.push({ ini, fin });
    i = fin + 1;
  }
  if (nucleos.length === 0) return [palabra];

  // 2. Reparto de las consonantes que quedan entre dos núcleos.
  const unir = (desde, hasta) => tokens.slice(desde, hasta + 1).map((t) => t.texto).join('');
  const silabas = [];
  let inicioSilaba = 0;
  nucleos.forEach((actual, k) => {
    let finSilaba;
    if (k === nucleos.length - 1) {
      finSilaba = tokens.length - 1;
    } else {
      const sig = nucleos[k + 1];
      const n = sig.ini - actual.fin - 1; // consonantes entre los dos núcleos
      let aLaSiguiente = 0;
      if (n === 1) aLaSiguiente = 1;
      else if (n >= 2) {
        const par = tokens[sig.ini - 2].base + tokens[sig.ini - 1].base;
        aLaSiguiente = GRUPOS_INSEPARABLES.has(par) ? 2 : 1;
      }
      finSilaba = sig.ini - 1 - aLaSiguiente;
    }
    silabas.push(unir(inicioSilaba, finSilaba));
    inicioSilaba = finSilaba + 1;
  });
  return silabas;
}

/** Divide un texto en sílabas (si trae varias palabras, devuelve las sílabas de todas). */
export function silabear(texto) {
  return String(texto ?? '')
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
    .flatMap(silabearPalabra);
}

/** ['ma', 'má'] -> 'ma-má' */
export function unirSilabas(silabas) {
  return silabas.join('-');
}
