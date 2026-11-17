// Análisis de la escritura (Ampliación 5, fase 31): qué palabras y sílabas le cuestan, con qué sílabas se confunde, dónde se
// equivoca dentro de la palabra, qué nivel es el más difícil y si generaliza a palabras nuevas. Lógica pura.
//
// NO copia el análisis de la lectura: usa sus ayudantes (`respuestasAnalizables`, `metricasPorPalabra`, `resumenPorActividad`,
// `actividadMasDificil`, `resumenPorHora`, `mediana`, índice de dificultad y tendencia). Lo único propio es lo que la lectura no
// tiene: sílabas, confusiones de sílabas, posición del error y generalización. Todo se compara contra el propio niño.

import {
  DIAS_VENTANA, MIN_CONFUSION, TAMANO_LISTA, actividadMasDificil, mediana, metricasPorPalabra, resumenPorActividad,
  resumenPorHora, respuestasAnalizables,
} from '../analisis.js';
import { esDePrueba, esIdDePrueba } from '../curso.js';
import { IDS_DE_NIVELES } from './niveles.js';

export const TASA_PARA_USAR_CONFUSION = 0.8; // con >= 80 % en una sílaba, su confusión se usa de distractora a propósito (una vez por sesión)
export const MIN_VECES_SILABA = 3; // con menos apariciones, una sílaba no se juzga

const minuscula = (t) => String(t ?? '').toLowerCase();
const redondear = (n, d = 2) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);
const tasaDe = (rs) => (rs.length ? rs.filter((r) => r.correctoAlPrimerIntento).length / rs.length : null);

/**
 * Las respuestas de escritura que cuentan, de UN solo perfil: el real o el de prueba (`prueba:<id>`), nunca las dos mezcladas.
 * @param perfilId  de quién (por defecto, las que no son de prueba)
 */
export function respuestasDeEscritura(respuestas, { perfilId = null, hoy = new Date(), dias = DIAS_VENTANA } = {}) {
  const propias = respuestas.filter((r) => (perfilId ? r.perfilId === perfilId : !esDePrueba(r)));
  return respuestasAnalizables(propias, { hoy, dias, escritura: true });
}

/** Una fila por (palabra, nivel): el índice de dificultad de la lectura, con `audioPorEnsayo` = escuchas de la palabra + de las piezas. */
export function metricasDePalabras(rs, { hoy = new Date() } = {}) {
  const adaptadas = rs.map((r) => ({
    ...r,
    elementoId: `${r.elementoId}:${r.actividad}`,
    repeticionesAudio: (r.repeticionesAudio ?? 0) + (r.escuchasPieza?.length ?? 0),
  }));
  return metricasPorPalabra(adaptadas, { hoy }).map((m) => {
    const [elementoId, nivel] = [m.elementoId.slice(0, m.elementoId.lastIndexOf(':')), m.elementoId.slice(m.elementoId.lastIndexOf(':') + 1)];
    // en E01 la pieza es la vocal: se muestra la imagen («abeja»), no la «a»
    return { ...m, clave: m.elementoId, elementoId, nivel, texto: nivel === 'E01' ? elementoId.replace(/^esc:/, '') : m.texto };
  });
}

/**
 * Por sílaba (la pieza que iba en la caja): apariciones, veces que la puso bien a la primera, veces que se equivocó en su caja,
 * tasa y tiempo mediano hasta ponerla (ms desde el toque anterior). Solo cuentan las sílabas con `MIN_VECES_SILABA` apariciones
 * para las listas; todas salen en `silabas`.
 */
export function metricasDeSilabas(rs) {
  const grupos = new Map();
  for (const r of rs) {
    const huecos = r.huecos ?? [];
    const correctos = (r.toques ?? []).filter((t) => t.correcto).sort((a, b) => a.ms - b.ms);
    const todos = [...(r.toques ?? [])].sort((a, b) => a.ms - b.ms);
    huecos.forEach((texto, i) => {
      const clave = minuscula(texto);
      const g = grupos.get(clave) ?? { texto: clave, apariciones: 0, sinError: 0, errores: 0, tiempos: [] };
      g.apariciones += 1;
      const malas = r.erroresPorHueco?.[i] ?? 0;
      g.errores += malas;
      if (malas === 0) g.sinError += 1;
      const toque = correctos.find((t) => t.hueco === i);
      if (toque) {
        const anterior = todos[todos.indexOf(toque) - 1];
        g.tiempos.push(Math.max(0, toque.ms - (anterior?.ms ?? 0)));
      }
      grupos.set(clave, g);
    });
  }
  return [...grupos.values()]
    .map((g) => ({
      texto: g.texto, apariciones: g.apariciones, sinError: g.sinError, errores: g.errores, tasa: g.sinError / g.apariciones,
      tiempoMediano: Math.round(mediana(g.tiempos) ?? 0) || null, confiable: g.apariciones >= MIN_VECES_SILABA,
    }))
    .sort((a, b) => a.tasa - b.tasa || b.errores - a.errores || a.texto.localeCompare(b.texto, 'es'));
}

