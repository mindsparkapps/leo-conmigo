// Monedas de oro y cofre (fase 11). Una moneda dibujada por cada moneda que tiene (hasta 20) y el número, chico,
// para que el niño vaya conociendo los números. Nada de esto se anima salvo al ganar monedas.

import { el } from './dom.js';
import { monedasADibujar } from '../core/album.js';

const ICONO = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <circle cx="32" cy="32" r="29" fill="#f2b632" stroke="#c48a12" stroke-width="4"/>
  <circle cx="32" cy="32" r="19" fill="none" stroke="#c48a12" stroke-width="3"/>
  <path d="M32 18l4.4 9 9.9 1.4-7.2 7 1.7 9.8L32 40.5l-8.8 4.7 1.7-9.8-7.2-7 9.9-1.4z" fill="#c48a12"/>
</svg>`;

/** Una moneda. `llena: false` la deja como contorno punteado (las que aún faltan). */
export function crearMoneda({ llena = true, retraso = null } = {}) {
  const moneda = el('span', { class: llena ? 'moneda' : 'moneda moneda-vacia', 'aria-hidden': 'true' });
  if (llena) moneda.innerHTML = ICONO;
  if (retraso != null) {
    moneda.classList.add('moneda-entra');
    moneda.style.animationDelay = `${retraso}ms`;
  }
  return moneda;
}

/**
 * Fila de monedas: `llenas` de oro y, hasta completar `total`, contornos punteados.
 * Con `nuevas`, las últimas `nuevas` monedas llenas entran una a una (≤ 2 s en total).
 */
export function crearMonedas({ total, llenas = total, max = 20, nuevas = 0 }) {
  const cuantas = monedasADibujar(total, max);
  const oro = Math.min(monedasADibujar(llenas, max), cuantas);
  const primeraNueva = Math.max(0, oro - nuevas);
  const paso = nuevas > 0 ? Math.min(180, Math.floor(1800 / nuevas)) : 0;
  const monedas = [];
  for (let i = 0; i < cuantas; i++) {
    if (i < oro) monedas.push(crearMoneda({ llena: true, retraso: i >= primeraNueva ? (i - primeraNueva) * paso : null }));
    else monedas.push(crearMoneda({ llena: false }));
  }
  return el('span', { class: 'monedas', 'aria-hidden': 'true' }, monedas);
}

/** El cofre: sus monedas y el número del saldo. */
export function crearCofre({ saldo, nuevas = 0 }) {
  return el(
    'div',
    { class: 'cofre', role: 'img', 'aria-label': `Tienes ${saldo} ${saldo === 1 ? 'moneda' : 'monedas'}` },
    crearMonedas({ total: saldo, nuevas }),
    el('span', { class: 'cofre-numero', 'aria-hidden': 'true' }, String(saldo)),
  );
}
