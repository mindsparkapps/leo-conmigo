// Acceso compartido al almacén y al perfil activo (el niño que está usando la app).

import { abrirStore } from './store.js';

const META_PERFIL = 'perfilActivoId';
let promesaStore = null;

/** Abre el almacén una sola vez. Rechaza si el navegador no puede guardar datos. */
export function obtenerStore() {
  promesaStore ??= abrirStore().catch((error) => {
    promesaStore = null; // permite reintentar
    throw error;
  });
  return promesaStore;
}

/** El perfil activo; si no hay ninguno elegido usa el primero. null si aún no hay perfiles. */
export async function perfilActivo() {
  const store = await obtenerStore();
  const id = await store.leerMeta(META_PERFIL);
  if (id) {
    const perfil = await store.obtener('perfiles', id);
    if (perfil) return perfil;
  }
  const todos = (await store.listar('perfiles')).sort((a, b) => (a.creado ?? '').localeCompare(b.creado ?? ''));
  if (!todos.length) return null;
  await store.escribirMeta(META_PERFIL, todos[0].id);
  return todos[0];
}

export async function fijarPerfilActivo(id) {
  const store = await obtenerStore();
  await store.escribirMeta(META_PERFIL, id);
}
