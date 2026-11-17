// Ajustes que se adaptan solos (PLAN.md, fase 14). Lógica pura: al terminar una sesión se miran las últimas 3 y se
// decide si conviene cambiar algún ajuste. Cada ajuste cambia como máximo una vez por día, solo si el adulto lo dejó
// en «Automático», y cada cambio queda anotado en `perfil.cambiosAutomaticos` para avisarle y poder deshacerlo.
// El niño nunca ve nada de esto y nada cambia a mitad de una sesión.
//
// Las constantes están arriba para poder afinarlas.

import { normalizarAjustes } from './modelos.js';
import { ESTADOS, OPCIONES_MAX, VENTANA_NIVEL, claveDia, precision } from './progreso.js';
import { mediana } from './analisis.js';
import { esDeEscritura } from './escritura/comun.js';
import { esIdDePrueba } from './curso.js';
import { siguienteNivelAbierto, nivelesDisponibles } from './escritura/elementos.js';

export const SESIONES_A_MIRAR = 3;
export const MAX_CAMBIOS_GUARDADOS = 30;

// Ensayos por sesión
export const PASO_ENSAYOS = 2;
export const MAX_ENSAYOS_AUTOMATICO = 12;
export const MIN_ENSAYOS_AUTOMATICO = 4;
export const ACIERTOS_PARA_SUBIR = 0.8; // aciertos al primer intento de las últimas 3 sesiones
export const MINUTOS_PARA_SUBIR = 8; // duración mediana por debajo de la cual se puede subir
export const MINUTOS_PARA_BAJAR = 12; // duración mediana por encima de la cual se baja
export const FATIGAS_PARA_BAJAR = 2; // sesiones con cansancio (de las últimas 3)

// Máximo de opciones
export const PRECISION_PARA_MAS_OPCIONES = 0.85;

// Palabras nuevas por sesión (según el índice de dificultad de las palabras en práctica)
export const INDICE_PARA_UNA_NUEVA = 50;
export const INDICE_PARA_DOS_NUEVAS = 30;

// Etapa
export const PROPORCION_PARA_SUBIR_ETAPA = 0.8;
export const PRECISION_PARA_SUGERIR_BAJAR = 0.5;

// Escritura (Ampliación 5): lo que mira y cuándo cambia (se mide en sesiones de escritura, nunca en las de lectura)
export const PASO_PALABRAS_ESCRITURA = 1;
export const MAX_PALABRAS_AUTOMATICO = 10; // el tope del adulto es 12; solo él lo pasa de 10
export const MIN_PALABRAS_AUTOMATICO = 4;
export const MINUTOS_ESCRITURA_SUBIR = 10; // una palabra tarda más en escribirse que un ensayo de lectura
export const MINUTOS_ESCRITURA_BAJAR = 15;
export const PROPORCION_PARA_SUBIR_NIVEL = 0.8; // palabras del nivel dominadas o aprendidas
export const MIN_PALABRAS_PARA_SUBIR_NIVEL = 4; // con menos palabras en el nivel no se sube solo
export const SESIONES_PARA_SUGERIR = 3; // sesiones del mismo nivel con < 50 % → solo una sugerencia

const NOMBRES = {
  ensayosPorSesion: 'ensayos por sesión',
  maxOpciones: 'máximo de opciones',
  palabrasNuevas: 'palabras nuevas por sesión',
  etapa: 'etapa',
  nivelEscritura: 'nivel de escritura',
  palabrasEscritura: 'palabras por sesión de escritura',
};
export const nombreDeAjuste = (ajuste) => NOMBRES[ajuste] ?? ajuste;

const minutosDe = (s) => {
  const ms = Date.parse(s.fin) - Date.parse(s.inicio);
  return Number.isFinite(ms) ? ms / 60000 : null;
};

/**
 * Las últimas `n` sesiones (más reciente primero), sin las borradas. Las de lectura y las de escritura no se mezclan: por defecto
 * solo cuentan las de lectura; con `{ escritura: true }`, solo las de escritura.
 */
export function ultimasSesiones(sesiones, n = SESIONES_A_MIRAR, { escritura = false } = {}) {
  return sesiones
    .filter((s) => !s.deleted && esDeEscritura(s) === escritura)
    .sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)))
    .slice(0, n);
}

