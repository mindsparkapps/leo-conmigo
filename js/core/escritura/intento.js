// Intento de escritura = el niño armando UNA palabra (o frase) en sus cajas (Ampliación 5, fase 28). Lógica pura.
//
//  - Una caja por sílaba (`huecos`); las piezas (`fichas`) son esas sílabas más 0 a 4 que no son, ya mezcladas.
//  - Se puede llenar en cualquier orden: una pieza es correcta si su texto es el de esa caja (dos cajas con la misma
//    sílaba aceptan cualquiera de las dos piezas iguales). Se registra el orden en que se llenó.
//  - Una pieza equivocada «vuelve a su lugar» (el estado no la guarda en ninguna caja) y cuenta como error de esa caja.
//    Tras `ERRORES_PARA_AYUDA` errores en la MISMA caja se ilumina la pieza correcta (`ayudaActual`); la palabra queda «con
//    ayuda» pero el niño nunca pierde: sigue hasta completarla.
//  - Se ignoran los toques demasiado seguidos (menos de 400 ms, igual que en la lectura) y los de los primeros 400 ms.
//  - Tocar una pieza sin ponerla solo la dice (`escuchar`): no es un error ni mueve el bloqueo.
//
// Para el registro fino cada cosa guarda CUÁNDO pasó, en ms desde que apareció el ensayo.

import { BLOQUEO_MS } from '../intento.js';

export { BLOQUEO_MS };
export const ERRORES_PARA_AYUDA = 2; // errores en una misma caja que encienden la ayuda amarilla

const msDesde = (intento, ahoraMs) => Math.round(ahoraMs - intento.inicio);
const clave = (texto) => String(texto ?? '').toLowerCase();

/** `ensayo` visual: `{ huecos: [texto], fichas: [{ id, texto, distractor }] }` (lo que arma `armarPiezas`). */
export function crearIntentoEscritura(ensayo, ahoraMs) {
  return {
    modo: 'escritura',
    huecos: [...ensayo.huecos],
    fichas: ensayo.fichas.map((f) => ({ id: f.id, texto: f.texto, distractor: Boolean(f.distractor) })),
    colocadas: ensayo.huecos.map(() => null), // por caja, el id de la pieza puesta (o null)
    ordenLlenado: [], // índices de caja, en el orden en que se llenaron
    errores: [], // un elemento por pieza soltada en una caja que no era: { fichaId, texto, hueco }
    erroresMs: [], // ms de cada error (mismo orden que `errores`)
    erroresPorHueco: ensayo.huecos.map(() => 0),
    toques: [], // cada pieza soltada: { fichaId, texto, hueco, correcto, ms, forma }
    escuchasPieza: [], // piezas tocadas solo para oírlas: { texto, ms }
    ayudaHueco: null, // caja que tiene encendida la ayuda (o null)
    conAyudaVisual: false, // la ayuda se encendió alguna vez en este ensayo
    primerToque: null, // ms hasta la primera pieza soltada
    inicio: ahoraMs,
    ultimoToque: ahoraMs,
    estado: 'esperando', // 'esperando' → 'ayuda' (hubo errores) → 'acertado'
    intentos: 0, // piezas soltadas en una caja
    fin: null,
  };
}

/** ¿Están todas las cajas llenas? */
export const completo = (intento) => intento.colocadas.every((f) => f !== null);

/** `true` si no hubo ningún error en todo el ensayo (lo que cuenta como «acierto al primer intento»). */
export const correctoAlPrimerIntento = (intento) => intento.errores.length === 0;

/** Piezas que todavía no están en ninguna caja. */
export const fichasLibres = (intento) => intento.fichas.filter((f) => !intento.colocadas.includes(f.id));

/** La pieza que corresponde a una caja (la primera libre con su texto), o null. */
export function fichaCorrectaPara(intento, hueco) {
  return fichasLibres(intento).find((f) => !f.distractor && clave(f.texto) === clave(intento.huecos[hueco]))?.id
    ?? fichasLibres(intento).find((f) => clave(f.texto) === clave(intento.huecos[hueco]))?.id
    ?? null;
}

