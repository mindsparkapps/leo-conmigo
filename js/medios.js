// Fotos y audios guardados en el almacén 'medios' (como Blob) y sus URLs para mostrarlos.

const urls = new Map();

/** Guarda una foto/pictograma/grabación y devuelve su registro (con `id`). */
export async function guardarMedio(store, { tipo, blob, mime, origen, arasaacId = null }) {
  return store.guardar('medios', { tipo, blob, mime: mime || blob.type, origen, arasaacId, subido: false });
}

/**
 * El contenido de un archivo que viene dentro de la app (p. ej. `data/voces/mama.mp3`), o null si no se puede sacar.
 * Lo sirve el service worker, así que funciona sin red una vez instalada la app.
 */
export async function blobDeApp(ruta) {
  try {
    const respuesta = await fetch(ruta);
    if (!respuesta.ok) return null;
    const blob = await respuesta.blob();
    return blob.size ? blob : null;
  } catch {
    return null;
  }
}

/** Un solo medio por ruta del catálogo para todos los perfiles y dispositivos: su id sale de la ruta. */
export const idMedioDeCatalogo = (ruta) => `catalogo:${ruta}`;

/**
 * El medio de una voz del catálogo (campo `ruta`), el mismo para todos los perfiles. Si ya existe se reutiliza sin
 * bajar nada (si le falta el contenido, se saca de la app y se guarda en local sin tocar `updatedAt`);
 * si no, se crea una sola vez. El contenido se guarda siempre en local para jugar sin red, pero nunca viaja a Drive.
 * @param blob  contenido ya conocido (si no, se saca de la app); null si no hay forma de obtenerlo
 */
export async function medioDeCatalogo(store, ruta, { blob = null, traerDeApp = blobDeApp } = {}) {
  const id = idMedioDeCatalogo(ruta);
  const existente = await store.obtener('medios', id);
  if (existente?.blob) return existente;
  const contenido = blob ?? await traerDeApp(ruta);
  if (existente) {
    if (!contenido) return existente;
    const completo = { ...existente, blob: contenido };
    await store.importar('medios', [completo]);
    return completo;
  }
  if (!contenido) return null;
  return store.guardar('medios', { id, tipo: 'audio', blob: contenido, mime: 'audio/mpeg', origen: 'catalogo', ruta, arasaacId: null, subido: true });
}

/**
 * A las palabras recién creadas desde el catálogo les pone su audio grabado (campo `voz` del catálogo:
 * ruta de un mp3 de la app). Todos los perfiles comparten UN medio por ruta. Si el archivo no existe o no se
 * puede sacar, la palabra queda con la voz sintética.
 * Modifica las palabras y devuelve cuántas recibieron audio; hay que guardarlas después.
 */
export async function ponerVocesIniciales(store, palabras, catalogo, { traerDeApp = blobDeApp } = {}) {
  const rutaDe = new Map(catalogo.filter((c) => c.voz).map((c) => [c.texto, c.voz]));
  let puestas = 0;
  for (const palabra of palabras) {
    const ruta = rutaDe.get(palabra.texto);
    if (!ruta || palabra.medioAudioId) continue;
    try {
      const medio = await medioDeCatalogo(store, ruta, { traerDeApp });
      if (!medio) continue;
      palabra.medioAudioId = medio.id;
      puestas += 1;
    } catch {
      // sin red o sin el archivo: se queda con la voz sintética
    }
  }
  return puestas;
}

/**
 * Migración (una vez, en el adulto): las voces del catálogo guardadas como un medio por palabra y por perfil
 * (`origen: 'catalogo'`, sin `ruta`) pasan a UN solo medio por ruta. Se empareja por el texto de la palabra, se reescribe
 * su `medioAudioId` y los medios sobrantes se borran del almacén local. Sus archivos en Drive NO se borran
 * (quedan marcados `conservarEnDrive` para la pantalla de limpieza). Lo que no se puede emparejar no se toca.
 * @returns {{ palabras, medios }} cuántas palabras se reapuntaron y cuántos medios sobrantes se quitaron
 */
export async function migrarMediosDelCatalogo(store, catalogo) {
  const rutaDe = new Map(catalogo.filter((c) => c.voz).map((c) => [c.texto, c.voz]));
  const viejos = new Map((await store.listar('medios')).filter((m) => m.origen === 'catalogo' && !m.ruta && m.tipo === 'audio').map((m) => [m.id, m]));
  if (!viejos.size) return { palabras: 0, medios: 0 };
  const todas = await store.listar('palabras');
  const cambiadas = [];
  for (const palabra of todas) {
    const viejo = viejos.get(palabra.medioAudioId);
    const ruta = rutaDe.get(palabra.texto);
    if (!viejo || !ruta || !viejo.blob) continue;
    const medio = await medioDeCatalogo(store, ruta, { blob: viejo.blob });
    if (!medio) continue;
    cambiadas.push({ ...palabra, medioAudioId: medio.id });
  }
  if (cambiadas.length) await store.guardarVarios('palabras', cambiadas);
  // un medio viejo se quita solo si se reapuntó alguna palabra suya y ya ninguna palabra viva lo usa
  const reapuntadas = new Set(cambiadas.map((p) => p.id));
  const reapuntadosDesde = new Set(todas.filter((p) => reapuntadas.has(p.id)).map((p) => p.medioAudioId));
  const siguenUsando = new Set(todas.filter((p) => !reapuntadas.has(p.id)).map((p) => p.medioAudioId));
  let quitados = 0;
  for (const viejo of viejos.values()) {
    if (!reapuntadosDesde.has(viejo.id) || siguenUsando.has(viejo.id)) continue;
    await store.guardar('medios', { ...viejo, blob: null, deleted: true, subido: false, conservarEnDrive: true });
    quitados += 1;
  }
  return { palabras: cambiadas.length, medios: quitados };
}

const MARCA_MIGRACION = 'catalogoSinCopias1';

/**
 * Corre `migrarMediosDelCatalogo` una sola vez por dispositivo (la marca se guarda solo si todo salió bien).
 * Solo en el adulto: el celular de un alumno no escribe palabras. Sin red para el catálogo, se reintenta después.
 */
export async function migrarCatalogoUnaVez(store, { leerCatalogo = null } = {}) {
  try {
    if (await store.leerMeta(MARCA_MIGRACION)) return null;
    const catalogo = leerCatalogo ? await leerCatalogo() : await (await fetch('data/vocabulario-inicial.json')).json();
    const resultado = await migrarMediosDelCatalogo(store, catalogo);
    await store.escribirMeta(MARCA_MIGRACION, true);
    return resultado;
  } catch {
    return null;
  }
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
  try {
    await store.guardar('medios', { ...medio, blob: null, deleted: true, subido: false });
  } catch (error) {
    if (error?.name === 'ErrorCurso') return; // en el celular de un alumno un medio del curso (o del catálogo) no se borra
    throw error;
  }
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
