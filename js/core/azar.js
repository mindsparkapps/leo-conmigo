// Azar reproducible. Todo el motor recibe `aleatorio` (una función que devuelve
// un número en [0, 1)) para poder probarlo con semillas fijas.

/** Generador mulberry32: misma semilla, misma secuencia. */
export function crearAleatorio(semilla = 1) {
  let a = semilla >>> 0;
  return function aleatorio() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Devuelve una copia barajada (Fisher-Yates). No modifica la lista original. */
export function barajar(lista, aleatorio = Math.random) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function elegirUno(lista, aleatorio = Math.random) {
  return lista.length ? lista[Math.floor(aleatorio() * lista.length)] : undefined;
}
