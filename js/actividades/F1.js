// F1 — Frase igual (etapa 2): ve una frase con su imagen y toca la frase idéntica entre 2 y 3.
import { armarEnsayo, renderEnsayo } from './comun.js';

export default {
  id: 'F1',
  etapa: 2,
  nombre: 'Frase igual',
  consigna: 'Toca la frase que es igual',
  crearEnsayo(datos) {
    return armarEnsayo({ ...datos, actividad: 'F1', consigna: this.consigna, formaModelo: 'tarjeta', formaCarta: 'tarjeta', audioInicial: true });
  },
  render: renderEnsayo,
};