/**
 * Confusiones de sílabas: «pa → ba» = en la caja de `pa` puso `ba` (una pieza que no era), con su nivel y `veces`.
 * Solo las que pasan de `minimo` veces. Más frecuentes primero.
 */
export function confusionesDeSilabas(rs, { minimo = MIN_CONFUSION } = {}) {
  const pares = new Map();
  for (const r of rs) {
    for (const e of r.errores ?? []) {
      const objetivo = minuscula(r.huecos?.[e.hueco]);
      const tocada = minuscula(e.texto);
      if (!objetivo || !tocada || objetivo === tocada) continue;
      const clave = `${objetivo}>${tocada}`;
      const par = pares.get(clave) ?? { objetivo, tocada, veces: 0, niveles: new Set() };
      par.veces += 1;
      par.niveles.add(r.actividad);
      pares.set(clave, par);
    }
  }
  return [...pares.values()]
    .filter((p) => p.veces >= minimo)
    .map((p) => ({ objetivo: p.objetivo, tocada: p.tocada, veces: p.veces, niveles: [...p.niveles].sort() }))
    .sort((a, b) => b.veces - a.veces || a.objetivo.localeCompare(b.objetivo, 'es') || a.tocada.localeCompare(b.tocada, 'es'));
}

/** Dónde se equivoca dentro de la palabra: primera, del medio o última pieza (solo palabras de 2 o más cajas). */
export function posicionDelError(rs) {
  const cuenta = { primera: { oportunidades: 0, errores: 0 }, medio: { oportunidades: 0, errores: 0 }, ultima: { oportunidades: 0, errores: 0 } };
  for (const r of rs) {
    const n = (r.huecos ?? []).length;
    if (n < 2) continue;
    for (let i = 0; i < n; i++) {
      const zona = i === 0 ? cuenta.primera : i === n - 1 ? cuenta.ultima : cuenta.medio;
      zona.oportunidades += 1;
      if ((r.erroresPorHueco?.[i] ?? 0) > 0) zona.errores += 1;
    }
  }
  const salida = {};
  for (const [zona, c] of Object.entries(cuenta)) salida[zona] = { ...c, tasaError: c.oportunidades ? redondear(c.errores / c.oportunidades, 3) : null };
  return salida;
}

/**
 * Generalización: de las palabras que escribió POR PRIMERA VEZ (`primeraVez`), cuántas armó sin error. Total y por nivel.
 * Es la métrica clave: la enseñanza explícita de ortografía suele generalizar poco a palabras nuevas.
 */
export function generalizacion(rs) {
  const nuevas = rs.filter((r) => r.primeraVez);
  const por = (lista) => ({ palabras: lista.length, aciertos: lista.filter((r) => r.correctoAlPrimerIntento).length, tasa: tasaDe(lista) });
  const porNivel = IDS_DE_NIVELES
    .map((nivel) => ({ nivel, ...por(nuevas.filter((r) => r.actividad === nivel)) }))
    .filter((n) => n.palabras > 0);
  return { total: por(nuevas), porNivel };
}

/** Por nivel: ensayos, tasa, tiempo mediano por palabra y sesiones (usa `resumenPorActividad`: el nivel es la actividad). */
export function resumenPorNivelDeEscritura(rs) {
  return resumenPorActividad(rs)
    .map((n) => ({ nivel: n.actividad, ensayos: n.ensayos, tasa: n.tasa, tiempoMediano: n.tiempoMediano, sesiones: new Set(rs.filter((r) => r.actividad === n.actividad).map((r) => r.sesionId)).size }))
    .sort((a, b) => IDS_DE_NIVELES.indexOf(a.nivel) - IDS_DE_NIVELES.indexOf(b.nivel));
}

