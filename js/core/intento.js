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
    modo: 'simple',
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

/** Resultado de un intento ya acertado: lo que recibe el motor de sesión (vale para los tres modos). */
export function resultadoDelIntento(intento) {
  if (intento.estado !== 'acertado') throw new Error('El ensayo todavía no se resolvió');
  const sinAyuda = intento.modo === 'lectura' ? intento.repeticiones === 0 : intento.errores.length === 0;
  return {
    correctoAlPrimerIntento: sinAyuda,
    intentos: intento.intentos,
    ms: Math.round(intento.fin - intento.inicio),
  };
}

// ---------- Secuencia: «armo la frase» (F3) ----------
//
// El niño toca las palabras EN ORDEN. Cada ficha se usa una vez. Si toca una que no corresponde, esa
// ficha se atenúa un momento (hasta el próximo acierto) y se ilumina la que sigue. No se pierde nada.

/** `ensayo`: { orden: [palabraId, ...], fichas: [{ id, palabraId }] } */
export function crearIntentoSecuencia(ensayo, ahoraMs) {
  return {
    modo: 'secuencia',
    orden: [...ensayo.orden],
    fichas: ensayo.fichas.map((f) => ({ id: f.id, palabraId: f.palabraId })),
    colocadas: [], // ids de ficha ya puestas en la franja, en orden
    errores: [], // ids de ficha tocadas por error
    atenuadas: [], // fichas equivocadas que siguen atenuadas (hasta el próximo acierto)
    inicio: ahoraMs,
    ultimoToque: ahoraMs,
    estado: 'esperando',
    intentos: 0,
    fin: null,
  };
}

/** La ficha que corresponde poner ahora (la primera libre con la palabra esperada), o null si ya terminó. */
export function fichaSiguiente(intento) {
  const esperada = intento.orden[intento.colocadas.length];
  return intento.fichas.find((f) => f.palabraId === esperada && !intento.colocadas.includes(f.id))?.id ?? null;
}

/**
 * @returns { intento, efecto } con efecto 'ignorado' | 'ayuda' (error) | 'paso' (acierto, falta seguir) | 'correcto' (frase completa)
 */
export function tocarSecuencia(intento, fichaId, ahoraMs) {
  const ignorado = { intento, efecto: 'ignorado' };
  if (intento.estado === 'acertado') return ignorado;
  const ficha = intento.fichas.find((f) => f.id === fichaId);
  if (!ficha || intento.colocadas.includes(fichaId)) return ignorado;
  if (ahoraMs - intento.ultimoToque < BLOQUEO_MS) return ignorado;

  if (ficha.palabraId === intento.orden[intento.colocadas.length]) {
    const colocadas = [...intento.colocadas, fichaId];
    const completa = colocadas.length === intento.orden.length;
    return {
      efecto: completa ? 'correcto' : 'paso',
      intento: {
        ...intento,
        colocadas,
        atenuadas: [],
        estado: completa ? 'acertado' : intento.errores.length ? 'ayuda' : 'esperando',
        intentos: intento.intentos + 1,
        ultimoToque: ahoraMs,
        fin: completa ? ahoraMs : null,
      },
    };
  }
  if (intento.atenuadas.includes(fichaId)) return ignorado;
  return {
    efecto: 'ayuda',
    intento: {
      ...intento,
      estado: 'ayuda',
      errores: [...intento.errores, fichaId],
      atenuadas: [...intento.atenuadas, fichaId],
      intentos: intento.intentos + 1,
      ultimoToque: ahoraMs,
    },
  };
}

// ---------- Lectura en voz alta asistida (L6) ----------
//
// El niño lee en voz alta y el ADULTO decide: «lo leyó» o «otra vez». La app nunca evalúa el habla.

export function crearIntentoLectura(ensayo, ahoraMs) {
  return { modo: 'lectura', inicio: ahoraMs, ultimoToque: ahoraMs, estado: 'esperando', repeticiones: 0, intentos: 0, fin: null };
}

/** @param decision 'ok' (lo leyó) | 'otra' (otra vez). @returns { intento, efecto: 'ignorado' | 'ayuda' | 'correcto' } */
export function decidirLectura(intento, decision, ahoraMs) {
  const ignorado = { intento, efecto: 'ignorado' };
  if (intento.estado === 'acertado') return ignorado;
  if (decision !== 'ok' && decision !== 'otra') return ignorado;
  if (ahoraMs - intento.ultimoToque < BLOQUEO_MS) return ignorado;
  if (decision === 'otra') {
    return { efecto: 'ayuda', intento: { ...intento, estado: 'ayuda', repeticiones: intento.repeticiones + 1, intentos: intento.intentos + 1, ultimoToque: ahoraMs } };
  }
  return { efecto: 'correcto', intento: { ...intento, estado: 'acertado', intentos: intento.intentos + 1, ultimoToque: ahoraMs, fin: ahoraMs } };
}
