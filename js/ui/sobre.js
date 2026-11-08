// Sobre de láminas: un sobre metálico (con la portada del álbum) como los de cartas coleccionables.
// - crearSobreChico(): el sobre de la tienda (solo dibujo).
// - presentarSobre(): el sobre comprado, en el centro de la pantalla; se abre arrastrando el dedo por su borde superior
//   (la tira se corta y se levanta) y las láminas se deslizan hacia afuera. Un toque también lo abre (sin arrastrar).

import { el } from './dom.js';
import { RUTA_PORTADA } from './laminas.js';

const CORTE = 13; // % de alto donde está el corte
const ARRASTRE_MINIMO = 0.88; // fracción del ancho que hay que recorrer para abrirlo
const PUNTOS = 24;

/** Borde dentado del corte: dos polígonos (tira y cuerpo) que encajan. */
function poligonos() {
  const borde = [];
  for (let i = 0; i <= PUNTOS; i++) borde.push([(i / PUNTOS) * 100, CORTE + (i % 2 ? 1.1 : -1.1)]);
  const texto = (puntos) => `polygon(${puntos.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(', ')})`;
  return {
    tira: texto([[0, 0], [100, 0], ...borde.slice().reverse()]),
    cuerpo: texto([...borde, [100, 100], [0, 100]]),
  };
}

function caras(abierto = false) {
  const { tira, cuerpo } = poligonos();
  const fondo = `url("${new URL(RUTA_PORTADA, document.baseURI).href}")`; // en la hoja de estilos la ruta sería relativa a css/
  const hacerCara = (clase, recorte) => {
    const cara = el('span', { class: `sobre-cara ${clase}`, 'aria-hidden': 'true' }, el('span', { class: 'sobre-brillo' }), el('span', { class: 'sobre-sello' }));
    cara.style.setProperty('--portada', fondo);
    cara.style.clipPath = recorte;
    cara.style.webkitClipPath = recorte;
    return cara;
  };
  return { tira: hacerCara('sobre-tira', tira), cuerpo: hacerCara('sobre-cuerpo', cuerpo), abierto };
}

/** El sobre de la tienda: pequeño, brillante, con la cantidad de láminas. */
export function crearSobreChico(cantidad) {
  const { tira, cuerpo } = caras();
  const sobre = el('span', { class: 'sobre-pack sobre-chico', 'aria-hidden': 'true' }, cuerpo, tira, el('span', { class: 'sobre-cantidad' }, `×${cantidad}`));
  return sobre;
}

/**
 * Muestra el sobre comprado en el centro, listo para abrir.
 * @param zona      contenedor (la vista) donde se superpone
 * @param dibujos   nodos de las láminas que trae
 * @param opciones  { mensaje, acciones: nodos que aparecen al final, alAbrir }
 * @returns {() => void} quita la escena
 */
export function presentarSobre(zona, dibujos, { mensaje, acciones = [], alAbrir = () => {} } = {}) {
  const { tira, cuerpo } = caras();
  const laminas = el(
    'span',
    { class: 'sobre-laminas', 'aria-hidden': 'true' },
    dibujos.map((d, i) => {
      const caja = el('span', { class: 'sobre-lamina' }, d);
      caja.style.setProperty('--i', String(i));
      return caja;
    }),
  );
  const tijera = el('span', { class: 'sobre-tijera', 'aria-hidden': 'true' }, '✂');
  const linea = el('span', { class: 'sobre-linea', 'aria-hidden': 'true' }, tijera);
  const sobre = el(
    'div',
    { class: 'sobre-pack sobre-grande', role: 'button', tabindex: '0', 'aria-label': 'Abrir el sobre: arrastra por arriba o toca' },
    laminas,
    cuerpo,
    tira,
    linea,
  );
  const aviso = el('p', { class: 'mensaje-nino mensaje-premio sobre-mensaje', role: 'status' }, mensaje ?? '');
  const pie = el('div', { class: 'acciones-inicio sobre-acciones', hidden: true }, acciones);
  const escena = el('div', { class: 'sobre-escena' }, aviso, el('div', { class: 'sobre-centro' }, sobre), pie);
  zona.append(escena);

  let abierto = false;
  const progreso = (p) => {
    sobre.style.setProperty('--p', p.toFixed(3));
  };

  function abrir() {
    if (abierto) return;
    abierto = true;
    progreso(1);
    sobre.classList.add('cortado');
    alAbrir();
    const hijas = [...laminas.children];
    hijas.forEach((h, i) => setTimeout(() => h.classList.add('sale'), 450 + i * 260));
    const total = 450 + hijas.length * 260 + 700;
    setTimeout(() => {
      sobre.classList.add('vacio');
      hijas.forEach((h) => h.classList.add('abanico'));
      aviso.textContent = '¡Tus láminas nuevas! Pégalas en el álbum.';
    }, total);
    setTimeout(() => {
      pie.hidden = false;
      pie.classList.add('aparece');
    }, total + 900);
  }

  // Arrastre: el recorrido horizontal con el dedo va cortando la tira
  let inicio = null;
  let movido = false;
  sobre.addEventListener('pointerdown', (e) => {
    if (abierto) return;
    inicio = { x: e.clientX, id: e.pointerId };
    movido = false;
    sobre.classList.add('cortando');
    try { sobre.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
  });
  sobre.addEventListener('pointermove', (e) => {
    if (!inicio || abierto || e.pointerId !== inicio.id) return;
    const ancho = sobre.getBoundingClientRect().width || 1;
    const dx = Math.abs(e.clientX - inicio.x);
    if (dx > 8) movido = true;
    const p = Math.min(1, dx / (ancho * ARRASTRE_MINIMO));
    progreso(p);
    if (p >= 1) abrir();
  });
  const soltar = (e) => {
    if (!inicio || (e && e.pointerId !== inicio.id)) return;
    inicio = null;
    sobre.classList.remove('cortando');
    if (!abierto && movido) progreso(0); // no llegó: la tira vuelve a su lugar
  };
  sobre.addEventListener('pointerup', soltar);
  sobre.addEventListener('pointercancel', soltar);
  // Un toque (o Enter/Espacio) también lo abre
  sobre.addEventListener('click', () => {
    if (!movido) abrir();
    movido = false;
  });
  sobre.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      abrir();
    }
  });
  sobre.focus({ preventScroll: true });

  return () => escena.remove();
}