/** Duración de las sesiones de escritura (minutos) y cuántas terminaron por cansancio o a medias. `sesiones` = las del almacén. */
export function resumenDeSesionesEscritura(sesiones, { perfilId = null } = {}) {
  const propias = (sesiones ?? []).filter((s) => !s.deleted && (s.tipo === 'escritura') && (perfilId ? s.perfilId === perfilId : !esIdDePrueba(s.perfilId)));
  const minutos = propias.map((s) => (Date.parse(s.fin) - Date.parse(s.inicio)) / 60000).filter((m) => Number.isFinite(m) && m >= 0);
  return {
    sesiones: propias.length,
    minutosMediana: redondear(mediana(minutos), 1),
    conCansancio: propias.filter((s) => s.fatiga).length,
    interrumpidas: propias.filter((s) => s.interrumpida).length,
  };
}

const porMasDificil = (a, b) => b.indice - a.indice || a.texto.localeCompare(b.texto, 'es');
const porMasFacil = (a, b) => a.indice - b.indice || b.tasa - a.tasa || (a.tiempoMediano ?? 0) - (b.tiempoMediano ?? 0) || a.texto.localeCompare(b.texto, 'es');

/**
 * Todo el análisis de una vez.
 * @param respuestas  las del almacén (el filtro por perfil lo hace `perfilId`: el real o `prueba:<id>`)
 * @param sesiones    las sesiones del almacén (opcional, para la duración)
 */
export function analizarEscritura(respuestas, { sesiones = [], perfilId = null, hoy = new Date(), dias = DIAS_VENTANA } = {}) {
  const rs = respuestasDeEscritura(respuestas, { perfilId, hoy, dias });
  const palabras = metricasDePalabras(rs, { hoy });
  const confiables = palabras.filter((p) => p.confiable);
  const todasDificiles = confiables.filter((p) => p.indice > 0).sort(porMasDificil);
  const masDificiles = todasDificiles.slice(0, TAMANO_LISTA);
  const ids = new Set(masDificiles.map((p) => p.clave));
  const todasFaciles = confiables.filter((p) => !ids.has(p.clave)).sort(porMasFacil);
  const silabas = metricasDeSilabas(rs);
  const porNivel = resumenPorNivelDeEscritura(rs);
  return {
    dias,
    ensayos: rs.length,
    palabras,
    masDificiles,
    masFaciles: todasFaciles.slice(0, TAMANO_LISTA),
    todasDificiles,
    todasFaciles,
    silabas,
    silabasDificiles: silabas.filter((s) => s.confiable && s.errores > 0).slice(0, TAMANO_LISTA),
    confusiones: confusionesDeSilabas(rs),
    posicionDelError: posicionDelError(rs),
    porNivel,
    nivelMasDificil: (() => { const a = actividadMasDificil(porNivel.map((n) => ({ actividad: n.nivel, ensayos: n.ensayos, tasa: n.tasa, tiempoMediano: n.tiempoMediano }))); return a ? { nivel: a.actividad, tasa: a.tasa, ensayos: a.ensayos } : null; })(),
    generalizacion: generalizacion(rs),
    porHora: resumenPorHora(rs),
    sesiones: resumenDeSesionesEscritura(sesiones, { perfilId }),
    hayDatos: confiables.length > 0,
  };
}

// ---------- exportar para analizar con una IA ----------

