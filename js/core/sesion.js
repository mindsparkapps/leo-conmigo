// Armado y avance de una sesión de práctica (PLAN.md §2 y §4). Lógica pura.
//
// `crearSesion` decide QUÉ ensayos se juegan; la interfaz los dibuja y avisa el
// resultado con `registrarRespuesta`. Un "elemento" es lo que se aprende en la
// actividad (hoy una palabra; en la etapa 2, una frase).
//
// Ensayo: { elementoId, actividad, tipo: 'nueva'|'practica'|'repaso'|'cierre',
//           esFacil, opciones, distractorIds }
//   - opciones = 1 + distractorIds.length. Con 1 sola opción (el niño aún no ha visto
//     ninguna otra palabra) la pantalla muestra solo la tarjeta: "Toca la palabra".

import { barajar } from './azar.js';
import { elegirDistractores } from './distractores.js';
import { normalizarAjustes } from './modelos.js';
import {
  ESTADOS, OPCIONES_MIN, claveDia, diaDeControl, estaAprendida, estaVencido, esNivelFacil, idNivel, idProgreso,
  opcionesEfectivas, tasaAciertoHistorial,
} from './progreso.js';

export const FRACCION_REPASO = 0.3; // ~30 % de los ensayos son repaso de lo ya dominado
export const MAX_EN_PRACTICA = 5; // palabras que se practican a la vez
export const MIN_EN_PRACTICA = 3; // por debajo de esto se introducen palabras nuevas
export const MAX_NUEVAS_POR_SESION = 2;
export const MAX_MISMA_ACTIVIDAD_SEGUIDA = 3;
export const ERRORES_PARA_FATIGA = 3;
export const UMBRAL_ENSAYO_FACIL = 0.6; // tasa de acierto mínima para llamar "fácil" a un ensayo
export const INDICE_DIFICIL = 50; // fase 14: una palabra en práctica con este índice (fase 13) o más recibe un ensayo extra...
export const INDICE_FACIL = 20; // ...y una con menos de este índice cede uno (siempre quedan al menos 1)
export const PRECISION_PARA_CONFUSION = 0.8; // con menos precisión, la confusión de una palabra NO se usa como distractor; con esta o más, sí (una vez por sesión)
export const MAX_CONTROLES_POR_SESION = 1; // repasos de control de palabras aprendidas
const INTENTOS_ORDEN = 120; // intentos al azar para ordenar los ensayos con unos extremos dados
const MAX_PARES_EXTREMOS = 40; // pares (primero, último) que se prueban, de mayor a menor puntaje
const MAX_CIERRES = 3;

// ---------- Orden de los ensayos ----------

/** Cuenta las reglas que se rompen: mismo elemento seguido o más de 3 veces la misma actividad. */
export function violacionesDeOrden(secuencia) {
  let violaciones = 0;
  let racha = 1;
  for (let i = 1; i < secuencia.length; i++) {
    if (secuencia[i].elementoId === secuencia[i - 1].elementoId) violaciones += 1;
    if (secuencia[i].actividad === secuencia[i - 1].actividad) {
      racha += 1;
      if (racha > MAX_MISMA_ACTIVIDAD_SEGUIDA) violaciones += 1;
    } else {
      racha = 1;
    }
  }
  return violaciones;
}

/** Largo de la racha de la misma actividad si `candidato` va justo después de `anterior`. */
function siguienteRacha(anterior, candidato, racha) {
  return candidato.actividad === anterior.actividad ? racha + 1 : 1;
}

/** ¿Puede ir `candidato` justo después de `anterior` sin romper ninguna regla? */
function puedeIrDespues(anterior, candidato, racha) {
  return (
    anterior.elementoId !== candidato.elementoId &&
    siguienteRacha(anterior, candidato, racha) <= MAX_MISMA_ACTIVIDAD_SEGUIDA
  );
}

