// Al terminar una lección: sale una lluvia de monedas 3D que gira hacia el total de la esquina. Cada una que llega
// suena como una moneda y hace «aplastarse y estirarse» al total (ui/saldo.js).

import { crearMoneda3D } from './moneda.js';
import { destinoSaldo, sumarSaldo } from './saldo.js';

const MAX_VISIBLES = 20;
let contexto = null;

/** El «ding» de una moneda, sintetizado (sin archivos): dos notas rápidas que suben un poco con cada moneda. */
export function sonidoMoneda(indice = 0) {
  try {
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AC) return;
    contexto ??= new AC();
    contexto.resume?.();
    const t = contexto.currentTime;
    const subir = 1 + Math.min(indice, 12) * 0.03;
    const salida = contexto.createGain();
    salida.gain.setValueAtTime(0.0001, t);
    salida.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    salida.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    salida.connect(contexto.destination);
    [[988, 0], [1319, 0.07]].forEach(([frecuencia, inicio]) => {
      const o = contexto.createOscillator();
      o.type = 'square';
      o.frequency.value = frecuencia * subir;
      const g = contexto.createGain();
      g.gain.setValueAtTime(inicio ? 0.0001 : 0.5, t);
      if (inicio) g.gain.setValueAtTime(0.5, t + inicio);
      o.connect(g).connect(salida);
      o.start(t);
      o.stop(t + 0.4);
    });
  } catch { /* sin audio: la animación sigue */ }
}

/**
 * @param cantidad  monedas que se ganaron (se dibujan hasta 20; cada una vale lo que haga falta para sumar el total)
 * @param origen    { x, y } de donde salen (por defecto, el centro de la pantalla)
 * @param sonido    false para que no suenen
 * @returns Promise que se cumple cuando llegó la última
 */
export function lanzarMonedas({ cantidad, origen = null, sonido = true, movimientoReducido = false, activo = () => true }) {
  const visibles = Math.min(cantidad, MAX_VISIBLES);
  const valores = Array.from({ length: visibles }, (_, i) => Math.floor(cantidad / visibles) + (i < cantidad % visibles ? 1 : 0));
  const destino = destinoSaldo();
  const centro = origen ?? { x: innerWidth / 2, y: innerHeight * 0.55 };
  const tamano = Math.round(Math.max(36, Math.min(innerWidth, innerHeight) * 0.09));

  return new Promise((resolver) => {
    let llegaron = 0;
    const llegar = (i) => {
      if (activo()) { // si el niño ya salió de la pantalla, el total se lee de nuevo del almacén
        sumarSaldo(valores[i]);
        if (sonido) sonidoMoneda(i);
      }
      llegaron += 1;
      if (llegaron === visibles) resolver();
    };
    if (!visibles) { resolver(); return; }
    for (let i = 0; i < visibles; i++) {
      const moneda = crearMoneda3D({ gira: true, tamano });
      moneda.classList.add('moneda-vuela');
      document.body.append(moneda);
      const x0 = centro.x + (Math.random() - 0.5) * innerWidth * 0.45 - tamano / 2;
      const y0 = centro.y + (Math.random() - 0.5) * innerHeight * 0.25 - tamano / 2;
      const x1 = destino.x - tamano / 2;
      const y1 = destino.y - tamano / 2;
      const retraso = i * 110;
      if (movimientoReducido || !moneda.animate) {
        moneda.remove();
        setTimeout(() => llegar(i), retraso);
        continue;
      }
      // sale con un salto, queda un instante en el aire y vuela girando hacia el total
      const animacion = moneda.animate(
        [
          { transform: `translate(${x0}px, ${y0 + 30}px) scale(0.2)`, opacity: 0 },
          { transform: `translate(${x0}px, ${y0 - 20}px) scale(1.15)`, opacity: 1, offset: 0.22 },
          { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1, offset: 0.34 },
          { transform: `translate(${x1}px, ${y1}px) scale(0.45)`, opacity: 1 },
        ],
        { duration: 1150, delay: retraso, easing: 'cubic-bezier(0.5, 0, 0.7, 1)', fill: 'both' },
      );
      animacion.onfinish = () => {
        moneda.remove();
        llegar(i);
      };
    }
  });
}
