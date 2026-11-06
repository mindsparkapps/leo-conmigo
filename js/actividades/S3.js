// S3 — Armo la palabra (etapa 3): ve la imagen y toca las sílabas EN ORDEN para formar la palabra. Sin arrastrar,
// igual que «armo la frase» (F3): una ficha equivocada se atenúa y se ilumina la que sigue.
// Con 3 y 4 opciones se suman 1 y 2 sílabas de relleno que no son de la palabra.
import { barajar } from '../core/azar.js';
import { silabasDe, silabasDistractoras } from '../core/silabeo.js';
import { renderSecuencia } from './secuencia.js';

const MAX_REINTENTOS_MEZCLA = 10;

export default {
  id: 'S3',
  etapa: 3,
  nombre: 'Armo la palabra',
  consigna: 'Arma la palabra',
  aplicaA: (palabra) => Boolean(palabra.leida) && palabra.silabas?.length >= 2,
  esOpcionValida: (palabra) => Boolean(palabra.leida),
  crearEnsayo({ ensayo, palabras, aleatorio = Math.random }) {
    const objetivo = palabras.get(ensayo.elementoId);
    if (!objetivo) throw new Error(`Palabra desconocida en el ensayo: ${ensayo.elementoId}`);
    const orden = silabasDe(objetivo);
    if (orden.length < 2) throw new Error(`«${objetivo.texto}» tiene una sola sílaba`);

    const extras = Math.max(0, ensayo.distractorIds.length - 1);
    const otras = ensayo.distractorIds.map((id) => palabras.get(id)).filter(Boolean);
    const respaldo = barajar([...palabras.values()].filter((p) => p.leida && p.id !== objetivo.id), aleatorio);
    const relleno = silabasDistractoras({ palabras: [...barajar(otras, aleatorio), ...respaldo], excluir: orden, cantidad: extras });

    const hechas = [...orden, ...relleno].map((silaba, i) => ({ id: `f${i}`, palabraId: silaba, texto: silaba }));
    // Que no queden ya en el orden correcto (si hay forma de evitarlo)
    const enOrden = (lista) => lista.slice(0, orden.length).every((f, i) => f.palabraId === orden[i]);
    let fichas = barajar(hechas, aleatorio);
    for (let k = 0; k < MAX_REINTENTOS_MEZCLA && enOrden(fichas) && new Set(orden).size > 1; k++) fichas = barajar(hechas, aleatorio);

    return {
      modo: 'secuencia',
      actividad: 'S3',
      elementoId: objetivo.id,
      tipo: ensayo.tipo,
      esFacil: ensayo.esFacil,
      consigna: this.consigna,
      consignaSiempre: false,
      dicho: null,
      modelo: { forma: 'imagen', palabraId: objetivo.id },
      orden,
      fichas,
      cartas: fichas, // para contar las opciones mostradas
      opciones: fichas.length,
      correctaId: null,
      audioInicial: true,
      posicionCorrecta: -1,
    };
  },
  render: renderSecuencia,
};
