// S4 — Palabra nueva (etapa 3): lee una palabra NUNCA vista, hecha solo con sílabas que ya domina, y toca su
// dibujo. Es leer de verdad: sin audio al inicio (aparece recién tras un error). Como todas las demás, sin error.
import { armarEnsayo, renderEnsayo } from './comun.js';

export default {
  id: 'S4',
  etapa: 3,
  nombre: 'Palabra nueva',
  consigna: 'Lee y toca el dibujo',
  aplicaA: (palabra) => Boolean(palabra.paraS4),
  esOpcionValida: (palabra) => Boolean(palabra.leida),
  crearEnsayo(datos) {
    return armarEnsayo({ ...datos, actividad: 'S4', consigna: this.consigna, formaModelo: 'palabra', formaCarta: 'imagen', audioInicial: false });
  },
  render: renderEnsayo,
};
