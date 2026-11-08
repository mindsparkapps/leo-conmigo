// Reproducción de voz: grabación del adulto (prioridad) o voz sintética es-CL (respaldo).

const PREFERIDAS = ['es-CL', 'es-419', 'es-US', 'es-MX', 'es-ES'];
const normalizarLang = (lang) => String(lang ?? '').replace('_', '-').toLowerCase();

/**
 * Elige la mejor voz en español: es-CL, luego es-419, es-US, es-MX, es-ES y, si no,
 * cualquier es-*. A igual idioma prefiere las voces del propio dispositivo.
 */
export function elegirVoz(voces, preferidas = PREFERIDAS) {
  const espanolas = voces.filter((v) => /^es(-|$)/.test(normalizarLang(v.lang)));
  for (const lang of preferidas) {
    const coincidentes = espanolas.filter((v) => normalizarLang(v.lang) === lang.toLowerCase());
    if (coincidentes.length) return coincidentes.find((v) => v.localService) ?? coincidentes[0];
  }
  return espanolas.find((v) => v.localService) ?? espanolas[0] ?? null;
}

export function hayVozSintetica() {
  return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** Las voces cargan de forma asíncrona: espera a que haya (máximo `espera` ms). */
export function cargarVoces(espera = 1500) {
  if (!hayVozSintetica()) return Promise.resolve([]);
  const ahora = speechSynthesis.getVoices();
  if (ahora.length) return Promise.resolve(ahora);
  return new Promise((resolver) => {
    const terminar = () => {
      speechSynthesis.removeEventListener?.('voiceschanged', terminar);
      clearTimeout(plazo);
      resolver(speechSynthesis.getVoices());
    };
    const plazo = setTimeout(terminar, espera);
    speechSynthesis.addEventListener?.('voiceschanged', terminar);
  });
}

/** Qué voz sintética se usaría (para mostrarlo al adulto): { lang, nombre } o null. */
export async function vozSinteticaElegida() {
  const voz = elegirVoz(await cargarVoces());
  return voz ? { lang: voz.lang, nombre: voz.name } : null;
}

let contexto = null;
let desbloqueado = false;
/** En iPhone/Safari el audio solo suena tras un toque: llamar dentro del primer toque del usuario. */
export function desbloquearAudio() {
  if (desbloqueado) return;
  desbloqueado = true;
  try {
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (AC) {
      contexto ??= new AC();
      contexto.resume?.();
    }
  } catch { /* ignorar */ }
  try {
    if (hayVozSintetica()) {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      speechSynthesis.speak(u);
    }
  } catch { /* ignorar */ }
}

let reproductor = null;
// Sube cada vez que algo de afuera pide un sonido nuevo o corta el actual: así una frase en curso
// (que dice palabra por palabra) se da cuenta y deja de seguir. Lo que hace la propia frase por
// dentro no lo sube (usa las versiones "internas").
let generacion = 0;

/** Corta el sonido que esté sonando, sin tocar la frase en curso (uso interno). */
function pararSonido() {
  if (reproductor) {
    reproductor.pause();
    reproductor = null;
  }
  if (hayVozSintetica()) speechSynthesis.cancel();
}

/** Corta lo que esté sonando (grabación, voz sintética o una frase a medias). */
export function detener() {
  generacion += 1;
  pararSonido();
}

async function hablarTextoInterno(texto, { velocidad = 1 } = {}) {
  if (!hayVozSintetica() || !String(texto ?? '').trim()) return false;
  const voz = elegirVoz(await cargarVoces());
  pararSonido();
  return new Promise((resolver) => {
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = voz?.lang ?? 'es-CL';
    if (voz) u.voice = voz;
    u.rate = velocidad;
    const plazo = setTimeout(() => resolver(false), 10000); // por si el navegador nunca avisa el final
    u.onend = () => { clearTimeout(plazo); resolver(true); };
    u.onerror = () => { clearTimeout(plazo); resolver(false); };
    speechSynthesis.speak(u);
  });
}

/** Dice un texto con la voz sintética. Devuelve false si no hay voz o falló. */
export function hablarTexto(texto, opciones = {}) {
  generacion += 1;
  return hablarTextoInterno(texto, opciones);
}

/**
 * Si el blob no declara un tipo de audio (p. ej. «application/octet-stream» al bajarlo de Drive), mira sus primeros
 * bytes y le pone el tipo real; si no lo reconoce, lo deja como está.
 */
export async function conTipoDeAudio(blob) {
  if (!blob || String(blob.type).startsWith('audio/')) return blob;
  const b = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const texto = (desde, n) => String.fromCharCode(...b.slice(desde, desde + n));
  let tipo = null;
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) tipo = 'audio/webm';
  else if (texto(0, 4) === 'OggS') tipo = 'audio/ogg';
  else if (texto(4, 4) === 'ftyp') tipo = 'audio/mp4';
  else if (texto(0, 4) === 'RIFF' && texto(8, 4) === 'WAVE') tipo = 'audio/wav';
  else if (texto(0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) tipo = 'audio/mpeg';
  return tipo ? new Blob([blob], { type: tipo }) : blob;
}

async function reproducirBlobInterno(original, { velocidad = 1 } = {}) {
  pararSonido();
  const blob = await conTipoDeAudio(original);
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.playbackRate = velocidad;
  reproductor = audio;
  try {
    await audio.play();
  } catch {
    URL.revokeObjectURL(url);
    return false;
  }
  return new Promise((resolver) => {
    const limpiar = (ok) => {
      URL.revokeObjectURL(url);
      if (reproductor === audio) reproductor = null;
      resolver(ok);
    };
    audio.addEventListener('ended', () => limpiar(true));
    audio.addEventListener('error', () => limpiar(false));
    audio.addEventListener('pause', () => limpiar(true));
  });
}

/** Reproduce una grabación. Devuelve false si el navegador no la deja sonar. */
export function reproducirBlob(blob, opciones = {}) {
  generacion += 1;
  return reproducirBlobInterno(blob, opciones);
}

async function decirPalabraInterno(palabra, { obtenerMedio, velocidad = 1 } = {}) {
  if (palabra.medioAudioId && obtenerMedio) {
    const medio = await obtenerMedio(palabra.medioAudioId);
    if (medio?.blob && (await reproducirBlobInterno(medio.blob, { velocidad }))) return true;
  }
  return hablarTextoInterno(palabra.texto, { velocidad });
}

/**
 * Dice una palabra: con la grabación del adulto si la tiene; si no, con voz sintética.
 * `obtenerMedio(id)` devuelve el registro de medio (con su blob).
 */
export function decirPalabra(palabra, opciones = {}) {
  generacion += 1;
  return decirPalabraInterno(palabra, opciones);
}

/**
 * Dice una frase palabra por palabra (con la voz grabada de cada una si existe). `alPalabra(i)` avisa
 * qué palabra suena, para resaltarla; al terminar o al cortarse avisa `alPalabra(-1)`.
 * Si algo corta el sonido (`detener`) en medio, deja de seguir. Devuelve true si la dijo entera.
 */
export async function decirFrase(palabras, { obtenerMedio, velocidad = 1, alPalabra = () => {}, pausaMs = 120 } = {}) {
  detener();
  const mia = generacion;
  let completa = true;
  for (let i = 0; i < palabras.length; i++) {
    if (mia !== generacion) { completa = false; break; }
    alPalabra(i);
    await decirPalabraInterno(palabras[i], { obtenerMedio, velocidad });
    if (mia !== generacion) { completa = false; break; } // alguien pidió otro sonido mientras sonaba esta palabra
    await new Promise((r) => setTimeout(r, pausaMs));
  }
  alPalabra(-1);
  return completa;
}
