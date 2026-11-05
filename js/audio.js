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

/** Corta lo que esté sonando (grabación o voz sintética). */
export function detener() {
  if (reproductor) {
    reproductor.pause();
    reproductor = null;
  }
  if (hayVozSintetica()) speechSynthesis.cancel();
}

/** Dice un texto con la voz sintética. Devuelve false si no hay voz o falló. */
export async function hablarTexto(texto, { velocidad = 1 } = {}) {
  if (!hayVozSintetica() || !String(texto ?? '').trim()) return false;
  const voz = elegirVoz(await cargarVoces());
  detener();
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

/** Reproduce una grabación. Devuelve false si el navegador no la deja sonar. */
export async function reproducirBlob(blob, { velocidad = 1 } = {}) {
  detener();
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

/**
 * Dice una palabra: con la grabación del adulto si la tiene; si no, con voz sintética.
 * `obtenerMedio(id)` devuelve el registro de medio (con su blob).
 */
export async function decirPalabra(palabra, { obtenerMedio, velocidad = 1 } = {}) {
  if (palabra.medioAudioId && obtenerMedio) {
    const medio = await obtenerMedio(palabra.medioAudioId);
    if (medio?.blob && (await reproducirBlob(medio.blob, { velocidad }))) return true;
  }
  return hablarTexto(palabra.texto, { velocidad });
}
