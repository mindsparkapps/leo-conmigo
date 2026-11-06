// Análisis de las respuestas registradas (PLAN.md, fase 13): qué le cuesta al niño, qué le sale fácil, con qué
// palabras se confunde y dónde se traba. Lógica pura: lee los registros del almacén `respuestas` (fase 12) y NO
// recalcula tiempos ni errores. Todo se compara contra el propio niño, nunca contra otros niños.
//
// Las constantes están arriba para poder afinarlas.

import { claveDia, sumarDias } from './progreso.js';

export const DIAS_VENTANA = 60; // solo cuentan las respuestas de los últimos 60 días
export const MIN_ENSAYOS = 5; // con menos ensayos, «pocos datos» (no confiable)
export const PESO_ERROR = 0.6; // peso de (1 − tasa de acierto sin ayuda) en el índice
export const PESO_TIEMPO = 0.25; // peso del tiempo relativo (más lento que su propio promedio)
export const PESO_AUDIO = 0.15; // peso de las veces que pidió oír otra vez
export const UMBRAL_TENDENCIA = 0.2; // diferencia de tasa entre los últimos 5 ensayos y los 5 anteriores
export const ENSAYOS_TENDENCIA = 5;
export const MIN_ANTERIORES_TENDENCIA = 3; // hacen falta al menos 3 ensayos anteriores para comparar
export const INDICE_PARA_REPETIR = 50;
export const DIAS_REPASO_FALLADO = 7;
export const TAMANO_LISTA = 5;
export const MIN_POR_FRANJA = 20; // ensayos mínimos en una franja del día para mostrarla
export const MIN_CONFUSION = 2; // veces mínimas para llamar «confusión» a un par
export const ACTIVIDADES_SIN_ANALISIS = ['L6']; // «Leo en voz alta» no es un acierto/error del niño
export const TIPOS_SIN_ANALISIS = ['lectura', 'cuento']; // las preguntas de los cuentos tampoco mueven nada

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
const redondear = (n, decimales = 2) => (n == null ? null : Math.round(n * 10 ** decimales) / 10 ** decimales);

export function mediana(numeros) {
  const v = numeros.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mitad = Math.floor(v.length / 2);
  return v.length % 2 ? v[mitad] : (v[mitad - 1] + v[mitad]) / 2;
}

/**
 * Respuestas que cuentan para el análisis: sin las `esFacil`, sin L6 ni preguntas de cuentos, sin las borradas
 * y (si se pide) solo las de los últimos `dias` días. Orden cronológico.
 */