/** Aciertos al primer intento de varias sesiones (sin «leo en voz alta», que decide el adulto). null si no hubo ensayos. */
function precisionDeSesiones(sesiones) {
  const ensayos = sesiones.flatMap((s) => (s.ensayos ?? []).filter((e) => e.tipo !== 'lectura'));
  return ensayos.length ? ensayos.filter((e) => e.correctoAlPrimerIntento).length / ensayos.length : null;
}

/**
 * @param perfil               perfil con sus ajustes
 * @param sesiones             las sesiones del niño (la que acaba de terminar ya guardada)
 * @param niveles              niveles por actividad
 * @param indicesEnPractica    índice de dificultad (fase 13) de las palabras que están en práctica con datos confiables
 * @param proporcionEtapa      proporción de las palabras activas de la etapa actual que están dominadas o aprendidas (null si no se sabe)
 * @param etapaSiguienteAbierta  ¿está abierta y hecha la etapa que sigue a la actual?
 * @param hoy                  Date
 * @returns { perfil, cambios }  `perfil` ya con los ajustes cambiados y los avisos anotados; `cambios` solo lo nuevo
 */
export function evaluarAutoajuste({
  perfil, sesiones = [], niveles = [], indicesEnPractica = [], proporcionEtapa = null, etapaSiguienteAbierta = false, hoy = new Date(),
}) {
  const ajustes = normalizarAjustes(perfil.ajustes);
  const auto = ajustes.automaticos;
  const dia = claveDia(hoy);
  const previos = perfil.cambiosAutomaticos ?? [];
  const yaCambioHoy = (ajuste) => previos.some((c) => c.ajuste === ajuste && !c.sugerencia && c.dia === dia);
  const ultimas = ultimasSesiones(sesiones);
  const nuevos = { ...ajustes };
  let etapaActual = perfil.etapaActual ?? 1;
  const cambios = [];
  const anotar = (ajuste, antes, despues, motivo, extra = {}) =>
    cambios.push({ fecha: hoy.toISOString(), dia, ajuste, antes, despues, motivo, visto: false, ...extra });

  if (ultimas.length >= SESIONES_A_MIRAR) {
    const duraciones = ultimas.map(minutosDe).filter((m) => m !== null);
    const duracion = mediana(duraciones);
    const fatigas = ultimas.filter((s) => s.fatiga).length;
    const interrumpidas = ultimas.filter((s) => s.interrumpida).length;
    const aciertos = precisionDeSesiones(ultimas);

    // ---- ensayos por sesión ----
    if (auto.ensayosPorSesion && !yaCambioHoy('ensayosPorSesion')) {
      const actual = ajustes.ensayosPorSesion;
      let motivo = null;
      let nuevo = actual;
      if (actual > MIN_ENSAYOS_AUTOMATICO && (fatigas >= FATIGAS_PARA_BAJAR || (duracion ?? 0) > MINUTOS_PARA_BAJAR || interrumpidas > 0)) {
        nuevo = Math.max(MIN_ENSAYOS_AUTOMATICO, actual - PASO_ENSAYOS);
        motivo = fatigas >= FATIGAS_PARA_BAJAR
          ? `se cansó en ${fatigas} de las últimas ${SESIONES_A_MIRAR} sesiones`
          : interrumpidas > 0 ? 'una de las últimas sesiones se interrumpió' : `las últimas sesiones duraron más de ${MINUTOS_PARA_BAJAR} minutos`;
      } else if (
        actual < MAX_ENSAYOS_AUTOMATICO && fatigas === 0 && interrumpidas === 0 && aciertos !== null && aciertos >= ACIERTOS_PARA_SUBIR &&
        duracion !== null && duracion < MINUTOS_PARA_SUBIR
      ) {
        nuevo = Math.min(MAX_ENSAYOS_AUTOMATICO, actual + PASO_ENSAYOS);
        motivo = `terminó ${SESIONES_A_MIRAR} sesiones seguidas sin cansarse`;
      }
      if (motivo && nuevo !== actual) {
        nuevos.ensayosPorSesion = nuevo;
        anotar('ensayosPorSesion', actual, nuevo, motivo);
      }
    }

    // ---- etapa: si va mal, solo se sugiere bajar (la etapa nunca baja sola) ----
    if (
      auto.etapa && !yaCambioHoy('etapa') && aciertos !== null && aciertos < PRECISION_PARA_SUGERIR_BAJAR && etapaActual > 0 &&
      !(etapaSiguienteAbierta && proporcionEtapa >= PROPORCION_PARA_SUBIR_ETAPA) &&
      !previos.some((c) => c.ajuste === 'etapa' && c.sugerencia && (c.dia === dia || !c.visto))
    ) {
      anotar('etapa', etapaActual, null, `acertó solo ${Math.round(aciertos * 100)} % sin ayuda en las últimas ${SESIONES_A_MIRAR} sesiones: quizá convenga volver a la etapa anterior (en Ajustes)`, { sugerencia: true });
    }
  }

  // ---- etapa: solo sube ----
  if (auto.etapa && !yaCambioHoy('etapa') && etapaSiguienteAbierta && proporcionEtapa !== null && proporcionEtapa >= PROPORCION_PARA_SUBIR_ETAPA) {
    etapaActual += 1;
    anotar('etapa', etapaActual - 1, etapaActual, `ya domina o aprendió ${Math.round(proporcionEtapa * 100)} % de las palabras de esta etapa`);
  }

  // ---- máximo de opciones: solo sube ----
  if (auto.maxOpciones && !yaCambioHoy('maxOpciones') && ajustes.maxOpciones < OPCIONES_MAX) {
    const enUso = niveles.filter((n) => !n.deleted && !esDeEscritura(n) && (n.ultimos?.length ?? 0) > 0); // los niveles de escritura son sílabas extra, no opciones
    const todosEnElMaximo = enUso.length > 0 && enUso.every(
      (n) => n.opciones >= ajustes.maxOpciones && n.ultimos.length >= VENTANA_NIVEL && precision(n.ultimos) >= PRECISION_PARA_MAS_OPCIONES,
    );
    if (todosEnElMaximo) {
      nuevos.maxOpciones = ajustes.maxOpciones + 1;
      anotar('maxOpciones', ajustes.maxOpciones, nuevos.maxOpciones, `en todas las actividades acierta ${Math.round(PRECISION_PARA_MAS_OPCIONES * 100)} % o más con ${ajustes.maxOpciones} opciones`);
    }
  }

  // ---- palabras nuevas por sesión (1 o 2) ----
  if (auto.palabrasNuevas && !yaCambioHoy('palabrasNuevas') && indicesEnPractica.length) {
    const promedio = indicesEnPractica.reduce((s, n) => s + n, 0) / indicesEnPractica.length;
    const actual = ajustes.palabrasNuevasPorSesion;
    if (promedio >= INDICE_PARA_UNA_NUEVA && actual > 1) {
      nuevos.palabrasNuevasPorSesion = 1;
      anotar('palabrasNuevas', actual, 1, 'las palabras que practica le están costando bastante');
    } else if (promedio < INDICE_PARA_DOS_NUEVAS && actual < 2) {
      nuevos.palabrasNuevasPorSesion = 2;
      anotar('palabrasNuevas', actual, 2, 'las palabras que practica le salen bien');
    }
  }

  if (!cambios.length) return { perfil, cambios };
  return {
    cambios,
    perfil: {
      ...perfil,
      ajustes: nuevos,
      etapaActual,
      cambiosAutomaticos: [...previos, ...cambios].slice(-MAX_CAMBIOS_GUARDADOS),
    },
  };
}

