// Registro fino de cada respuesta (PLAN.md, fase 12). Lógica pura: arma UN registro por ensayo terminado
// con todo lo que hace falta para analizar después qué le cuesta al niño (con qué se confunde, cuánto
// duda, cuántas veces pidió oír otra vez). Los registros solo se agregan: nunca se editan.
//
// El registro es autosuficiente: copia el texto de la palabra y de las opciones, para que se entienda aunque
// después borren la palabra. Su `id` es `<sesionId>:<numeroEnSesion>`, así que guardarlo dos veces no lo duplica.

import { claveDia } from './progreso.js';

export const MS_DISTRAIDO = 60000; // una respuesta más lenta que esto se marca `distraido` y el análisis la excluye del tiempo

const COPIA_O_NULO = (valor) => (valor == null ? null : valor);

export function idDeRespuesta(sesionId, numeroEnSesion) {
  return `${sesionId}:${numeroEnSesion}`;
}

/**
 * @param perfilId, sesionId, numeroEnSesion   a qué niño y sesión pertenece, y qué ensayo fue (1, 2, 3…)
 * @param fecha            Date (o texto ISO) del momento en que se acertó
 * @param etapa            etapa que se practicaba (0 a 4)
 * @param ensayo           ensayo del plan: { elementoId, actividad, tipo, esFacil }
 * @param elemento         la palabra o frase practicada: { texto, esFrase, categoria, silabas }
 * @param visual           ensayo visual que se dibujó: { cartas | fichas, orden, posicionCorrecta, opciones }
 * @param intento          intento ya acertado (ver intento.js)
 * @param textoDe          (id) => texto de una opción de las cartas que no trae su propio `texto`
 * @param progresoAntes / progresoDespues   progreso del elemento en la actividad, antes y después del ensayo
 * @param nivelOpciones    cuántas opciones mandaba el nivel (null si no aplica)
 * @param repeticionesAudio  veces que el niño tocó el altavoz o el modelo para volver a oír
 * @param fatigaActiva     true si este ensayo fue el de cierre por cansancio
 * @param extra            campos propios de una pantalla (p. ej. { libroId } en los cuentos)
 */
export function construirRespuesta({
  perfilId, sesionId, numeroEnSesion, fecha, etapa = null, ensayo, elemento, visual, intento, textoDe = () => null,
  progresoAntes = null, progresoDespues = null, nivelOpciones = null, repeticionesAudio = 0, fatigaActiva = false, extra = {},
}) {
  if (intento.estado !== 'acertado') throw new Error('El ensayo todavía no se resolvió');
  const momento = fecha instanceof Date ? fecha : new Date(fecha);
  const msAcierto = Math.round(intento.fin - intento.inicio);
  const modo = intento.modo;

  const fichas = new Map((visual.fichas ?? []).map((f) => [f.id, f]));
  const textoDeCarta = (carta) => carta.texto ?? textoDe(carta.id);

  let opciones = [];
  let errores = [];
  let posicionCorrecta = null;
  let secuencia = {};
  let conAyudaVisual = false;

  if (modo === 'lectura') {
    conAyudaVisual = intento.repeticiones > 0;
    secuencia = { repeticiones: intento.repeticiones };
  } else if (modo === 'secuencia') {
    opciones = (visual.fichas ?? []).map((f) => ({ id: f.palabraId, texto: f.texto }));
    errores = intento.errores.map((id, i) => ({ id: fichas.get(id)?.palabraId ?? id, texto: fichas.get(id)?.texto ?? null, ms: intento.erroresMs[i] }));
    const textoDeOrden = (palabraId) => (visual.fichas ?? []).find((f) => f.palabraId === palabraId)?.texto ?? textoDe(palabraId);
    secuencia = {
      ordenEsperado: visual.orden.map(textoDeOrden),
      toques: intento.toques.map((t) => ({ texto: fichas.get(t.fichaId)?.texto ?? null, correcto: t.correcto, ms: t.ms })),
    };
    conAyudaVisual = intento.errores.length > 0;
  } else {
    const cartas = visual.cartas ?? [];
    opciones = cartas.map((c) => ({ id: c.id, texto: textoDeCarta(c) }));
    const porId = new Map(cartas.map((c) => [c.id, c]));
    errores = intento.errores.map((id, i) => ({ id, texto: porId.has(id) ? textoDeCarta(porId.get(id)) : textoDe(id), ms: intento.erroresMs[i] }));
    posicionCorrecta = visual.posicionCorrecta ?? cartas.findIndex((c) => c.id === intento.correctaId);
    conAyudaVisual = intento.errores.length > 0;
  }

  const registro = {
    ...camposComunes({ perfilId, sesionId, numeroEnSesion, momento, etapa, ensayo, elemento, intento, msAcierto, repeticionesAudio, progresoAntes, progresoDespues, fatigaActiva }),
    opciones,
    posicionCorrecta,
    nivelOpciones,
    correctoAlPrimerIntento: modo === 'lectura' ? intento.repeticiones === 0 : intento.errores.length === 0,
    errores,
    conAyudaVisual,
    ...secuencia,
    ...extra,
  };
  return registro;
}

