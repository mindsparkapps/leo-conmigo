// Las láminas que el niño ganó y aún no pegó: aparecen sueltas sobre el libro.
//  - Doble toque (o doble clic): la lámina se voltea y muestra su página (letra) y su número, por ejemplo «A-7».
//  - Arrastrar: se despega y se lleva al libro; al soltarla, quien llamó (`alSoltar`) dice si cayó en su lugar.
//    Si no cayó, la lámina vuelve despacio a donde estaba (sin sonido, sin rojo).
// Solo toques simples: no hace falta mantener apretado nada.

import { el } from './dom.js';

const UMBRAL_ARRASTRE_PX = 8;
const DOBLE_TOQUE_MS = 450;

/** Un número estable por código y por `sal` (distinto para cada rasgo), para un desorden que no cambia al redibujar. */
function azar(codigo, sal) {
  let h = 7 + sal * 131;
  for (const c of String(codigo)) h = (h * 33 + c.charCodeAt(0)) % 1009;
  return h;
}
/** Desorden de cada lámina en la fila: ángulo (−9° a 9°), altura (−9 a 9 px) y separación (−5 a 5 px). */
const desorden = (codigo) => ({
  giro: (azar(codigo, 0) % 19) - 9,
  sube: (azar(codigo, 1) % 19) - 9,
  sepa: (azar(codigo, 2) % 11) - 5,
});

/**
 * @param contenedor  elemento (position: relative) sobre el que flotan las láminas
 * @param laminas     [{ codigo, letra, numero, nodo }]  `nodo` es el dibujo de la lámina (se usa una vez)
 * @param alSoltar    async ({ codigo, ... }, { x, y }) => boolean  — x, y: centro de la lámina en la pantalla;
 *                    true = quedó pegada (la lámina desaparece)
 * @param alArrastrar ({ codigo, ... } | null) => void  — al empezar (la lámina) y al terminar (null) de arrastrar
 */
export function crearLaminasSueltas({ contenedor, laminas, alSoltar, alArrastrar = () => {} }) {
  const capa = el('div', { class: 'laminas-sueltas' });
  contenedor.prepend(capa); // una fila encima del libro, no sobre él
  const pendientes = [...laminas];
  const enPantalla = new Set();

  function poner(lamina) {
    const d = desorden(lamina.codigo);
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
        style: `--giro-base:${d.giro}deg;--sube:${d.sube}px;--sepa:${d.sepa}px`,
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
          acomodar();
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

  /** Si no caben en una línea, las láminas se montan unas sobre otras (las últimas encima). */
  function acomodar() {
    const cajas = [...capa.children];
    const ancho = cajas[0]?.offsetWidth ?? 0;
    const disponible = capa.clientWidth;
    let solape = 0;
    if (cajas.length > 1 && ancho && cajas.length * (ancho + 10) > disponible) {
      solape = -Math.ceil((cajas.length * (ancho + 10) - disponible) / (cajas.length - 1));
    }
    capa.style.setProperty('--solape', `${solape}px`);
  }
  function reponer() {
    while (pendientes.length) poner(pendientes.shift());
    acomodar();
  }
  reponer();
  const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(acomodar) : null;
  observador?.observe(capa);

  return {
    destruir: () => {
      observador?.disconnect();
      capa.remove();
    },
    cantidad: () => enPantalla.size + pendientes.length,
  };
}