// ---------- escritura (Ampliación 5) ----------

const AJUSTES_DE_ESCRITURA = { nivelEscritura: 'nivelEscritura', palabrasEscritura: 'palabrasPorSesion' }; // aviso -> campo de `ajustes.escritura`

/** Proporción de las palabras activas de un nivel que están dominadas (o aprendidas), con su total. */
export function avanceDeNivel({ elementos, progresos, perfilId, nivel }) {
  const activos = elementos.filter((e) => e.nivel === nivel && e.activa !== false && !e.deleted);
  const porId = new Map(progresos.filter((p) => !p.deleted && p.actividad === nivel && p.perfilId === perfilId).map((p) => [p.elementoId, p]));
  const dominadas = activos.filter((e) => porId.get(e.id)?.estado === ESTADOS.DOMINADA).length;
  return { total: activos.length, dominadas, proporcion: activos.length ? dominadas / activos.length : null };
}

/**
 * Autoajuste de la escritura: solo mira sesiones `tipo: 'escritura'` (las de lectura no cuentan) y cambia, como máximo una vez por día
 * y solo si el adulto lo dejó en «Automático», el nivel y las palabras por sesión. Las sílabas extra las lleva el nivel de cada
 * actividad (`niveles`), no este módulo. Sin efecto en un perfil de prueba: sus sesiones nunca cuentan para el perfil real.
 * @param perfil     el perfil (curso o alumno ya combinado) con sus ajustes
 * @param sesiones   sesiones del perfil (las de lectura y las de otros perfiles se ignoran)
 * @param elementos  elementos de escritura (`elementosDeEscritura`)
 * @param progresos  progresos del perfil (solo importan los `E*`)
 * @returns { perfil, cambios } igual que `evaluarAutoajuste`
 */