export const ESQUEMA_ESCRITURA = Object.freeze({
  metodo: 'Cómo funciona el modo Escritura: orden de los 20 niveles, qué es una pieza, la regla de dominio y qué significan los colores.',
  ventanaDias: 'Cuántos días atrás miran las métricas (las respuestas traen todo el historial).',
  metricasPorPalabra: 'Una fila por palabra y nivel (el dictado E20 es aparte): clave (elementoId:nivel), texto, nivel, ensayos, aciertosPrimerIntento, tasa (0 a 1, armada sin ningún error), errores, tiempoMediano (ms), tiempoRelativo (1 = su propio promedio en ese nivel), audioPorEnsayo (veces que pidió oír la palabra o tocó una pieza para oírla, por ensayo), tendencia, dias, ultimaVez, indice (dificultad de 0 a 100), confiable (false con menos de 5 ensayos) y falloRepasoReciente.',
  silabas: 'Por sílaba (la que iba en la caja): apariciones, sinError (veces que la puso bien a la primera), errores (piezas equivocadas en su caja), tasa, tiempoMediano (ms desde su toque anterior) y confiable (3 apariciones o más).',
  confusiones: 'Pares «objetivo → tocada»: en la caja de la sílaba objetivo puso la pieza tocada, que no era; con veces y los niveles donde pasó.',
  posicionDelError: 'Dónde se equivoca dentro de la palabra (primera, medio o ultima pieza; solo palabras de 2 o más cajas): oportunidades, errores y tasaError.',
  porNivel: 'Por nivel: ensayos, tasa, tiempoMediano (ms) y sesiones. nivelMasDificil es el de menor tasa con 5 ensayos o más.',
  generalizacion: 'De las palabras que escribió POR PRIMERA VEZ, cuántas armó sin error (total y por nivel): mide si generaliza a palabras nuevas.',
  porHora: 'Tasa por momento del día; solo con al menos dos franjas de 20 ensayos o más.',
  sesiones: 'Sesiones de escritura: inicio, fin, nivel, palabras, aciertosPrimerIntento, fatiga, interrumpida y si el nivel lo eligió el niño.',
  respuestas: 'Una fila por palabra armada: lo mismo que las respuestas de lectura más modo (escritura), unidad (vocal, silaba o palabra), huecos (las cajas), fichas (las piezas y si son distractoras), extras, toques (cada pieza soltada: fichaId, texto, hueco, correcto, ms y forma: arrastre o toque), escuchasPieza (piezas tocadas para oírlas; no son errores), erroresPorHueco, ordenLlenado, primeraVez y conAyudaVisual. Los tiempos están en milisegundos.',
  prueba: 'true si son datos del «perfil de prueba» (modo administrador), no del niño.',
});

export const METODO_ESCRITURA = Object.freeze([
  'Escritura por composición con piezas móviles (sin trazar letras): el niño pone sílabas en cajas, una caja por sílaba (cajas de Elkonin). Es experimental.',
  'Orden de 20 niveles: E01 vocales, E02 sílabas directas, E03 CH, E04 LL, E05 Ñ, E06 QU, E07 GU y GÜ, E08 R y RR, E09 inversas, E10 mixtas, E11 trabadas con L, E12 trabadas con R, E13 TL, E14 diptongos, E15 triptongos, E16 hiatos, E17 palabras, E18 oraciones, E19 textos (una palabra que falta) y E20 dictados (solo audio).',
  'Se muestran las sílabas de la palabra más 0 a 4 que no son (extras); el número sube o baja solo según cómo le va.',
  'Una palabra «al primer intento» es la que se arma sin ninguna pieza equivocada. La ayuda amarilla aparece tras 2 errores en la misma caja y la palabra queda «con ayuda»; el niño nunca pierde.',
  'El error puede verse en rojo suave o solo atenuando la pieza (opción del adulto); el rojo es solo informativo, sin sonido ni vibración. Se puede tocar o arrastrar.',
  'Dominio y repaso espaciado como en la lectura (cajas de Leitner de 1, 2, 4, 8 y 16 días). El nivel sube solo con el 80 % de las palabras dominadas y nunca baja solo.',
]);

/**
 * La sección `escritura` de la exportación. `prueba: true` marca que son los datos del «perfil de prueba» (nunca se mezclan con los del niño).
 * Devuelve null si no hay nada de escritura.
 */
export function construirSeccionEscritura({ perfil, sesiones = [], respuestas = [], hoy = new Date(), prueba = false }) {
  const idPerfil = prueba ? `prueba:${perfil.id}` : null;
  const delPerfil = (r) => (prueba ? r.perfilId === idPerfil : !esDePrueba(r));
  const vivas = (lista) => lista.filter((x) => !x.deleted && delPerfil(x));
  const rsTodas = vivas(respuestas).filter((r) => r.modo === 'escritura' || /^E\d/.test(r.actividad ?? ''));
  const ses = vivas(sesiones).filter((s) => s.tipo === 'escritura');
  if (!rsTodas.length && !ses.length) return null;
  const analisis = analizarEscritura(respuestas, { sesiones, perfilId: idPerfil, hoy });
  return {
    esquema: ESQUEMA_ESCRITURA,
    metodo: METODO_ESCRITURA,
    prueba,
    ajustes: { ...(perfil.ajustes?.escritura ?? {}), automaticos: { nivelEscritura: perfil.ajustes?.automaticos?.nivelEscritura, palabrasEscritura: perfil.ajustes?.automaticos?.palabrasEscritura, silabasExtra: perfil.ajustes?.automaticos?.silabasExtra } },
    ventanaDias: analisis.dias,
    metricasPorPalabra: analisis.palabras,
    silabas: analisis.silabas,
    confusiones: analisis.confusiones,
    posicionDelError: analisis.posicionDelError,
    porNivel: analisis.porNivel,
    nivelMasDificil: analisis.nivelMasDificil,
    generalizacion: analisis.generalizacion,
    porHora: analisis.porHora,
    duracion: analisis.sesiones,
    sesiones: ses.map((s) => ({
      id: s.id, inicio: s.inicio, fin: s.fin, nivel: s.nivel ?? null, palabras: (s.ensayos ?? []).length,
      aciertosPrimerIntento: (s.ensayos ?? []).filter((e) => e.correctoAlPrimerIntento).length,
      fatiga: Boolean(s.fatiga), interrumpida: Boolean(s.interrumpida), nivelElegidoPorNino: Boolean(s.nivelElegidoPorNino),
    })),
    respuestas: rsTodas.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
  };
}

