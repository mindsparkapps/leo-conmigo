// Sesión de escritura (Ampliación 5, fase 28). Lógica pura.
//
// NO duplica el motor de la lectura: `crearSesionEscritura` llama a `crearSesion` (máx. 2 palabras nuevas, ~30 % de repaso, primer y
// último ensayo fáciles, sin repetir seguidas, reserva para el cansancio) con la actividad = el NIVEL de cada palabra (`E07`). Lo
// único propio es qué niveles entran (la práctica es del nivel elegido; los niveles anteriores solo se repasan), que en vez de
// opciones hay sílabas extra (0 a 4) y cómo se arman las piezas. El avance (Leitner, avance rápido, «aprendida») es el de
// `core/progreso.js`.
//
// Ensayo de escritura: { elementoId, actividad: 'E07', tipo: 'nueva'|'practica'|'repaso'|'cierre', esFacil, extras }

import { normalizarAjustes } from '../modelos.js';
import { ajustarNivel, idNivel, registrarEnsayo } from '../progreso.js';
import { crearSesion } from '../sesion.js';
import { MAX_SILABAS_EXTRA, armarPiezas } from './piezas.js';
import { IDS_DE_NIVELES, indiceDeNivel } from './niveles.js';
import { nivelEfectivo, nivelesDisponibles } from './elementos.js';
import { ajustesDeConfusiones } from './analisis.js';

export const EXTRAS_MIN = 0;

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));

// ---------- nivel de sílabas extra (0 a 4): la misma regla que el nivel de opciones ----------

/** Nivel de una actividad de escritura: empieza SIN sílabas extra. `extras` hace de `opciones` de la lectura. */
export function nuevoNivelEscritura(perfilId, actividad) {
  return { id: idNivel(perfilId, actividad), perfilId, actividad, extras: EXTRAS_MIN, ultimos: [] };
}

/** Sube 1 extra con >= 80 % de acierto en los últimos 10, baja 1 con < 50 %; nunca pasa de `maxExtras` (lo que fijó el adulto). */
export function registrarEnNivelEscritura(nivel, correctoAlPrimerIntento, maxExtras = MAX_SILABAS_EXTRA) {
  return ajustarNivel(nivel, correctoAlPrimerIntento, { min: EXTRAS_MIN, max: maxExtras, tope: MAX_SILABAS_EXTRA, campo: 'extras' });
}

/**
 * Sílabas extra de hoy en un nivel: con «Lo elijo yo» (`automaticos.silabasExtra` apagado y un número fijado) ese número; si no,
 * las del nivel automático, sin pasar de `maxSilabasExtra`. `ajustes` = ajustes del perfil (se normalizan).
 */
export function extrasEfectivos(nivel, ajustes) {
  const a = normalizarAjustes(ajustes);
  if (!a.automaticos.silabasExtra && a.escritura.silabasExtraManual !== null) return a.escritura.silabasExtraManual;
  return limitar(nivel?.extras ?? EXTRAS_MIN, EXTRAS_MIN, a.escritura.maxSilabasExtra);
}

/**
 * El equivalente de `aplicarResultado` de la lectura: actualiza el progreso (mismo `registrarEnsayo`, Leitner y avance rápido) y
 * el nivel de extras. `resultado.opciones` = piezas que se mostraron (cajas + extras): con una sola pieza el ensayo no cuenta
 * para el avance rápido, como un ensayo de una opción en la lectura.
 */
export function aplicarResultadoEscritura({ progreso, nivel, resultado, maxExtras = MAX_SILABAS_EXTRA, contarParaNivel = true, avanceRapido = false }) {
  return {
    progreso: registrarEnsayo(progreso, resultado, { avanceRapido }),
    nivel: contarParaNivel ? registrarEnNivelEscritura(nivel, resultado.correctoAlPrimerIntento, maxExtras) : nivel,
  };
}

// ---------- armar la sesión ----------

/**
 * @param perfil       el perfil (curso): `{ id, ajustes }`; de ahí salen `ajustes.escritura` y los comunes (palabras nuevas, avance rápido)
 * @param perfilId     con quién se guardan los registros: el del perfil o `prueba:<perfilId>` (por defecto, `perfil.id`)
 * @param palabras     elementos de escritura (`elementosDeEscritura`)
 * @param progresos    progresos del perfilId (los de lectura no estorban: solo se leen los de `E*`)
 * @param niveles      niveles del perfilId (de extras)
 * @param nivel        nivel de esta sesión (por defecto, el efectivo del perfil)
 * @param dificultades Map elementoId -> { indice, confiable, tasa, confusionId } (análisis de escritura; fase 31)
 * @returns { perfilId, fecha, tipo: 'escritura', nivel, ensayos, reservaFacil, resumen }
 */
