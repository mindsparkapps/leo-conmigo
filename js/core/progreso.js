// Motor de progreso (PLAN.md §4). Lógica pura, sin DOM ni almacenamiento.
// Todas las funciones devuelven objetos nuevos: nunca modifican lo que reciben.

export const ESTADOS = Object.freeze({ NUEVA: 'nueva', PRACTICA: 'practica', DOMINADA: 'dominada' });

// --- Dominio de un elemento en una actividad ---
export const MAX_HISTORIAL = 10;
export const VENTANA_DOMINIO = 5; // se miran los últimos 5 ensayos...
export const ACIERTOS_PARA_DOMINAR = 4; // ...y al menos 4 deben ser aciertos al primer intento...
export const DIAS_PARA_DOMINAR = 2; // ...repartidos en al menos 2 días distintos.

// --- Repaso espaciado (cajas de Leitner) ---
export const INTERVALOS_LEITNER = Object.freeze([1, 2, 4, 8, 16]); // días de cada caja (1 a 5)
export const FALLOS_PARA_RETROCEDER = 2; // fallos seguidos en repaso para volver a "práctica"

// --- Avance rápido y palabras aprendidas (fase 14) ---
export const ENSAYOS_AVANCE_RAPIDO = 3; // los primeros 3 ensayos contados, todos acertados al primer intento...
export const OPCIONES_MIN_AVANCE = 2; // ...y con 2 opciones o más (no cuentan los de 1 opción ni los fáciles)
export const CAJA_APRENDIDA = 5; // un repaso acertado estando en la caja 5 (16 días) hace «aprendida» a la palabra
export const DIAS_CONTROL = 30; // las aprendidas solo tienen un repaso de control cada 30 días

// --- Número de opciones por actividad ---
export const OPCIONES_MIN = 2;
export const OPCIONES_MAX = 4;
export const VENTANA_NIVEL = 10;
export const UMBRAL_SUBIR = 0.8;
export const UMBRAL_BAJAR = 0.5;

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));

// ---------- Identificadores y fechas ----------

export function idProgreso(perfilId, elementoId, actividad) {
  return `${perfilId}:${elementoId}:${actividad}`;
}

export function idNivel(perfilId, actividad) {
  return `${perfilId}:${actividad}`;
}

/** Día local en formato AAAA-MM-DD. Acepta Date o texto de fecha. */
export function claveDia(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) throw new RangeError(`Fecha inválida: ${String(fecha)}`);
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export function sumarDias(clave, dias) {
  const [a, m, d] = clave.split('-').map(Number);
  return claveDia(new Date(a, m - 1, d + dias));
}

function aTexto(fecha) {
  return fecha instanceof Date ? fecha.toISOString() : String(fecha);
}

// ---------- Progreso de un elemento en una actividad ----------

export function nuevoProgreso({ perfilId, elementoId, actividad }) {
  return {
    id: idProgreso(perfilId, elementoId, actividad),
    perfilId,
    elementoId,
    actividad,
    estado: ESTADOS.NUEVA,
    historial: [], // últimos 10 ensayos: { fecha, correctoAlPrimerIntento, opciones }
    cajaLeitner: 1,
    proximoRepaso: null, // día AAAA-MM-DD (solo cuando está dominada)
    fallosRepaso: 0, // fallos seguidos desde que está dominada
  };
}

/** Proporción de aciertos al primer intento de una lista de ensayos (0 si está vacía). */
export function tasaAciertoHistorial(historial) {
  if (!historial.length) return 0;
  return historial.filter((e) => e.correctoAlPrimerIntento).length / historial.length;
}

/**
 * Dominada = al menos 4 aciertos al primer intento entre los últimos 5 ensayos,
 * y esos aciertos deben caer en al menos 2 días distintos.
 */
export function cumpleDominio(historial) {
  const aciertos = historial.slice(-VENTANA_DOMINIO).filter((e) => e.correctoAlPrimerIntento);
  if (aciertos.length < ACIERTOS_PARA_DOMINAR) return false;
  return new Set(aciertos.map((e) => claveDia(e.fecha))).size >= DIAS_PARA_DOMINAR;
}

/** ¿Toca repasar? Solo las dominadas: sin fecha de repaso cuentan como vencidas. */
export function estaVencido(progreso, dia) {
  return progreso.estado === ESTADOS.DOMINADA && (progreso.proximoRepaso == null || progreso.proximoRepaso <= dia);
}

