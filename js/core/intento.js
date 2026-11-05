// Un intento = el niño resolviendo UN ensayo. Lógica pura de «aprendizaje sin error» (PLAN.md §2):
//  - Un toque equivocado nunca castiga: esa opción se atenúa, la correcta se ilumina (ayuda) y el niño
//    sigue hasta acertar. El ensayo queda registrado como «con ayuda».
//  - Se ignoran los toques demasiado seguidos (menos de 400 ms) y los de los primeros 400 ms del ensayo
//    (el dedo todavía puede venir del toque anterior).
//  - Volver a tocar una opción ya atenuada no cuenta como otro error.

export const BLOQUEO_MS = 400;

/** `ensayo` visual: necesita `correctaId` y `cartas` ([{ id }]). `ahoraMs`: reloj monótono (performance.now()). */
export function crearIntento(ensayo, ahoraMs) {
  return {
    correctaId: ensayo.correctaId,
    ids: ensayo.cartas.map((c) => c.id),
    inicio: ahoraMs,
    ultimoToque: ahoraMs,
    estado: 'esperando', // 'esperando' -> 'ayuda' (hubo error) -> 'acertado'
    errores: [], // ids tocados por error, en orden
    atenuadas: [],
    intentos: 0,
    fin: null,
  };
}

/**
 * Procesa un toque sobre una opción.
 * @returns { intento, efecto } con efecto 'ignorado' | 'ayuda' (error: atenuar y guiar) | 'correcto'
 */
export function tocar(intento, opcionId, ahoraMs) {
  const ignorado = { intento, efecto: 'ignorado' };
  if (intento.estado === 'acertado') return ignorado;
  if (!intento.ids.includes(opcionId)) return ignorado;
  if (ahoraMs - intento.ultimoToque < BLOQUEO_MS) return ignorado;

  if (opcionId === intento.correctaId) {
    return {
      efecto: 'correcto',
      intento: { ...intento, estado: 'acertado', intentos: intento.intentos + 1, ultimoToque: ahoraMs, fin: ahoraMs },
    };
  }
  if (intento.atenuadas.includes(opcionId)) return ignorado;
  return {
    efecto: 'ayuda',
    intento: {
      ...intento,
      estado: 'ayuda',
      errores: [...intento.errores, opcionId],
      atenuadas: [...intento.atenuadas, opcionId],
      intentos: intento.intentos + 1,
      ultimoToque: ahoraMs,
    },
  };
}

/** Resultado de un intento ya acertado: lo que recibe el motor de sesión. */
export function resultadoDelIntento(intento) {
  if (intento.estado !== 'acertado') throw new Error('El ensayo todavía no se resolvió');
  return {
    correctoAlPrimerIntento: intento.errores.length === 0,
    intentos: intento.intentos,
    ms: Math.round(intento.fin - intento.inicio),
  };
}
