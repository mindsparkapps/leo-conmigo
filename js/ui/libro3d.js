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
const ARRASTRE_INICIO_PX = 10; // desde aquí un movimiento deja de ser un toque y la hoja empieza a seguir al dedo
const DOBLE_TOQUE_MS = 350;
const ZOOM_LLENADO = 0.94; // parte de la pantalla que ocupa la lámina al acercarla
const FOV = 30;
const RETRASO_HOJA_S = 0.07; // entre una hoja y la siguiente cuando se pasan varias de golpe

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
const suave = (t) => t * t * (3 - 2 * t);

/**
 * @param contenedor  elemento donde se inserta el <canvas> (debe tener tamaño)
 * @param caras       canvases 2D, cantidad par
 * @param alCambiar   ({ puedeAtras, puedeAdelante, carasVisibles }) al empezar y cada vez que cambia la página
 * @param hayLamina   (cara, u, v) => 0 | semiLado — si en ese punto hay una lámina pegada, la mitad de su lado
 *                    (fracción del ancho de la página); doble toque = acercarla
 * @param alAcercar   ({ cara, u, v } | null) — cuando la lámina ya quedó centrada con el zoom, y null al salir del zoom
 * @throws si el navegador no tiene WebGL (quien llama debe mostrar otra cosa)
 */
