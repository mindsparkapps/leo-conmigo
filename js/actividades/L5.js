// L5 — Escucho y elijo: escucha la palabra (el modelo es un altavoz) y toca la palabra escrita.
import { armarEnsayo, renderEnsayo } from './comun.js';

export default {
  id: 'L5',
  etapa: 1,
  nombre: 'Escucho y elijo',
  consigna: 'Escucha y toca la palabra',
  crearEnsayo(datos) {
    return armarEnsayo({ ...datos, actividad: 'L5', consigna: this.consigna, formaModelo: 'audio', formaCarta: 'palabra', audioInicial: true });
  },
  render: renderEnsayo,
};
