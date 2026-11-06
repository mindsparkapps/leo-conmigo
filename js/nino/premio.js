// Fin de sesión: celebración y calcomanía nueva. Sin números ni porcentajes de aciertos (PLAN.md §5).
// Si la calcomanía completa el álbum: el álbum entero, el cofre con sus monedas nuevas y un álbum vacío al volver.

import { el } from '../ui/dom.js';
import { crearCandado } from '../ui/candado.js';
import { habilitarAdulto, deshabilitarAdulto } from '../acceso.js';
import { NOMBRE_APP } from '../config.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { desbloquearAudio, detener, hablarTexto } from '../audio.js';
import { vibrar } from '../hardware.js';
import { liberarUrls } from '../medios.js';
import { crearCofre } from '../ui/moneda.js';
import { mapaDePropias, nodoDeCalcomania } from '../ui/calcomania.js';

export const titulo = NOMBRE_APP;

const ICONO_CASA = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 8L6 32h8v22h14V40h8v14h14V32h8z" fill="currentColor"/></svg>`;

let premio = null;

/**
 * La sesión deja aquí lo que debe mostrarse:
 * { codigo, ajustes (ya normalizados), album: null | { numero, codigos, monedas }, saldo }
 */
export function establecerPremio(datos) {
  premio = datos;
}

/** Estrellas que suben y se desvanecen (≤ 1,5 s). Con movimiento reducido el CSS las oculta. */
export function lluviaDeEstrellas(vista) {
  const lluvia = el(
    'div',
    { class: 'estrellas', 'aria-hidden': 'true' },
    [12, 30, 50, 70, 88].map((x, i) => el('span', { style: `left:${x}%; animation-delay:${i * 90}ms` }, '⭐')),
  );
  vista.append(lluvia);
  setTimeout(() => lluvia.remove(), 1500);
}

export function montar(contenedor, { ir }) {
  deshabilitarAdulto();
  if (!premio) {
    ir('/nino'); // abierto directamente (p. ej. al recargar): no hay nada que premiar
    return undefined;
  }
  const { codigo, ajustes, album = null, saldo = 0 } = premio;
  const candado = crearCandado({
    alDesbloquear: () => {
      habilitarAdulto();
      ir('/adulto');
    },
  });
  const casa = el('button', { type: 'button', class: 'boton-casa', 'aria-label': 'Volver al inicio', onclick: () => ir('/nino') });
  casa.innerHTML = ICONO_CASA;

  const centro = el('div', { class: album ? 'premio-album' : 'premio-calcomania' });
  const vista = el(
    'section',
    { class: 'vista-nino premio-nino', 'aria-label': album ? 'Completaste tu álbum' : 'Calcomanía nueva' },
    centro,
    casa,
    candado,
  );
  contenedor.append(vista);

  let vivo = true;
  pintar(centro, { codigo, album, saldo }, () => vivo).catch((error) => console.error('No se pudo dibujar el premio', error));

  const celebra = ajustes.intensidadCelebracion !== 'ninguna';
  if (ajustes.intensidadCelebracion === 'normal') lluviaDeEstrellas(vista);
  if (celebra && ajustes.sonido) {
    desbloquearAudio();
    hablarTexto(album ? `¡Completaste tu álbum! ¡Ganaste ${album.monedas} monedas!` : '¡Lo lograste!', { velocidad: ajustes.velocidadVoz });
  }
  if (celebra && ajustes.vibracion) vibrar([40, 60, 40]);

  return () => {
    vivo = false;
    detener();
    liberarUrls();
    premio = null;
  };
}

async function pintar(centro, { codigo, album, saldo }, estaVivo) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  const propias = mapaDePropias(perfil ? await store.listar('calcomaniasPropias', { perfilId: perfil.id }) : []);
  if (!estaVivo()) return;

  if (!album) {
    const nodo = await nodoDeCalcomania(store, codigo, propias, { clase: 'calcomania-grande', decorativo: true });
    if (estaVivo() && nodo) centro.append(nodo);
    return;
  }
  // El álbum completo: todas sus calcomanías y el cofre con las monedas nuevas entrando una a una
  const nodos = (await Promise.all(album.codigos.map((c) => nodoDeCalcomania(store, c, propias)))).filter(Boolean);
  if (!estaVivo()) return;
  centro.append(
    el('div', { class: 'album album-completo' }, nodos),
    crearCofre({ saldo, nuevas: album.monedas }),
  );
}