export function crearLibro3D(contenedor, caras, { alCambiar = () => {}, hayLamina = null, alAcercar = () => {} } = {}) {
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

  // Contratapa: una sola tapa detrás de las hojas de la derecha, siempre presente. El lado izquierdo NO lleva
  // tapa propia: ahí queda el reverso de la portada (la cara 1), que gira junto con la hoja. Antes había una tapa
  // fija a cada lado y la de la izquierda aparecía de golpe al abrir y desaparecía de golpe al cerrar.
  const materialTapa = new THREE.MeshBasicMaterial({ color: 0x1f5f82 });
  const geometriaTapa = new THREE.PlaneGeometry(ANCHO, ALTO); // del mismo tamaño que la portada
  liberables.push(materialTapa, geometriaTapa);
  const contratapa = new THREE.Mesh(geometriaTapa, materialTapa);
  contratapa.position.set(ANCHO / 2, 0, -0.02);
  libro.add(contratapa);

  // Hojas: la geometría se recalcula vértice por vértice para poder curvarlas al pasar
  const progreso = new Array(hojas).fill(0); // 0 = a la derecha, 1 = a la izquierda
  const objetivo = new Array(hojas).fill(0);
  const espera = new Array(hojas).fill(0); // segundos que falta para que la hoja empiece a girar (al saltar varias páginas)
  const texturas = []; // una por cara, para poder cambiar su dibujo (al pegar una lámina)
  const hojasMallas = [];
  for (let j = 0; j < hojas; j++) {
    const geometria = new THREE.PlaneGeometry(ANCHO, ALTO, SEGMENTOS, 1);
    geometria.translate(ANCHO / 2, 0, 0); // el borde izquierdo (x = 0) es el lomo
    const xBase = Float32Array.from(geometria.attributes.position.array.filter((_, i) => i % 3 === 0));
    texturas[2 * j] = textura(caras[2 * j], false);
    texturas[2 * j + 1] = textura(caras[2 * j + 1], true);
    const frente = new THREE.Mesh(geometria, new THREE.MeshBasicMaterial({ map: texturas[2 * j], side: THREE.FrontSide }));
    const reverso = new THREE.Mesh(geometria, new THREE.MeshBasicMaterial({ map: texturas[2 * j + 1], side: THREE.BackSide }));
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
    // con el mismo suavizado que el giro de cada hoja, para que el libro y la portada se muevan a la vez
    const vueltas = progreso.reduce((a, b) => a + suave(limitar(b, 0, 1)), 0);
    libro.position.x = modo === 'pagina'
      ? -foco
      : (-ANCHO / 2) * limitar(1 - vueltas, 0, 1) + (ANCHO / 2) * limitar(vueltas - (hojas - 1), 0, 1);
  }

  // Cámara: distancia base, y un zoom con desplazamiento para centrar una lámina (doble toque sobre una pegada)
  let dBase = 5;
  let zoom = 1;
  let zoomObjetivo = 1;
  let panX = 0;
  let panY = 0;
  let panXObjetivo = 0;
  let panYObjetivo = 0;
  function colocarCamara() {
    camara.position.set(panX, panY - (dBase * 0.1) / zoom, dBase / zoom);
    camara.lookAt(panX, panY, 0);
  }
  let acercando = null; // { cara, u, v, avisado }: la lámina que se está acercando
  const salirDelZoom = () => {
    zoomObjetivo = 1;
    panXObjetivo = 0;
    panYObjetivo = 0;
    if (acercando) {
      const habiaAvisado = acercando.avisado;
      acercando = null;
      if (habiaAvisado) alAcercar(null);
    }
  };

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
    dBase = Math.max(dAlto, dAncho);
    colocarCamara();
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
    if (zoom !== zoomObjetivo || panX !== panXObjetivo || panY !== panYObjetivo) {
      const k = Math.min(1, dt * 7);
      zoom += (zoomObjetivo - zoom) * k;
      panX += (panXObjetivo - panX) * k;
      panY += (panYObjetivo - panY) * k;
      if (Math.abs(zoomObjetivo - zoom) < 0.003 && Math.abs(panXObjetivo - panX) < 0.003 && Math.abs(panYObjetivo - panY) < 0.003) {
        zoom = zoomObjetivo; panX = panXObjetivo; panY = panYObjetivo;
      } else moviendo = true;
      colocarCamara();
      // ya quedó centrada: quien llama puede poner encima la imagen original, nítida
      if (!moviendo && acercando && !acercando.avisado) {
        dibujar();
        acercando.avisado = true;
        alAcercar({ cara: acercando.cara, u: acercando.u, v: acercando.v });
      }
    }
    if (arrastre) { dibujar(); return; } // mientras se arrastra, el dedo manda
    if (modo === 'pagina' && foco !== focoObjetivo) {
      foco += (focoObjetivo - foco) * Math.min(1, dt * 7);
      if (Math.abs(focoObjetivo - foco) < 0.002) foco = focoObjetivo;
      else moviendo = true;
    }
    for (let j = 0; j < hojas; j++) {
      if (progreso[j] === objetivo[j]) continue;
      if (espera[j] > 0) { espera[j] -= dt; moviendo = true; continue; }
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

  /** Las caras que se ven ahora (una en modo 'pagina'; una o dos en modo 'doble'). */
  function carasVisibles() {
    if (modo === 'pagina') return [cara];
    if (pasadas === 0) return [0];
    if (pasadas === hojas) return [2 * hojas - 1];
    return [2 * pasadas - 1, 2 * pasadas];
  }

  function aplicarEstado(sinAnimar = false) {
    salirDelZoom();
    if (sinAnimar) { zoom = 1; panX = 0; panY = 0; colocarCamara(); }
    pasadas = modo === 'pagina' ? Math.ceil(cara / 2) : pasadas;
    focoObjetivo = cara % 2 === 0 ? ANCHO / 2 : -ANCHO / 2;
    // las hojas que cambian giran una tras otra (la más cercana primero) para que un salto de varias páginas se vea como pasar hojas
    const cambian = [];
    for (let j = 0; j < hojas; j++) {
      const nuevo = j < pasadas ? 1 : 0;
      if (nuevo !== objetivo[j]) cambian.push(j);
      objetivo[j] = nuevo;
      if (sinAnimar) { progreso[j] = nuevo; espera[j] = 0; colocarHoja(j); }
    }
    if (!sinAnimar) {
      const adelante = cambian.length > 0 && objetivo[cambian[0]] === 1;
      (adelante ? cambian : [...cambian].reverse()).forEach((j, orden) => { espera[j] = Math.min(orden * RETRASO_HOJA_S, 0.6); });
    }
    if (sinAnimar) { foco = focoObjetivo; colocarLibro(); dibujar(); }
    else pedirCuadro();
    alCambiar({ puedeAtras: puedeAtras(), puedeAdelante: puedeAdelante(), carasVisibles: carasVisibles() });
  }

  /** Va a una cara (en modo 'doble', a la doble página que la contiene). */
  function irACara(destino) {
    const f = limitar(Math.round(destino), 0, caras.length - 1);
    if (modo === 'pagina') cara = f === 1 ? 2 : f;
    else {
      pasadas = Math.ceil(f / 2);
      cara = pasadas * 2;
    }
    aplicarEstado();
  }

  // En modo 'pagina' se salta la cara 1 (el reverso de la portada, que no tiene nada): de la portada se pasa directo
  // a la primera página, y de ella se vuelve directo a la portada.
  function siguienteCara(direccion) {
    const n = cara + direccion;
    return modo === 'pagina' && n === 1 ? (direccion > 0 ? 2 : 0) : n;
  }

  function pasar(direccion) {
    if (direccion > 0 && !puedeAdelante()) return;
    if (direccion < 0 && !puedeAtras()) return;
    if (modo === 'pagina') cara = siguienteCara(direccion);
    else {
      pasadas += direccion;
      cara = pasadas * 2;
    }
    aplicarEstado();
  }

  const quieto = () => cuadro === 0 && espera.every((e) => e <= 0) && zoom === 1 && zoomObjetivo === 1;

  // La cara y el punto (u, v) del libro que hay bajo un punto de la pantalla; null si no es una página.
  function lugarEn(clientX, clientY) {
    const r = lienzo.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
    camara.updateMatrixWorld();
    const rayo = new THREE.Raycaster();
    rayo.setFromCamera(ndc, camara);
    const p = new THREE.Vector3();
    if (!rayo.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.01), p)) return null;
    const xl = p.x - libro.position.x;
    let c;
    if (modo === 'pagina') c = cara;
    else c = xl >= 0 ? (pasadas < hojas ? 2 * pasadas : null) : (pasadas > 0 ? 2 * pasadas - 1 : null);
    if (c === null || (c % 2 === 0) !== (xl >= 0)) return null;
    const u = (xl - (c % 2 === 0 ? 0 : -ANCHO)) / ANCHO;
    const v = (ALTO / 2 - p.y) / ALTO;
    return u < 0 || u > 1 || v < 0 || v > 1 ? null : { cara: c, u, v };
  }

  // `semiLado`: mitad del lado de la lámina, en fracción del ancho de la página. El zoom la deja ocupando casi toda la pantalla.
  function enfocar(c, u, v, semiLado = 0.15) {
    panXObjetivo = (c % 2 === 0 ? 0 : -ANCHO) + u * ANCHO + libro.position.x;
    panYObjetivo = ALTO / 2 - v * ALTO;
    const altoVista = 2 * dBase * Math.tan((FOV * Math.PI) / 360); // alto visible del plano del libro sin zoom
    const menor = Math.min(altoVista, altoVista * camara.aspect);
    zoomObjetivo = limitar((menor * ZOOM_LLENADO) / (2 * semiLado * ANCHO), 1.5, 10);
    acercando = { cara: c, u, v, avisado: false };
    pedirCuadro();
  }

  // Arrastrar: la hoja (y la cámara, en modo 'pagina') siguen al dedo; al soltar, si pasó de cierto punto, termina
  // de pasar; si no, vuelve. Un toque: la mitad derecha pasa la hoja y la izquierda la devuelve. Doble toque sobre una
  // lámina pegada: la centra con zoom (otro toque la suelta).
  let toque = null; // { x, y, movido }
  let arrastre = null; // { dir, j, t, focoBase, focoDestino }
  let ultimoToque = { t: -Infinity };
  let pendiente = 0;

  function empezarArrastre(dir) {
    let j = -1;
    if (modo === 'doble') j = dir > 0 ? pasadas : pasadas - 1;
    else if (dir > 0 && cara % 2 === 0) j = cara / 2;
    else if (dir < 0 && cara % 2 === 1) j = (cara - 1) / 2;
    else if (dir < 0 && cara === 2) j = 0; // de la primera página a la portada (sin pasar por el reverso vacío)
    if (j >= 0) espera[j] = 0;
    arrastre = { dir, j, t: 0, focoBase: foco, focoDestino: siguienteCara(dir) % 2 === 0 ? ANCHO / 2 : -ANCHO / 2 };
  }
  function moverArrastre(t) {
    arrastre.t = t;
    if (arrastre.j >= 0) {
      progreso[arrastre.j] = arrastre.dir > 0 ? t : 1 - t;
      colocarHoja(arrastre.j);
    }
    if (modo === 'pagina') foco = arrastre.focoBase + (arrastre.focoDestino - arrastre.focoBase) * t;
    colocarLibro();
    dibujar();
  }

  function pasarPorToque(clientX) {
    const caja = lienzo.getBoundingClientRect();
    pasar(clientX - caja.left > caja.width / 2 ? 1 : -1);
  }

  lienzo.addEventListener('pointerdown', (e) => {
    lienzo.setPointerCapture?.(e.pointerId);
    toque = { x: e.clientX, y: e.clientY, movido: false };
  });
  lienzo.addEventListener('pointermove', (e) => {
    if (!toque) return;
    const dx = e.clientX - toque.x;
    const dy = e.clientY - toque.y;
    if (!arrastre && !toque.movido && Math.hypot(dx, dy) > ARRASTRE_INICIO_PX) {
      toque.movido = true;
      const dir = dx < 0 ? 1 : -1;
      const puede = dir > 0 ? puedeAdelante() : puedeAtras();
      if (Math.abs(dx) > Math.abs(dy) && puede && zoomObjetivo === 1 && quieto()) empezarArrastre(dir);
    }
    if (arrastre) {
      const hacia = arrastre.dir > 0 ? -dx : dx;
      moverArrastre(limitar(hacia / (lienzo.clientWidth * 0.45), 0, 1));
    }
  });
  const soltar = (e, cancelado) => {
    const estado = toque;
    toque = null;
    if (!estado) return;
    if (arrastre) {
      const { dir, t } = arrastre;
      arrastre = null;
      if (!cancelado && t > 0.3) pasar(dir);
      else aplicarEstado();
      return;
    }
    if (cancelado || estado.movido) return;
    if (zoomObjetivo > 1) { salirDelZoom(); pedirCuadro(); return; }
    const sitio = hayLamina ? lugarEn(e.clientX, e.clientY) : null;
    const semiLado = sitio ? hayLamina(sitio.cara, sitio.u, sitio.v) : 0;
    if (semiLado) {
      const ahora = performance.now();
      if (ahora - ultimoToque.t < DOBLE_TOQUE_MS) {
        clearTimeout(pendiente);
        ultimoToque.t = -Infinity;
        enfocar(sitio.cara, sitio.u, sitio.v, semiLado);
      } else {
        ultimoToque.t = ahora; // un solo toque no voltea la página: las hojas se pasan solo arrastrando (o con las flechas)
      }
    }
  };
  lienzo.addEventListener('pointerup', (e) => soltar(e, false));
  lienzo.addEventListener('pointercancel', (e) => soltar(e, true));
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
    irACara,
    carasVisibles,
    /** true cuando ninguna hoja se está moviendo (solo entonces valen las posiciones de `proyectar`). */
    quieto,
    /** Cambia el dibujo de una cara (p. ej. al pegar una lámina). */
    actualizarCara(indice, canvas) {
      const t = texturas[indice];
      if (!t) return;
      t.image = canvas;
      t.needsUpdate = true;
      dibujar();
    },
    /**
     * Dónde queda en la pantalla el punto (u, v) de una cara que se está viendo (u hacia la derecha y v hacia abajo,
     * de 0 a 1, tal como se dibujó). Devuelve píxeles relativos al canvas del libro.
     */
    proyectar(indice, u, v) {
      const derecha = indice % 2 === 0;
      const x = (derecha ? 0 : -ANCHO) + u * ANCHO;
      const punto = new THREE.Vector3(x + libro.position.x, ALTO / 2 - v * ALTO, 0.01);
      camara.updateMatrixWorld();
      punto.project(camara);
      return { x: ((punto.x + 1) / 2) * contenedor.clientWidth, y: ((1 - punto.y) / 2) * contenedor.clientHeight };
    },
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
