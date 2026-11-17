// Cosas comunes del modo Escritura (Ampliación 5). Lógica pura, sin DOM.

/** Prefijo de los ids de elemento de las palabras del banco incluido (`esc:<texto>`). */
export const PREFIJO_BANCO = 'esc:';

/**
 * ¿Es un registro (progreso, nivel, sesión o respuesta) de la escritura?
 * La lectura y la escritura comparten almacenes: todo lo que mira registros de la lectura debe ignorar los de
 * escritura con esta función (y es la ÚNICA forma de decidirlo).
 *  - `actividad` que empieza con `E` y un número (`E07`),
 *  - `tipo: 'escritura'` (sesiones) o `modo: 'escritura'` (respuestas).
 */
export function esDeEscritura(registro) {
  if (!registro || typeof registro !== 'object') return false;
  if (registro.tipo === 'escritura' || registro.modo === 'escritura') return true;
  return typeof registro.actividad === 'string' && /^E\d/.test(registro.actividad);
}

/**
 * Id de elemento (el de `progresos`) de una entrada del banco: `esc:<texto>`; en `E01` la pieza es la vocal y
 * el texto se repite entre imágenes, así que se usa el nombre de la imagen (`esc:abeja`).
 */
export function idDeBanco(entrada) {
  return `${PREFIJO_BANCO}${String(entrada.modelo ?? entrada.texto).toLowerCase()}`;
}
