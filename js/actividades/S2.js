// S2 — Completo la palabra (etapa 3): ve la imagen y la palabra con una sílaba que falta («__sa» → mesa) y
// toca la sílaba que falta entre 2 y 4. Al tocar el modelo suena la palabra entera.
import { barajar } from '../core/azar.js';
import { mezclarCartas, renderEnsayo } from './comun.js';
import { silabasDe, silabasDistractoras } from '../core/silabeo.js';

export default {
  id: 'S2',
  etapa: 3,
  nombre: 'Completo la palabra',
  consigna: 'Completa la palabra',
  aplicaA: (palabra) => Boolean(palabra.leida) && palabra.silabas?.length >= 2,
  esOpcionValida: (palabra) => Boolean(palabra.leida),
  crearEnsayo({ ensayo, palabras, aleatorio = Math.random, ultimasPosiciones = [] }) {
    const objetivo = palabras.get(ensayo.elementoId);
    if (!objetivo) throw new Error(`Palabra desconocida en el ensayo: ${ensayo.elementoId}`);
    const silabas = silabasDe(objetivo);
    if (silabas.length < 2) throw new Error(`«${objetivo.texto}» tiene una sola sílaba`);
    const hueco = Math.floor(aleatorio() * silabas.length);
    const correcta = silabas[hueco];

    // Las otras opciones son sílabas de otras palabras (primero de las que eligió el motor), distintas de la correcta
    // y entre sí. Se vetan las de la propia palabra: «ma» y «má» no pueden ser dos opciones.
    const otras = ensayo.distractorIds.map((id) => palabras.get(id)).filter(Boolean);
    const respaldo = barajar([...palabras.values()].filter((p) => p.leida && p.id !== objetivo.id), aleatorio);
    const distractoras = silabasDistractoras({
      palabras: [...barajar(otras, aleatorio), ...respaldo],
      excluir: silabas,
      cantidad: ensayo.distractorIds.length,
    });

    const cartas = mezclarCartas(
      [correcta, ...distractoras].map((s) => ({ id: s, forma: 'silaba', texto: s })),
      correcta,
      aleatorio,
      ultimasPosiciones,
    );
    return {
      modo: 'simple',
      actividad: 'S2',
      elementoId: objetivo.id,
      tipo: ensayo.tipo,
      esFacil: ensayo.esFacil,
      consigna: this.consigna,
      consignaSiempre: false,
      dicho: null, // al tocar el modelo suena la palabra entera
      modelo: { forma: 'tarjeta', palabraId: objetivo.id, hueco },
      cartas,
      opciones: cartas.length,
      correctaId: correcta,
      audioInicial: true,
      posicionCorrecta: cartas.findIndex((c) => c.id === correcta),
    };
  },
  render: renderEnsayo,
};
