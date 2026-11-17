// Acceso compartido al almacén y al perfil activo (el niño que está usando la app).

import { abrirStore } from './store.js';
import { completarVocesIniciales, migrarCatalogoUnaVez } from './medios.js';
import { esAlumno } from './acceso.js';
import { contenidoDe } from './core/curso.js';
import { envolverParaFamilia } from './store-familia.js';

const META_PERFIL = 'perfilActivoId';
let promesaStore = null;

/**
 * Abre el almacén una sola vez. Rechaza si el navegador no puede guardar datos.
 * Si la conexión se cierra (otra pestaña actualizó o borró la base), la siguiente llamada la reabre.
 */
export function obtenerStore() {
  if (!promesaStore) {
    // En el celular de un alumno lo que escribe la familia se marca «de la familia» y lo del curso no se toca (store-familia.js)
    const esta = abrirStore({
      alCerrarse: () => {
        if (promesaStore === esta) promesaStore = null;
      },
    }).then((store) => envolverParaFamilia(store, esAlumno)).catch((error) => {
      if (promesaStore === esta) promesaStore = null; // permite reintentar
      throw error;
    });
    promesaStore = esta;
  }
  return promesaStore;
}

/** El perfil activo; si no hay ninguno elegido usa el primero. null si aún no hay perfiles. */
export async function perfilActivo() {
  const store = await obtenerStore();
  const perfil = await elegirPerfil(store);
  // El alumno recibe las voces del adulto: no completa palabras por su cuenta (son del adulto y no las publica)
  if (perfil && !esAlumno() && !vocesRevisadas.has(perfil.id)) {
    vocesRevisadas.add(perfil.id);
    await migrarCatalogoUnaVez(store); // una voz del catálogo = un solo medio para todos los perfiles
    await completarVocesIniciales(store, perfil.id);
  }
  return perfil;
}

const vocesRevisadas = new Set();

async function elegirPerfil(store) {
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

/**
 * De quién son las estadísticas que muestra una pantalla del adulto (Progreso, «Qué le cuesta», Álbum…): del perfil activo o,
 * si la ruta termina en `/ficha/<id>`, de la ficha de un alumno (Ampliación 4, fase 23). Es de solo lectura para una ficha.
 * @returns {Promise<null | { perfil, ficha, id, contenidoId, titulo, sufijo }>}
 *   perfil: el curso (de ahí salen palabras, frases, libros y álbumes: `contenidoId`); id: el `perfilId` con que se guardó el
 *   avance (el perfil o la ficha); sufijo: lo que se agrega a un enlace para seguir en la misma ficha ('' o '/ficha/…').
 *   `{ faltaFicha: true }` si la ficha ya no existe.
 */
export async function sujetoDeEstadisticas(ruta = '') {
  const encontrada = /\/ficha\/([^/?#]+)$/.exec(ruta);
  if (!encontrada) {
    const perfil = await perfilActivo();
    return perfil ? { perfil, ficha: null, id: perfil.id, contenidoId: perfil.id, titulo: perfil.nombre, sufijo: '' } : null;
  }
  const store = await obtenerStore();
  const ficha = await store.obtener('alumnos', decodeURIComponent(encontrada[1]));
  const perfil = ficha ? await store.obtener('perfiles', contenidoDe(ficha)) : null;
  if (!ficha || !perfil) return { faltaFicha: true };
  return { perfil, ficha, id: ficha.id, contenidoId: contenidoDe(ficha), titulo: `${ficha.nombre} · perfil ${perfil.nombre}`, sufijo: `/ficha/${encodeURIComponent(ficha.id)}` };
}

export async function fijarPerfilActivo(id) {
  const store = await obtenerStore();
  await store.escribirMeta(META_PERFIL, id);
}
