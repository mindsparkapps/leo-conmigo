// L4 — De la palabra a la imagen: ve SOLO la palabra escrita (sin audio) y toca el dibujo.
// Esto ya es leer. Si se equivoca, la ayuda incluye el audio (aparece recién entonces).
import { armarEnsayo, renderEnsayo } from './comun.js';

export default {
  id: 'L4',
  etapa: 1,
  nombre: 'De la palabra a la imagen',
  consigna: 'Lee y toca el dibujo',
  crearEnsayo(datos) {
    return armarEnsayo({ ...datos, actividad: 'L4', consigna: this.consigna, formaModelo: 'palabra', formaCarta: 'imagen', audioInicial: false });
  },
  render: renderEnsayo,
};
