// F3 — Armo la frase (etapa 2): ve una imagen y toca las palabras en orden. Sin arrastrar.
import { armarEnsayoSecuencia, renderSecuencia } from './secuencia.js';

export default {
  id: 'F3',
  etapa: 2,
  nombre: 'Armo la frase',
  consigna: 'Arma la frase',
  crearEnsayo: armarEnsayoSecuencia,
  render: renderSecuencia,
};
