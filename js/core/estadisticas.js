// Estadísticas para el panel de progreso del adulto (PLAN.md §5). Lógica pura, sin DOM.

import { ACTIVIDADES_POR_ETAPA } from './etapas.js';
import { ESTADOS, claveDia, desmarcarAprendida, estaAprendida, nuevoProgreso, sumarDias } from './progreso.js';
import { ordenadas } from './vocabulario.js';

export const ACTIVIDADES_ETAPA_1 = ACTIVIDADES_POR_ETAPA[1];
export const ACTIVIDAD_LEER = 'L4'; // «palabra leída» = dominada en L4

/** Lo que se muestra en una celda de la tabla: una palabra en una actividad. */
export function celdaDeProgreso(progreso) {
  const historial = progreso?.historial ?? [];
  if (!progreso || (progreso.estado === ESTADOS.NUEVA && !historial.length)) {
    return { estado: ESTADOS.NUEVA, ensayos: 0, aciertos: 0, proximoRepaso: null, caja: null };
  }
  return {
    estado: progreso.estado,
    ensayos: historial.length,
    aciertos: historial.filter((e) => e.correctoAlPrimerIntento).length,
    proximoRepaso: progreso.proximoRepaso ?? null,
    caja: progreso.cajaLeitner ?? null,
  };
}

/**
 * Estado general de una palabra a partir de sus celdas (en el orden de `actividades`):
 * 'aprendida' (completa y con repaso acertado en caja 5; la decide `tablaDePalabras`), 'completa' (todas dominadas), 'leida' (dominada en L4), 'practica' (ya empezó) o 'nueva'.
 */
export function estadoDePalabra(celdas, actividades = ACTIVIDADES_ETAPA_1) {
  if (celdas.length && celdas.every((c) => c.estado === ESTADOS.DOMINADA)) return 'completa';
  const iLeer = actividades.indexOf(ACTIVIDAD_LEER);
  if (iLeer !== -1 && celdas[iLeer]?.estado === ESTADOS.DOMINADA) return 'leida';
  if (celdas.some((c) => c.estado !== ESTADOS.NUEVA)) return 'practica';
  return 'nueva';
}

/** Primera actividad aún no dominada (la que se está practicando), o null si están todas. */
export function actividadActualDe(celdas, actividades = ACTIVIDADES_ETAPA_1) {
  const i = celdas.findIndex((c) => c.estado !== ESTADOS.DOMINADA);
  return i === -1 ? null : actividades[i];
}

/**
 * Una fila por palabra, en el orden de introducción:
 * { palabra, celdas: [{ actividad, estado, ensayos, aciertos, ... }], estado, actividadActual }
 */
export function tablaDePalabras({ palabras, progresos, actividades = ACTIVIDADES_ETAPA_1 }) {
  const porClave = new Map(progresos.filter((p) => !p.deleted).map((p) => [`${p.elementoId}:${p.actividad}`, p]));
  return ordenadas([...palabras]).map((palabra) => {
    const celdas = actividades.map((actividad) => ({
      actividad,
      ...celdaDeProgreso(porClave.get(`${palabra.id}:${actividad}`)),
    }));
    let estado = estadoDePalabra(celdas, actividades);
    // «Aprendida» (fase 14): completa y con un repaso acertado en la caja 5; sale sola de los repasos normales
    if (estado === 'completa' && estaAprendida(actividades.map((a) => porClave.get(`${palabra.id}:${a}`)))) estado = 'aprendida';
    return { palabra, celdas, estado, actividadActual: actividadActualDe(celdas, actividades) };
  });
}

/** «Volver a practicar»: los progresos de una palabra aprendida, listos para guardar, sin la marca de aprendida. */
export function volverAPracticar({ elementoId, existentes = [] }) {
  return existentes.filter((p) => p.elementoId === elementoId && !p.deleted).map(desmarcarAprendida);
}

