// Monedas de oro en 3D (CSS) y cofre. Una moneda dibujada por cada moneda que tiene (hasta 20) y el número, chico,
// para que el niño vaya conociendo los números. Las monedas de las filas están inclinadas (se nota el grosor);
// solo giran las "voladoras" y la del saldo de la esquina.

import { el } from './dom.js';
import { monedasADibujar } from '../core/album.js';

const REBANADAS = 6; // discos apilados que forman el canto

const ESTRELLA = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <circle cx="32" cy="32" r="22" fill="none" stroke="#b57a0c" stroke-width="3" opacity=".8"/>
  <path d="M32 15l5 10.5 11.5 1.6-8.3 8.1 2 11.4L32 41l-10.2 5.6 2-11.4-8.3-8.1 11.5-1.6z" fill="#b57a0c" opacity=".9"/>
</svg>`;

/**
 * Una moneda 3D. `gira`: da vueltas sin parar. `tamano`: lado en px (por defecto lo manda el CSS).
 * Tiene frente, dorso y un canto de varias rebanadas para que se vea con grosor al girar.
 */
export function crearMoneda3D({ gira = false, tamano = null } = {}) {
  const canto = Array.from({ length: REBANADAS }, (_, i) => {
    const z = (i / (REBANADAS - 1) - 0.5) * 2; // −1 … 1 (en múltiplos del medio grosor)
    return el('span', { class: 'm3-canto', style: `--z:${z}` });
  });
  const frente = el('span', { class: 'm3-cara m3-frente' });
  frente.innerHTML = ESTRELLA;
  const dorso = el('span', { class: 'm3-cara m3-dorso' });
  dorso.innerHTML = ESTRELLA;
  const giro = el('span', { class: 'moneda3d-giro' }, canto, frente, dorso);
  const moneda = el('span', { class: gira ? 'moneda3d gira' : 'moneda3d', 'aria-hidden': 'true' }, giro);
  if (tamano) {
    moneda.style.setProperty('--m', `${tamano}px`);
    moneda.style.setProperty('--g', `${(tamano * 0.07).toFixed(1)}px`); // medio grosor
  }
  return moneda;
}

/** Una moneda. `llena: false` la deja como contorno punteado (las que aún faltan). */
export function crearMoneda({ llena = true, retraso = null } = {}) {
  const moneda = el('span', { class: llena ? 'moneda' : 'moneda moneda-vacia', 'aria-hidden': 'true' });
  if (llena) moneda.append(crearMoneda3D());
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

/** Un precio: una sola moneda girando y el número (con `prefijo`, p. ej. «+»). */
export function crearPrecio(cantidad, { prefijo = '' } = {}) {
  return el(
    'span',
    { class: 'premio-precio', 'aria-hidden': 'true' },
    crearMoneda3D({ gira: true, tamano: 36 }),
    el('span', { class: 'cofre-numero' }, `${prefijo}${cantidad}`),
  );
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
