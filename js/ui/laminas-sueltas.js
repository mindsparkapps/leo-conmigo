// Las láminas que el niño ganó y aún no pegó: aparecen sueltas sobre el libro.
//  - Doble toque (o doble clic): la lámina se voltea y muestra su página (letra) y su número, por ejemplo «A-7».
//  - Arrastrar: se despega y se lleva al libro; al soltarla, quien llamó (`alSoltar`) dice si cayó en su lugar.
//    Si no cayó, la lámina vuelve despacio a donde estaba (sin sonido, sin rojo).
// Solo toques simples: no hace falta mantener apretado nada.

import { el } from './dom.js';

const UMBRAL_ARRASTRE_PX = 8;
const DOBLE_TOQUE_MS = 450;
const MAX_VISIBLES = 8; // si hay más, el resto aparece a medida que se pegan las primeras

/** Un ángulo pequeño y estable por código (−9° a 9°), para que parezcan tiradas sobre el libro. */
function inclinacion(codigo) {
  let h = 7;
  for (const c of String(codigo)) h = (h * 33 + c.charCodeAt(0)) % 1009;
  return (h % 19) - 9;
}

/**
 * @param contenedor  elemento (position: relative) sobre el que flotan las láminas
 * @param laminas     [{ codigo, letra, numero, nodo }]  `nodo` es el dibujo de la lámina (se usa una vez)
 * @param alSoltar    async ({ codigo, ... }, { x, y }) => boolean  — x, y: centro de la lámina en la pantalla;
 *                    true = quedó pegada (la lámina desaparece)
 * @param alArrastrar ({ codigo, ... } | null) => void  — al empezar (la lámina) y al terminar (null) de arrastrar
 */
export function crearLaminasSueltas({ contenedor, laminas, alSoltar, alArrastrar = () => {} }) {
  const capa = el('div', { class: 'laminas-sueltas' });
  contenedor.append(capa);
  const pendientes = [...laminas];
  const enPantalla = new Set();

  function poner(lamina, posicion) {
    const frente = el('div', { class: 'lamina-cara lamina-frente' }, lamina.nodo);
    const dorso = el(
      'div',
      { class: 'lamina-cara lamina-dorso' },
      el('span', { class: 'dorso-titulo' }, 'Página'),
      el('span', { class: 'dorso-letra' }, lamina.letra),
      el('span', { class: 'dorso-titulo' }, 'Lámina'),
      el('span', { class: 'dorso-numero' }, String(lamina.numero)),
    );
    const giro = el('div', { class: 'lamina-giro' }, frente, dorso);
    const caja = el(
      'div',
      {
        class: 'lamina-suelta',
        role: 'img',
        'aria-label': `Lámina ${lamina.letra}-${lamina.numero}. Toca dos veces para darle la vuelta; arrástrala a su lugar.`,
        style: `left:${posicion.izquierda}%;top:${posicion.arriba}%;--giro-base:${inclinacion(lamina.codigo)}deg`,
      },
      giro,
    );
    capa.append(caja);
    enPantalla.add(lamina.codigo);

    let inicio = null; // { x, y, arrastrando }
    let ultimoToque = -Infinity;

    caja.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      caja.setPointerCapture?.(e.pointerId);
      inicio = { x: e.clientX, y: e.clientY, arrastrando: false };
      caja.classList.remove('volviendo');
    });
    caja.addEventListener('pointermove', (e) => {
      if (!inicio) return;
      const dx = e.clientX - inicio.x;
      const dy = e.clientY - inicio.y;
      if (!inicio.arrastrando && Math.hypot(dx, dy) > UMBRAL_ARRASTRE_PX) {
        inicio.arrastrando = true;
        caja.classList.add('arrastrando'); // sube por encima de las demás (z-index en el CSS)
        alArrastrar(lamina);
      }
      if (inicio.arrastrando) {
        caja.style.setProperty('--dx', `${dx}px`);
        caja.style.setProperty('--dy', `${dy}px`);
      }
    });
    const terminar = async (e, cancelado) => {
      if (!inicio) return;
      const estado = inicio;
      inicio = null;
      caja.releasePointerCapture?.(e.pointerId);
      if (!estado.arrastrando) {
        // un toque: dos seguidos dan la vuelta a la lámina
        if (cancelado) return;
        const ahora = performance.now();
        if (ahora - ultimoToque < DOBLE_TOQUE_MS) {
          caja.classList.toggle('volteada');
          ultimoToque = -Infinity;
        } else ultimoToque = ahora;
        return;
      }
      caja.classList.remove('arrastrando');
      alArrastrar(null);
      let pegada = false;
      if (!cancelado) {
        const r = caja.getBoundingClientRect();
        try {
          pegada = await alSoltar(lamina, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
        } catch (error) {
          console.error('No se pudo pegar la lámina', error);
        }
      }
      if (pegada) {
        caja.classList.add('pegada');
        setTimeout(() => {
          caja.remove();
          enPantalla.delete(lamina.codigo);
          reponer();
        }, 450);
      } else {
        caja.classList.add('volviendo'); // vuelve a su sitio
        caja.style.setProperty('--dx', '0px');
        caja.style.setProperty('--dy', '0px');
      }
    };
    caja.addEventListener('pointerup', (e) => terminar(e, false));
    caja.addEventListener('pointercancel', (e) => terminar(e, true));
    caja.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Lugar de reposo de la lámina número `i`: repartidas a lo ancho, en la parte baja del libro, alternando alturas. */
  const posicionDe = (i) => ({ izquierda: 8 + ((i * 29) % 56), arriba: 58 + ((i * 13) % 5) * 7 });

  let usadas = 0;
  function reponer() {
    while (enPantalla.size < MAX_VISIBLES && pendientes.length) {
      poner(pendientes.shift(), posicionDe(usadas));
      usadas += 1;
    }
  }
  reponer();

  return {
    destruir: () => capa.remove(),
    cantidad: () => enPantalla.size + pendientes.length,
  };
}
