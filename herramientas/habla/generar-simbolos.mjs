// Genera data/habla/simbolos.json: cada uno de los 127 tokens de ZIPA
// (data/habla/tokens-zipa.txt) → fonema del inventario del español de Chile o
// «otro». Se corre a mano cuando se cambia la tabla de abajo:
//
//   node herramientas/habla/generar-simbolos.mjs
//
// Es un primer cuadro hecho con lo que se sabe del español (fase 33a). Las
// pruebas con voces reales (33b) y la fase 34 lo afinan; lo que cambie se anota
// en PLAN.md. Las clases de «tipo»:
//   fonema      → se cuenta como ese sonido del inventario
//   otro        → es un sonido real pero fuera del inventario chileno (se
//                 conserva el IPA: sirve para ver QUÉ dijo en vez de lo esperado)
//   modificador → marca de articulación (aspirado, nasalizado, largo…): se ignora
//   especial    → blanco de CTC, inicio/fin, desconocido y límite de palabra
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));

/** Inventario del español de Chile con el que trabaja el modo Hablar. */
const INVENTARIO = [
  ['a', 'vocal'], ['e', 'vocal'], ['i', 'vocal'], ['o', 'vocal'], ['u', 'vocal'],
  ['j', 'deslizada'], ['w', 'deslizada'],
  ['p', 'oclusiva'], ['b', 'oclusiva'], ['t', 'oclusiva'], ['d', 'oclusiva'], ['k', 'oclusiva'], ['g', 'oclusiva'],
  ['tʃ', 'africada'],
  ['f', 'fricativa'], ['s', 'fricativa'], ['h', 'fricativa'], ['x', 'fricativa'], ['ʝ', 'fricativa'],
  ['m', 'nasal'], ['n', 'nasal'], ['ɲ', 'nasal'],
  ['l', 'lateral'],
  ['ɾ', 'vibrante'], ['r', 'vibrante'], ['ř', 'vibrante'],
];

const NOTAS_INVENTARIO = {
  b: 'incluye [β] (b, v y w entre vocales)',
  d: 'incluye [ð]',
  g: 'incluye [ɣ]',
  tʃ: 'ZIPA no tiene el símbolo de la africada: la da como «t» + «ʃ»; la alineación (fase 34) las junta',
  h: '/s/ aspirada en final de sílaba ("lo\' perro\'"); solo vale como variante de /s/ en coda',
  x: 'jota: [x], [χ] y [ç] ante e/i',
  ʝ: '«y» y «ll» (yeísmo); suena [ʝ] o [ɟ]',
  j: 'deslizada de los diptongos (hierba, aire)',
  w: 'deslizada de los diptongos (huevo, auto)',
  ɾ: 'vibrante simple (pera, comer)',
  r: 'vibrante múltiple (perro, rojo)',
  ř: 'rótica asibilada chilena [ɹ̝] (muy común, se acepta como /r/); la «tr» suena [tɹ̝̥]',
};

// token → [fonema o null, tipo, nota?]
const F = (f, nota) => [f, 'fonema', nota];
const OTRO = (nota) => [null, 'otro', nota];
const MOD = (nota) => [null, 'modificador', nota];
const ESP = (nota) => [null, 'especial', nota];

