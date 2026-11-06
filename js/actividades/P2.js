// P2 — Misma cosa (etapa 0): ve una foto y toca el dibujo de lo mismo (foto de su perro → pictograma o
// emoji de perro). Solo para palabras con foto y con un símbolo (pictograma guardado al lado, o emoji).
import { armarEnsayo, renderEnsayo } from './comun.js';
import { tieneSimbolo } from '../core/vocabulario.js';

export default {
  id: 'P2',
  etapa: 0,
  nombre: 'Misma cosa',
  consigna: 'Toca el dibujo de lo mismo',
  aplicaA: (palabra) => Boolean(palabra.medioImagenId) && tieneSimbolo(palabra),
  esOpcionValida: tieneSimbolo, // las opciones se muestran con su símbolo, así que todas deben tenerlo
  crearEnsayo(datos) {
    return armarEnsayo({
      ...datos, actividad: 'P2', consigna: this.consigna, formaModelo: 'imagen', formaCarta: 'imagen', fuenteCarta: 'simbolo', audioInicial: true,
    });
  },
  render: renderEnsayo,
};
