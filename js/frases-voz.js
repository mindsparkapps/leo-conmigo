// Frases fijas de la app con su audio grabado (voz Catalina de ElevenLabs): consignas de las actividades,
// felicitaciones, tienda y álbum. `hablarTexto` (audio.js) las reproduce desde aquí; cualquier otro texto
// (nombres de premios, montos distintos, preguntas de cuentos) sigue con la voz sintética.
// Para agregar una: genera el mp3 en data/voces/frases/, anótala aquí y añádela a PRECACHE en sw.js.

const FRASES = [
  // consignas
  ['Toca la frase que es igual', 'toca-la-frase-que-es-igual'],
  ['Lee la frase y toca el dibujo', 'lee-la-frase-y-toca-el-dibujo'],
  ['Arma la frase', 'arma-la-frase'],
  ['Toca la palabra que es igual', 'toca-la-palabra-que-es-igual'],
  ['Toca la que es igual', 'toca-la-que-es-igual'],
  ['Toca la palabra', 'toca-la-palabra'],
  ['Escucha y toca la palabra', 'escucha-y-toca-la-palabra'],
  ['Lee y toca el dibujo', 'lee-y-toca-el-dibujo'],
  ['Lee en voz alta', 'lee-en-voz-alta'],
  ['Toca la imagen que es igual', 'toca-la-imagen-que-es-igual'],
  ['Toca el dibujo de lo mismo', 'toca-el-dibujo-de-lo-mismo'],
  ['Toca la palabra que empieza igual', 'toca-la-palabra-que-empieza-igual'],
  ['Completa la palabra', 'completa-la-palabra'],
  ['Arma la palabra', 'arma-la-palabra'],
  // felicitaciones (ELOGIOS de core/elogios.js)
  ['¡Muy bien!', 'muy-bien'],
  ['¡Eso es!', 'eso-es'],
  ['¡Lo lograste!', 'lo-lograste'],
  ['¡Genial!', 'genial'],
  ['¡Excelente!', 'excelente'],
  ['¡Bien hecho!', 'bien-hecho'],
  // tienda y álbum
  ['¡Tus láminas nuevas! Pégalas en el álbum', 'tus-laminas-nuevas'],
  ['Arrastra el dedo por arriba del sobre para abrirlo', 'arrastra-el-dedo'],
  ['¡Es tuyo! Pídeselo a un adulto', 'es-tuyo'],
  ['¡Completaste tu álbum! ¡Ganaste 10 monedas!', 'completaste-tu-album'],
  ['Ganaste 13 monedas', 'ganaste-13-monedas'],
];

export const RUTAS_DE_FRASES = Object.freeze(FRASES.map(([, archivo]) => rutaDe(archivo)));

const PORTEXTO = new Map(FRASES.map(([texto, archivo]) => [texto, rutaDe(archivo)]));

function rutaDe(archivo) {
  return `data/voces/frases/${archivo}.mp3`;
}

/** La ruta del mp3 de una frase fija, o null si ese texto no tiene grabación. */
export function rutaDeFrase(texto) {
  return PORTEXTO.get(String(texto ?? '').trim()) ?? null;
}
