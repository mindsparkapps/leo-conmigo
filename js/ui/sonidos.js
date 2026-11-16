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

/**
 * Una hoja que se pasa: un «fshh» de papel que sube y baja, con un roce suave al final.
 * `retraso` (segundos) lo hace sonar más tarde, para pasar varias hojas seguidas.
 */
export function sonidoPagina(retraso = 0, variacion = 0) {
  const c = ctx();
  if (!c) return;
  try {
    const t = c.currentTime + Math.max(0, retraso);
    const dur = 0.34;
    const f = ruido(c, dur);
    const filtro = c.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.Q.value = 0.8;
    // el aire de la hoja: arranca grave, sube y se apaga (cada hoja un poco distinta)
    filtro.frequency.setValueAtTime(900 + variacion * 120, t);
    filtro.frequency.exponentialRampToValueAtTime(3800 + variacion * 200, t + dur * 0.55);
    filtro.frequency.exponentialRampToValueAtTime(1800, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.07);
    g.gain.exponentialRampToValueAtTime(0.08, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(filtro).connect(g).connect(c.destination);
    f.start(t);
    f.stop(t + dur);
    // el roce de la hoja al caer sobre la otra página
    const r = ruido(c, 0.08);
    const fr = c.createBiquadFilter();
    fr.type = 'lowpass';
    fr.frequency.value = 1400;
    const gr = c.createGain();
    gr.gain.setValueAtTime(0.0001, t + dur - 0.06);
    gr.gain.exponentialRampToValueAtTime(0.1, t + dur - 0.04);
    gr.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    r.connect(fr).connect(gr).connect(c.destination);
    r.start(t + dur - 0.06);
    r.stop(t + dur + 0.04);
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
