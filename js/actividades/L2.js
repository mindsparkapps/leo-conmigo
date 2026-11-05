// L2 — Palabra igual (sin imagen): el modelo es una tarjeta y las opciones son solo palabras.
// Es emparejar formas escritas; todavía no es leer.
import { armarEnsayo, renderEnsayo } from './comun.js';

export default {
  id: 'L2',
  etapa: 1,
  nombre: 'Palabra igual (sin imagen)',
  consigna: 'Toca la palabra que es igual',
  crearEnsayo(datos) {
    return armarEnsayo({ ...datos, actividad: 'L2', consigna: this.consigna, formaModelo: 'tarjeta', formaCarta: 'palabra', audioInicial: true });
  },
  render: renderEnsayo,
};
