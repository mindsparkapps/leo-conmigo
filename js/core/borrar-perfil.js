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
  // Las fichas de los alumnos del curso y sus registros (avance, sesiones…) también se borran
  const fichas = (await store.listar('alumnos')).filter((f) => f.cursoId === perfilId);
  const familia = fichas.length ? (await store.listar('contenidoFamilia')).filter((f) => fichas.some((x) => x.id === f.fichaId)) : [];
  const plan = planDeBorradoDePerfil({ perfilId, perfiles, todos, fichas, familia });
  // el material de la familia que el adulto trajo a este celular (si lo hay) se quita con las fichas
  for (const ficha of fichas) await store.escribirMeta?.(`materialFamilia:${ficha.id}`, []);
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
  // Lo anidado del perfil: portada y sobre de cada álbum cargado (`colecciones`) y los del álbum de la app (`base`).
  const anidados = [...(Array.isArray(registro.colecciones) ? registro.colecciones : []), registro.base];
  for (const a of anidados) {
    if (!a || typeof a !== 'object') continue;
    for (const clave of ['medioPortadaId', 'medioSobreId']) if (typeof a[clave] === 'string' && a[clave]) ids.push(a[clave]);
  }
  return ids;
}

/**
 * @param perfilId  el perfil a quitar
 * @param perfiles  los registros del almacén `perfiles` (vivos)
 * @param todos     { almacen: [registros vivos de TODOS los perfiles] } de los almacenes con `perfilId`
 * @param fichas    las fichas de alumno de este curso (almacén `alumnos`): se borran con sus registros
 * @param familia   las filas de `contenidoFamilia` de esas fichas: se borran también
 * @returns {{ registros: {[almacen]: string[]}, medios: string[] }} ids a borrar
 */
export function planDeBorradoDePerfil({ perfilId, perfiles, todos, fichas = [], familia = [] }) {
  const perfil = perfiles.find((p) => p.id === perfilId);
  const registros = { perfiles: perfil ? [perfil.id] : [] };
  if (perfil && fichas.length) registros.alumnos = fichas.filter((f) => f.cursoId === perfilId).map((f) => f.id);
  // lo que agregó la familia de esos alumnos (solo la lista para estadísticas: sin fotos ni voces)
  if (perfil && familia.length) registros.contenidoFamilia = familia.filter((f) => (registros.alumnos ?? []).includes(f.fichaId)).map((f) => f.id);
  const idsDeFichas = new Set(registros.alumnos ?? []);
  const propios = perfil ? [perfil] : [];
  const ajenos = perfiles.filter((p) => p.id !== perfilId);
  for (const [almacen, lista] of Object.entries(todos)) {
    const mios = lista.filter((r) => r.perfilId === perfilId || idsDeFichas.has(r.perfilId));
    registros[almacen] = mios.map((r) => r.id);
    propios.push(...mios);
    ajenos.push(...lista.filter((r) => !mios.includes(r)));
  }
  const usadosPorOtros = new Set(ajenos.flatMap(mediosDeRegistro));
  const medios = [...new Set(propios.flatMap(mediosDeRegistro))].filter((id) => !usadosPorOtros.has(id));
  return { registros, medios };
}