/** La ayuda encendida: `{ hueco, fichaId }` (la caja y la pieza que hay que ponerle), o null. */
export function ayudaActual(intento) {
  if (intento.ayudaHueco === null || intento.estado === 'acertado') return null;
  return { hueco: intento.ayudaHueco, fichaId: fichaCorrectaPara(intento, intento.ayudaHueco) };
}

/**
 * El niño suelta (o toca para poner) una pieza en una caja.
 * @param entrada  `{ fichaId, hueco, forma }`; `forma`: 'arrastre' | 'toque' (por defecto 'toque')
 * @returns `{ intento, efecto, completo }`; `efecto`: 'ignorado' | 'correcto' (queda puesta; verde) | 'incorrecto' (vuelve a su lugar)
 */
export function soltar(intento, { fichaId, hueco, forma = 'toque' }, ahoraMs) {
  const ignorado = { intento, efecto: 'ignorado', completo: false };
  if (intento.estado === 'acertado') return ignorado;
  const ficha = intento.fichas.find((f) => f.id === fichaId);
  if (!ficha || intento.colocadas.includes(fichaId)) return ignorado;
  if (!Number.isInteger(hueco) || hueco < 0 || hueco >= intento.huecos.length || intento.colocadas[hueco] !== null) return ignorado; // caja inexistente o ya llena
  if (ahoraMs - intento.ultimoToque < BLOQUEO_MS) return ignorado;

  const ms = msDesde(intento, ahoraMs);
  const base = { ...intento, primerToque: intento.primerToque ?? ms, intentos: intento.intentos + 1, ultimoToque: ahoraMs };

  if (clave(ficha.texto) === clave(intento.huecos[hueco])) {
    const colocadas = intento.colocadas.map((f, i) => (i === hueco ? fichaId : f));
    const lleno = colocadas.every((f) => f !== null);
    const siguiente = {
      ...base,
      colocadas,
      ordenLlenado: [...intento.ordenLlenado, hueco],
      toques: [...intento.toques, { fichaId, texto: ficha.texto, hueco, correcto: true, ms, forma }],
      ayudaHueco: intento.ayudaHueco === hueco ? null : intento.ayudaHueco, // la caja ayudada ya quedó resuelta
      estado: lleno ? 'acertado' : intento.errores.length ? 'ayuda' : 'esperando',
      fin: lleno ? ahoraMs : null,
    };
    return { intento: siguiente, efecto: 'correcto', completo: lleno };
  }

  const erroresPorHueco = intento.erroresPorHueco.map((n, i) => (i === hueco ? n + 1 : n));
  const enciendeAyuda = erroresPorHueco[hueco] >= ERRORES_PARA_AYUDA;
  return {
    intento: {
      ...base,
      estado: 'ayuda',
      errores: [...intento.errores, { fichaId, texto: ficha.texto, hueco }],
      erroresMs: [...intento.erroresMs, ms],
      erroresPorHueco,
      toques: [...intento.toques, { fichaId, texto: ficha.texto, hueco, correcto: false, ms, forma }],
      ayudaHueco: enciendeAyuda ? hueco : intento.ayudaHueco,
      conAyudaVisual: intento.conAyudaVisual || enciendeAyuda,
    },
    efecto: 'incorrecto',
    completo: false,
  };
}

/**
 * El niño tocó una pieza para oír su sonido (no la puso). No es un error ni mueve el bloqueo de toques.
 * @returns `{ intento, efecto }` con efecto 'ignorado' | 'escuchada'
 */
export function escuchar(intento, fichaId, ahoraMs) {
  const ficha = intento.fichas.find((f) => f.id === fichaId);
  if (!ficha || intento.estado === 'acertado') return { intento, efecto: 'ignorado' };
  return {
    intento: { ...intento, escuchasPieza: [...intento.escuchasPieza, { texto: ficha.texto, ms: msDesde(intento, ahoraMs) }] },
    efecto: 'escuchada',
  };
}