/**
 * Registra un ensayo y devuelve el progreso actualizado.
 * - nueva -> práctica en el primer ensayo; práctica -> dominada al cumplir el dominio.
 * - Dominada: un acierto en un repaso vencido sube de caja (1, 2, 4, 8, 16 días);
 *   un error vuelve a la caja 1; dos errores seguidos devuelven la palabra a "práctica".
 */
const cuentaParaAvance = (e) => !e.esFacil && (e.opciones ?? 0) >= OPCIONES_MIN_AVANCE;

/**
 * `esFacil` marca un ensayo fácil de relleno (queda en el historial solo cuando es verdad).
 * `avanceRapido` (fase 14): si los primeros 3 ensayos que cuentan fueron aciertos al primer intento con 2 o más
 * opciones, la actividad queda dominada **provisional** (caja 1, repaso al día siguiente). Si ese repaso falla,
 * vuelve a práctica con un solo error; si acierta, deja de ser provisional.
 */
export function registrarEnsayo(progreso, { fecha, correctoAlPrimerIntento, opciones = null, esFacil = false }, { avanceRapido = false } = {}) {
  const entrada = { fecha: aTexto(fecha), correctoAlPrimerIntento: Boolean(correctoAlPrimerIntento), opciones };
  if (esFacil) entrada.esFacil = true;
  const historial = [...progreso.historial, entrada].slice(-MAX_HISTORIAL);
  const dia = claveDia(entrada.fecha);
  const siguiente = { ...progreso, historial };

  if (progreso.estado === ESTADOS.DOMINADA) {
    if (entrada.correctoAlPrimerIntento) {
      siguiente.fallosRepaso = 0;
      if (estaVencido(progreso, dia)) {
        if (progreso.provisional) siguiente.provisional = false;
        if (progreso.cajaLeitner >= CAJA_APRENDIDA) siguiente.aciertosEnCaja5 = (progreso.aciertosEnCaja5 ?? 0) + 1;
        const caja = Math.min(INTERVALOS_LEITNER.length, progreso.cajaLeitner + 1);
        siguiente.cajaLeitner = caja;
        siguiente.proximoRepaso = sumarDias(dia, INTERVALOS_LEITNER[caja - 1]);
      } // un acierto antes de tiempo no adelanta la caja
    } else if (progreso.provisional) {
      // Avance rápido que no se sostuvo: vuelve a práctica con un solo error (no hacen falta dos)
      siguiente.estado = ESTADOS.PRACTICA;
      siguiente.provisional = false;
      siguiente.cajaLeitner = 1;
      siguiente.proximoRepaso = null;
      siguiente.fallosRepaso = 0;
    } else {
      const fallos = (progreso.fallosRepaso ?? 0) + 1;
      siguiente.cajaLeitner = 1;
      if (progreso.aciertosEnCaja5) siguiente.aciertosEnCaja5 = 0; // si falla, ya no cuenta como aprendida
      if (fallos >= FALLOS_PARA_RETROCEDER) {
        siguiente.estado = ESTADOS.PRACTICA;
        siguiente.proximoRepaso = null;
        siguiente.fallosRepaso = 0;
      } else {
        siguiente.proximoRepaso = sumarDias(dia, INTERVALOS_LEITNER[0]);
        siguiente.fallosRepaso = fallos;
      }
    }
    return siguiente;
  }

  siguiente.estado = ESTADOS.PRACTICA;
  const contados = historial.filter(cuentaParaAvance);
  const avanza =
    avanceRapido &&
    progreso.historial.length < MAX_HISTORIAL && // son de verdad los primeros ensayos de la palabra
    cuentaParaAvance(entrada) &&
    contados.length === ENSAYOS_AVANCE_RAPIDO &&
    contados.every((e) => e.correctoAlPrimerIntento);
  if (avanza || cumpleDominio(historial)) {
    siguiente.estado = ESTADOS.DOMINADA;
    siguiente.cajaLeitner = 1;
    siguiente.proximoRepaso = sumarDias(dia, INTERVALOS_LEITNER[0]);
    siguiente.fallosRepaso = 0;
    if (avanza && !cumpleDominio(historial)) siguiente.provisional = true;
  }
  return siguiente;
}

