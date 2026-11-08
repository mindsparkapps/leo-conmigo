// Efectos de sonido sintetizados (sin archivos): clic de botón, rasgado del sobre y láminas que salen.
// `permitirSonidos(false)` los silencia (lo manda el ajuste «sonido» del perfil).

let contexto = null;
let permitido = true;

export function permitirSonidos(si) {
  permitido = Boolean(si);
}

function ctx() {
  if (!permitido) return null;
  try {
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AC) return null;
    contexto ??= new AC();
    contexto.resume?.();
    return contexto;
  } catch {
    return null;
  }
}

function ruido(c, segundos) {
  const n = Math.floor(c.sampleRate * segundos);
  const buffer = c.createBuffer(1, n, c.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) datos[i] = Math.random() * 2 - 1;
  const fuente = c.createBufferSource();
  fuente.buffer = buffer;
  return fuente;
}

/** «Pop» suave de botón: un tono corto que sube. */
export function sonidoClic() {
  const c = ctx();
  if (!c) return;
  try {
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(480, t);
    o.frequency.exponentialRampToValueAtTime(820, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.15);
  } catch { /* sin audio */ }
}

/** Papel que se rasga: ruido filtrado, áspero y con altibajos. */
export function sonidoCorte(duracion = 0.45) {
  const c = ctx();
  if (!c) return;
  try {
    const t = c.currentTime;
    const f = ruido(c, duracion);
    const filtro = c.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.Q.value = 0.9;
    filtro.frequency.setValueAtTime(2200, t);
    filtro.frequency.linearRampToValueAtTime(5200, t + duracion);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    // la amplitud tiembla para que suene a fibras que se rompen
    for (let i = 1; i <= 10; i++) g.gain.linearRampToValueAtTime(0.14 + Math.random() * 0.22, t + (duracion * i) / 11);
    g.gain.linearRampToValueAtTime(0.0001, t + duracion);
    f.connect(filtro).connect(g).connect(c.destination);
    f.start(t);
    f.stop(t + duracion);
  } catch { /* sin audio */ }
}

/** Una lámina que se desliza hacia afuera: «fiuuu» corto y un toque de papel. */
export function sonidoLamina(indice = 0) {
  const c = ctx();
  if (!c) return;
  try {
    const t = c.currentTime;
    const f = ruido(c, 0.4);
    const filtro = c.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.Q.value = 1.4;
    filtro.frequency.setValueAtTime(600 + indice * 150, t);
    filtro.frequency.exponentialRampToValueAtTime(2600 + indice * 200, t + 0.35);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    f.connect(filtro).connect(g).connect(c.destination);
    f.start(t);
    f.stop(t + 0.4);
    // «ting» al aparecer
    const o = c.createOscillator();
    const go = c.createGain();
    o.type = 'triangle';
    o.frequency.value = 880 * 1.25 ** indice;
    go.gain.setValueAtTime(0.0001, t + 0.3);
    go.gain.exponentialRampToValueAtTime(0.12, t + 0.32);
    go.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(go).connect(c.destination);
    o.start(t + 0.3);
    o.stop(t + 0.75);
  } catch { /* sin audio */ }
}
