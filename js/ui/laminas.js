// Dibuja con canvas 2D las caras del libro del álbum: portada, contraportada interior y páginas de láminas.
// Cada calcomanía es una lámina con marco blanco de esquinas redondeadas. Las que aún no se ganaron se pintan
// en gris y translúcidas; al ganarlas aparecen a color (y con una sombra, como pegadas en la página).

import { esPropia, idDePropia, rutaCalcomania } from '../core/calcomanias.js';
import { urlDeMedio } from '../medios.js';

export const ANCHO_CARA = 512;
export const ALTO_CARA = 683; // proporción 3:4

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

function cargarImagen(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Un ángulo pequeño y estable por código (−2.5° a 2.5°) para que las láminas no queden militarmente rectas. */
function inclinacion(codigo) {
  let h = 0;
  for (const c of String(codigo)) h = (h * 31 + c.charCodeAt(0)) % 997;
  return ((h % 51) - 25) / 10 * (Math.PI / 180);
}

/** Lo que se dibuja dentro de la lámina: { imagen } o { emoji } o { letra }. null si ya no existe. */
async function contenidoDe(store, codigo, propiasPorId) {
  if (!esPropia(codigo)) return { imagen: await cargarImagen(rutaCalcomania(codigo)) };
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
  const marco = lado * 0.07;
  const redondeoMarco = lado * 0.16;
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
    const px = Math.ceil(lado);
    const aparte = document.createElement('canvas');
    aparte.width = px;
    aparte.height = px;
    const c = aparte.getContext('2d');
    c.fillStyle = '#ffffff';
    rectRedondeado(c, 0, 0, px, px, redondeoMarco);
    c.fill();
    dibujarContenido(c, contenido, marco, marco, px - marco * 2, redondeoMarco * 0.55);
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
  lienzo.width = ANCHO_CARA;
  lienzo.height = ALTO_CARA;
  return lienzo;
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

function portada({ conseguidas, total }) {
  const lienzo = lienzoNuevo();
  const ctx = lienzo.getContext('2d');
  const degradado = ctx.createLinearGradient(0, 0, ANCHO_CARA, ALTO_CARA);
  degradado.addColorStop(0, '#2f86ad');
  degradado.addColorStop(1, '#1f5f82');
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, ANCHO_CARA, ALTO_CARA);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 6;
  rectRedondeado(ctx, 28, 28, ANCHO_CARA - 56, ALTO_CARA - 56, 36);
  ctx.stroke();
  estrella(ctx, ANCHO_CARA / 2, 270, 130, '#f2b632');
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 64px ${FUENTE}`;
  ctx.fillText('Mi álbum', ANCHO_CARA / 2, 470);
  ctx.font = `700 40px ${FUENTE}`;
  ctx.fillText(`${conseguidas} de ${total}`, ANCHO_CARA / 2, 550);
  return lienzo;
}

function interior() {
  const lienzo = lienzoNuevo();
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#d8ebf5';
  ctx.fillRect(0, 0, ANCHO_CARA, ALTO_CARA);
  for (const [x, y, r] of [[120, 160, 34], [380, 260, 26], [210, 430, 30], [400, 520, 38], [110, 570, 22]]) {
    estrella(ctx, x, y, r, 'rgba(255, 255, 255, 0.7)');
  }
  return lienzo;
}

function carasVacias() {
  const lienzo = lienzoNuevo();
  papel(lienzo.getContext('2d'));
  return lienzo;
}

/**
 * Dibuja todas las caras del libro, en orden: portada, interior de la portada, una por página y, si hace falta,
 * una cara en blanco para que el total sea par (cada hoja tiene dos caras).
 * @param libro    resultado de armarLibro()
 * @param propias  calcomanías propias vigentes
 */
export async function dibujarCaras({ store, libro, propias = [] }) {
  const propiasPorId = new Map(propias.map((p) => [p.id, p]));
  const caras = [portada(libro), interior()];
  const margenX = 44;
  const margenSup = 56;
  const margenInf = 44;
  const celdaW = (ANCHO_CARA - margenX * 2) / COLUMNAS;
  const celdaH = (ALTO_CARA - margenSup - margenInf) / FILAS;
  const lado = Math.min(celdaW, celdaH) * 0.86;

  for (const pagina of libro.paginas) {
    const lienzo = lienzoNuevo();
    const ctx = lienzo.getContext('2d');
    papel(ctx);
    const contenidos = await Promise.all(pagina.map((item) => contenidoDe(store, item.codigo, propiasPorId)));
    pagina.forEach((item, i) => {
      const contenido = contenidos[i];
      if (contenido === null) return;
      const col = i % COLUMNAS;
      const fila = Math.floor(i / COLUMNAS);
      dibujarLamina(ctx, contenido, {
        cx: margenX + celdaW * (col + 0.5),
        cy: margenSup + celdaH * (fila + 0.5),
        lado,
        ganada: item.ganada,
        codigo: item.codigo,
      });
    });
    caras.push(lienzo);
  }
  if (caras.length % 2 !== 0) caras.push(carasVacias());
  return caras;
}
