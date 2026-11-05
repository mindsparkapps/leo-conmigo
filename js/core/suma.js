// Suma de control para entrar al modo adulto. Lógica pura, sin DOM.

/** Dos sumandos de dos cifras (12 a 89). `aleatorio` se inyecta para poder probarla. */
export function generarSuma(aleatorio = Math.random) {
  const entre = (min, max) => min + Math.floor(aleatorio() * (max - min + 1));
  const a = entre(12, 89);
  const b = entre(12, 89);
  return { a, b, resultado: a + b };
}

/** Acepta solo dígitos (con espacios alrededor) que igualen el resultado. */
export function esRespuestaCorrecta(suma, texto) {
  const limpio = String(texto ?? '').trim();
  return /^\d{1,3}$/.test(limpio) && Number(limpio) === suma.resultado;
}