export function respuestasAnalizables(respuestas, { hoy = new Date(), dias = DIAS_VENTANA } = {}) {
  const desde = dias == null ? null : sumarDias(claveDia(hoy), -dias);
  return respuestas
    .filter((r) => !r.deleted && !r.esFacil && !ACTIVIDADES_SIN_ANALISIS.includes(r.actividad) && !TIPOS_SIN_ANALISIS.includes(r.tipo))
    .filter((r) => desde === null || (r.dia ?? '') >= desde)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

const tasaDe = (rs) => (rs.length ? rs.filter((r) => r.correctoAlPrimerIntento).length / rs.length : null);
const tiempoValido = (r) => r.correctoAlPrimerIntento && !r.distraido && Number.isFinite(r.msAcierto);

/** Mediana de `msAcierto` del niño en cada actividad (aciertos al primer intento, sin distraídos). */
export function medianaPorActividad(rs) {
  const porActividad = new Map();
  for (const r of rs.filter(tiempoValido)) {
    if (!porActividad.has(r.actividad)) porActividad.set(r.actividad, []);
    porActividad.get(r.actividad).push(r.msAcierto);
  }
  return new Map([...porActividad].map(([actividad, tiempos]) => [actividad, mediana(tiempos)]));
}

export function tendenciaDe(rs) {
  const ultimos = rs.slice(-ENSAYOS_TENDENCIA);
  const anteriores = rs.slice(-2 * ENSAYOS_TENDENCIA, -ENSAYOS_TENDENCIA);
  if (ultimos.length < ENSAYOS_TENDENCIA || anteriores.length < MIN_ANTERIORES_TENDENCIA) return 'igual';
  const diferencia = redondear(tasaDe(ultimos) - tasaDe(anteriores), 3);
  if (diferencia >= UMBRAL_TENDENCIA) return 'mejora';
  if (diferencia <= -UMBRAL_TENDENCIA) return 'empeora';
  return 'igual';
}

/** Índice de dificultad de 0 (le sale solo) a 100 (le cuesta mucho). */
export function indiceDeDificultad({ tasa, tiempoRelativo, audioPorEnsayo }) {
  const lento = tiempoRelativo == null ? 0 : limitar((tiempoRelativo - 1) / 2, 0, 1);
  const audio = limitar((audioPorEnsayo ?? 0) / 2, 0, 1);
  return Math.round(100 * (PESO_ERROR * (1 - tasa) + PESO_TIEMPO * lento + PESO_AUDIO * audio));
}

/** Métricas de cada palabra (o frase) practicada. `rs` = respuestas ya filtradas con `respuestasAnalizables`. */
export function metricasPorPalabra(rs, { hoy = new Date() } = {}) {
  const medianas = medianaPorActividad(rs);
  const limiteRepaso = sumarDias(claveDia(hoy), -DIAS_REPASO_FALLADO);
  const porElemento = new Map();
  for (const r of rs) {
    if (!porElemento.has(r.elementoId)) porElemento.set(r.elementoId, []);
    porElemento.get(r.elementoId).push(r);
  }

  const lista = [];
  for (const [elementoId, propias] of porElemento) {
    const ultimo = propias[propias.length - 1];
    const aciertos = propias.filter((r) => r.correctoAlPrimerIntento).length;
    const tasa = aciertos / propias.length;
    const validos = propias.filter(tiempoValido);
    const razones = validos.filter((r) => medianas.get(r.actividad)).map((r) => r.msAcierto / medianas.get(r.actividad));
    const tiempoMediano = mediana(validos.map((r) => r.msAcierto));
    const tiempoRelativo = mediana(razones);
    const audioPorEnsayo = propias.reduce((s, r) => s + (r.repeticionesAudio ?? 0), 0) / propias.length;
    lista.push({
      elementoId,
      texto: ultimo.texto,
      esFrase: Boolean(ultimo.esFrase),
      ensayos: propias.length,
      aciertosPrimerIntento: aciertos,
      tasa,
      errores: propias.reduce((s, r) => s + (r.errores?.length ?? 0), 0),
      tiempoMediano: tiempoMediano == null ? null : Math.round(tiempoMediano),
      tiempoRelativo: redondear(tiempoRelativo),
      audioPorEnsayo: redondear(audioPorEnsayo),
      tendencia: tendenciaDe(propias),
      dias: new Set(propias.map((r) => r.dia)).size,
      ultimaVez: ultimo.fecha,
      indice: indiceDeDificultad({ tasa, tiempoRelativo, audioPorEnsayo }),
      confiable: propias.length >= MIN_ENSAYOS,
      falloRepasoReciente: propias.some((r) => r.tipo === 'repaso' && !r.correctoAlPrimerIntento && (r.dia ?? '') >= limiteRepaso),
    });
  }
  return lista.sort((a, b) => b.indice - a.indice || a.texto.localeCompare(b.texto, 'es'));
}

/** Pares (palabra objetivo → opción tocada por error), de más a menos frecuentes. */
export function confusionesFrecuentes(respuestas, { minimo = MIN_CONFUSION, hoy = new Date(), dias = DIAS_VENTANA } = {}) {
  const pares = new Map();
  for (const r of respuestasAnalizables(respuestas, { hoy, dias })) {
    for (const e of r.errores ?? []) {
      if (!e.id || e.id === r.elementoId || !e.texto) continue;
      const clave = `${r.elementoId}>${e.id}`;
      const par = pares.get(clave) ?? { objetivoId: r.elementoId, objetivo: r.texto, tocadaId: e.id, tocada: e.texto, veces: 0 };
      par.veces += 1;
      pares.set(clave, par);
    }
  }
  return [...pares.values()]
    .filter((p) => p.veces >= minimo)
    .sort((a, b) => b.veces - a.veces || a.objetivo.localeCompare(b.objetivo, 'es') || a.tocada.localeCompare(b.tocada, 'es'));
}

/** Tasa y tiempo mediano por actividad (L1–L5, S1–S4…): dónde se traba. */
export function resumenPorActividad(rs) {
  const grupos = new Map();
  for (const r of rs) {
    if (!grupos.has(r.actividad)) grupos.set(r.actividad, []);
    grupos.get(r.actividad).push(r);
  }
  return [...grupos]
    .map(([actividad, propias]) => ({
      actividad,
      ensayos: propias.length,
      tasa: tasaDe(propias),
      tiempoMediano: Math.round(mediana(propias.filter(tiempoValido).map((r) => r.msAcierto)) ?? 0) || null,
    }))
    .sort((a, b) => a.actividad.localeCompare(b.actividad));
}

/** La actividad con menor tasa (entre las que tienen datos suficientes). Empate: la más lenta. */
export function actividadMasDificil(porActividad) {
  const candidatas = porActividad.filter((a) => a.ensayos >= MIN_ENSAYOS);
  if (!candidatas.length) return null;
  return [...candidatas].sort((a, b) => a.tasa - b.tasa || (b.tiempoMediano ?? 0) - (a.tiempoMediano ?? 0))[0];
}

export const FRANJAS = [
  { id: 'manana', nombre: 'mañana', desde: 5, hasta: 12 },
  { id: 'tarde', nombre: 'tarde', desde: 12, hasta: 19 },
  { id: 'noche', nombre: 'noche', desde: 19, hasta: 29 }, // 19:00 a 04:59
];
const franjaDe = (hora) => FRANJAS.find((f) => (hora >= f.desde && hora < f.hasta) || (hora + 24 >= f.desde && hora + 24 < f.hasta));

/** Tasa por franja del día, solo con las franjas que tienen datos suficientes y solo si hay al menos dos. */
export function resumenPorHora(rs) {
  const grupos = new Map();
  for (const r of rs) {
    if (!Number.isFinite(r.hora)) continue;
    const franja = franjaDe(r.hora);
    if (!grupos.has(franja.id)) grupos.set(franja.id, []);
    grupos.get(franja.id).push(r);
  }
  const lista = FRANJAS.filter((f) => (grupos.get(f.id)?.length ?? 0) >= MIN_POR_FRANJA).map((f) => ({
    franja: f.id,
    nombre: f.nombre,
    ensayos: grupos.get(f.id).length,
    tasa: tasaDe(grupos.get(f.id)),
  }));
  return lista.length >= 2 ? lista : [];
}

const porMasDificil = (a, b) => b.indice - a.indice || a.texto.localeCompare(b.texto, 'es');
const porMasFacil = (a, b) => a.indice - b.indice || b.tasa - a.tasa || (a.tiempoMediano ?? 0) - (b.tiempoMediano ?? 0) || a.texto.localeCompare(b.texto, 'es');

/** Todo el análisis de una vez. `respuestas` = las del niño, sin filtrar. */
export function analizar(respuestas, { hoy = new Date(), dias = DIAS_VENTANA } = {}) {
  const rs = respuestasAnalizables(respuestas, { hoy, dias });
  const palabras = metricasPorPalabra(rs, { hoy });
  const confiables = palabras.filter((p) => p.confiable);
  const masDificiles = confiables.filter((p) => p.indice > 0).sort(porMasDificil).slice(0, TAMANO_LISTA);
  const idsDificiles = new Set(masDificiles.map((p) => p.elementoId));
  const masFaciles = confiables.filter((p) => !idsDificiles.has(p.elementoId)).sort(porMasFacil).slice(0, TAMANO_LISTA);
  const paraRepetirMas = palabras
    .filter((p) => (p.confiable && p.indice >= INDICE_PARA_REPETIR) || p.tendencia === 'empeora' || p.falloRepasoReciente)
    .sort(porMasDificil);
  const porActividad = resumenPorActividad(rs);
  return {
    dias,
    ensayos: rs.length,
    palabras,
    masDificiles,
    masFaciles,
    paraRepetirMas,
    confusiones: confusionesFrecuentes(respuestas, { hoy, dias }),
    porActividad,
    actividadMasDificil: actividadMasDificil(porActividad),
    porHora: resumenPorHora(rs),
    // Sin al menos una palabra con datos suficientes no se muestran listas vacías: se explica.
    hayDatos: confiables.length > 0,
  };
}

/**
 * Para armar la sesión (fase 14): Map elementoId -> { indice, confiable, tasa, confusionId }, con la confusión más
 * frecuente de cada palabra (la que más veces tocó por error al pedírsela).
 */
export function dificultadesDe(analisis) {
  const confusionDe = new Map();
  for (const c of analisis.confusiones) if (!confusionDe.has(c.objetivoId)) confusionDe.set(c.objetivoId, c.tocadaId); // ya vienen de más a menos
  return new Map(analisis.palabras.map((p) => [p.elementoId, {
    indice: p.indice, confiable: p.confiable, tasa: p.tasa, confusionId: confusionDe.get(p.elementoId) ?? null,
  }]));
}

// ---------- exportar para analizar con una IA ----------

export const ESQUEMA = Object.freeze({
  perfil: 'Datos del niño: nombre de pila (o «el niño»), edad en años si se conoce, etapa actual y ajustes de la app.',
  metodo: 'Resumen del método pedagógico y de las reglas de la app.',
  metricasPorPalabra:
    'Una fila por palabra o frase de los últimos 60 días: ensayos, aciertosPrimerIntento, tasa (0 a 1, acierto sin ayuda), errores, tiempoMediano (ms, solo aciertos al primer intento y sin distracciones), tiempoRelativo (1 = su propio promedio en esa actividad; mayor es más lento), audioPorEnsayo (veces que pidió oír otra vez), tendencia (mejora, igual o empeora: últimos 5 ensayos contra los 5 anteriores), dias practicados, ultimaVez, indice (dificultad de 0 a 100), confiable (false si hay menos de 5 ensayos) y falloRepasoReciente.',
  confusiones: 'Pares de palabras que confunde: objetivo (la palabra pedida), tocada (la que tocó por error) y veces.',
  porActividad: 'Por actividad (L1 a L5, S1 a S4, F1 a F3, P1 a P3): ensayos, tasa y tiempoMediano en ms.',
  porHora: 'Tasa de acierto sin ayuda por momento del día (mañana, tarde, noche); solo aparece si hay al menos dos franjas con 20 ensayos o más.',
  ventanaDias: 'Cuántos días atrás miran metricasPorPalabra, confusiones, porActividad y porHora. Las respuestas traen todo el historial.',
  sesiones: 'Cada sesión de práctica: inicio, fin, ensayos y si terminó antes por cansancio (fatiga).',
  respuestas:
    'Una fila por ensayo terminado, todas las registradas: fecha, dia, hora, diaSemana, numeroEnSesion, elementoId, texto, esFrase, categoria, silabas, etapa, actividad, tipo (nueva, practica, repaso), esFacil (ensayo fácil de relleno), opciones (las que se mostraron y su orden), posicionCorrecta, nivelOpciones, correctoAlPrimerIntento, intentos, errores (opción tocada por error y ms desde el inicio), msPrimerToque (cuánto dudó), msAcierto, distraido (más de 60 s), repeticionesAudio, conAyudaVisual, estadoAntes/estadoDespues, cajaLeitnerAntes/cajaLeitnerDespues (repaso espaciado 1, 2, 4, 8, 16 días), fatigaActiva y, en secuencias, ordenEsperado y toques. Todos los tiempos están en milisegundos.',
});

export const METODO = Object.freeze([
  'Método de lectura global (palabras completas) para un niño con síndrome de Down: primero reconoce la palabra entera y después se llega a las sílabas.',
  'Aprendizaje sin error: si se equivoca, la respuesta correcta se ilumina y se repite sola; nunca se le dice «mal».',
  'Una palabra queda «dominada» en una actividad con 4 de 5 aciertos al primer intento en al menos 2 días distintos.',
  'Las palabras dominadas se repasan con cajas de Leitner de 1, 2, 4, 8 y 16 días; hay como máximo 2 palabras nuevas por sesión.',
  'La app se adapta al niño: compara los tiempos con su propio promedio, nunca con otros niños, y el tiempo no se le muestra ni se usa para juzgarlo.',
]);

const REEMPLAZO_NOMBRE = 'el niño';

function edadEnAnios(fechaNacimiento, hoy) {
  if (!fechaNacimiento) return null;
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fechaNacimiento)); // 'AAAA-MM-DD' se lee como fecha local
  const nacimiento = partes ? new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])) : new Date(fechaNacimiento);
  if (Number.isNaN(nacimiento.getTime())) return null;
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const aunNoCumple = hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (aunNoCumple) edad -= 1;
  return edad >= 0 ? edad : null;
}

