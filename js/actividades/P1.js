// P1 — Imagen igual (etapa 0): ve una imagen y toca la imagen idéntica entre 2 a 4. Sin letras.
import { armarEnsayo, renderEnsayo } from './comun.js';
import { tieneImagen } from '../core/vocabulario.js';

export default {
  id: 'P1',
  etapa: 0,
  nombre: 'Imagen igual',
  consigna: 'Toca la imagen que es igual',
  aplicaA: tieneImagen,
  crearEnsayo(datos) {
    return armarEnsayo({ ...datos, actividad: 'P1', consigna: this.consigna, formaModelo: 'imagen', formaCarta: 'imagen', audioInicial: true });
  },
  render: renderEnsayo,
};
