// P3 — Clasificar (etapa 0): «¿Cuál es una comida?» y toca la imagen de la categoría.
// La pregunta se dice en voz alta (cambia en cada ensayo) y el altavoz la repite.
// Los distractores son siempre de OTRA categoría: si no, habría dos respuestas correctas.
import { armarEnsayo, renderEnsayo } from './comun.js';
import { preguntaDeCategoria, tieneImagen } from '../core/vocabulario.js';

export default {
  id: 'P3',
  etapa: 0,
  nombre: 'Clasificar',
  consigna: '¿Cuál es…?',
  aplicaA: (palabra) => tieneImagen(palabra) && Boolean(preguntaDeCategoria(palabra.categoria)),
  esOpcionValida: (palabra) => palabra.categoria !== 'enlace',
  reglas: { soloOtraCategoria: true },
  crearEnsayo(datos) {
    const objetivo = datos.palabras.get(datos.ensayo.elementoId);
    const pregunta = preguntaDeCategoria(objetivo?.categoria);
    if (!pregunta) throw new Error(`La categoría «${objetivo?.categoria}» no sirve para clasificar`);
    return armarEnsayo({
      ...datos,
      actividad: 'P3',
      consigna: pregunta,
      consignaSiempre: true,
      dicho: pregunta,
      formaModelo: 'audio',
      formaCarta: 'imagen',
      audioInicial: false, // la pregunta ya se dice como consigna
    });
  },
  render: renderEnsayo,
};
