// F2 — Leo la frase (etapa 2): ve la frase escrita («papá come pan») sin audio y toca la imagen que la representa.
// Si se equivoca, la ayuda incluye el audio.
import { armarEnsayo, renderEnsayo } from './comun.js';

export default {
  id: 'F2',
  etapa: 2,
  nombre: 'Leo la frase',
  consigna: 'Lee la frase y toca el dibujo',
  crearEnsayo(datos) {
    return armarEnsayo({ ...datos, actividad: 'F2', consigna: this.consigna, formaModelo: 'palabra', formaCarta: 'imagen', audioInicial: false });
  },
  render: renderEnsayo,
};
