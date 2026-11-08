// El saldo de monedas en la esquina superior derecha, en todas las pantallas del niño (también durante el juego).
// Es una moneda 3D que gira y el total. `sumar` lo hace subir con un «squash and stretch» cada vez que llega una moneda.

import { crearMoneda3D } from './moneda.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { saldo as calcularSaldo } from '../core/album.js';

let caja = null;
let numero = null;
let valor = 0;
let version = 0; // sube con cada cambio manual: una lectura vieja del almacén no pisa lo que se fijó después
let animacion = null;

function asegurar() {
  if (caja) return;
  caja = document.createElement('div');
  caja.id = 'saldo-esquina';
  caja.setAttribute('role', 'status');
  caja.hidden = true;
  numero = document.createElement('span');
  numero.className = 'saldo-numero';
  caja.append(crearMoneda3D({ gira: true }), numero);
  document.body.append(caja);
}

function pintar() {
  numero.textContent = String(valor);
  caja.setAttribute('aria-label', `Tienes ${valor} ${valor === 1 ? 'moneda' : 'monedas'}`);
}

/** Pone el total (sin animar). */
export function fijarSaldo(n) {
  asegurar();
  version += 1;
  valor = n;
  pintar();
}

/** Suma monedas al total que se ve y lo hace «aplastarse y estirarse». */
export function sumarSaldo(n) {
  asegurar();
  version += 1;
  valor += n;
  pintar();
  animacion?.cancel();
  if (!caja.animate || matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  animacion = caja.animate(
    [
      { transform: 'scale(1, 1)' },
      { transform: 'scale(1.32, 0.72)', offset: 0.25 },
      { transform: 'scale(0.84, 1.28)', offset: 0.5 },
      { transform: 'scale(1.1, 0.94)', offset: 0.75 },
      { transform: 'scale(1, 1)' },
    ],
    { duration: 340, easing: 'ease-out' },
  );
}

/** Dónde está el total en la pantalla (a donde vuelan las monedas). */
export function destinoSaldo() {
  asegurar();
  caja.hidden = false;
  const r = caja.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

async function leerSaldo() {
  const actual = version;
  try {
    const perfil = await perfilActivo();
    if (!perfil) return;
    const store = await obtenerStore();
    const n = calcularSaldo(await store.listar('movimientos', { perfilId: perfil.id }));
    if (actual === version) {
      valor = n;
      pintar();
    }
  } catch (error) {
    console.error('No se pudo leer el saldo', error);
  }
}

/** Muestra el total en las pantallas del niño (#/nino…) y lo oculta en las del adulto. */
export function iniciarSaldo() {
  asegurar();
  const alRuta = () => {
    const enNino = location.hash.startsWith('#/nino') || location.hash === '' || location.hash === '#/';
    caja.hidden = !enNino;
    if (enNino) leerSaldo();
  };
  addEventListener('hashchange', alRuta);
  alRuta();
}
