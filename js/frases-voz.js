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
  // Frases genéricas: sin el monto, que se ve en pantalla (así sirven para cualquier cantidad de monedas)
  ['Te faltan monedas', 'te-faltan-monedas'],
  ['¡Has ganado tus monedas!', 'has-ganado-tus-monedas'],
  ['¡Completaste tu álbum! ¡Has ganado tus monedas!', 'completaste-tu-album-has-ganado'],
  // preguntas de «clasificar» (P3, PREGUNTAS_CATEGORIA de core/vocabulario.js)
  ['¿Cuál es una persona?', 'cual-es-una-persona'],
  ['¿Cuál es una parte del cuerpo?', 'cual-es-una-parte-del-cuerpo'],
  ['¿Cuál es una comida?', 'cual-es-una-comida'],
  ['¿Cuál es algo de la casa?', 'cual-es-algo-de-la-casa'],
  ['¿Cuál es un animal?', 'cual-es-un-animal'],
  ['¿Cuál es un juguete o una cosa?', 'cual-es-un-juguete-o-una-cosa'],
  // preguntas de los cuentos de data/cuentos-iniciales.json
  ['¿Quién bebe leche?', 'quien-bebe-leche'],
  ['¿Qué come el gato?', 'que-come-el-gato'],
  ['¿Qué tiene el perro?', 'que-tiene-el-perro'],
  ['¿Quién duerme?', 'quien-duerme'],
  ['¿Quién juega?', 'quien-juega'],
  ['¿Quién bebe agua?', 'quien-bebe-agua'],
  ['¡Lo lograste! Elige un álbum', 'lo-lograste-elige-un-album'],
];

export const RUTAS_DE_FRASES = Object.freeze(FRASES.map(([, archivo]) => rutaDe(archivo)));

/** Cada frase fija con su texto y la ruta de su mp3 (para revisarlas una por una en Ajustes). */
export const LISTA_DE_FRASES = Object.freeze(FRASES.map(([texto, archivo]) => ({ texto, ruta: rutaDe(archivo) })));

const PORTEXTO =new Map(FRASES.map(([texto, archivo]) => [texto, rutaDe(archivo)]));

function rutaDe(archivo) {
  return `data/voces/frases/${archivo}.mp3`;
}

/** La ruta del mp3 de una frase fija, o null si ese texto no tiene grabación. */
export function rutaDeFrase(texto) {
  return PORTEXTO.get(String(texto ?? '').trim()) ?? null;
}
