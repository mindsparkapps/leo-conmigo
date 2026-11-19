// Avatar que felicita: al acertar aparece sobre la zona de respuestas, sonríe, inclina la cabeza y mueve la boca
// al ritmo del elogio. La boca sigue al audio de verdad: audio.js avisa con el evento «leo:voz» qué elemento suena y
// aquí se lee su `currentTime` para buscar la apertura en data/avatar/bocas.json (una cifra por cada 1/30 s,
// calculada de cada mp3). Con voz sintética no hay curva: la boca se abre y cierra hasta que termina.

// relativas al módulo, no a la página (así funciona también desde las páginas de prueba)
const RUTA_SVG = new URL('../../data/avatar/avatar.svg', import.meta.url);
const RUTA_BOCAS = new URL('../../data/avatar/bocas.json', import.meta.url);
const ZONAS = ['.zona-opciones', '.esc-piezas', '.esc-cajas', '.libro-opciones', '.zona-modelo'];
const PLAZO_MAXIMO_MS = 3200; // si la voz nunca avisa que terminó, el avatar se va igual
const SALIDA_MS = 260;
const FPS = 30;
const TAMANO = 0.5625; // dos reducciones del 25 % (0,75 × 0,75) sobre el lado de la zona de respuestas

let recursos = null;

/** Baja el dibujo y las curvas de la boca una sola vez (llamar al empezar una sesión para que no haya espera). */
export function prepararAvatar() {
  recursos ??= Promise.all([
    fetch(RUTA_SVG).then((r) => (r.ok ? r.text() : null)),
    fetch(RUTA_BOCAS).then((r) => (r.ok ? r.json() : {})),
  ]).catch(() => [null, {}]);
  return recursos;
}

function zonaDeRespuesta(vista) {
  for (const selector of ZONAS) {
    const zona = vista.querySelector(selector);
    if (zona && zona.getBoundingClientRect().width > 0) return zona;
  }
  return vista;
}

/**
 * El rectángulo que ocupan de verdad las respuestas: la unión de los hijos visibles de la zona (las cartas o piezas).
 * La zona puede ser más ancha que lo que muestra (una grilla centrada), y así el avatar queda al medio de las respuestas.
 */
function rectanguloDeRespuestas(zona) {
  let izq = Infinity, arr = Infinity, der = -Infinity, aba = -Infinity;
  for (const hijo of zona.children) {
    const h = hijo.getBoundingClientRect();
    if (h.width === 0 || h.height === 0) continue;
    izq = Math.min(izq, h.left); arr = Math.min(arr, h.top);
    der = Math.max(der, h.right); aba = Math.max(aba, h.bottom);
  }
  if (izq === Infinity) return zona.getBoundingClientRect();
  return { left: izq, top: arr, width: der - izq, height: aba - arr };
}

const nombreDe =(ruta) => String(ruta ?? '').split('/').pop().replace(/\.mp3$/, '');

/**
 * Muestra el avatar sobre la zona de respuestas de `vista` mientras suena `texto` (el elogio).
 * Llamarla ANTES de pedir la voz para no perder el aviso. Devuelve `{ terminado, cerrar }`: `terminado` se cumple
 * cuando el avatar ya se fue (el elogio terminó o se cumplió el plazo).
 */
export function avatarFelicita(vista, texto, { conVoz = true } = {}) {
  let cerrado = false;
  let cuadro = 0;
  let plazo = 0;
  let capa = null;
  let abierta = null;
  let voz = null; // { audio, curva } o { sintetica: true }
  let avisarFin;
  const terminado = new Promise((r) => { avisarFin = r; });

  function alVoz(e) {
    if (cerrado || e.detail?.texto !== texto) return;
    voz = e.detail.audio ? { audio: e.detail.audio, ruta: e.detail.ruta } : { sintetica: true };
    if (e.detail.audio) {
      const a = e.detail.audio;
      const irse = () => setTimeout(cerrar, 250);
      a.addEventListener('ended', irse, { once: true });
      a.addEventListener('pause', irse, { once: true });
    } else {
      e.detail.fin?.then(() => setTimeout(cerrar, 150));
    }
  }
  if (conVoz) globalThis.addEventListener('leo:voz', alVoz);

  function cerrar() {
    if (cerrado) return;
    cerrado = true;
    globalThis.removeEventListener('leo:voz', alVoz);
    cancelAnimationFrame(cuadro);
    clearTimeout(plazo);
    if (capa) {
      capa.classList.add('saliendo');
      setTimeout(() => { capa.remove(); avisarFin(); }, SALIDA_MS);
    } else {
      avisarFin();
    }
  }
  plazo = setTimeout(cerrar, conVoz ? PLAZO_MAXIMO_MS : 1400);

  prepararAvatar().then(([svg, bocas]) => {
    if (cerrado || !svg || !vista.isConnected) { if (!svg) cerrar(); return; }
    const r = rectanguloDeRespuestas(zonaDeRespuesta(vista));
    const lado = Math.max(80,Math.min(r.width, r.height, window.innerHeight * 0.7) * 0.95 * TAMANO);
    capa = document.createElement('div');
    capa.className = 'avatar-felicita';
    capa.setAttribute('aria-hidden', 'true');
    capa.style.width = capa.style.height = `${lado}px`;
    capa.style.left = `${r.left + r.width / 2 - lado / 2}px`;
    capa.style.top = `${r.top + r.height / 2 - lado / 2}px`;
    capa.innerHTML = svg;
    document.body.append(capa);
    abierta = capa.querySelector('.av-abierta');
    setTimeout(() => capa.classList.add('feliz'), 30); // tras pintarse una vez, para que la sonrisa sea una transición
    const t0 = performance.now();
    const paso = (ahora) => {
      if (cerrado) return;
      let apertura = 0;
      if (voz?.audio) {
        const curva = bocas[nombreDe(voz.ruta)];
        const i = Math.floor(voz.audio.currentTime * FPS);
        apertura = curva ? (curva[i] ?? 0) : 0.4 + 0.3 * Math.sin(voz.audio.currentTime * 22);
      } else if (voz?.sintetica) {
        apertura = 0.25 + 0.25 * Math.abs(Math.sin((ahora - t0) / 90));
      }
      // la boca abierta nunca cierra del todo mientras habla: entre sílabas queda entreabierta
      abierta.style.transform = `scaleY(${apertura > 0 ? 0.15 + 0.85 * apertura : 0.02})`;
      cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
  });

  return { terminado, cerrar };
}