const TABLA = {
  '<blk>': ESP('blanco de CTC'),
  '<sos/eos>': ESP('inicio/fin'),
  '<unk>': ESP('desconocido'),
  '▁': ESP('límite de palabra: se ignora'),
  // letras ASCII (símbolos IPA con la misma forma)
  a: F('a'), b: F('b'), c: F('k', 'oclusiva palatal: /k/ ante e/i'), d: F('d'), e: F('e'),
  f: F('f'), g: F('g'), h: F('h', 'aspirada'), i: F('i'), j: F('j', 'aproximante palatal: deslizada (o «y» suave)'),
  k: F('k'), l: F('l'), m: F('m'), n: F('n'), o: F('o'), p: F('p'), q: F('k', 'oclusiva uvular'),
  r: F('r'), s: F('s'), t: F('t'), u: F('u'), v: F('b', 'la «v» se dice /b/'), w: F('w'),
  x: F('x'), y: OTRO('vocal anterior redondeada: no existe en español'), z: F('s', '/s/ sonora (asimilación ante consonante sonora)'),
  // otros símbolos IPA
  æ: F('a', 'casi abierta'), ç: F('x', 'jota palatal ante e/i'), ð: F('d', 'alófono aproximante'),
  ø: OTRO('vocal media anterior redondeada'), ħ: OTRO('fricativa faríngea'), ŋ: F('n', 'nasal velar ante /k g x/'),
  œ: OTRO('vocal'), 'ǀ': OTRO('chasquido'), 'ǁ': OTRO('chasquido'), 'ǂ': OTRO('chasquido'), 'ǃ': OTRO('chasquido'),
  ɐ: F('a', 'casi abierta central'), ɑ: F('a', 'abierta posterior'), ɒ: OTRO('abierta posterior redondeada'),
  ɓ: F('b', 'implosiva'), ɔ: F('o', 'media-abierta posterior'), ɕ: OTRO('fricativa alveolopalatal'),
  ɖ: F('d', 'retrofleja'), ɗ: F('d', 'implosiva'), ɘ: OTRO('vocal media central'), ə: OTRO('vocal neutra (schwa)'),
  ɛ: F('e', 'media-abierta anterior'), ɜ: OTRO('vocal'), ɞ: OTRO('vocal'), ɟ: F('ʝ', 'oclusiva palatal sonora: «y» fuerte'),
  ɠ: F('g', 'implosiva'), ɢ: F('g', 'oclusiva uvular sonora'), ɣ: F('g', 'alófono aproximante'), ɤ: OTRO('vocal'),
  ɥ: OTRO('aproximante labiopalatal'), ɦ: F('h', 'aspirada sonora'), ɧ: OTRO('fricativa'),
  ɨ: OTRO('vocal cerrada central'), ɪ: F('i', 'cerrada relajada'), ɬ: OTRO('lateral fricativa'),
  ɭ: F('l', 'lateral retrofleja'), ɮ: OTRO('lateral fricativa sonora'), ɯ: OTRO('vocal cerrada posterior no redondeada'),
  ɰ: OTRO('aproximante velar'), ɱ: F('n', 'nasal labiodental ante /f/'), ɲ: F('ɲ'), ɳ: F('n', 'nasal retrofleja'),
  ɴ: F('n', 'nasal uvular'), ɵ: OTRO('vocal'), ɶ: OTRO('vocal'), ɸ: F('f', 'fricativa bilabial'),
  ɹ: F('ř', 'aproximante alveolar: «r» asibilada chilena'), ɺ: F('ɾ', 'vibrante lateral'), ɻ: F('ř', 'aproximante retrofleja: «r» asibilada'),
  ɽ: F('ɾ', 'vibrante simple retrofleja'), ɾ: F('ɾ'), ʀ: F('r', 'vibrante múltiple uvular'), ʁ: OTRO('fricativa uvular'),
  ʂ: F('ř', 'fricativa retrofleja sorda: la «tr» chilena [ʈʂ]'), ʃ: F('tʃ', 'en Chile solo aparece en «ch»'),
  ʄ: F('ʝ', 'implosiva palatal'), ʈ: F('t', 'retrofleja'), ʉ: OTRO('vocal cerrada central redondeada'),
  ʊ: F('u', 'cerrada relajada'), ʋ: F('b', 'aproximante labiodental'), ʌ: OTRO('vocal media posterior'),
  ʍ: OTRO('aproximante labiovelar sorda'), ʎ: F('ʝ', 'lateral palatal: yeísmo'), ʏ: OTRO('vocal'),
  ʐ: F('ř', 'fricativa retrofleja sonora: «r» asibilada'), ʑ: F('ʝ', 'fricativa alveolopalatal sonora'),
  ʒ: F('ʝ', 'fricativa postalveolar sonora: «y» rehilada'), ʔ: OTRO('oclusión glotal'), ʕ: OTRO('fricativa faríngea sonora'),
  ʘ: OTRO('chasquido'), ʙ: OTRO('vibrante bilabial'), ʛ: F('g', 'implosiva uvular'), ʜ: OTRO('fricativa epiglotal'),
  ʝ: F('ʝ'), ʟ: OTRO('lateral velar'), ʡ: OTRO('oclusión epiglotal'), ʢ: OTRO('fricativa epiglotal sonora'),
  ʰ: MOD('aspirado'), ʲ: MOD('palatalizado'), ʷ: MOD('labializado'), ʼ: MOD('eyectivo'), 'ː': MOD('largo'),
  '˞': MOD('rotacizado'), ˠ: MOD('velarizado'), ˤ: MOD('faringalizado'),
  '̃': MOD('nasalizado'), '̚': MOD('sin soltar'), '̥': MOD('sordo'), '̩': MOD('silábico'),
  '̪': MOD('dental'), '̴': MOD('velarizado o faringalizado'), '̺': MOD('apical'),
  β: F('b', 'alófono aproximante'), θ: OTRO('fricativa interdental: en Chile no se usa (seseo)'),
  χ: F('x', 'fricativa uvular: jota'), 'ᶑ': F('d', 'implosiva retrofleja'), 'ⱱ': F('ɾ', 'vibrante labiodental'),
};

const lineas = readFileSync(`${RAIZ}data/habla/tokens-zipa.txt`, 'utf8').split(/\r?\n/).filter(Boolean);
const tokens = lineas.map((linea) => {
  const corte = linea.lastIndexOf(' ');
  const ipa = linea.slice(0, corte);
  const id = Number(linea.slice(corte + 1));
  const fila = TABLA[ipa];
  if (!fila) throw new Error(`Falta el token ${id} «${ipa}» en la tabla`);
  const [fonema, tipo, nota] = fila;
  const salida = { id, ipa, tipo, fonema };
  if (nota) salida.nota = nota;
  return salida;
});
for (const ipa of Object.keys(TABLA)) {
  if (!tokens.some((t) => t.ipa === ipa)) throw new Error(`La tabla tiene «${ipa}» que no está en tokens-zipa.txt`);
}

const salida = {
  version: 1,
  fuente: 'Tokens de anyspeech/zipa-small-crctc-300k (data/habla/tokens-zipa.txt). Generado por herramientas/habla/generar-simbolos.mjs',
  inventario: INVENTARIO.map(([id, clase]) => ({ id, clase, ...(NOTAS_INVENTARIO[id] ? { nota: NOTAS_INVENTARIO[id] } : {}) })),
  tokens,
};
writeFileSync(`${RAIZ}data/habla/simbolos.json`, JSON.stringify(salida, null, 1) + '\n');
console.log(`${tokens.length} tokens; ${tokens.filter((t) => t.tipo === 'fonema').length} a fonemas, ` +
  `${tokens.filter((t) => t.tipo === 'otro').length} otros, ${tokens.filter((t) => t.tipo === 'modificador').length} modificadores`);
