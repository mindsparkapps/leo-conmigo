// Ajustes que se adaptan solos (PLAN.md, fase 14). Lógica pura: al terminar una sesión se miran las últimas 3 y se
// decide si conviene cambiar algún ajuste. Cada ajuste cambia como máximo una vez por día, solo si el adulto lo dejó
// en «Automático», y cada cambio queda anotado en `perfil.cambiosAutomaticos` para avisarle y poder deshacerlo.
// El niño nunca ve nada de esto y nada cambia a mitad de una sesión.
//
// Las constantes están arriba para poder afinarlas.

import { normalizarAjustes } from './modelos.js';
import { OPCIONES_MAX, VENTANA_NIVEL, claveDia, precision } from './progreso.js';
import { mediana } from './analisis.js';

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

const NOMBRES = {
  ensayosPorSesion: 'ensayos por sesión',
  maxOpciones: 'máximo de opciones',
  palabrasNuevas: 'palabras nuevas por sesión',
  etapa: 'etapa',
};
export const nombreDeAjuste = (ajuste) => NOMBRES[ajuste] ?? ajuste;

const minutosDe = (s) => {
  const ms = Date.parse(s.fin) - Date.parse(s.inicio);
  return Number.isFinite(ms) ? ms / 60000 : null;
};

/** Las últimas `n` sesiones (más reciente primero), sin las borradas. */
export function ultimasSesiones(sesiones, n = SESIONES_A_MIRAR) {
  return sesiones.filter((s) => !s.deleted).sort((a, b) => String(b.inicio).localeCompare(String(a.inicio))).slice(0, n);
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
      !previos.some((c) => c.sugerencia && (c.dia === dia || !c.visto))
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
    const enUso = niveles.filter((n) => !n.deleted && (n.ultimos?.length ?? 0) > 0);
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
  else ajustes[cambio.ajuste] = cambio.antes;
  ajustes.automaticos = { ...ajustes.automaticos, [cambio.ajuste]: false };
  const lista = perfil.cambiosAutomaticos.map((c, i) => (i === indice ? { ...c, visto: true, deshecho: true } : c));
  return { ...perfil, etapaActual, ajustes: normalizarAjustes(ajustes), cambiosAutomaticos: lista };
}