export function crearSesionEscritura({
  perfil, perfilId = perfil.id, palabras, progresos = [], niveles = [], nivel = null, hoy = new Date(), aleatorio = Math.random,
  dificultades = new Map(),
}) {
  const ajustes = normalizarAjustes(perfil.ajustes);
  const esc = ajustes.escritura;
  const activos = palabras.filter((p) => p.activa !== false && !p.deleted);
  const disponibles = nivelesDisponibles(activos);
  const elegido = nivel ?? nivelEfectivo({ nivelEscritura: esc.nivelEscritura, disponibles, bloqueados: esc.nivelesBloqueados, forzados: esc.nivelesForzados });
  const vacia = { perfilId, fecha: null, tipo: 'escritura', nivel: elegido, ensayos: [], reservaFacil: [], resumen: { repasos: 0, nuevas: 0, practica: 0 } };
  if (!elegido) return { ...vacia, fecha: hoy instanceof Date ? hoy.toISOString().slice(0, 10) : String(hoy).slice(0, 10) };

  const hasta = indiceDeNivel(elegido);
  const elementos = activos.filter((p) => indiceDeNivel(p.nivel) <= hasta);
  const plan = crearSesion({
    perfil: { ...perfil, id: perfilId, ajustes: { ...ajustes, ensayosPorSesion: esc.palabrasPorSesion, actividadesHabilitadas: null } },
    elementos,
    progresos: progresos.filter((p) => !p.deleted),
    niveles: [], // los niveles de extras se aplican abajo; aquí no hay opciones que elegir
    actividades: IDS_DE_NIVELES.slice(0, hasta + 1),
    hoy,
    aleatorio,
    puedeHacer: (elemento, actividad) => elemento.nivel === actividad,
    puedeSerOpcion: () => false,
    puedePracticar: (elemento) => elemento.nivel === elegido, // los niveles anteriores solo entran como repaso
    dificultades,
    maxActividadSeguida: Infinity, // la actividad es el nivel: varias palabras seguidas del mismo nivel es lo normal
  });

  const mapaNiveles = new Map(niveles.map((n) => [n.id, n]));
  const poner = (ensayo) => {
    const facil = ensayo.esFacil || ensayo.tipo === 'cierre';
    ensayo.extras = facil ? 0 : extrasEfectivos(mapaNiveles.get(idNivel(perfilId, ensayo.actividad)), ajustes);
    delete ensayo.distractorIds; // en escritura no hay opciones que elegir
    delete ensayo.opciones; // las piezas (cajas + extras) las cuenta quien las arma
    return ensayo;
  };
  plan.ensayos.forEach(poner);
  plan.reservaFacil.forEach(poner);
  return { ...plan, tipo: 'escritura', nivel: elegido };
}

// ---------- las piezas de un ensayo ----------

/**
 * Arma lo que se dibuja de un ensayo: cajas y piezas (`armarPiezas`) y los datos del elemento.
 * @param ensayo    ensayo del plan (`extras`, `actividad`)
 * @param elemento  el elemento de escritura (`palabra`, `texto`, `nivel`…)
 * @param ajustes   ajustes del perfil (se normalizan): `escritura.piezasOracion` decide si E18 va por palabras o por sílabas
 * @param evitar    sílabas que no deben salir de distractoras (las que ya confunde; fase 31)
 */
export function armarEnsayoEscritura({ ensayo, elemento, ajustes, aleatorio = Math.random, evitar = [], analisis = null, yaUsadas = new Set() }) {
  const a = normalizarAjustes(ajustes);
  const base = { palabra: elemento.palabra, aleatorio, nivel: ensayo.actividad, por: a.escritura.piezasOracion };
  // Fase 31: las sílabas que confunde. Mientras falle la caja, su confusión no sale de distractora; con >= 80 % se usa a propósito, una vez por sesión.
  let incluir = [];
  if (analisis?.confusiones?.length) {
    const previa = armarPiezas({ ...base, extras: 0, aleatorio: () => 0.5 }); // solo para saber las cajas; no gasta el azar de la sesión
    // sin sílabas extra no hay distractoras: la confusión «a propósito» no se gasta
    const ajuste = ajustesDeConfusiones({ huecos: previa.huecos, analisis, yaUsadas: (ensayo.extras ?? 0) > 0 ? yaUsadas : new Set(yaUsadas) });
    evitar = [...evitar, ...ajuste.evitar];
    incluir = (ensayo.extras ?? 0) > 0 ? ajuste.incluir : [];
  }
  const piezas = armarPiezas({ ...base, extras: ensayo.extras ?? 0, evitar, incluir });
  return {
    modo: 'escritura',
    elementoId: ensayo.elementoId,
    nivel: ensayo.actividad,
    texto: elemento.texto,
    ...piezas,
    opciones: piezas.fichas.length, // piezas mostradas (cajas + extras)
    dictado: Boolean(elemento.dictado),
    porSilabas: piezas.unidad === 'silaba' && Array.isArray(elemento.palabra?.palabras),
  };
}
