// Qué hay que borrar al quitar un perfil. Lógica pura, sin DOM ni base de datos.
//
// Se borran el perfil y todo lo que lleva su `perfilId` (palabras, progreso, respuestas, monedas, álbum…) y las
// fotos y audios que solo usaban esos registros. Un medio que también usa otro perfil se conserva.

import { borrarMedio } from '../medios.js';

/** Almacenes cuyos registros llevan `perfilId` (todos menos `perfiles` y `medios`). */
export const ALMACENES_DEL_PERFIL = Object.freeze([
  'palabras', 'progresos', 'niveles', 'frases', 'libros', 'sesiones', 'calcomanias', 'calcomaniasPropias', 'premios', 'movimientos', 'respuestas',
]);

/**
 * Borra el perfil y todo lo suyo (borrado suave: viaja a los demás dispositivos con la sincronización).
 * Devuelve cuántos registros y medios se borraron.
 */
export async function borrarPerfil(store, perfilId) {
  const perfiles = await store.listar('perfiles');
  if (!perfiles.some((p) => p.id === perfilId)) return { registros: 0, medios: 0 };
  const todos = {};
  for (const almacen of ALMACENES_DEL_PERFIL) todos[almacen] = await store.listar(almacen);
  const plan = planDeBorradoDePerfil({ perfilId, perfiles, todos });
  let registros = 0;
  for (const [almacen, ids] of Object.entries(plan.registros)) {
    for (const id of ids) if (await store.borrar(almacen, id)) registros += 1;
  }
  for (const id of plan.medios) await borrarMedio(store, id);
  return { registros, medios: plan.medios.length };
}

/** Los ids de medios que nombra un registro: fotoMedioId, medioImagenId, medioAudioId, medioSimboloId, páginas de libros… */
export function mediosDeRegistro(registro) {
  const ids = [];
  if (!registro || typeof registro !== 'object') return ids;
  for (const [clave, valor] of Object.entries(registro)) {
    if (typeof valor === 'string' && valor && (/^medio[A-Za-z]*Id$/.test(clave) || clave === 'fotoMedioId')) ids.push(valor);
  }
  if (Array.isArray(registro.paginas)) {
    for (const pagina of registro.paginas) if (pagina?.medioImagenId) ids.push(pagina.medioImagenId);
  }
  return ids;
}

/**
 * @param perfilId  el perfil a quitar
 * @param perfiles  los registros del almacén `perfiles` (vivos)
 * @param todos     { almacen: [registros vivos de TODOS los perfiles] } de los almacenes con `perfilId`
 * @returns {{ registros: {[almacen]: string[]}, medios: string[] }} ids a borrar
 */
export function planDeBorradoDePerfil({ perfilId, perfiles, todos }) {
  const perfil = perfiles.find((p) => p.id === perfilId);
  const registros = { perfiles: perfil ? [perfil.id] : [] };
  const propios = perfil ? [perfil] : [];
  const ajenos = perfiles.filter((p) => p.id !== perfilId);
  for (const [almacen, lista] of Object.entries(todos)) {
    const mios = lista.filter((r) => r.perfilId === perfilId);
    registros[almacen] = mios.map((r) => r.id);
    propios.push(...mios);
    ajenos.push(...lista.filter((r) => r.perfilId !== perfilId));
  }
  const usadosPorOtros = new Set(ajenos.flatMap(mediosDeRegistro));
  const medios = [...new Set(propios.flatMap(mediosDeRegistro))].filter((id) => !usadosPorOtros.has(id));
  return { registros, medios };
}
