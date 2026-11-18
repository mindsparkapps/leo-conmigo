// La foto del alumno (sin DOM). La pantalla está en `adulto/foto-alumno.js`.
//
// La foto es del alumno, no del perfil (curso). En el celular del alumno se guarda como un medio de la familia
// (`origen: 'familia'`, lo pone el almacén envuelto de `store-familia.js`): su archivo va a la carpeta `familia/` de su Drive y a
// su respaldo, nunca al Drive del adulto ni a la Biblioteca. El perfil guarda solo su id (`medioFotoAlumnoId`, campo del alumno
// en `core/curso.js`): el adulto lo recibe en la ficha y ve la foto solo si trae el material de la familia.

import { guardarMedio, borrarMedio } from './medios.js';

/** Cambia (o quita, con `blob` null) la foto del alumno. Devuelve el perfil guardado. */
export async function guardarFotoAlumno(store, perfil, { blob = null, mime = null } = {}) {
  const actual = (await store.obtener('perfiles', perfil.id)) ?? perfil;
  const nuevoId = blob ? (await guardarMedio(store, { tipo: 'imagen', blob, mime, origen: 'foto' })).id : null;
  if (actual.medioFotoAlumnoId && actual.medioFotoAlumnoId !== nuevoId) await borrarMedio(store, actual.medioFotoAlumnoId);
  const nuevo = { ...actual };
  if (nuevoId) nuevo.medioFotoAlumnoId = nuevoId;
  else delete nuevo.medioFotoAlumnoId;
  await store.guardar('perfiles', nuevo);
  return nuevo;
}

/** La foto que tenía el perfil (perfiles antiguos), para pasarla al alumno: { blob, mime } o null si no hay. */
export async function fotoQueTeniaElPerfil(store, perfil) {
  if (!perfil?.fotoMedioId) return null;
  const medio = await store.obtener('medios', perfil.fotoMedioId);
  return medio?.blob ? { blob: medio.blob, mime: medio.mime || medio.blob.type || 'image/webp' } : null;
}
