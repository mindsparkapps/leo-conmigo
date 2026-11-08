// Libro 3D con three.js: cada hoja tiene dos caras (una imagen de canvas por cara) y gira alrededor del lomo,
// curvándose un poco mientras pasa. Solo se dibuja mientras algo se mueve (ahorra batería).
// three.js va incluido en vendor/ (sin red): MIT, ver vendor/THREE-LICENSE.txt.
//
// Las caras llegan en orden: cara 0 = portada (frente de la hoja 0), cara 1 = su reverso, cara 2 = frente de la
// hoja 1, etc. Por eso el total debe ser par. «Páginas pasadas» (0..hojas) dice cuántas hojas están a la izquierda.

import * as THREE from '../../vendor/three.module.min.js';

const ANCHO = 1.5; // media doble página (3:4 con ALTO)
const ALTO = 2;
const SEGMENTOS = 22;
const SEPARACION = 0.006; // entre hojas apiladas, para que no se peleen en profundidad
const DURACION_S = 0.9;
const ARRASTRE_MIN_PX = 40;
const FOV = 30;

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
const suave = (t) => t * t * (3 - 2 * t);

/**
 * @param contenedor  elemento donde se inserta el <canvas> (debe tener tamaño)
 * @param caras       canvases 2D, cantidad par
 * @param alCambiar   ({ puedeAtras, puedeAdelante }) al empezar y cada vez que cambia la página
 * @throws si el navegador no tiene WebGL (quien llama debe mostrar otra cosa)
 */