export function evaluarAutoajusteEscritura({ perfil, sesiones = [], elementos = [], progresos = [], hoy = new Date() }) {
  if (esIdDePrueba(perfil.id)) return { perfil, cambios: [] };
  const ajustes = normalizarAjustes(perfil.ajustes);
  const esc = ajustes.escritura;
  const auto = ajustes.automaticos;
  const dia = claveDia(hoy);
  const previos = perfil.cambiosAutomaticos ?? [];
  const yaCambioHoy = (ajuste) => previos.some((c) => c.ajuste === ajuste && !c.sugerencia && c.dia === dia);
  const propias = sesiones.filter((s) => !s.perfilId || s.perfilId === perfil.id); // nunca las de otro perfil (ni las de prueba)
  const ultimas = ultimasSesiones(propias, SESIONES_A_MIRAR, { escritura: true });
  const nuevos = { ...esc };
  const cambios = [];
  const anotar = (ajuste, antes, despues, motivo, extra = {}) =>
    cambios.push({ fecha: hoy.toISOString(), dia, ajuste, antes, despues, motivo, visto: false, ...extra });

  // ---- palabras por sesión (±1, entre 4 y 10) ----
  if (auto.palabrasEscritura && !yaCambioHoy('palabrasEscritura') && ultimas.length >= SESIONES_A_MIRAR) {
    const duracion = mediana(ultimas.map(minutosDe).filter((m) => m !== null));
    const fatigas = ultimas.filter((s) => s.fatiga).length;
    const interrumpidas = ultimas.filter((s) => s.interrumpida).length;
    const aciertos = precisionDeSesiones(ultimas);
    const actual = esc.palabrasPorSesion;
    if (actual > MIN_PALABRAS_AUTOMATICO && (fatigas >= FATIGAS_PARA_BAJAR || (duracion ?? 0) > MINUTOS_ESCRITURA_BAJAR || interrumpidas > 0)) {
      nuevos.palabrasPorSesion = Math.max(MIN_PALABRAS_AUTOMATICO, actual - PASO_PALABRAS_ESCRITURA);
      anotar('palabrasEscritura', actual, nuevos.palabrasPorSesion, fatigas >= FATIGAS_PARA_BAJAR
        ? `se cansó en ${fatigas} de las últimas ${SESIONES_A_MIRAR} sesiones de escritura`
        : interrumpidas > 0 ? 'una de las últimas sesiones de escritura se interrumpió' : `las últimas sesiones de escritura duraron más de ${MINUTOS_ESCRITURA_BAJAR} minutos`);
    } else if (
      actual < MAX_PALABRAS_AUTOMATICO && fatigas === 0 && interrumpidas === 0 && aciertos !== null && aciertos >= ACIERTOS_PARA_SUBIR &&
      duracion !== null && duracion < MINUTOS_ESCRITURA_SUBIR
    ) {
      nuevos.palabrasPorSesion = Math.min(MAX_PALABRAS_AUTOMATICO, actual + PASO_PALABRAS_ESCRITURA);
      anotar('palabrasEscritura', actual, nuevos.palabrasPorSesion, `terminó ${SESIONES_A_MIRAR} sesiones de escritura seguidas sin cansarse`);
    }
  }

  // ---- nivel: solo sube; si va mal, solo se sugiere ----
  if (auto.nivelEscritura && !yaCambioHoy('nivelEscritura')) {
    const nivel = esc.nivelEscritura;
    const { total, dominadas, proporcion } = avanceDeNivel({ elementos, progresos, perfilId: perfil.id, nivel });
    const siguiente = siguienteNivelAbierto({
      nivel, disponibles: nivelesDisponibles(elementos.filter((e) => e.activa !== false && !e.deleted)), bloqueados: esc.nivelesBloqueados, forzados: esc.nivelesForzados,
    });
    if (siguiente && total >= MIN_PALABRAS_PARA_SUBIR_NIVEL && proporcion >= PROPORCION_PARA_SUBIR_NIVEL) {
      nuevos.nivelEscritura = siguiente;
      anotar('nivelEscritura', nivel, siguiente, `ya domina o aprendió ${dominadas} de las ${total} palabras del nivel ${nivel}`);
    } else {
      const delNivel = ultimasSesiones(propias, SESIONES_PARA_SUGERIR, { escritura: true }).filter((s) => s.nivel === nivel);
      const aciertos = delNivel.length >= SESIONES_PARA_SUGERIR ? precisionDeSesiones(delNivel) : null;
      if (aciertos !== null && aciertos < PRECISION_PARA_SUGERIR_BAJAR && !previos.some((c) => c.ajuste === 'nivelEscritura' && c.sugerencia && (c.dia === dia || !c.visto))) {
        anotar('nivelEscritura', nivel, null, `acertó solo ${Math.round(aciertos * 100)} % sin ayuda en las últimas ${SESIONES_PARA_SUGERIR} sesiones del nivel ${nivel}: quizá convenga volver a un nivel anterior (en el menú Escritura)`, { sugerencia: true });
      }
    }
  }

  if (!cambios.length) return { perfil, cambios };
  return {
    cambios,
    perfil: {
      ...perfil,
      ajustes: { ...ajustes, escritura: nuevos },
      cambiosAutomaticos: [...previos, ...cambios].slice(-MAX_CAMBIOS_GUARDADOS),
    },
  };
}

