// S1 — Descubro la sílaba (etapa 3): ve una palabra que ya lee partida en sílabas de colores, se resalta la
// primera y suena («ma»); toca la palabra que EMPIEZA IGUAL entre 2 y 4. La respuesta es otra palabra que
// ya lee y que empieza con la misma sílaba; los distractores empiezan distinto, así hay una sola correcta.
import { mezclarCartas, renderEnsayo } from './comun.js';
import { empiezanIgual, silabasDe } from '../core/silabeo.js';

export default {
  id: 'S1',
  etapa: 3,
  nombre: 'Descubro la sílaba',
  consigna: 'Toca la palabra que empieza igual',
  aplicaA: (palabra) => Boolean(palabra.conMismaSilaba),
  esOpcionValida: (palabra) => Boolean(palabra.leida),
  crearEnsayo({ ensayo, palabras, aleatorio = Math.random, ultimasPosiciones = [] }) {
    const objetivo = palabras.get(ensayo.elementoId);
    if (!objetivo) throw new Error(`Palabra desconocida en el ensayo: ${ensayo.elementoId}`);
    const silabas = silabasDe(objetivo);
    const todas = [...palabras.values()].filter((p) => p.id !== objetivo.id && p.leida && p.activa !== false && !p.deleted);
    const companeras = todas.filter((p) => empiezanIgual(p, objetivo));
    if (!companeras.length) throw new Error(`«${objetivo.texto}» no tiene otra palabra que empiece igual`);
    const correcta = companeras[Math.floor(aleatorio() * companeras.length)];

    // Distractores: los que eligió el motor y, si no alcanzan, otras palabras leídas; nunca una que empiece igual
    const quiereDistractores = ensayo.distractorIds.length;
    const usados = new Set([correcta.id, objetivo.id]);
    const distractoras = [];
    const candidatas = [...ensayo.distractorIds.map((id) => palabras.get(id)), ...todas];
    for (const p of candidatas) {
      if (distractoras.length >= quiereDistractores) break;
      if (!p || usados.has(p.id) || empiezanIgual(p, objetivo)) continue;
      usados.add(p.id);
      distractoras.push(p);
    }

    const ids = [correcta.id, ...distractoras.map((d) => d.id)];
    const cartas = mezclarCartas(ids.map((id) => ({ id, forma: 'palabra' })), correcta.id, aleatorio, ultimasPosiciones);
    return {
      modo: 'simple',
      actividad: 'S1',
      elementoId: objetivo.id,
      tipo: ensayo.tipo,
      esFacil: ensayo.esFacil,
      consigna: this.consigna,
      consignaSiempre: false,
      dicho: silabas[0], // suena la sílaba, no la palabra entera
      modelo: { forma: 'silabas', palabraId: objetivo.id, resaltar: 0 },
      cartas,
      opciones: cartas.length,
      correctaId: correcta.id,
      audioInicial: true,
      posicionCorrecta: cartas.findIndex((c) => c.id === correcta.id),
    };
  },
  render: renderEnsayo,
};