/** Coloca `primero` al inicio y `ultimo` al final, y ordena el resto sin romper las reglas (si es posible). */
function ordenarEnsayos(primero, medio, ultimo, aleatorio) {
  let mejor = null;
  let menosViolaciones = Infinity;

  for (let intento = 0; intento < INTENTOS_ORDEN; intento++) {
    const pool = barajar(medio, aleatorio);
    const secuencia = [primero];
    let racha = 1;
    while (pool.length) {
      const anterior = secuencia.at(-1);
      const esElUltimoDelMedio = pool.length === 1;
      // Mejor caso: respeta las reglas (y, si es el último del medio, también con el ensayo final).
      let idx = pool.findIndex(
        (c) =>
          puedeIrDespues(anterior, c, racha) &&
          !(esElUltimoDelMedio && ultimo && !puedeIrDespues(c, ultimo, siguienteRacha(anterior, c, racha))),
      );
      // Si no hay, al menos no repetir el mismo elemento; y si tampoco se puede, el primero que quede.
      if (idx === -1) idx = pool.findIndex((c) => anterior.elementoId !== c.elementoId);
      if (idx === -1) idx = 0;
      const elegido = pool.splice(idx, 1)[0];
      racha = siguienteRacha(anterior, elegido, racha);
      secuencia.push(elegido);
    }
    if (ultimo) secuencia.push(ultimo);

    const v = violacionesDeOrden(secuencia);
    if (v < menosViolaciones) {
      menosViolaciones = v;
      mejor = secuencia;
      if (v === 0) break;
    }
  }
  return mejor;
}

/**
 * Elige el primer y el último ensayo (los que mejor sabe el niño) y ordena el resto.
 * Entre los pares de extremos posibles se prefiere el de más puntaje que permita cumplir
 * todas las reglas de orden; si ninguno puede, el que rompe menos reglas.
 * `candidatos`: [{ ensayo, puntaje }]
 */
function ordenarSesion(candidatos, aleatorio) {
  const ranking = barajar(candidatos, aleatorio).sort((a, b) => b.puntaje - a.puntaje);
  if (ranking.length === 1) return { primero: ranking[0], ultimo: null, secuencia: [ranking[0].ensayo] };

  const firma = (c) => `${c.ensayo.elementoId}:${c.ensayo.actividad}`;
  const vistos = new Set();
  const pares = [];
  for (const a of ranking) {
    for (const b of ranking) {
      const clave = `${firma(a)}|${firma(b)}`;
      if (a === b || vistos.has(clave)) continue;
      vistos.add(clave);
      // A igual puntaje, se prefiere que los extremos sean de palabras distintas.
      const mismaPalabra = a.ensayo.elementoId === b.ensayo.elementoId;
      pares.push({ a, b, puntaje: a.puntaje + b.puntaje - (mismaPalabra ? 0.001 : 0) });
    }
  }
  pares.sort((x, y) => y.puntaje - x.puntaje);

  let mejor = null;
  for (const par of pares.slice(0, MAX_PARES_EXTREMOS)) {
    const medio = ranking.filter((c) => c !== par.a && c !== par.b).map((c) => c.ensayo);
    const secuencia = ordenarEnsayos(par.a.ensayo, medio, par.b.ensayo, aleatorio);
    const violaciones = violacionesDeOrden(secuencia);
    if (!mejor || violaciones < mejor.violaciones) mejor = { primero: par.a, ultimo: par.b, secuencia, violaciones };
    if (violaciones === 0) break;
  }
  return mejor;
}

// ---------- Análisis del vocabulario ----------

/**
 * Cada elemento recorre solo las actividades que le corresponden (`puedeHacer`): por ejemplo
 * «misma cosa» exige una foto y un símbolo. Los que no pueden hacer ninguna se descartan.
 */
function analizar({ perfilId, elementos, actividades, mapaProgresos, puedeHacer }) {
  const analizados = elementos.map((elemento) => {
    const lista = actividades.filter((a) => puedeHacer(elemento, a));
    if (!lista.length) return null;
    const progresos = lista.map((a) => mapaProgresos.get(idProgreso(perfilId, elemento.id, a)));
    const indiceActual = progresos.findIndex((p) => p?.estado !== ESTADOS.DOMINADA);
    const vista = progresos.some((p) => p && (p.historial.length > 0 || p.estado === ESTADOS.DOMINADA));
    const ultima = Math.max(
      0,
      ...progresos.flatMap((p) => (p ? p.historial.map((h) => Date.parse(h.fecha) || 0) : [])),
    );
    let categoria = 'practica';
    if (indiceActual === -1) categoria = 'completa';
    else if (indiceActual === 0 && !vista) categoria = 'nueva';
    // «Aprendida»: todas sus actividades de esta etapa dominadas de verdad y un repaso acertado en la caja 5
    const aprendida = categoria === 'completa' && estaAprendida(progresos);
    return { elemento, actividades: lista, progresos, indiceActual, vista, ultima, categoria, aprendida };
  });
  return analizados.filter(Boolean);
}

