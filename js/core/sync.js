// Sincronización con Google Drive (PLAN.md §7). Lógica pura, sin red ni DOM.
//
// En la carpeta oculta de la app (appDataFolder) hay:
//   data.json            todos los registros (también los borrados, para que el borrado viaje) sin el contenido de las imágenes y audios
//   medio-<id>.<ext>     el contenido de cada imagen o audio
//
// Regla de fusión: registro por registro gana el `updatedAt` más reciente. Nada se pierde: lo que solo está
// en un lado se agrega al otro. Si dos dispositivos suben a la vez, el siguiente sync de cada uno repara la
// diferencia (cada uno vuelve a subir lo suyo que falte), porque los datos locales nunca se borran al fusionar.

import { ALMACENES_RESPALDO } from './respaldo.js';

export const FORMATO_SYNC = 'leo-conmigo-sync';
export const VERSION_SYNC = 1;
export const ARCHIVO_DATOS = 'data.json';
export const ALMACENES_SYNC = ALMACENES_RESPALDO; // 'medios' primero

/** Desde este tamaño de `data.json` la pantalla Cuenta avisa (el registro fino de respuestas es lo que más crece). */
export const LIMITE_AVISO_DATOS_BYTES = 8 * 1024 * 1024;
export const datosMuyGrandes = (bytes) => Number(bytes) > LIMITE_AVISO_DATOS_BYTES;

export class ErrorSync extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorSync';
  }
}

const EXTENSIONES = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

/** Nombre del archivo de un medio en Drive: medio-<id>.<ext>. */
export function nombreArchivoMedio(medio) {
  const base = String(medio.mime ?? '').split(';')[0].trim().toLowerCase();
  return `medio-${medio.id}.${EXTENSIONES[base] ?? 'bin'}`;
}

/** Los medios sin su contenido (el contenido va en archivos aparte). */
const sinBlob = (medio) => {
  const { blob, ...resto } = medio;
  return resto;
};

/**
 * @param almacenes  { palabras: [...], medios: [{..., blob}], ... } incluidos los borrados
 */
export function armarDocumento({ almacenes, ahora = new Date() }) {
  const salida = {};
  for (const nombre of ALMACENES_SYNC) {
    const lista = almacenes[nombre] ?? [];
    salida[nombre] = nombre === 'medios' ? lista.map(sinBlob) : [...lista];
  }
  return { formato: FORMATO_SYNC, version: VERSION_SYNC, actualizado: ahora.toISOString(), almacenes: salida };
}

/** Mensaje de error en español, o null si el documento de Drive es válido. */
export function validarDocumento(doc) {
  if (!doc || typeof doc !== 'object' || doc.formato !== FORMATO_SYNC) {
    return 'El archivo que hay en Google Drive no es de Leo Conmigo.';
  }
  if (!Number.isInteger(doc.version) || doc.version < 1) return 'Los datos de Google Drive están dañados: no tienen versión.';
  if (doc.version > VERSION_SYNC) return 'Los datos de Google Drive son de una versión más nueva de la aplicación. Actualiza la app e inténtalo de nuevo.';
  if (!doc.almacenes || typeof doc.almacenes !== 'object') return 'Los datos de Google Drive están dañados: no traen registros.';
  for (const nombre of ALMACENES_SYNC) {
    const lista = doc.almacenes[nombre];
    if (lista === undefined) continue;
    if (!Array.isArray(lista)) return `Los datos de Google Drive están dañados (${nombre}).`;
    if (lista.some((r) => !r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id)) {
      return `Los datos de Google Drive están dañados: hay un registro sin identificador (${nombre}).`;
    }
  }
  return null;
}

/**
 * Fusiona los registros de un almacén (incluidos los borrados).
 * @returns {{ resultado, paraLocal, paraRemoto }} resultado = unión con el más reciente de cada id;
 *   paraLocal = lo que hay que escribir aquí; paraRemoto = lo que Drive todavía no tiene así.
 */
export function fusionarAlmacen(locales, remotos) {
  const l = new Map(locales.map((r) => [r.id, r]));
  const r = new Map(remotos.map((x) => [x.id, x]));
  const resultado = [];
  const paraLocal = [];
  let paraRemoto = 0;
  for (const id of new Set([...l.keys(), ...r.keys()])) {
    const a = l.get(id);
    const b = r.get(id);
    if (!a) { resultado.push(b); paraLocal.push(b); continue; }
    if (!b) { resultado.push(a); paraRemoto += 1; continue; }
    const ta = a.updatedAt ?? '';
    const tb = b.updatedAt ?? '';
    if (tb > ta) { resultado.push(b); paraLocal.push(b); } else if (ta > tb) { resultado.push(a); paraRemoto += 1; } else resultado.push(a);
  }
  return { resultado, paraLocal, paraRemoto };
}

/**
 * Qué hay que hacer con los archivos de imágenes y audios.
 * @param medios       los medios ya fusionados (con `deleted`)
 * @param archivos     Map nombre -> { id } de lo que hay en Drive
 * @param conBlobLocal Set de ids de medios cuyo contenido está en este dispositivo
 */
export function planDeMedios({ medios, archivos, conBlobLocal }) {
  const subir = [];
  const bajar = [];
  const borrarRemotos = [];
  const faltantes = [];
  for (const medio of medios) {
    const nombre = nombreArchivoMedio(medio);
    const remoto = archivos.get(nombre);
    if (medio.deleted) {
      if (remoto) borrarRemotos.push({ medio, archivoId: remoto.id });
    } else if (conBlobLocal.has(medio.id)) {
      if (!remoto) subir.push({ medio, nombre });
    } else if (remoto) {
      bajar.push({ medio, nombre, archivoId: remoto.id });
    } else {
      faltantes.push(medio);
    }
  }
  return { subir, bajar, borrarRemotos, faltantes };
}

/** Cuántos registros hay por almacén (para mostrar el resultado). */
export function contarRegistros(almacenes) {
  const cuenta = {};
  for (const nombre of ALMACENES_SYNC) cuenta[nombre] = (almacenes[nombre] ?? []).filter((r) => !r.deleted).length;
  return cuenta;
}
