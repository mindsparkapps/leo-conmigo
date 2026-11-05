// L1 — Palabra igual (con imagen): ve una tarjeta (imagen + palabra) y toca la tarjeta igual.
import { armarEnsayo, renderEnsayo } from './comun.js';

export default {
  id: 'L1',
  etapa: 1,
  nombre: 'Palabra igual (con imagen)',
  consigna: 'Toca la que es igual',
  crearEnsayo(datos) {
    return armarEnsayo({ ...datos, actividad: 'L1', consigna: this.consigna, formaModelo: 'tarjeta', formaCarta: 'tarjeta', audioInicial: true });
  },
  render: renderEnsayo,
};