/**
 * Palabra «aprendida» (fase 14): todas sus actividades dominadas de verdad (no provisionales) y al menos un
 * repaso acertado estando en la caja 5. `progresos` = el progreso de la palabra en cada actividad que le toca
 * (si falta alguno, no está aprendida). No necesita ningún campo obligatorio nuevo.
 */
export function estaAprendida(progresos) {
  if (!progresos.length || progresos.some((p) => !p || p.estado !== ESTADOS.DOMINADA || p.provisional)) return false;
  return progresos.some((p) => (p.aciertosEnCaja5 ?? 0) > 0);
}

/** Día (AAAA-MM-DD) desde el que toca el repaso de control de una actividad de una palabra aprendida. */
export function diaDeControl(progreso) {
  const ultimo = progreso.historial.at(-1);
  return ultimo ? sumarDias(claveDia(ultimo.fecha), DIAS_CONTROL) : (progreso.proximoRepaso ?? '0000-00-00');
}

/** «Volver a practicar»: la palabra deja de ser aprendida y queda dominada en caja 1, con repaso en la próxima sesión. */
export function desmarcarAprendida(progreso) {
  return { ...progreso, cajaLeitner: 1, proximoRepaso: null, fallosRepaso: 0, aciertosEnCaja5: 0, provisional: false };
}

// ---------- Nivel de una actividad (cuántas opciones se muestran) ----------

export function nuevoNivel(perfilId, actividad) {
  return {
    id: idNivel(perfilId, actividad),
    perfilId,
    actividad,
    opciones: OPCIONES_MIN,
    ultimos: [], // aciertos al primer intento (true/false) de los últimos ensayos contados
  };
}

/** Proporción de aciertos de una lista de true/false; null si está vacía. */
export function precision(ultimos) {
  return ultimos.length ? ultimos.filter(Boolean).length / ultimos.length : null;
}

/**
 * Sube una opción si la precisión de los últimos 10 ensayos es >= 80 %,
 * y baja una si es < 50 %. Al cambiar de nivel la ventana se reinicia.
 */
export function registrarEnNivel(nivel, correctoAlPrimerIntento, maxOpciones = OPCIONES_MAX) {
  const tope = limitar(maxOpciones, OPCIONES_MIN, OPCIONES_MAX);
  let opciones = limitar(nivel.opciones, OPCIONES_MIN, tope); // si el adulto bajó el máximo
  let ultimos = [...nivel.ultimos, Boolean(correctoAlPrimerIntento)].slice(-VENTANA_NIVEL);

  if (ultimos.length >= VENTANA_NIVEL) {
    const p = precision(ultimos);
    if (p >= UMBRAL_SUBIR && opciones < tope) {
      opciones += 1;
      ultimos = [];
    } else if (p < UMBRAL_BAJAR && opciones > OPCIONES_MIN) {
      opciones -= 1;
      ultimos = [];
    }
  }
  return { ...nivel, opciones, ultimos };
}

/** Nivel "fácil": 2 opciones, precisión menor a 80 % o aún sin datos (recién cambiado de nivel). */
export function esNivelFacil(nivel) {
  if (!nivel || nivel.opciones <= OPCIONES_MIN) return true;
  const p = precision(nivel.ultimos);
  return p === null || p < UMBRAL_SUBIR;
}

/** Opciones a mostrar hoy en una actividad, respetando el máximo que fijó el adulto. */
export function opcionesEfectivas(nivel, maxOpciones = OPCIONES_MAX) {
  return limitar(Math.min(nivel?.opciones ?? OPCIONES_MIN, maxOpciones), OPCIONES_MIN, OPCIONES_MAX);
}

/**
 * Aplica el resultado de un ensayo al progreso y al nivel.
 * `contarParaNivel` debe ser false en los ensayos "fáciles" (primero, último y cierre por
 * fatiga), que se muestran con menos opciones y no deben inflar la precisión del nivel.
 */
export function aplicarResultado({ progreso, nivel, resultado, maxOpciones = OPCIONES_MAX, contarParaNivel = true, avanceRapido = false }) {
  return {
    progreso: registrarEnsayo(progreso, resultado, { avanceRapido }),
    nivel: contarParaNivel ? registrarEnNivel(nivel, resultado.correctoAlPrimerIntento, maxOpciones) : nivel,
  };
}
