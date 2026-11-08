// Dibuja con canvas 2D las caras del libro del álbum: portada, contraportada interior y páginas de láminas.
// Cada calcomanía es una lámina con marco blanco de esquinas redondeadas. Las que aún no se ganaron se pintan
// en gris y translúcidas; al ganarlas aparecen a color (y con una sombra, como pegadas en la página).

import { esPropia, idDePropia, rutaCalcomania } from '../core/calcomanias.js';
import { urlDeMedio } from '../medios.js';

export const ANCHO_CARA = 512;
export const ALTO_CARA = 683; // proporción 3:4
// Medidas lógicas: cada cara se dibuja ESCALA veces más grande para que no se pixele al acercar una lámina
const ESCALA = 2;

const COLUMNAS = 2;
const FILAS = 3;
const FUENTE = "'Andika', system-ui, sans-serif";
const ALFA_SIN_GANAR = 0.4;

function rectRedondeado(ctx, x, y, w, h, r) {
  const radio = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + w, y, x + w, y + h, radio);
  ctx.arcTo(x + w, y + h, x, y + h, radio);
  ctx.arcTo(x, y + h, x, y, radio);
  ctx.arcTo(x, y, x + w, y, radio);
  ctx.closePath();
}

function cargarUnaVez(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Carga una imagen; si falla (conexión cortada, red inestable) lo intenta una vez más antes de rendirse. */
async function cargarImagen(url) {
  if (!url) return null;
  const primera = await cargarUnaVez(url);
  if (primera) return primera;
  await new Promise((r) => setTimeout(r, 200));
  return cargarUnaVez(url);
}

/** Un ángulo pequeño y estable por código (−2.5° a 2.5°) para que las láminas no queden militarmente rectas. */
function inclinacion(codigo) {
  let h = 0;
  for (const c of String(codigo)) h = (h * 31 + c.charCodeAt(0)) % 997;
  return ((h % 51) - 25) / 10 * (Math.PI / 180);
}

/** Lo que se dibuja dentro de la lámina: { imagen } o { emoji } o { letra }. null si ya no existe. */
async function contenidoDe(store, codigo, propiasPorId) {
  // las láminas de fotos (jpg) llenan el marco recortadas; los dibujos SVG antiguos se muestran enteros
  if (!esPropia(codigo)) {
    const ruta = rutaCalcomania(codigo);
    return { imagen: await cargarImagen(ruta), foto: ruta.endsWith('.jpg') };
  }
  const propia = propiasPorId.get(idDePropia(codigo));
  if (!propia) return null;
  const imagen = propia.medioImagenId ? await cargarImagen(await urlDeMedio(store, propia.medioImagenId)) : null;
  if (imagen) return { imagen, foto: true };
  return { emoji: propia.emoji ?? null, letra: (propia.nombre ?? '★')[0] };
}

function dibujarContenido(ctx, contenido, x, y, lado, redondeo) {
  ctx.save();
  rectRedondeado(ctx, x, y, lado, lado, redondeo);
  ctx.clip();
  if (contenido?.imagen) {
    const { naturalWidth: w, naturalHeight: h } = contenido.imagen;
    const base = contenido.foto ? Math.max(lado / (w || lado), lado / (h || lado)) : Math.min(lado / (w || lado), lado / (h || lado));
    const dw = (w || lado) * base;
    const dh = (h || lado) * base;
    ctx.drawImage(contenido.imagen, x + (lado - dw) / 2, y + (lado - dh) / 2, dw, dh);
  } else if (contenido) {
    ctx.fillStyle = '#fff3cf';
    ctx.fillRect(x, y, lado, lado);
    ctx.fillStyle = '#1d2b36';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${lado * 0.6}px ${FUENTE}`;
    ctx.fillText(contenido.emoji ?? contenido.letra ?? '★', x + lado / 2, y + lado / 2 + lado * 0.04);
  }
  ctx.restore();
}

/** Pasa a grises un lienzo (dejando su transparencia). */
function aGrises(lienzo) {
  const c = lienzo.getContext('2d');
  const datos = c.getImageData(0, 0, lienzo.width, lienzo.height);
  const d = datos.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  c.putImageData(datos, 0, 0);
}

/**
 * Dibuja una lámina centrada en (cx, cy).
 * @param ganada  true: a color con sombra · false: gris y translúcida
 */
function dibujarLamina(ctx, contenido, { cx, cy, lado, ganada, codigo }) {
  const marco = lado * 0.02; // borde blanco fino
  const redondeoMarco = lado * 0.12;
  const interior = lado - marco * 2;
  ctx.save();
  ctx.translate(cx, cy);
  if (ganada) ctx.rotate(inclinacion(codigo));
  const x = -lado / 2;
  const y = -lado / 2;

  if (ganada) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = lado * 0.07;
    ctx.shadowOffsetY = lado * 0.025;
    ctx.fillStyle = '#ffffff';
    rectRedondeado(ctx, x, y, lado, lado, redondeoMarco);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 2;
    rectRedondeado(ctx, x, y, lado, lado, redondeoMarco);
    ctx.stroke();
    dibujarContenido(ctx, contenido, x + marco, y + marco, interior, redondeoMarco * 0.55);
  } else {
    // gris y con transparencia: el marco y el dibujo se pintan en un lienzo aparte para pasarlos a grises juntos
    const px = Math.ceil(lado * ESCALA);
    const aparte = document.createElement('canvas');
    aparte.width = px;
    aparte.height = px;
    const c = aparte.getContext('2d');
    c.scale(px / lado, px / lado);
    c.fillStyle = '#ffffff';
    rectRedondeado(c, 0, 0, lado, lado, redondeoMarco);
    c.fill();
    dibujarContenido(c, contenido, marco, marco, lado - marco * 2, redondeoMarco * 0.55);
    aGrises(aparte);
    ctx.globalAlpha = ALFA_SIN_GANAR;
    ctx.drawImage(aparte, x, y, lado, lado);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(77, 96, 108, 0.35)';
    ctx.lineWidth = 2;
    rectRedondeado(ctx, x, y, lado, lado, redondeoMarco);
    ctx.stroke();
  }
  ctx.restore();
}

function lienzoNuevo() {
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO_CARA * ESCALA;
  lienzo.height = ALTO_CARA * ESCALA;
  return lienzo;
}

/** El contexto de una cara recién creada: se dibuja en coordenadas lógicas (ANCHO_CARA × ALTO_CARA). */
function contexto(lienzo) {
  const ctx = lienzo.getContext('2d');
  ctx.scale(ESCALA, ESCALA);
  return ctx;
}

function papel(ctx) {
  ctx.fillStyle = '#fdf8ea';
  ctx.fillRect(0, 0, ANCHO_CARA, ALTO_CARA);
  // renglones muy suaves, como una hoja de álbum
  ctx.strokeStyle = 'rgba(40, 117, 153, 0.07)';
  ctx.lineWidth = 2;
  for (let y = 64; y < ALTO_CARA; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ANCHO_CARA, y);
    ctx.stroke();
  }
}

function estrella(ctx, cx, cy, radio, relleno) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radio : radio * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = relleno;
  ctx.fill();
}

/** Imagen de la portada del álbum (data/laminas/portada.jpg = GTA6_032). */
export const RUTA_PORTADA = 'data/laminas/portada.jpg';

function portada(_libro, imagen) {
  const lienzo = lienzoNuevo();
  const ctx = contexto(lienzo);
  // fondo de tapa y, encima, la imagen a pantalla completa (recortada al centro)
  ctx.fillStyle = '#1f5f82';
  ctx.fillRect(0, 0, ANCHO_CARA, ALTO_CARA);
  if (imagen) {
    const k = Math.max(ANCHO_CARA / imagen.naturalWidth, ALTO_CARA / imagen.naturalHeight);
    const w = imagen.naturalWidth * k;
    const h = imagen.naturalHeight * k;
    ctx.drawImage(imagen, (ANCHO_CARA - w) / 2, (ALTO_CARA - h) / 2, w, h);
  } else {
    estrella(ctx, ANCHO_CARA / 2, 270, 130, '#f2b632');
  }
  // sin título: solo la imagen y un marco fino (el avance se ve abajo, junto a las flechas)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 8;
  rectRedondeado(ctx, 20, 20, ANCHO_CARA - 40, ALTO_CARA - 40, 34);
  ctx.stroke();
  return lienzo;
}

/** Reverso de la portada: es el interior de la tapa, del mismo azul que ella. */
function interior() {
  const lienzo = lienzoNuevo();
  const ctx = contexto(lienzo);
  ctx.fillStyle = '#1f5f82';
  ctx.fillRect(0, 0, ANCHO_CARA, ALTO_CARA);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 6;
  rectRedondeado(ctx, 28, 28, ANCHO_CARA - 56, ALTO_CARA - 56, 30);
  ctx.stroke();
  for (const [x, y, r] of [[120, 160, 34], [380, 260, 26], [210, 430, 30], [400, 520, 38], [110, 570, 22]]) {
    estrella(ctx, x, y, r, 'rgba(255, 255, 255, 0.16)');
  }
  return lienzo;
}

function carasVacias() {
  const lienzo = lienzoNuevo();
  papel(contexto(lienzo));
  return lienzo;
}

// ---- Distribución de una página: letra arriba y 2 columnas × 3 filas de láminas ----
const MARGEN_X = 44;
const MARGEN_SUP = 92; // deja lugar a la letra de la página
const MARGEN_INF = 40;
const CELDA_W = (ANCHO_CARA - MARGEN_X * 2) / COLUMNAS;
const CELDA_H = (ALTO_CARA - MARGEN_SUP - MARGEN_INF) / FILAS;
const LADO = Math.min(CELDA_W, CELDA_H) * 0.86;

/**
 * Dónde cae cada lugar de una página, en proporciones de la cara (u hacia la derecha, v hacia abajo, de 0 a 1).
 * Sirve para saber en qué parte de la pantalla está un lugar (soltar una lámina sobre él).
 * @returns {{ u: number, v: number }[]} los 6 lugares y, en `semiLadoU`, la mitad del lado de una lámina
 */
export function lugaresDePagina() {
  const lugares = Array.from({ length: COLUMNAS * FILAS }, (_, i) => ({
    u: (MARGEN_X + CELDA_W * ((i % COLUMNAS) + 0.5)) / ANCHO_CARA,
    v: (MARGEN_SUP + CELDA_H * (Math.floor(i / COLUMNAS) + 0.5)) / ALTO_CARA,
  }));
  lugares.semiLadoU = LADO / 2 / ANCHO_CARA;
  return lugares;
}

/** La letra de la página, en un círculo arriba al centro. */
function encabezado(ctx, letra) {
  ctx.fillStyle = '#287599';
  ctx.beginPath();
  ctx.arc(ANCHO_CARA / 2, 46, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${letra.length > 1 ? 30 : 38}px ${FUENTE}`;
  ctx.fillText(letra, ANCHO_CARA / 2, 48);
}

/** «A-7» sobre el hueco de una lámina que aún no está pegada. */
function etiqueta(ctx, texto, cx, cy) {
  ctx.save();
  ctx.font = `700 44px ${FUENTE}`;
  const ancho = ctx.measureText(texto).width + 36;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  rectRedondeado(ctx, cx - ancho / 2, cy - 30, ancho, 60, 30);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 117, 153, 0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#1f5f82';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, cx, cy + 2);
  ctx.restore();
}

/** Dibuja una página de láminas (letra, láminas pegadas a color y huecos grises con su «A-7»). */
export async function dibujarCaraDePagina({ store, libro, propias = [], indice }) {
  const propiasPorId = new Map(propias.map((p) => [p.id, p]));
  const pagina = libro.paginas[indice];
  const lienzo = lienzoNuevo();
  const ctx = contexto(lienzo);
  papel(ctx);
  encabezado(ctx, pagina.letra);
  const contenidos = await Promise.all(pagina.items.map((item) => contenidoDe(store, item.codigo, propiasPorId)));
  pagina.items.forEach((item, i) => {
    const contenido = contenidos[i];
    if (contenido === null) return;
    const cx = MARGEN_X + CELDA_W * ((i % COLUMNAS) + 0.5);
    const cy = MARGEN_SUP + CELDA_H * (Math.floor(i / COLUMNAS) + 0.5);
    dibujarLamina(ctx, contenido, { cx, cy, lado: LADO, ganada: item.pegada, codigo: item.codigo });
    if (!item.pegada) etiqueta(ctx, `${item.letra}-${item.numero}`, cx, cy);
  });
  return lienzo;
}

/** La portada con «pegadas de total» al día. */
export async function dibujarPortadaDeLibro(libro) {
  return portada(libro, await cargarImagen(RUTA_PORTADA));
}

/**
 * Dibuja todas las caras del libro, en orden: portada, interior de la portada, una por página y, si hace falta,
 * una cara en blanco para que el total sea par (cada hoja tiene dos caras).
 * @param libro    resultado de armarLibro()
 * @param propias  calcomanías propias vigentes
 */
export async function dibujarCaras({ store, libro, propias = [] }) {
  const caras = [await dibujarPortadaDeLibro(libro), interior()];
  for (let i = 0; i < libro.paginas.length; i++) caras.push(await dibujarCaraDePagina({ store, libro, propias, indice: i }));
  if (caras.length % 2 !== 0) caras.push(carasVacias());
  return caras;
}

/** La cara del libro donde está la página de láminas número `indice` (0 = A). */
export const caraDePagina = (indice) => 2 + indice;
