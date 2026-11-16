// Sílabas sueltas con su audio grabado (voz Catalina): la actividad S1 dice la primera sílaba de la palabra.
// Generado con los scripts de voces; cada sílaba tiene su mp3 en data/voces/silabas/. Una sílaba que no esté aquí
// (de una palabra que agrega el adulto) sigue con la voz sintética.

const SILABAS = new Set(["ma","pa","ta","a","be","ne","pie","bo","o","na","pan","le","so","que","man","plá","ju","ca","me","si","puer","pe","ga","va","pez","au","glo","mu","li","po","co","duer","jue","es","tie","el","la","y","yo","tú","mi","un","u","no","sí","quie","da","ven","ho","gra","fa","más","ya","con","de","en","soy","e","hay","voy","te","se","lo","muy","bien","mal","tam","los","las","al","del","su","sal","cie","can","bai","to","ba","llo","rí","due","her","tí","ni","pro","doc","pri","bra","pier","dien","len","hue","car","fru","he","tor","fi","za","du","san","pal","piz","cho","dul","ja","luz","pla","cu","lla","pi","cor","ce","pá","mo","ti","ra","chan","hor","bi","tren","lá","cal","cha","go","ves","som","re","flor","ár","sol","lu","nu","llu","mar","tien","hos","bus","ro","ver","blan","dos","tres","cua","cin","sa","cui","em","hom","pre","ham","sed","sue","do","mie","per","gran","chi","lin","fe","ri","frí","lim","bue","tris","quién","dón","cuál","cuán","hoy","dí","tar","den","fue","cer","an","des","siem","nun","nos","mí","tu","sin","has","por","cuan","jun","lle","tra","guar","com","di","pin","via","cuen","ha","vue","vie","ve","pue","or","sien","pien","gus","vis","pei","rá","nue","lar","lis","bom","gen","cue","pas","mer","on","pes","tos","dor","jar","sá","fra","lám","bal","sar","bol","zo","ji","mos","gu","bú","guan","bu","fal","mú","fo","blo","cas","cum","fies","vien","gris","seis","sie","diez","far","ban","am","as","men","mez","hier","sir","vein","cien","miér","vier","mes","in","cuar","ser","dia","nú","nai","trom","bar"]);

/** Nombre del archivo: sin tildes, y con «-t» si la sílaba las llevaba (para que «pa» y «pá» no choquen). */
function archivoDe(silaba) {
  const base = silaba.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  return base + (base !== silaba ? '-t' : '');
}

const ruta = (silaba) => `data/voces/silabas/${archivoDe(silaba)}.mp3`;

export const RUTAS_DE_SILABAS = Object.freeze([...SILABAS].map(ruta));
export const LISTA_DE_SILABAS = Object.freeze([...SILABAS].map((texto) => ({ texto, ruta: ruta(texto) })));

/** La ruta del mp3 de una sílaba suelta, o null si ese texto no es una sílaba grabada. */
export function rutaDeSilaba(texto) {
  const t = String(texto ?? '').trim();
  return SILABAS.has(t) ? ruta(t) : null;
}