// ---------- avisos para el adulto ----------

/** Cambios (y sugerencias) que el adulto todavía no vio, con su posición en `perfil.cambiosAutomaticos`. */
export function avisosPendientes(perfil) {
  return (perfil.cambiosAutomaticos ?? []).map((cambio, indice) => ({ ...cambio, indice })).filter((c) => !c.visto);
}

/** «Entendido»: el aviso deja de mostrarse. */
export function marcarVisto(perfil, indice) {
  const lista = (perfil.cambiosAutomaticos ?? []).map((c, i) => (i === indice ? { ...c, visto: true } : c));
  return { ...perfil, cambiosAutomaticos: lista };
}

/**
 * «Deshacer»: el ajuste vuelve a su valor anterior y queda en «Lo elijo yo», para que la app no lo vuelva a tocar.
 * Las sugerencias no se deshacen (no cambiaron nada): solo se marcan como vistas.
 */
export function deshacerCambio(perfil, indice) {
  const cambio = (perfil.cambiosAutomaticos ?? [])[indice];
  if (!cambio || cambio.sugerencia || cambio.deshecho) return marcarVisto(perfil, indice);
  const ajustes = normalizarAjustes(perfil.ajustes);
  let etapaActual = perfil.etapaActual ?? 1;
  if (cambio.ajuste === 'etapa') etapaActual = cambio.antes;
  else if (cambio.ajuste === 'palabrasNuevas') ajustes.palabrasNuevasPorSesion = cambio.antes;
  else if (cambio.ajuste in AJUSTES_DE_ESCRITURA) ajustes.escritura = { ...ajustes.escritura, [AJUSTES_DE_ESCRITURA[cambio.ajuste]]: cambio.antes };
  else ajustes[cambio.ajuste] = cambio.antes;
  ajustes.automaticos = { ...ajustes.automaticos, [cambio.ajuste]: false };
  const lista = perfil.cambiosAutomaticos.map((c, i) => (i === indice ? { ...c, visto: true, deshecho: true } : c));
  return { ...perfil, etapaActual, ajustes: normalizarAjustes(ajustes), cambiosAutomaticos: lista };
}
