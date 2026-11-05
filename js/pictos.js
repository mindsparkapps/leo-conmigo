// Pictogramas de ARASAAC (https://arasaac.org). Se buscan por texto en español y la imagen
// elegida se descarga y se guarda en IndexedDB, así funciona sin conexión.
//
// Licencia CC BY-NC-SA: la app no puede ser comercial mientras los use (ver «Acerca de»).
// Solo se envía a ARASAAC el texto buscado.

import { normalizarTexto } from './core/vocabulario.js';

export const API = 'https://api.arasaac.org/v1';
export const ESTATICO = 'https://static.arasaac.org/pictograms';

export const CREDITO_ARASAAC =
  'Los símbolos pictográficos utilizados son propiedad del Gobierno de Aragón y han sido creados por Sergio Palao para ARASAAC (https://arasaac.org), que los distribuye bajo Licencia Creative Commons BY-NC-SA.';

export class ErrorRed extends Error {
  /** codigo: 'sin-conexion' | 'servicio' */
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'ErrorRed';
    this.codigo = codigo;
  }
}

export function urlBusqueda(texto) {
  return `${API}/pictograms/es/search/${encodeURIComponent(String(texto).trim())}`;
}

/** `tam`: 300 o 500 (píxeles). */
export function urlImagen(id, tam = 500) {
  return `${ESTATICO}/${id}/${id}_${tam}.png`;
}

/**
 * Deja solo lo necesario de la respuesta de la API: [{ id, palabras }].
 * Descarta pictogramas con violencia o contenido sexual (la app es para niños) y repetidos;
 * pone primero los que coinciden exactamente con lo buscado.
 */
export function normalizarResultados(json, { texto = '', max = 12 } = {}) {
  if (!Array.isArray(json)) return [];
  const buscado = normalizarTexto(texto);
  const vistos = new Set();
  const resultados = [];
  for (const item of json) {
    const id = Number(item?._id);
    if (!Number.isInteger(id) || id <= 0 || vistos.has(id)) continue;
    if (item.violence || item.sex) continue;
    vistos.add(id);
    const palabras = (item.keywords ?? []).map((k) => k.keyword).filter(Boolean);
    const exacto = palabras.some((p) => normalizarTexto(p) === buscado);
    resultados.push({ id, palabras, exacto });
  }
  resultados.sort((a, b) => Number(b.exacto) - Number(a.exacto));
  return resultados.slice(0, max).map(({ id, palabras }) => ({ id, palabras }));
}

async function pedir(url, fetchImpl) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ErrorRed('sin-conexion', 'No hay conexión a internet. Los pictogramas se buscan en línea; los ya guardados siguen funcionando.');
  }
  try {
    return await fetchImpl(url);
  } catch {
    throw new ErrorRed('sin-conexion', 'No se pudo conectar con ARASAAC. Revisa tu conexión e inténtalo de nuevo.');
  }
}

/** Busca pictogramas por texto. [] si no hay resultados. Lanza ErrorRed si no hay conexión o el servicio falla. */
export async function buscarPictogramas(texto, { fetchImpl = globalThis.fetch?.bind(globalThis), max = 12 } = {}) {
  const limpio = String(texto ?? '').trim();
  if (!limpio) return [];
  const respuesta = await pedir(urlBusqueda(limpio), fetchImpl);
  if (respuesta.status === 404) return []; // la API responde 404 cuando no hay coincidencias
  if (!respuesta.ok) throw new ErrorRed('servicio', 'El servicio de pictogramas no está respondiendo. Inténtalo más tarde.');
  let json;
  try {
    json = await respuesta.json();
  } catch {
    throw new ErrorRed('servicio', 'El servicio de pictogramas devolvió una respuesta inesperada.');
  }
  return normalizarResultados(json, { texto: limpio, max });
}

/** Descarga la imagen de un pictograma para guardarla localmente. */
export async function descargarPictograma(id, { tam = 500, fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
  const respuesta = await pedir(urlImagen(id, tam), fetchImpl);
  if (!respuesta.ok) throw new ErrorRed('servicio', 'No se pudo descargar el pictograma.');
  const blob = await respuesta.blob();
  if (!blob.size) throw new ErrorRed('servicio', 'El pictograma descargado está vacío.');
  return { blob, mime: blob.type || 'image/png', arasaacId: id };
}
