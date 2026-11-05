// Fotos y audios guardados en el almacén 'medios' (como Blob) y sus URLs para mostrarlos.

const urls = new Map();

/** Guarda una foto/pictograma/grabación y devuelve su registro (con `id`). */
export async function guardarMedio(store, { tipo, blob, mime, origen, arasaacId = null }) {
  return store.guardar('medios', { tipo, blob, mime: mime || blob.type, origen, arasaacId, subido: false });
}

/**
 * Quita un medio: se borra el contenido (para no acumular fotos viejas) y queda la marca
 * de borrado para que se sincronice con los demás dispositivos.
 */
export async function borrarMedio(store, id) {
  if (!id) return;
  const medio = await store.obtener('medios', id, { conBorrados: true });
  if (!medio) return;
  await store.guardar('medios', { ...medio, blob: null, deleted: true, subido: false });
  const url = urls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urls.delete(id);
  }
}

/** URL (blob:) para mostrar un medio en <img> o <audio>; null si no existe. */
export async function urlDeMedio(store, id) {
  if (!id) return null;
  if (urls.has(id)) return urls.get(id);
  const medio = await store.obtener('medios', id);
  if (!medio?.blob) return null;
  const url = URL.createObjectURL(medio.blob);
  urls.set(id, url);
  return url;
}

/** Libera las URLs creadas (al salir de una vista). */
export function liberarUrls() {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}