export const PREGUNTA_ESCRITURA = 'Sobre la escritura: dime qué sílabas reforzar y si conviene cambiar el nivel o las sílabas extra.';

/** 3 a 5 líneas de Markdown con lo más importante de la escritura (van dentro del resumen de 4 000 caracteres). */
export function lineasDeEscrituraParaIA(analisis) {
  if (!analisis || !analisis.ensayos) return [];
  const pct = (n) => `${Math.round(n * 100)} %`;
  const lineas = [`Escritura (experimental): ${analisis.ensayos} palabras en los últimos ${analisis.dias} días.`];
  if (analisis.silabasDificiles?.length) lineas.push(`Sílabas que más le cuestan: ${analisis.silabasDificiles.slice(0, 3).map((s) => `${s.texto} (${pct(s.tasa)})`).join(', ')}.`);
  if (analisis.confusiones?.length) lineas.push(`Confunde: ${analisis.confusiones.slice(0, 3).map((c) => `${c.objetivo}→${c.tocada} (${c.veces})`).join(', ')}.`);
  if (analisis.nivelMasDificil) lineas.push(`Nivel más difícil: ${analisis.nivelMasDificil.nivel} (${pct(analisis.nivelMasDificil.tasa)} a la primera).`);
  if (analisis.generalizacion?.total.palabras) lineas.push(`Palabras nuevas armadas bien a la primera: ${analisis.generalizacion.total.aciertos} de ${analisis.generalizacion.total.palabras}.`);
  return lineas;
}

/**
 * Para armar la sesión (como `dificultadesDe` de la lectura): Map elementoId → { indice, confiable, tasa, confusionId }.
 * Una palabra puede estar en dos niveles (el dictado): se queda con el índice más alto.
 */
export function dificultadesDeEscritura(analisis) {
  const mapa = new Map();
  for (const p of analisis.palabras) {
    const actual = mapa.get(p.elementoId);
    if (!actual || p.indice > actual.indice) mapa.set(p.elementoId, { indice: p.indice, confiable: p.confiable, tasa: p.tasa, confusionId: null });
  }
  return mapa;
}

/**
 * Qué hacer con las confusiones de sílabas al armar las piezas de UNA palabra (la prioridad de la fase 14, para las sílabas):
 *  - `evitar`: sílabas que NO deben salir de distractoras, porque se confunden con una de las cajas y esa caja aún falla (< 80 %);
 *  - `incluir`: con >= 80 % en esa caja, su confusión se usa a propósito, UNA sola vez por sesión (`yaUsadas` lo recuerda).
 * @param huecos        sílabas de las cajas de la palabra
 * @param analisis      `analizarEscritura(...)`
 * @param yaUsadas      Set de `objetivo>tocada` ya puestas a propósito en esta sesión (se actualiza aquí)
 */
export function ajustesDeConfusiones({ huecos, analisis, yaUsadas = new Set() }) {
  const tasaDe_ = new Map(analisis.silabas.filter((s) => s.confiable).map((s) => [s.texto, s.tasa]));
  const evitar = [];
  const incluir = [];
  for (const c of analisis.confusiones) {
    if (!huecos.some((h) => minuscula(h) === c.objetivo) || huecos.some((h) => minuscula(h) === c.tocada)) continue;
    const tasa = tasaDe_.get(c.objetivo);
    if (tasa === undefined || tasa < TASA_PARA_USAR_CONFUSION) evitar.push(c.tocada);
    else if (!incluir.length && yaUsadas.size === 0) { // una sola vez por sesión
      incluir.push(c.tocada);
      yaUsadas.add(`${c.objetivo}>${c.tocada}`);
    }
  }
  return { evitar, incluir };
}