export function crearLibro3D(contenedor, caras, { alCambiar = () => {} } = {}) {
  if (caras.length % 2 !== 0) throw new Error('El libro necesita un número par de caras');
  const hojas = caras.length / 2;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const lienzo = renderer.domElement;
  lienzo.classList.add('libro-lienzo');
  lienzo.setAttribute('aria-hidden', 'true');
  contenedor.append(lienzo);

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  const libro = new THREE.Group();
  escena.add(libro);

  const liberables = [];
  const anisotropia = renderer.capabilities.getMaxAnisotropy();
  const textura = (canvas, espejo) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, anisotropia);
    if (espejo) { // visto por detrás, el dibujo sale al revés: se voltea en horizontal
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.x = -1;
      t.offset.x = 1;
    }
    liberables.push(t);
    return t;
  };

  // Tapas: una detrás de cada lado, un poco más grandes que las hojas
  const materialTapa = new THREE.MeshBasicMaterial({ color: 0x1f5f82 });
  const geometriaTapa = new THREE.PlaneGeometry(ANCHO * 1.06, ALTO * 1.05);
  liberables.push(materialTapa, geometriaTapa);
  const tapas = [-1, 1].map((lado) => {
    const tapa = new THREE.Mesh(geometriaTapa, materialTapa);
    tapa.position.set(lado * (ANCHO / 2 + 0.01), 0, -0.02);
    libro.add(tapa);
    return tapa;
  });

  // Hojas: la geometría se recalcula vértice por vértice para poder curvarlas al pasar
  const progreso = new Array(hojas).fill(0); // 0 = a la derecha, 1 = a la izquierda
  const objetivo = new Array(hojas).fill(0);
  const hojasMallas = [];
  for (let j = 0; j < hojas; j++) {
    const geometria = new THREE.PlaneGeometry(ANCHO, ALTO, SEGMENTOS, 1);
    geometria.translate(ANCHO / 2, 0, 0); // el borde izquierdo (x = 0) es el lomo
    const xBase = Float32Array.from(geometria.attributes.position.array.filter((_, i) => i % 3 === 0));
    const frente = new THREE.Mesh(geometria, new THREE.MeshBasicMaterial({ map: textura(caras[2 * j], false), side: THREE.FrontSide }));
    const reverso = new THREE.Mesh(geometria, new THREE.MeshBasicMaterial({ map: textura(caras[2 * j + 1], true), side: THREE.BackSide }));
    frente.frustumCulled = reverso.frustumCulled = false;
    libro.add(frente, reverso);
    liberables.push(geometria, frente.material, reverso.material);
    hojasMallas.push({ geometria, xBase });
    colocarHoja(j);
  }

  function colocarHoja(j) {
    const { geometria, xBase } = hojasMallas[j];
    const p = suave(limitar(progreso[j], 0, 1));
    const zDerecha = 0.003 + (hojas - j) * SEPARACION;
    const zIzquierda = 0.003 + (j + 1) * SEPARACION;
    const z = zDerecha + (zIzquierda - zDerecha) * p;
    const pos = geometria.attributes.position;
    const curva = Math.sin(Math.PI * p);
    for (let i = 0; i < pos.count; i++) {
      const xn = xBase[i] / ANCHO;
      // el borde libre se atrasa un poco respecto al lomo mientras la hoja gira
      const angulo = Math.PI * Math.max(0, p - 0.25 * xn * curva);
      pos.setX(i, xBase[i] * Math.cos(angulo));
      pos.setZ(i, z + xBase[i] * Math.sin(angulo));
    }
    pos.needsUpdate = true;
  }

  // Dos modos de ver el libro:
  //  - 'doble': las dos páginas a la vez (pantalla ancha). Cada paso pasa una hoja.
  //  - 'pagina': una sola página, más grande (celular vertical). Cada paso es UNA cara: se pasa la hoja y la
  //    cámara se desplaza de la página derecha a la izquierda, o de la izquierda a la derecha de la hoja siguiente.
  let modo = 'doble';
  let cara = 0; // en modo 'pagina': 0 = portada (derecha), 1 = su reverso (izquierda), 2 = frente de la hoja 1…
  let foco = ANCHO / 2; // x que queda en el centro de la pantalla en modo 'pagina'
  let focoObjetivo = foco;

  // Con el libro cerrado se ve solo la portada, centrada; al abrirlo pasa al centro, y al cerrarlo atrás, a la izquierda
  function colocarLibro() {
    const vueltas = progreso.reduce((a, b) => a + limitar(b, 0, 1), 0);
    libro.position.x = modo === 'pagina'
      ? -foco
      : (-ANCHO / 2) * limitar(1 - vueltas, 0, 1) + (ANCHO / 2) * limitar(vueltas - (hojas - 1), 0, 1);
    // cerrado, solo se ve una tapa: la de la izquierda aparece cuando se abre y la de la derecha desaparece al cerrarlo del todo
    tapas[0].visible = vueltas > 0.001;
    tapas[1].visible = vueltas < hojas - 0.001;
  }

  function ajustarTamano() {
    const ancho = Math.max(1, contenedor.clientWidth);
    const alto = Math.max(1, contenedor.clientHeight);
    renderer.setSize(ancho, alto, false);
    lienzo.style.width = '100%';
    lienzo.style.height = '100%';
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
    const nuevoModo = camara.aspect < 0.85 ? 'pagina' : 'doble';
    const tan = Math.tan((FOV * Math.PI) / 360);
    const dAlto = (ALTO * 1.14) / 2 / tan;
    const paginasAnchas = nuevoModo === 'pagina' ? 1 : 2;
    const dAncho = (ANCHO * paginasAnchas * 1.06) / 2 / (tan * camara.aspect);
    const d = Math.max(dAlto, dAncho);
    camara.position.set(0, -d * 0.1, d);
    camara.lookAt(0, 0, 0);
    if (nuevoModo !== modo || primeraVez) {
      modo = nuevoModo;
      cara = Math.min(pasadas * 2, caras.length - 1);
      aplicarEstado(true);
    } else dibujar();
    primeraVez = false;
  }
  let primeraVez = true;

  let cuadro = 0;
  let ultimo = 0;
  function dibujar() {
    renderer.render(escena, camara);
  }
  function pedirCuadro() {
    if (cuadro) return;
    ultimo = performance.now();
    cuadro = requestAnimationFrame(bucle);
  }
  function bucle(ahora) {
    cuadro = 0;
    const dt = Math.min(0.05, Math.max(0, (ahora - ultimo) / 1000));
    ultimo = ahora;
    let moviendo = false;
    if (modo === 'pagina' && foco !== focoObjetivo) {
      foco += (focoObjetivo - foco) * Math.min(1, dt * 7);
      if (Math.abs(focoObjetivo - foco) < 0.002) foco = focoObjetivo;
      else moviendo = true;
    }
    for (let j = 0; j < hojas; j++) {
      if (progreso[j] === objetivo[j]) continue;
      const paso = (dt / DURACION_S) * Math.sign(objetivo[j] - progreso[j]);
      progreso[j] += paso;
      const llego = (paso > 0 && progreso[j] >= objetivo[j]) || (paso < 0 && progreso[j] <= objetivo[j]);
      if (llego) progreso[j] = objetivo[j];
      else moviendo = true;
      colocarHoja(j);
    }
    colocarLibro();
    dibujar();
    if (moviendo) pedirCuadro();
  }

  let pasadas = 0; // hojas que ya están a la izquierda
  const puedeAtras = () => (modo === 'pagina' ? cara > 0 : pasadas > 0);
  const puedeAdelante = () => (modo === 'pagina' ? cara < caras.length - 1 : pasadas < hojas);

  function aplicarEstado(sinAnimar = false) {
    pasadas = modo === 'pagina' ? Math.ceil(cara / 2) : pasadas;
    focoObjetivo = cara % 2 === 0 ? ANCHO / 2 : -ANCHO / 2;
    for (let j = 0; j < hojas; j++) {
      objetivo[j] = j < pasadas ? 1 : 0;
      if (sinAnimar) { progreso[j] = objetivo[j]; colocarHoja(j); }
    }
    if (sinAnimar) { foco = focoObjetivo; colocarLibro(); dibujar(); }
    else pedirCuadro();
    alCambiar({ puedeAtras: puedeAtras(), puedeAdelante: puedeAdelante() });
  }

  function pasar(direccion) {
    if (direccion > 0 && !puedeAdelante()) return;
    if (direccion < 0 && !puedeAtras()) return;
    if (modo === 'pagina') cara += direccion;
    else {
      pasadas += direccion;
      cara = pasadas * 2;
    }
    aplicarEstado();
  }

  // Tocar la mitad derecha o arrastrar hacia la izquierda pasa la hoja; la mitad izquierda o hacia la derecha, vuelve
  let xInicial = null;
  lienzo.addEventListener('pointerdown', (e) => { xInicial = e.clientX; });
  lienzo.addEventListener('pointerup', (e) => {
    if (xInicial === null) return;
    const dx = e.clientX - xInicial;
    xInicial = null;
    if (Math.abs(dx) >= ARRASTRE_MIN_PX) { pasar(dx < 0 ? 1 : -1); return; }
    const caja = lienzo.getBoundingClientRect();
    pasar(e.clientX - caja.left > caja.width / 2 ? 1 : -1);
  });
  lienzo.addEventListener('pointercancel', () => { xInicial = null; });
  lienzo.addEventListener('contextmenu', (e) => e.preventDefault());

  const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(ajustarTamano) : null;
  observador?.observe(contenedor);
  colocarLibro();
  ajustarTamano();

  return {
    hojas,
    puedeAtras,
    puedeAdelante,
    pasar,
    destruir() {
      cancelAnimationFrame(cuadro);
      cuadro = 0;
      observador?.disconnect();
      for (const recurso of liberables) recurso.dispose();
      renderer.dispose();
      lienzo.remove();
    },
  };
}
