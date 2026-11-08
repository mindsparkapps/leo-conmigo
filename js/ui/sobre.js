// Sobre de láminas: un sobre metálico (con la portada del álbum) como los de cartas coleccionables.
// - crearSobreChico(): el sobre de la tienda (solo dibujo).
// - presentarSobre(): el sobre comprado, en el centro de la pantalla; se abre arrastrando el dedo por su borde superior
//   (la tira se corta y se levanta) y las láminas se deslizan hacia afuera. Un toque también lo abre (sin arrastrar).

import { el } from './dom.js';
import { RUTA_PORTADA } from './laminas.js';
import { sonidoCorte, sonidoLamina } from './sonidos.js';

const CORTE = 13; // % de alto donde está el corte
const ARRASTRE_MINIMO = 0.88; // fracción del ancho que hay que recorrer para abrirlo
const PUNTOS = 40;
const RELACION = 5 / 3; // alto / ancho del sobre

/**
 * Línea de corte casi recta, con una leve curvatura y una pendiente al azar (cada sobre se corta distinto) y un
 * temblor mínimo de papel. Devuelve los dos polígonos (tira y cuerpo) que encajan y los puntos de la línea.
 */
function poligonos(aleatorio = Math.random) {
  const pendiente = (aleatorio() * 2 - 1) * 2.4; // % de alto que sube o baja de un extremo al otro
  const curva = (aleatorio() * 2 - 1) * 1.3;
  const borde = [];
  for (let i = 0; i <= PUNTOS; i++) {
    const x = (i / PUNTOS) * 100;
    const u = (x - 50) / 50; // −1 … 1
    const y = CORTE + (pendiente * u) / 2 + curva * (1 - u * u) + (aleatorio() - 0.5) * 0.18;
    borde.push([x, y]);
  }
  const texto = (puntos) => `polygon(${puntos.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(', ')})`;
  return {
    tira: texto([[0, 0], [100, 0], ...borde.slice().reverse()]),
    cuerpo: texto([...borde, [100, 100], [0, 100]]),
    borde,
    angulo: (Math.atan((pendiente / 100) * RELACION) * 180) / Math.PI,
  };
}

function caras(abierto = false) {
  const { tira, cuerpo, borde, angulo } = poligonos();
  const fondo = `url("${new URL(RUTA_PORTADA, document.baseURI).href}")`; // en la hoja de estilos la ruta sería relativa a css/
  const hacerCara = (clase, recorte) => {
    const cara = el('span', { class: `sobre-cara ${clase}`, 'aria-hidden': 'true' }, el('span', { class: 'sobre-brillo' }), el('span', { class: 'sobre-sello' }));
    cara.style.setProperty('--portada', fondo);
    cara.style.clipPath = recorte;
    cara.style.webkitClipPath = recorte;
    return cara;
  };
  return { tira: hacerCara('sobre-tira', tira), cuerpo: hacerCara('sobre-cuerpo', cuerpo), borde, angulo, abierto };
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
  const { tira, cuerpo, borde, angulo } = caras();
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
  const trazo = el('span', { class: 'sobre-trazo', 'aria-hidden': 'true' });
  trazo.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false"><polyline points="${[borde[0], borde.at(-1)].map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="7 5" vector-effect="non-scaling-stroke"/></svg>`;
  const linea = el('span', { class: 'sobre-linea', 'aria-hidden': 'true' }, trazo, tijera);
  linea.style.setProperty('--angulo', `${angulo.toFixed(2)}deg`);
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
  let rasgado = false; // el sonido del corte ya empezó con el arrastre
  const progreso = (p) => {
    sobre.style.setProperty('--p', p.toFixed(3));
  };

  function abrir() {
    if (abierto) return;
    abierto = true;
    progreso(1);
    sobre.classList.add('cortado');
    if (!rasgado) sonidoCorte();
    alAbrir();
    const hijas = [...laminas.children];
    hijas.forEach((h, i) =>
      setTimeout(() => {
        h.classList.add('sale');
        sonidoLamina(i);
      }, 450 + i * 260),
    );
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
    if (movido && !rasgado) {
      rasgado = true;
      sonidoCorte();
    }
    const p = Math.min(1, dx / (ancho * ARRASTRE_MINIMO));
    progreso(p);
    if (p >= 1) abrir();
  });
  const soltar = (e) => {
    if (!inicio || (e && e.pointerId !== inicio.id)) return;
    inicio = null;
    sobre.classList.remove('cortando');
    if (!abierto && movido) {
      progreso(0); // no llegó: la tira vuelve a su lugar
      rasgado = false;
    }
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
