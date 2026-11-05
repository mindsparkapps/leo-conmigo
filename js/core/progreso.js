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
export function registrarEnsayo(progreso, { fecha, correctoAlPrimerIntento, opciones = null }) {
  const entrada = { fecha: aTexto(fecha), correctoAlPrimerIntento: Boolean(correctoAlPrimerIntento), opciones };
  const historial = [...progreso.historial, entrada].slice(-MAX_HISTORIAL);
  const dia = claveDia(entrada.fecha);
  const siguiente = { ...progreso, historial };

  if (progreso.estado === ESTADOS.DOMINADA) {
    if (entrada.correctoAlPrimerIntento) {
      siguiente.fallosRepaso = 0;
      if (estaVencido(progreso, dia)) {
        const caja = Math.min(INTERVALOS_LEITNER.length, progreso.cajaLeitner + 1);
        siguiente.cajaLeitner = caja;
        siguiente.proximoRepaso = sumarDias(dia, INTERVALOS_LEITNER[caja - 1]);
      } // un acierto antes de tiempo no adelanta la caja
    } else {
      const fallos = (progreso.fallosRepaso ?? 0) + 1;
      siguiente.cajaLeitner = 1;
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
  if (cumpleDominio(historial)) {
    siguiente.estado = ESTADOS.DOMINADA;
    siguiente.cajaLeitner = 1;
    siguiente.proximoRepaso = sumarDias(dia, INTERVALOS_LEITNER[0]);
    siguiente.fallosRepaso = 0;
  }
  return siguiente;
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
export function aplicarResultado({ progreso, nivel, resultado, maxOpciones = OPCIONES_MAX, contarParaNivel = true }) {
  return {
    progreso: registrarEnsayo(progreso, resultado),
    nivel: contarParaNivel ? registrarEnNivel(nivel, resultado.correctoAlPrimerIntento, maxOpciones) : nivel,
  };
}
