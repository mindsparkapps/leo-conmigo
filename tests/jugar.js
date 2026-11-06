// Ayudas para jugar ensayos de cualquier modo con el controlador (no es una prueba: no termina en .test.js).

import assert from 'node:assert/strict';

/**
 * Resuelve el ensayo actual como lo haría un niño (o el adulto, en lectura). Con `errar`, primero se equivoca una vez.
 * Devuelve el tiempo (ms) en que terminó. No llama a `avanzar`.
 */
export function resolver(ctl, visual, tiempo, { errar = false } = {}) {
  let t = tiempo + 1000;
  if (visual.modo === 'simple') {
    const mala = visual.cartas.find((c) => c.id !== visual.correctaId);
    if (errar && mala) {
      assert.equal(ctl.tocar(mala.id, t).efecto, 'ayuda');
      t += 600;
    }
    assert.equal(ctl.tocar(visual.correctaId, t).efecto, 'correcto');
    return t;
  }
  if (visual.modo === 'secuencia') {
    const usadas = new Set();
    for (let i = 0; i < visual.orden.length; i++) {
      const palabraId = visual.orden[i];
      if (errar && i === 0) {
        const mala = visual.fichas.find((f) => f.palabraId !== palabraId);
        if (mala) {
          assert.equal(ctl.tocar(mala.id, t).efecto, 'ayuda');
          t += 600;
        }
      }
      const ficha = visual.fichas.find((f) => f.palabraId === palabraId && !usadas.has(f.id));
      usadas.add(ficha.id);
      const r = ctl.tocar(ficha.id, t);
      assert.equal(r.efecto, i === visual.orden.length - 1 ? 'correcto' : 'paso');
      t += 500;
    }
    return t;
  }
  // lectura: el adulto confirma
  if (errar) {
    assert.equal(ctl.tocar('otra', t).efecto, 'ayuda');
    t += 600;
  }
  assert.equal(ctl.tocar('ok', t).efecto, 'correcto');
  return t;
}

/** Juega la sesión entera. `errar(n)` dice si en el ensayo n hay un error primero. */
export function jugarSesion(ctl, { errar = () => false, inicio = 1000 } = {}) {
  const vistos = [];
  const guardados = [];
  let t = inicio;
  let visual = ctl.iniciar(t);
  let n = 0;
  while (visual && !ctl.terminada) {
    vistos.push(visual);
    t = resolver(ctl, visual, t, { errar: errar(n) });
    t += 800;
    const sig = ctl.avanzar(t);
    guardados.push(sig.guardar);
    visual = sig.siguiente;
    n += 1;
    if (sig.terminada) break;
  }
  return { vistos, guardados, t };
}
