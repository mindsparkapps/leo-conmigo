// Confeti al acertar: papelitos de colores que caen girando desde arriba (≈ 2 s) y se quitan solos.
// Con movimiento reducido no se dibuja nada (quien llama ya lo decide con `intensidadCelebracion`).

const COLORES = ['#f2b632', '#e8553d', '#2b7d51', '#287599', '#c04fb0', '#ff8fb1', '#7ed957'];

/**
 * @param cantidad  papelitos
 * @param aleatorio función de azar (para poder fijarla en pruebas)
 */
export function lanzarConfeti({ cantidad = 46, aleatorio = Math.random } = {}) {
  if (typeof document === 'undefined') return;
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const capa = document.createElement('div');
  capa.className = 'confeti';
  capa.setAttribute('aria-hidden', 'true');
  const ancho = window.innerWidth;
  const alto = window.innerHeight;
  for (let i = 0; i < cantidad; i++) {
    const papel = document.createElement('span');
    const redondo = aleatorio() < 0.3;
    const lado = 8 + aleatorio() * 8;
    papel.style.cssText = `left:${aleatorio() * ancho}px;width:${lado}px;height:${redondo ? lado : lado * 0.6}px;background:${COLORES[Math.floor(aleatorio() * COLORES.length)]};${redondo ? 'border-radius:50%' : ''}`;
    capa.append(papel);
    const deriva = (aleatorio() - 0.5) * 160;
    const giro = (aleatorio() - 0.5) * 1080;
    papel.animate?.(
      [
        { transform: 'translate(0, -20px) rotate(0deg)', opacity: 1 },
        { transform: `translate(${deriva}px, ${alto * 0.55}px) rotate(${giro / 2}deg)`, opacity: 1, offset: 0.65 },
        { transform: `translate(${deriva * 1.4}px, ${alto + 30}px) rotate(${giro}deg)`, opacity: 0.9 },
      ],
      { duration: 1500 + aleatorio() * 900, delay: aleatorio() * 350, easing: 'cubic-bezier(0.3, 0.1, 0.6, 1)', fill: 'forwards' },
    );
  }
  document.body.append(capa);
  setTimeout(() => capa.remove(), 3000);
}