const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Cambia el nombre del niño (con o sin tildes y mayúsculas) por «el niño» en cualquier texto del objeto. */
export function ocultarNombreEn(objeto, nombre) {
  const completo = String(nombre ?? '').trim();
  if (!completo) return objeto;
  const partes = [completo, completo.split(/\s+/)[0]].filter(Boolean).sort((a, b) => b.length - a.length);
  const patron = new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...new Set(partes)].map(escaparRegex).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  return JSON.parse(JSON.stringify(objeto).replace(patron, REEMPLAZO_NOMBRE));
}

/**
 * Lo que se descarga para analizar con una IA: sin fotos ni audios (solo ids de palabras y textos).
 * @param perfil, sesiones, respuestas   registros del niño tal como están en el almacén
 */
export function construirExportacion({ perfil, sesiones = [], respuestas = [], hoy = new Date(), ocultarNombre = false, version = null }) {
  const analisis = analizar(respuestas, { hoy });
  const vivas = (lista) => lista.filter((x) => !x.deleted);
  const exportacion = {
    esquema: ESQUEMA,
    metodo: METODO,
    generado: hoy.toISOString(),
    versionApp: version,
    perfil: {
      nombre: String(perfil.nombre ?? '').trim().split(/\s+/)[0] || REEMPLAZO_NOMBRE,
      edad: edadEnAnios(perfil.fechaNacimiento, hoy),
      etapaActual: perfil.etapaActual ?? 1,
      ajustes: perfil.ajustes ?? {},
    },
    ventanaDias: analisis.dias,
    metricasPorPalabra: analisis.palabras,
    confusiones: analisis.confusiones,
    porActividad: analisis.porActividad,
    porHora: analisis.porHora,
    sesiones: vivas(sesiones).map(({ id, inicio, fin, fatiga, ensayos }) => ({
      id, inicio, fin, fatiga: Boolean(fatiga), ensayos: (ensayos ?? []).length,
      aciertosPrimerIntento: (ensayos ?? []).filter((e) => e.correctoAlPrimerIntento).length,
    })),
    respuestas: vivas(respuestas).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
  };
  return ocultarNombre ? ocultarNombreEn(exportacion, perfil.nombre) : exportacion;
}