/** Números grandes del panel: palabras, leídas, en práctica, sesiones y la última. */
export function resumenGeneral({ filas, sesiones }) {
  const iLeer = ACTIVIDADES_ETAPA_1.indexOf(ACTIVIDAD_LEER);
  const ultima = sesiones.reduce((max, s) => (s.inicio > max ? s.inicio : max), '');
  return {
    palabras: filas.length,
    leidas: filas.filter((f) => f.celdas[iLeer]?.estado === ESTADOS.DOMINADA).length,
    completas: filas.filter((f) => f.estado === 'completa' || f.estado === 'aprendida').length,
    enPractica: filas.filter((f) => f.estado === 'practica' || f.estado === 'leida').length,
    nuevas: filas.filter((f) => f.estado === 'nueva').length,
    sesiones: sesiones.length,
    ultimaSesion: ultima || null,
  };
}

// ---------- semanas y sesiones ----------

/** Lunes (AAAA-MM-DD, hora local) de la semana de una fecha. */
export function lunesDe(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const atras = (d.getDay() + 6) % 7; // lunes = 0 ... domingo = 6
  return claveDia(new Date(d.getFullYear(), d.getMonth(), d.getDate() - atras));
}

/**
 * Aciertos al primer intento por semana (de lunes a domingo), de la más antigua a la actual.
 * Las semanas sin ensayos llevan `precision: null`.
 * @returns [{ inicio, ensayos, aciertos, precision }]
 */
export function precisionSemanal(sesiones, { hoy = new Date(), semanas = 8 } = {}) {
  const actual = lunesDe(hoy);
  const lista = [];
  for (let i = semanas - 1; i >= 0; i--) lista.push({ inicio: sumarDias(actual, -7 * i), ensayos: 0, aciertos: 0 });
  const porInicio = new Map(lista.map((s) => [s.inicio, s]));
  for (const sesion of sesiones) {
    const semana = porInicio.get(lunesDe(sesion.inicio));
    if (!semana) continue; // fuera del rango mostrado
    for (const e of sesion.ensayos ?? []) {
      semana.ensayos += 1;
      if (e.correctoAlPrimerIntento) semana.aciertos += 1;
    }
  }
  return lista.map((s) => ({ ...s, precision: s.ensayos ? s.aciertos / s.ensayos : null }));
}

/** Una sesión resumida: fecha, duración, ensayos y aciertos al primer intento. */
export function resumenDeSesion(sesion) {
  const ensayos = sesion.ensayos ?? [];
  const aciertos = ensayos.filter((e) => e.correctoAlPrimerIntento).length;
  const ms = Date.parse(sesion.fin) - Date.parse(sesion.inicio);
  return {
    id: sesion.id,
    inicio: sesion.inicio,
    segundos: Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : null,
    ensayos: ensayos.length,
    aciertos,
    conAyuda: ensayos.length - aciertos,
    fatiga: Boolean(sesion.fatiga),
  };
}

/** Las últimas sesiones, la más reciente primero. */
export function historialDeSesiones(sesiones, limite = 20) {
  return [...sesiones]
    .filter((s) => !s.deleted)
    .sort((a, b) => b.inicio.localeCompare(a.inicio))
    .slice(0, limite)
    .map(resumenDeSesion);
}

/** 45 -> «menos de 1 min» · 150 -> «3 min» · 4000 -> «1 h 07 min». */
export function formatearDuracion(segundos) {
  if (segundos == null) return '—';
  if (segundos < 60) return 'menos de 1 min';
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
}

// ---------- marcado manual ----------

/**
 * «Ya la sabe»: deja la palabra dominada en todas las actividades. Sin fecha de repaso cuenta como
 * vencida: en la próxima sesión se repasa. Conserva el historial que ya tuviera.
 * @returns registros de progreso listos para guardar
 */
export function marcarDominada({ perfilId, elementoId, actividades = ACTIVIDADES_ETAPA_1, existentes = [] }) {
  const previos = new Map(existentes.filter((p) => p.elementoId === elementoId).map((p) => [p.actividad, p]));
  return actividades.map((actividad) => ({
    ...nuevoProgreso({ perfilId, elementoId, actividad }),
    estado: ESTADOS.DOMINADA,
    cajaLeitner: 1,
    proximoRepaso: null,
    fallosRepaso: 0,
    historial: previos.get(actividad)?.historial ?? [],
  }));
}

/** «Empezar de nuevo»: los progresos de esa palabra que hay que borrar. */
export function idsDeProgresoDe(progresos, elementoId) {
  return progresos.filter((p) => p.elementoId === elementoId && !p.deleted).map((p) => p.id);
}