/**
 * Toma hasta `n` repasos. Siempre se agota primero lo vencido y solo después el resto;
 * dentro de cada grupo se prefiere un repaso por palabra y se repite palabra solo si hace falta.
 */
function tomarRepasos(vencidos, resto, n) {
  const elegidos = [];
  for (const grupo of [vencidos, resto]) {
    const usados = new Set(elegidos.map((p) => p.info.elemento.id));
    for (const par of grupo) {
      if (elegidos.length >= n) break;
      if (usados.has(par.info.elemento.id)) continue;
      elegidos.push(par);
      usados.add(par.info.elemento.id);
    }
    for (const par of grupo) {
      if (elegidos.length >= n) break;
      if (!elegidos.includes(par)) elegidos.push(par);
    }
  }
  return elegidos;
}

/**
 * Prioridad a lo difícil (fase 14): entre las palabras en práctica con datos confiables, las de índice alto reciben
 * un ensayo más y las de índice bajo ceden uno. El total no cambia, ninguna pasa de `tope` ni se queda sin ensayos.
 * Modifica `cuentas` (ensayos de práctica por palabra de `trabajo`).
 */
export function reajustarPorDificultad(trabajo, cuentas, dificultades, tope) {
  const indiceDe = (info) => {
    const d = dificultades.get(info.elemento.id);
    return info.categoria === 'practica' && d?.confiable ? d.indice : null;
  };
  const receptoras = trabajo.map((info, i) => i).filter((i) => (indiceDe(trabajo[i]) ?? -1) >= INDICE_DIFICIL)
    .sort((a, b) => indiceDe(trabajo[b]) - indiceDe(trabajo[a]));
  const donantes = trabajo.map((info, i) => i).filter((i) => indiceDe(trabajo[i]) !== null && indiceDe(trabajo[i]) < INDICE_FACIL)
    .sort((a, b) => indiceDe(trabajo[a]) - indiceDe(trabajo[b]));
  for (const d of donantes) {
    if (cuentas[d] <= 1) continue;
    const r = receptoras.find((i) => cuentas[i] < tope);
    if (r === undefined) break;
    cuentas[d] -= 1;
    cuentas[r] += 1;
  }
  return cuentas;
}

// ---------- Crear la sesión ----------

/**
 * @param perfil        { id, ajustes }
 * @param elementos     palabras (o frases) del perfil, con { id, texto, categoria, orden, activa }
 * @param progresos     registros de progreso del perfil
 * @param niveles       registros de nivel del perfil
 * @param actividades   actividades de la etapa, de la más sencilla a la más difícil (['L1', ..., 'L5'])
 * @param hoy           Date o texto de fecha
 * @param aleatorio     función de azar (inyectable para pruebas)
 * @param puedeHacer    (elemento, actividad) => ¿le corresponde esa actividad? (por defecto, todas)
 * @param puedeSerOpcion (elemento, actividad) => ¿puede aparecer como opción en esa actividad?
 * @param reglasDe      (actividad) => { soloOtraCategoria } reglas extra para elegir distractores
 * @param vistasPrevias Set de ids de elementos que ya cuentan como vistos (pueden ser distractores desde el primer ensayo)
 * @param dificultades  Map elementoId -> { indice, confiable, tasa, confusionId } (análisis de la fase 13; vacío = sin datos)
 */
