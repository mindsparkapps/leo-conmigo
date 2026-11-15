// Fin de sesión: celebración y calcomanía nueva. Sin números ni porcentajes de aciertos (PLAN.md §5).
// Si la calcomanía completa el álbum: el álbum entero, el cofre con sus monedas nuevas y un álbum vacío al volver.

import { el } from '../ui/dom.js';
import { deshabilitarAdulto } from '../acceso.js';
import { NOMBRE_APP } from '../config.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { desbloquearAudio, detener, hablarTexto } from '../audio.js';
import { vibrar } from '../hardware.js';
import { liberarUrls } from '../medios.js';
import { crearCofre } from '../ui/moneda.js';
import { mapaDePropias, nodoDeCalcomania } from '../ui/calcomania.js';
import { ganarCalcomania, pagarLeccion } from '../albumes.js';
import { destinoSaldo, fijarSaldo } from '../ui/saldo.js';
import { lanzarMonedas } from '../ui/monedas-vuelo.js';
import { lanzarConfeti } from '../ui/confeti.js';

export const titulo = NOMBRE_APP;

const ICONO_JUGAR = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M18 8l38 24-38 24z" fill="currentColor"/></svg>`;

let premio = null;

/**
 * La sesión deja aquí lo que debe mostrarse:
 * { codigo, ajustes (ya normalizados), album: null | { numero, codigos, monedas }, saldo }
 */
export function establecerPremio(datos) {
  premio = datos;
}

/**
 * Cierra una lección: elige la calcomanía de hoy, paga las monedas de la lección y deja todo listo para la pantalla del
 * premio. Lo usan el fin de la sesión y el atajo «saltar la lección» de las herramientas de desarrollador.
 */
export async function terminarLeccion(store, perfil, ajustes, { coleccionId = null } = {}) {
  const { codigo, album, saldo } = await ganarCalcomania(store, perfil, { coleccionId });
  const pago = await pagarLeccion(store, perfil);
  establecerPremio({ codigo, ajustes, album, saldo: saldo + pago.cantidad, monedas: pago.cantidad, saldoAntes: pago.saldoAntes });
}

/** Confeti que cae (≈ 2 s). Se llama igual que antes (`vista` ya no hace falta): ahora son papelitos, no estrellas. */
export function lluviaDeEstrellas() {
  lanzarConfeti();
}

export function montar(contenedor, { ir }) {
  deshabilitarAdulto();
  if (!premio) {
    ir('/nino'); // abierto directamente (p. ej. al recargar): no hay nada que premiar
    return undefined;
  }
  const { codigo, ajustes, album = null, saldo = 0, monedas = 0, saldoAntes = 0 } = premio;
  // Al completar la práctica: el botón es «volver a jugar» (la casa queda para el resto de pantallas)
  const casa = el('button', { type: 'button', class: 'boton-jugar premio-jugar', 'aria-label': 'Volver a jugar', onclick: () => { desbloquearAudio(); ir('/nino/sesion'); } });
  casa.innerHTML = ICONO_JUGAR;

  const centro = el('div', { class: album ? 'premio-album' : 'premio-calcomania' });
  if (!album) {
    // La calcomanía flota; un toque la agranda y otro la devuelve a su tamaño
    centro.addEventListener('click', () => centro.classList.toggle('ampliada'));
  }
  const vista = el(
    'section',
    { class: 'vista-nino premio-nino', 'aria-label': album ? 'Completaste tu álbum' : 'Calcomanía nueva' },
    centro,
    casa,
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

  // Las monedas de la lección salen volando hacia el total de la esquina, que sube con cada una
  let temporizador = 0;
  if (monedas > 0) {
    fijarSaldo(saldoAntes);
    destinoSaldo(); // muestra el total
    temporizador = setTimeout(() => {
      lanzarMonedas({ cantidad: monedas, sonido: ajustes.sonido, movimientoReducido: ajustes.intensidadCelebracion === 'ninguna', activo: () => vivo });
    }, 900);
  }

  return () => {
    clearTimeout(temporizador);
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
