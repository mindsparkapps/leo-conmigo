// El material de la familia de un alumno (fotos y voces) que el ADULTO decide traer a su celular (PLAN.md, Ampliación 4, fase 24).
//
// No se baja solo: lo trae el botón «Traer el material de la familia» y lo quita «Quitarlo de mi celular». Sirve únicamente para ver
// las fotos y oír las voces en las estadísticas de esa ficha. Se guarda en `meta` (una lista por ficha) a propósito, y NO en el almacén
// `medios`: así nunca entra a la sincronización personal del adulto, ni a su copia de seguridad, ni a la Biblioteca. Quitarlo borra solo
// esta copia local: no toca el Drive ni el celular del alumno.

const clave = (fichaId) => `materialFamilia:${fichaId}`;

/** Lo que hay traído de esa ficha: [{ id, tipo, mime, nombre, blob }]. */
export async function materialDe(store, fichaId) {
  return (await store.leerMeta(clave(fichaId), [])) ?? [];
}

export async function guardarMaterial(store, fichaId, items) {
  await store.escribirMeta(clave(fichaId), items);
}

/** «Quitarlo de mi celular»: borra solo la copia local. Devuelve cuántos archivos quitó. */
export async function quitarMaterial(store, fichaId) {
  const n = (await materialDe(store, fichaId)).length;
  await store.escribirMeta(clave(fichaId), []);
  return n;
}

/** Un `medio-<id>.<ext>` de `familia/` -> el id del medio (o null si no es un medio). */
export const idDeArchivoDeMedio = (nombre) => /^medio-(.+)\.[^./]+$/.exec(String(nombre ?? ''))?.[1] ?? null;

/** Direcciones (blob:) para mostrar el material: id del medio -> url. Quien las pide las libera con `liberar()`. */
export function urlsDeMaterial(items) {
  const urls = new Map((items ?? []).filter((m) => m.blob).map((m) => [m.id, URL.createObjectURL(m.blob)]));
  return { urls, liberar: () => { for (const u of urls.values()) URL.revokeObjectURL(u); urls.clear(); } };
}