export function nombreDeArchivoAnalisis(perfil, hoy = new Date(), ocultarNombre = false) {
  const base = ocultarNombre ? 'nino' : String(perfil.nombre ?? 'nino').trim().split(/\s+/)[0];
  const limpio = base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'nino';
  return `leo-conmigo-analisis-${limpio}-${claveDia(hoy)}.json`;
}

export const PREGUNTA_PARA_IA =
  'Eres especialista en lectura para niños con síndrome de Down (método Troncoso). Con estos datos, dime qué palabras reforzar, qué confusiones trabajar y si conviene cambiar algo de los ajustes.';

export const LIMITE_RESUMEN = 4000;

const segundos = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`);
const porciento = (n) => `${Math.round(n * 100)} %`;
const FLECHA = { mejora: '↑ mejora', igual: '→ igual', empeora: '↓ empeora' };

/** Resumen corto en Markdown (hasta 4 000 caracteres) listo para pegar en un chat con una IA. */
export function resumenParaIA({ perfil, analisis, hoy = new Date(), ocultarNombre = false }) {
  const nombre = ocultarNombre ? REEMPLAZO_NOMBRE : String(perfil.nombre ?? '').trim().split(/\s+/)[0] || REEMPLAZO_NOMBRE;
  const edad = edadEnAnios(perfil.fechaNacimiento, hoy);
  const fila = (p) => `- ${p.texto}: índice ${p.indice}/100, ${porciento(p.tasa)} sin ayuda en ${p.ensayos} ensayos, ${segundos(p.tiempoMediano)}, ${FLECHA[p.tendencia]}`;

  const armar = (n) => {
    const partes = [
      `# Datos de lectura ${ocultarNombre ? 'del niño' : `de ${nombre}`}`,
      `Últimos ${analisis.dias} días (${analisis.ensayos} ensayos).${edad != null ? ` Edad: ${edad} años.` : ''} Etapa actual: ${perfil.etapaActual ?? 1}. Ajustes: ${perfil.ajustes?.ensayosPorSesion ?? '?'} ensayos por sesión, hasta ${perfil.ajustes?.maxOpciones ?? '?'} opciones.`,
      'El índice va de 0 (le sale solo) a 100 (le cuesta mucho). Los tiempos se comparan con su propio promedio.',
      '',
      '## Le cuestan más',
      ...(analisis.masDificiles.length ? analisis.masDificiles.slice(0, n).map(fila) : ['- (sin datos suficientes)']),
      '',
      '## Le salen fácil',
      ...(analisis.masFaciles.length ? analisis.masFaciles.slice(0, n).map(fila) : ['- (sin datos suficientes)']),
      '',
      '## Para repetir más',
      ...(analisis.paraRepetirMas.length ? analisis.paraRepetirMas.slice(0, n).map((p) => `- ${p.texto} (${FLECHA[p.tendencia]}${p.falloRepasoReciente ? ', falló un repaso reciente' : ''})`) : ['- (ninguna)']),
      '',
      '## Se confunde entre',
      ...(analisis.confusiones.length ? analisis.confusiones.slice(0, n).map((c) => `- ${c.objetivo} ↔ ${c.tocada}: ${c.veces} veces`) : ['- (sin confusiones repetidas)']),
      '',
      '## Por actividad',
      ...(analisis.porActividad.length ? analisis.porActividad.map((a) => `- ${a.actividad}: ${porciento(a.tasa)} sin ayuda, ${segundos(a.tiempoMediano)}, ${a.ensayos} ensayos`) : ['- (sin datos)']),
      ...(analisis.actividadMasDificil ? [`La que más le cuesta: ${analisis.actividadMasDificil.actividad}.`] : []),
      ...(analisis.porHora.length ? ['', '## Por momento del día', ...analisis.porHora.map((h) => `- ${h.nombre}: ${porciento(h.tasa)} sin ayuda en ${h.ensayos} ensayos`)] : []),
      '',
      '## Pregunta',
      PREGUNTA_PARA_IA,
    ];
    return partes.join('\n');
  };

  for (let n = TAMANO_LISTA; n >= 1; n -= 1) {
    const texto = armar(n);
    if (texto.length <= LIMITE_RESUMEN) return texto;
  }
  return armar(1).slice(0, LIMITE_RESUMEN);
}
