// Fbank estilo Kaldi de 80 bandas, igual al de lhotse (`Fbank`/`FbankConfig` con
// dither = 0 y snip_edges = false), que es lo que espera el modelo ZIPA.
// Puro (sin DOM, sin azar). La comparación contra lhotse está en
// tests/fbank.test.js con datos de herramientas/habla/fbank-referencia.py.
//
// Parámetros (los de `FbankConfig()` de lhotse 1.33):
//   16 kHz · ventana 25 ms (400 muestras) · paso 10 ms (160) · FFT de 512
//   quitar DC · preénfasis 0,97 · ventana Povey (hann no periódica ^0,85)
//   potencia espectral · filtros mel «torchaudio» (low 20 Hz, high -400 → 7600 Hz)
//   piso del logaritmo = eps de float32 (1,1920929e-7) · sin energía.

export const FBANK = Object.freeze({
  frecuencia: 16000,
  ventana: 400,
  paso: 160,
  fft: 512,
  bandas: 80,
  preenfasis: 0.97,
  bajaFrecuencia: 20,
  altaFrecuencia: -400,
  piso: 1.1920928955078125e-7,
});

const lin2mel = (f) => 1127 * Math.log(1 + f / 700);

let cache = null;

/** Tablas que no dependen del audio (ventana, filtros mel y factores de la FFT). */
function tablas() {
  if (cache) return cache;
  const { ventana, fft, bandas, frecuencia, bajaFrecuencia, altaFrecuencia } = FBANK;
  // Povey: hann no periódica (0,5 - 0,5 cos(2πn/(N-1))) elevada a 0,85.
  const win = new Float64Array(ventana);
  for (let n = 0; n < ventana; n++) {
    win[n] = Math.pow(0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (ventana - 1)), 0.85);
  }
  // Filtros mel (get_mel_banks de torchaudio): 256 columnas (sin Nyquist).
  const nyquist = frecuencia / 2;
  const alta = altaFrecuencia <= 0 ? altaFrecuencia + nyquist : altaFrecuencia;
  const melBaja = lin2mel(bajaFrecuencia);
  const melAlta = lin2mel(alta);
  const delta = (melAlta - melBaja) / (bandas + 1);
  const ancho = frecuencia / fft;
  const columnas = fft / 2;
  const filtros = [];
  for (let b = 0; b < bandas; b++) {
    const izq = melBaja + b * delta;
    const cen = melBaja + (b + 1) * delta;
    const der = melBaja + (b + 2) * delta;
    const pesos = [];
    let primero = -1;
    for (let k = 0; k < columnas; k++) {
      const mel = lin2mel(ancho * k);
      const peso = Math.max(0, Math.min((mel - izq) / (cen - izq), (der - mel) / (der - cen)));
      if (peso > 0) {
        if (primero < 0) primero = k;
        pesos.push(peso);
      }
    }
    filtros.push({ desde: primero, pesos: Float64Array.from(pesos) });
  }
  // FFT radix-2: twiddles y orden de bits.
  const cos = new Float64Array(fft / 2);
  const sen = new Float64Array(fft / 2);
  for (let i = 0; i < fft / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / fft);
    sen[i] = -Math.sin((2 * Math.PI * i) / fft);
  }
  const bits = Math.log2(fft);
  const inverso = new Uint16Array(fft);
  for (let i = 0; i < fft; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
    inverso[i] = r;
  }
  cache = { win, filtros, cos, sen, inverso };
  return cache;
}

/** FFT compleja in situ sobre `re`/`im` (tamaño potencia de 2). */
function fftInterna(re, im, t) {
  const n = re.length;
  for (let i = 0; i < n; i++) {
    const j = t.inverso[i];
    if (j > i) {
      const a = re[i]; re[i] = re[j]; re[j] = a;
      const b = im[i]; im[i] = im[j]; im[j] = b;
    }
  }
  for (let medio = 1; medio < n; medio <<= 1) {
    const paso = n / (medio << 1);
    for (let ini = 0; ini < n; ini += medio << 1) {
      for (let k = 0; k < medio; k++) {
        const wr = t.cos[k * paso];
        const wi = t.sen[k * paso];
        const i = ini + k;
        const j = i + medio;
        const xr = re[j] * wr - im[j] * wi;
        const xi = re[j] * wi + im[j] * wr;
        re[j] = re[i] - xr;
        im[j] = im[i] - xi;
        re[i] += xr;
        im[i] += xi;
      }
    }
  }
}

/**
 * Índice reflejado REPITIENDO el borde (-1 → 0, -2 → 1, n → n-1…): es lo que
 * hace el `torch.flip(waveform[:, :k])` del relleno de lhotse, no el `reflect`
 * de numpy.
 */
function reflejar(i, n) {
  const periodo = 2 * n;
  const m = ((i % periodo) + periodo) % periodo;
  return m < n ? m : periodo - 1 - m;
}

/** Número de cuadros que da `calcularFbank` para `muestras` muestras. */
export function cuadrosDeFbank(muestras) {
  return Math.floor((muestras + FBANK.paso / 2) / FBANK.paso);
}

/**
 * Calcula el fbank de un audio mono a 16 kHz (valores en [-1, 1]).
 * Devuelve `{ datos, cuadros, bandas }`: `datos` es un Float32Array plano de
 * `cuadros × 80` (cuadro por cuadro), listo para el tensor `x` `[1, T, 80]`.
 */
export function calcularFbank(audio) {
  const { ventana, paso, fft, bandas, preenfasis, piso } = FBANK;
  const n = audio.length;
  const cuadros = cuadrosDeFbank(n);
  const datos = new Float32Array(cuadros * bandas);
  if (cuadros === 0) return { datos, cuadros, bandas };
  const t = tablas();
  // Relleno por reflexión: izquierda (ventana - paso)/2, y el resto a la derecha.
  const izq = Math.floor((ventana - paso) / 2);
  const re = new Float64Array(fft);
  const im = new Float64Array(fft);
  const marco = new Float64Array(ventana);
  const muestra = (j) => audio[reflejar(j - izq, n)];
  for (let c = 0; c < cuadros; c++) {
    const ini = c * paso;
    let media = 0;
    for (let k = 0; k < ventana; k++) {
      marco[k] = muestra(ini + k);
      media += marco[k];
    }
    media /= ventana;
    for (let k = 0; k < ventana; k++) marco[k] -= media;
    // Preénfasis con el primer valor repetido (relleno «replicate»).
    re.fill(0);
    im.fill(0);
    for (let k = ventana - 1; k >= 0; k--) {
      const previo = k === 0 ? marco[0] : marco[k - 1];
      re[k] = (marco[k] - preenfasis * previo) * t.win[k];
    }
    fftInterna(re, im, t);
    const base = c * bandas;
    for (let b = 0; b < bandas; b++) {
      const { desde, pesos } = t.filtros[b];
      let suma = 0;
      for (let k = 0; k < pesos.length; k++) {
        const i = desde + k;
        suma += (re[i] * re[i] + im[i] * im[i]) * pesos[k];
      }
      datos[base + b] = Math.log(Math.max(suma, piso));
    }
  }
  return { datos, cuadros, bandas };
}
