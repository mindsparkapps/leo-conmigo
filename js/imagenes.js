// Preparación de fotos: recorte cuadrado, reducción a 512 px y WebP (JPEG si no hay soporte).

/** Recorte cuadrado centrado de una imagen de ancho × alto. */
export function calcularRecorteCuadrado(ancho, alto) {
  const tam = Math.min(ancho, alto);
  return { sx: Math.floor((ancho - tam) / 2), sy: Math.floor((alto - tam) / 2), tam };
}

/** Lado final: nunca se agranda una foto pequeña. */
export function ladoFinal(tam, maximo = 512) {
  return Math.min(tam, maximo);
}

async function abrirImagen(archivo) {
  if (typeof createImageBitmap === 'function') {
    try {
      // 'from-image' respeta la orientación de la cámara (EXIF)
      const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
      return { imagen: bitmap, ancho: bitmap.width, alto: bitmap.height, cerrar: () => bitmap.close?.() };
    } catch { /* se prueba con <img> */ }
  }
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { imagen: img, ancho: img.naturalWidth, alto: img.naturalHeight, cerrar: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

const aBlob = (lienzo, tipo, calidad) => new Promise((resolver) => lienzo.toBlob(resolver, tipo, calidad));

/**
 * Convierte la foto en un cuadrado de hasta `lado` px.
 * @returns { blob, mime, lado }
 */
export async function prepararImagen(archivo, { lado = 512, calidad = 0.85, conservarProporcion = false } = {}) {
  let fuente;
  try {
    fuente = await abrirImagen(archivo);
  } catch {
    throw new Error('No se pudo leer la imagen. Prueba con otra foto.');
  }
  try {
    // `conservarProporcion`: sin recorte (portadas), con el lado MAYOR reducido a `lado`; si no, recorte cuadrado
    const { sx, sy, tam } = conservarProporcion ? { sx: 0, sy: 0, tam: Math.max(fuente.ancho, fuente.alto) } : calcularRecorteCuadrado(fuente.ancho, fuente.alto);
    if (!tam) throw new Error('La imagen está vacía.');
    const destino = ladoFinal(tam, lado);
    const lienzo = document.createElement('canvas');
    const k = destino / tam;
    const anchoDestino = conservarProporcion ? Math.max(1, Math.round(fuente.ancho * k)) : destino;
    const altoDestino = conservarProporcion ? Math.max(1, Math.round(fuente.alto * k)) : destino;
    lienzo.width = anchoDestino;
    lienzo.height = altoDestino;
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#ffffff'; // fondo blanco para transparencias
    ctx.fillRect(0, 0, anchoDestino, altoDestino);
    ctx.imageSmoothingQuality = 'high';
    if (conservarProporcion) ctx.drawImage(fuente.imagen, 0, 0, fuente.ancho, fuente.alto, 0, 0, anchoDestino, altoDestino);
    else ctx.drawImage(fuente.imagen, sx, sy, tam, tam, 0, 0, destino, destino);

    let blob = await aBlob(lienzo, 'image/webp', calidad);
    if (!blob || blob.type !== 'image/webp') blob = await aBlob(lienzo, 'image/jpeg', calidad);
    if (!blob) throw new Error('No se pudo guardar la imagen.');
    return { blob, mime: blob.type, lado: destino };
  } finally {
    fuente.cerrar();
  }
}
