// L6 — Leo en voz alta (asistida, opcional): ve la palabra y la dice; el ADULTO toca ✓ («lo leyó»)
// u «otra vez» en una esquina. La app nunca evalúa el habla. Solo se usa si el adulto la habilita y
// solo con palabras que el niño ya lee (L4 dominada). No forma parte de la cadena L1–L5.
import { el } from '../ui/dom.js';
import { esSegundoDedo, renderEnsayo } from './comun.js';

export default {
  id: 'L6',
  etapa: 1,
  nombre: 'Leo en voz alta',
  consigna: 'Lee en voz alta',
  crearEnsayo({ ensayo, palabras }) {
    if (!palabras.has(ensayo.elementoId)) throw new Error(`Palabra desconocida en el ensayo: ${ensayo.elementoId}`);
    return {
      modo: 'lectura',
      actividad: 'L6',
      elementoId: ensayo.elementoId,
      tipo: 'lectura',
      esFacil: false,
      consigna: this.consigna,
      consignaSiempre: false,
      dicho: null,
      modelo: { forma: 'palabra', palabraId: ensayo.elementoId },
      cartas: [],
      opciones: 1,
      correctaId: null,
      audioInicial: false, // la palabra se lee, no se escucha; el audio aparece con «otra vez»
      posicionCorrecta: -1,
    };
  },
  render(contenedor, ensayo, ctx) {
    const manejador = renderEnsayo(contenedor, ensayo, ctx);
    const boton = (clase, etiqueta, simbolo, decision) =>
      el('button', {
        type: 'button',
        class: `boton-adulto ${clase}`,
        'aria-label': etiqueta,
        title: etiqueta,
        onclick: (e) => {
          if (!esSegundoDedo(e)) ctx.alToque(decision);
        },
      }, simbolo);
    contenedor.append(el('div', { class: 'controles-adulto' }, boton('otra', 'Otra vez', '↻', 'otra'), boton('ok', 'Lo leyó bien', '✓', 'ok')));
    return manejador;
  },
};
