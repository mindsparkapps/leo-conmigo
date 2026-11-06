// Frases y libros (PLAN.md §3, etapa 2). Lógica pura, sin DOM.
//
// Una frase se arma con palabras del niño. Para mostrarla (F1, F2, libros) lleva una imagen propia
// (foto o pictograma del conjunto) o, si no la tiene, un collage con las imágenes de sus palabras.

import { tieneImagen } from './vocabulario.js';

export const MIN_PALABRAS_FRASE = 2;
export const MAX_PALABRAS_FRASE = 6;
export const MAX_PAGINAS_LIBRO = 10;
export const MAX_LARGO_TITULO = 40;
export const MAX_PARTES_COLLAGE = 3;

/** ['papá', 'come', 'pan'] (palabras en orden) -> 'papá come pan' */
export function textoDeFrase(palabras) {
  return palabras.map((p) => p.texto).join(' ');
}

/** Las palabras de una frase, en orden. Si alguna ya no existe (borrada), devuelve null. */
export function palabrasDeFrase(frase, palabrasPorId) {
  const lista = frase.palabraIds.map((id) => palabrasPorId.get(id));
  return lista.every((p) => p && !p.deleted) ? lista : null;
}

/** Mensaje de error en español, o null si la frase se puede guardar. */
export function validarFrase({ palabraIds, palabrasPorId, frases = [], exceptoId = null }) {
  if (palabraIds.length < MIN_PALABRAS_FRASE) return `Elige al menos ${MIN_PALABRAS_FRASE} palabras.`;
  if (palabraIds.length > MAX_PALABRAS_FRASE) return `Una frase puede tener hasta ${MAX_PALABRAS_FRASE} palabras.`;
  if (palabraIds.some((id) => !palabrasPorId.get(id) || palabrasPorId.get(id).deleted)) return 'Una de las palabras ya no está en el vocabulario.';
  const clave = palabraIds.join('|');
  if (frases.some((f) => !f.deleted && f.id !== exceptoId && f.palabraIds.join('|') === clave)) return 'Esa frase ya está en la lista.';
  return null;
}

/** Palabras cuyas imágenes forman el collage de una frase sin imagen propia (hasta 3, las que tengan). */
export function partesDeCollage(palabras) {
  return palabras.filter(tieneImagen).slice(0, MAX_PARTES_COLLAGE);
}

/** ¿Se puede practicar? Todas sus palabras existen y hay algo que mostrar (imagen propia o collage). */
export function frasePracticable(frase, palabrasPorId) {
  if (frase.deleted || frase.activa === false) return false;
  const palabras = palabrasDeFrase(frase, palabrasPorId);
  if (!palabras) return false;
  return Boolean(frase.medioImagenId) || partesDeCollage(palabras).length > 0;
}

/**
 * Las frases practicables, vistas como «elementos» del motor de sesión (igual que una palabra):
 * { id, texto, orden, activa, medioImagenId, emoji, esFrase, palabraIds, partes }.
 * `partes` son las palabras del collage (vacío si la frase tiene imagen propia).
 */
export function frasesComoElementos(frases, palabrasPorId) {
  return frases
    .filter((f) => frasePracticable(f, palabrasPorId))
    .map((f) => {
      const palabras = palabrasDeFrase(f, palabrasPorId);
      return {
        id: f.id,
        texto: f.texto,
        categoria: null,
        orden: f.orden ?? 0,
        activa: true,
        medioImagenId: f.medioImagenId ?? null,
        emoji: null,
        esFrase: true,
        palabraIds: f.palabraIds,
        partes: f.medioImagenId ? [] : partesDeCollage(palabras),
      };
    });
}

// ---------- libros ----------

/** Mensaje de error en español, o null si el libro se puede guardar. */
export function validarLibro({ titulo, paginas, frasesPorId }) {
  const limpio = String(titulo ?? '').trim();
  if (!limpio) return 'Ponle un título al libro.';
  if (limpio.length > MAX_LARGO_TITULO) return `El título es demasiado largo (máximo ${MAX_LARGO_TITULO} letras).`;
  if (!paginas.length) return 'Agrega al menos una página.';
  if (paginas.length > MAX_PAGINAS_LIBRO) return `Un libro puede tener hasta ${MAX_PAGINAS_LIBRO} páginas.`;
  const sinFrase = paginas.findIndex((p) => !p.fraseId || !frasesPorId.get(p.fraseId) || frasesPorId.get(p.fraseId).deleted);
  if (sinFrase !== -1) return `La página ${sinFrase + 1} necesita una frase.`;
  return null;
}

/** Páginas que todavía se pueden leer (su frase sigue existiendo y sus palabras también). */
export function paginasLeibles(libro, frasesPorId, palabrasPorId) {
  return libro.paginas.filter((p) => {
    const frase = frasesPorId.get(p.fraseId);
    return frase && !frase.deleted && palabrasDeFrase(frase, palabrasPorId);
  });
}

/** Los libros que se muestran al niño: tienen al menos una página legible. */
export function librosParaElNino(libros, frasesPorId, palabrasPorId) {
  return libros.filter((l) => !l.deleted && paginasLeibles(l, frasesPorId, palabrasPorId).length > 0);
}