/** Los campos que tiene todo registro, de lectura o de escritura (el análisis los lee igual). */
function camposComunes({ perfilId, sesionId, numeroEnSesion, momento, etapa, ensayo, elemento, intento, msAcierto, repeticionesAudio, progresoAntes, progresoDespues, fatigaActiva }) {
  return {
    id: idDeRespuesta(sesionId, numeroEnSesion),
    perfilId,
    sesionId,
    fecha: momento.toISOString(),
    dia: claveDia(momento),
    hora: momento.getHours(),
    diaSemana: momento.getDay(),
    numeroEnSesion,
    elementoId: ensayo.elementoId,
    texto: elemento?.texto ?? null,
    esFrase: Boolean(elemento?.esFrase),
    categoria: COPIA_O_NULO(elemento?.categoria),
    silabas: Array.isArray(elemento?.silabas) ? [...elemento.silabas] : null,
    etapa,
    actividad: ensayo.actividad,
    tipo: ensayo.tipo,
    esFacil: Boolean(ensayo.esFacil),
    intentos: intento.intentos,
    msPrimerToque: COPIA_O_NULO(intento.primerToque),
    msAcierto,
    distraido: msAcierto > MS_DISTRAIDO,
    repeticionesAudio,
    estadoAntes: progresoAntes?.estado ?? null,
    estadoDespues: progresoDespues?.estado ?? null,
    cajaLeitnerAntes: progresoAntes?.cajaLeitner ?? null,
    cajaLeitnerDespues: progresoDespues?.cajaLeitner ?? null,
    fatigaActiva: Boolean(fatigaActiva),
  };
}

/**
 * Registro fino de un ensayo de escritura (Ampliación 5, fase 28). Tiene los mismos campos que el de lectura (para que el análisis y
 * las exportaciones lo lean igual) más los propios: `modo: 'escritura'`, `unidad`, `huecos`, `fichas`, `extras`, `toques`,
 * `escuchasPieza`, `erroresPorHueco`, `ordenLlenado`, `primeraVez` (¿nunca antes había visto esta palabra escribiendo? → mide la
 * generalización) y `nivelExtras` (las extras que mandaba el nivel; no el `nivelOpciones` de la lectura, que aquí es null).
 * `errores`: `{ id, texto, hueco, ms }` por cada pieza soltada en una caja equivocada; `id` es el texto de la pieza, para poder
 * contar confusiones («pa → ba») con las mismas funciones de la lectura.
 * @param visual  el ensayo armado (`armarEnsayoEscritura`): `{ unidad, huecos, fichas, extras, nivel }`
 * @param intento intento ya completo (`escritura/intento.js`)
 */
export function construirRespuestaEscritura({
  perfilId, sesionId, numeroEnSesion, fecha, ensayo, elemento, visual, intento, progresoAntes = null, progresoDespues = null,
  nivelExtras = null, repeticionesAudio = 0, fatigaActiva = false, primeraVez = false, extra = {},
}) {
  if (intento.estado !== 'acertado') throw new Error('El ensayo todavía no se resolvió');
  const momento = fecha instanceof Date ? fecha : new Date(fecha);
  const msAcierto = Math.round(intento.fin - intento.inicio);
  return {
    ...camposComunes({ perfilId, sesionId, numeroEnSesion, momento, etapa: null, ensayo, elemento, intento, msAcierto, repeticionesAudio, progresoAntes, progresoDespues, fatigaActiva }),
    modo: 'escritura',
    unidad: visual.unidad,
    opciones: [],
    posicionCorrecta: null,
    nivelOpciones: null,
    nivelExtras,
    huecos: [...intento.huecos],
    fichas: intento.fichas.map((f) => ({ id: f.id, texto: f.texto, distractor: f.distractor })),
    extras: visual.extras ?? intento.fichas.filter((f) => f.distractor).length,
    correctoAlPrimerIntento: intento.errores.length === 0,
    errores: intento.errores.map((e, i) => ({ id: e.texto, texto: e.texto, hueco: e.hueco, ms: intento.erroresMs[i] })),
    toques: intento.toques.map((t) => ({ fichaId: t.fichaId, texto: t.texto, hueco: t.hueco, correcto: t.correcto, ms: t.ms, forma: t.forma })),
    escuchasPieza: intento.escuchasPieza.map((e) => ({ texto: e.texto, ms: e.ms })),
    erroresPorHueco: [...intento.erroresPorHueco],
    ordenLlenado: [...intento.ordenLlenado],
    primeraVez: Boolean(primeraVez),
    conAyudaVisual: intento.conAyudaVisual,
    ...extra,
  };
}