export function crearSesion({
  perfil, elementos, progresos = [], niveles = [], actividades, hoy = new Date(), aleatorio = Math.random,
  puedeHacer = () => true, puedeSerOpcion = () => true, reglasDe = () => ({}), vistasPrevias = new Set(),
  dificultades = new Map(),
}) {
  const ajustes = normalizarAjustes(perfil.ajustes);
  const total = ajustes.ensayosPorSesion;
  const dia = claveDia(hoy);
  // Las actividades que el adulto apagó se saltan; si apagó todas las de esta etapa, se usan todas
  // (los ajustes valen para varias etapas y no deben dejar una etapa sin nada que hacer).
  const habilitadas = actividades.filter((a) => !ajustes.actividadesHabilitadas || ajustes.actividadesHabilitadas.includes(a));
  const secuenciaActividades = habilitadas.length ? habilitadas : [...actividades];

  const activos = elementos
    .filter((e) => e.activa !== false && !e.deleted)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const mapaProgresos = new Map(progresos.map((p) => [p.id, p]));
  const mapaNiveles = new Map(niveles.map((n) => [n.id, n]));
  const infos = analizar({ perfilId: perfil.id, elementos: activos, actividades: secuenciaActividades, mapaProgresos, puedeHacer });

  const sesionVacia = { perfilId: perfil.id, fecha: dia, ensayos: [], reservaFacil: [], resumen: { repasos: 0, nuevas: 0, practica: 0 } };
  if (!infos.length || !secuenciaActividades.length) return sesionVacia;

  // 1. Palabras en práctica (las más antiguas sin practicar primero) y, si hacen falta, palabras nuevas.
  const enPractica = infos
    .filter((i) => i.categoria === 'practica')
    .sort((a, b) => a.ultima - b.ultima)
    .slice(0, MAX_EN_PRACTICA);
  const maxNuevas = Math.min(MAX_NUEVAS_POR_SESION, ajustes.palabrasNuevasPorSesion);
  const nuevasNecesarias = enPractica.length < MIN_EN_PRACTICA ? Math.min(maxNuevas, MAX_EN_PRACTICA - enPractica.length) : 0;
  const nuevas = infos.filter((i) => i.categoria === 'nueva').slice(0, nuevasNecesarias);
  const trabajo = [...enPractica, ...nuevas];

  // 2. Repasos: primero los vencidos (Leitner); si faltan, dominadas al azar.
  // Las aprendidas no entran en los repasos normales: solo un repaso de control cada 30 días, uno por sesión.
  const pares = [];
  const controles = [];
  for (const info of infos) {
    info.progresos.forEach((progreso, i) => {
      if (progreso?.estado !== ESTADOS.DOMINADA) return;
      const par = { info, actividad: info.actividades[i], progreso };
      if (!info.aprendida) pares.push(par);
      else if (diaDeControl(progreso) <= dia) controles.push(par);
    });
  }
  controles.sort((a, b) => diaDeControl(a.progreso).localeCompare(diaDeControl(b.progreso)));
  const control = controles.slice(0, MAX_CONTROLES_POR_SESION)[0] ?? null;
  const conControl = control ? 1 : 0;
  const vencidos = pares
    .filter((p) => estaVencido(p.progreso, dia))
    .sort((a, b) => (a.progreso.proximoRepaso ?? '').localeCompare(b.progreso.proximoRepaso ?? '') || a.info.ultima - b.info.ultima);
  const restoDeRepasos = barajar(pares.filter((p) => !vencidos.includes(p)), aleatorio);
  const totalRepasosPosibles = vencidos.length + restoDeRepasos.length;

  let nRepasos = Math.min(Math.round(total * FRACCION_REPASO), totalRepasosPosibles + conControl);
  if (trabajo.length === 0) nRepasos = totalRepasosPosibles ? total : conControl; // nada nuevo que practicar: todo es repaso
  else if (conControl && nRepasos === 0) nRepasos = 1; // el control ocupa un lugar aunque no haya otros repasos
  let nPractica = trabajo.length ? total - nRepasos : 0;

  // Reparto de la práctica entre las palabras, de a una por vuelta. Ninguna ocupa más de la
  // mitad de la sesión (si no, no se podría evitar repetirla seguida): lo que sobra se llena
  // con repasos, si los hay.
  const tope = Math.max(1, Math.floor(total / 2));
  const cuentas = trabajo.map(() => 0);
  const repartir = (cantidad, limite) => {
    let repartidas = 0;
    let avanzo = true;
    while (repartidas < cantidad && avanzo) {
      avanzo = false;
      for (let i = 0; i < trabajo.length && repartidas < cantidad; i++) {
        if (cuentas[i] >= limite) continue;
        cuentas[i] += 1;
        repartidas += 1;
        avanzo = true;
      }
    }
    return repartidas;
  };
  let repartidas = repartir(nPractica, tope);
  if (repartidas < nPractica) {
    if (totalRepasosPosibles > 0) nRepasos += nPractica - repartidas;
    else repartidas += repartir(nPractica - repartidas, Infinity); // sin repasos que lo compensen
  }
  nPractica = repartidas;
  reajustarPorDificultad(trabajo, cuentas, dificultades, tope);

  const candidatos = [];
  trabajo.forEach((info, i) => {
    const progreso = info.progresos[info.indiceActual];
    for (let k = 0; k < cuentas[i]; k++) {
      candidatos.push({
        ensayo: {
          elementoId: info.elemento.id,
          actividad: info.actividades[info.indiceActual],
          tipo: info.categoria === 'nueva' ? 'nueva' : 'practica',
        },
        puntaje: info.categoria === 'nueva' ? -1 : tasaAciertoHistorial(progreso?.historial ?? []),
      });
    }
  });
  const usaControl = conControl && nRepasos > 0;
  const repasos = tomarRepasos(vencidos, restoDeRepasos, nRepasos - (usaControl ? 1 : 0));
  for (let i = 0; i < nRepasos; i++) {
    const par = usaControl && i === 0 ? control : repasos[(i - (usaControl ? 1 : 0)) % repasos.length]; // si hay menos pares que ensayos, se repiten en ciclo
    candidatos.push({
      ensayo: { elementoId: par.info.elemento.id, actividad: par.actividad, tipo: 'repaso' },
      puntaje: 10,
    });
  }

  if (candidatos.length === 0) return sesionVacia;

  // 3. Primer y último ensayo: lo que mejor sabe el niño (el éxito abre y cierra la sesión).
  const { primero, ultimo, secuencia } = ordenarSesion(candidatos, aleatorio);
  for (const c of [primero, ultimo]) {
    if (c) c.ensayo.esFacil = c.puntaje >= UMBRAL_ENSAYO_FACIL;
  }
  for (const e of secuencia) e.esFacil = Boolean(e.esFacil);

  // 4. Opciones y distractores (solo con palabras que el niño ya vio).
  // `vistasPrevias`: elementos que el niño ya vio en otra etapa (la etapa 3 parte de palabras que ya conoce)
  const vistas = new Set([...vistasPrevias, ...infos.filter((i) => i.vista).map((i) => i.elemento.id)]);
  const porId = new Map(activos.map((e) => [e.id, e]));
  const confusionesUsadas = new Set();
  const completar = (ensayo, opcionesForzadas = null) => {
    const nivel = mapaNiveles.get(idNivel(perfil.id, ensayo.actividad));
    const deseadas = opcionesForzadas ?? (ensayo.esFacil ? OPCIONES_MIN : opcionesEfectivas(nivel, ajustes.maxOpciones));
    const facil = ensayo.esFacil || deseadas <= OPCIONES_MIN || esNivelFacil(nivel);
    const posibles = activos.filter((p) => puedeSerOpcion(p, ensayo.actividad));
    // Confusiones (fase 14): mientras la palabra no se sepa bien (< 80 %), su confusión más frecuente no se usa de
    // distractor (no se refuerza el error); con 80 % o más se usa a propósito, una vez por sesión, para afinar.
    const dificultad = dificultades.get(ensayo.elementoId);
    const confusionId = !ensayo.esFacil && ensayo.tipo !== 'cierre' && dificultad?.confiable ? dificultad.confusionId : null;
    let excluirIds = [];
    let incluirIds = [];
    if (confusionId) {
      if (dificultad.tasa < PRECISION_PARA_CONFUSION) excluirIds = [confusionId];
      else if (!confusionesUsadas.has(ensayo.elementoId) && deseadas > 1 && vistas.has(confusionId) && posibles.some((p) => p.id === confusionId)) {
        incluirIds = [confusionId];
        confusionesUsadas.add(ensayo.elementoId);
      }
    }
    const distractores = elegirDistractores(
      porId.get(ensayo.elementoId),
      posibles,
      { cantidad: deseadas - 1, facil, vistas, aleatorio, excluirIds, incluirIds, ...reglasDe(ensayo.actividad) },
    );
    ensayo.distractorIds = distractores.map((d) => d.id);
    ensayo.opciones = 1 + ensayo.distractorIds.length;
    vistas.add(ensayo.elementoId); // desde este ensayo el niño ya vio la palabra
    return ensayo;
  };
  secuencia.forEach((e) => completar(e));

  // 5. Reserva para la regla de fatiga: lo más fácil que sabe el niño, con 2 opciones.
  const reservaFacil = infos
    .map((info) => {
      const iDominada = info.progresos.findIndex((p) => p?.estado === ESTADOS.DOMINADA);
      if (iDominada !== -1) return { info, actividad: info.actividades[iDominada], puntaje: 10 + aleatorio() };
      const progreso = info.progresos[info.indiceActual];
      if (info.categoria === 'practica' && progreso?.historial.length) {
        return { info, actividad: info.actividades[info.indiceActual], puntaje: tasaAciertoHistorial(progreso.historial) };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, MAX_CIERRES)
    .map((c) => completar({ elementoId: c.info.elemento.id, actividad: c.actividad, tipo: 'cierre', esFacil: true }, OPCIONES_MIN));

  return {
    perfilId: perfil.id,
    fecha: dia,
    ensayos: secuencia,
    reservaFacil,
    resumen: { repasos: nRepasos, nuevas: nuevas.length, practica: nPractica },
  };
}

// ---------- Avance de la sesión ----------

export function iniciarCurso(plan) {
  return { plan, indice: 0, resultados: [], fatiga: false, cierre: null, terminada: plan.ensayos.length === 0 };
}

export function ensayoActual(estado) {
  if (estado.terminada) return null;
  return estado.cierre ?? estado.plan.ensayos[estado.indice] ?? null;
}

/** Errores seguidos al final. «Leo en voz alta» (L6) lo decide el adulto y no cuenta para el cansancio. */
function erroresSeguidos(resultados) {
  let n = 0;
  for (let i = resultados.length - 1; i >= 0; i--) {
    if (resultados[i].tipo === 'lectura') continue;
    if (resultados[i].correctoAlPrimerIntento) break;
    n += 1;
  }
  return n;
}

/**
 * Registra la respuesta al ensayo actual y devuelve el nuevo estado.
 * Fatiga: con 3 errores seguidos, el siguiente ensayo es uno muy fácil (algo ya dominado,
 * 2 opciones) y la sesión termina al completarlo.
 * `resultado`: { correctoAlPrimerIntento, intentos, ms }
 */
export function registrarRespuesta(estado, resultado) {
  if (estado.terminada) return estado;
  const ensayo = ensayoActual(estado);
  const resultados = [
    ...estado.resultados,
    {
      elementoId: ensayo.elementoId,
      actividad: ensayo.actividad,
      tipo: ensayo.tipo,
      esFacil: ensayo.esFacil,
      correctoAlPrimerIntento: Boolean(resultado.correctoAlPrimerIntento),
      intentos: resultado.intentos ?? 1,
      ms: resultado.ms ?? null,
    },
  ];

  if (estado.cierre) return { ...estado, resultados, terminada: true };

  const indice = estado.indice + 1;
  if (!estado.fatiga && erroresSeguidos(resultados) >= ERRORES_PARA_FATIGA) {
    const reserva = estado.plan.reservaFacil;
    const cierre = reserva.find((r) => r.elementoId !== ensayo.elementoId) ?? reserva[0] ?? null;
    return { ...estado, resultados, indice, fatiga: true, cierre, terminada: cierre === null };
  }
  return { ...estado, resultados, indice, terminada: indice >= estado.plan.ensayos.length };
}

/** Datos para guardar la sesión terminada (el almacén le pone `id` y `updatedAt`). */
export function construirRegistroSesion(estado, { perfilId, inicio, fin }) {
  return {
    perfilId,
    inicio: inicio instanceof Date ? inicio.toISOString() : inicio,
    fin: fin instanceof Date ? fin.toISOString() : fin,
    fatiga: estado.fatiga,
    ensayos: estado.resultados.map((r) => ({ ...r })),
  };
}

export function resumenDeSesion(estado) {
  const total = estado.resultados.length;
  const aciertos = estado.resultados.filter((r) => r.correctoAlPrimerIntento).length;
  return { total, aciertosPrimerIntento: aciertos, conAyuda: total - aciertos, fatiga: estado.fatiga };
}
