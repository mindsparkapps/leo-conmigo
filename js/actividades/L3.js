// L3 — De la imagen a la palabra: ve la imagen, escucha la palabra y toca la palabra escrita.
import { armarEnsayo, renderEnsayo } from './comun.js';

export default {
  id: 'L3',
  etapa: 1,
  nombre: 'De la imagen a la palabra',
  consigna: 'Toca la palabra',
  crearEnsayo(datos) {
    return armarEnsayo({ ...datos, actividad: 'L3', consigna: this.consigna, formaModelo: 'imagen', formaCarta: 'palabra', audioInicial: true });
  },
  render: renderEnsayo,
};
