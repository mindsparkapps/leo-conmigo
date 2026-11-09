// Fotos y audios guardados en el almacén 'medios' (como Blob) y sus URLs para mostrarlos.

const urls = new Map();

/** Guarda una foto/pictograma/grabación y devuelve su registro (con `id`). */
export async function guardarMedio(store, { tipo, blob, mime, origen, arasaacId = null }) {
  return store.guardar('medios', { tipo, blob, mime: mime || blob.type, origen, arasaacId, subido: false });
}

/**
 * A las palabras recién creadas desde el catálogo les pone su audio grabado (campo `voz` del catálogo:
 * ruta de un mp3 de la app). Si el archivo no existe o no se puede bajar, la palabra queda con la voz sintética.
 * Modifica las palabras y devuelve cuántas recibieron audio; hay que guardarlas después.
 */
export async function ponerVocesIniciales(store, palabras, catalogo) {
  const rutaDe = new Map(catalogo.filter((c) => c.voz).map((c) => [c.texto, c.voz]));
  let puestas = 0;
  for (const palabra of palabras) {
    const ruta = rutaDe.get(palabra.texto);
    if (!ruta || palabra.medioAudioId) continue;
    try {
      const respuesta = await fetch(ruta);
      if (!respuesta.ok) continue;
      const blob = await respuesta.blob();
      if (!blob.size) continue;
      const medio = await guardarMedio(store, { tipo: 'audio', blob, mime: 'audio/mpeg', origen: 'catalogo' });
      palabra.medioAudioId = medio.id;
      puestas += 1;
    } catch {
      // sin red o sin el archivo: se queda con la voz sintética
    }
  }
  return puestas;
}

/**
 * Una sola vez por perfil, pone el audio del catálogo a las palabras que ya tenía (creadas antes de que
 * existieran los audios) y todavía no tienen grabación. Si no hay red, no marca nada y lo reintenta luego.
 * Una grabación del adulto nunca se pisa, y si la quita después no vuelve.
 */
export async function completarVocesIniciales(store, perfilId) {
  const marca = `vocesIniciales2-${perfilId}`;
  try {
    const respuesta = await fetch('data/vocabulario-inicial.json');
    if (!respuesta.ok) return 0;
    const catalogo = await respuesta.json();
    // La marca guarda cuántas voces tenía el catálogo la última vez: si se agregan voces nuevas, se vuelve a revisar
    const totalConVoz = catalogo.filter((c) => c.voz).length;
    if ((await store.leerMeta(marca)) === totalConVoz) return 0;
    const palabras = (await store.listar('palabras', { perfilId })).filter((p) => !p.deleted && !p.medioAudioId);
    const puestas = await ponerVocesIniciales(store, palabras, catalogo);
    const cambiadas = palabras.filter((p) => p.medioAudioId);
    if (cambiadas.length) await store.guardarVarios('palabras', cambiadas);
    const conVoz = new Set(catalogo.filter((c) => c.voz).map((c) => c.texto));
    if (puestas === palabras.filter((p) => conVoz.has(p.texto)).length) await store.escribirMeta(marca, totalConVoz);
    return puestas;
  } catch {
    return 0;
  }
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
