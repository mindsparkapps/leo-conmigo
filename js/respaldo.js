// Exportar e importar la copia de seguridad usando el almacén local (la lógica pura está en core/respaldo.js).

import { VERSION } from './config.js';
import { claveDia } from './core/progreso.js';
import {
  ALMACENES_RESPALDO, ErrorRespaldo, armarRespaldo, decodificarRespaldo, fusionar,
} from './core/respaldo.js';

/** Lee todo lo vigente del almacén y arma el respaldo (objeto; se guarda con `JSON.stringify`). */
export async function exportarTodo(store, ahora = new Date()) {
  const almacenes = {};
  for (const nombre of ALMACENES_RESPALDO) almacenes[nombre] = await store.listar(nombre);
  const meta = { perfilActivoId: await store.leerMeta('perfilActivoId', null) };
  return armarRespaldo({ almacenes, meta, appVersion: VERSION, ahora });
}

export function nombreDeArchivo(fecha = new Date()) {
  return `leo-conmigo-respaldo-${claveDia(fecha)}.json`;
}

/** Cuenta lo que trae un respaldo (para mostrárselo al adulto antes de descargarlo). */
export function contarRespaldo(respaldo) {
  const cuenta = {};
  for (const nombre of ALMACENES_RESPALDO) cuenta[nombre] = respaldo.almacenes[nombre]?.length ?? 0;
  return cuenta;
}

/**
 * Restaura una copia sin borrar nada: suma lo que falta y se queda con lo más reciente.
 * Todo se lee y valida ANTES de escribir; si el archivo está dañado no se toca nada.
 * @returns { almacen: { nuevos, omitidos } }
 */
export async function importarTodo(store, texto) {
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new ErrorRespaldo('No se pudo leer el archivo: no es una copia de seguridad de Leo Conmigo.');
  }
  const { almacenes, meta } = decodificarRespaldo(datos);

  const resumen = {};
  for (const nombre of ALMACENES_RESPALDO) {
    const existentes = await store.listar(nombre, { conBorrados: true });
    const { aEscribir, omitidos } = fusionar(existentes, almacenes[nombre]);
    await store.importar(nombre, aEscribir);
    resumen[nombre] = { nuevos: aEscribir.length, omitidos };
  }

  // Si todavía no hay un niño activo, se usa el de la copia (siempre que exista)
  if (meta.perfilActivoId && !(await store.leerMeta('perfilActivoId'))) {
    if (await store.obtener('perfiles', meta.perfilActivoId)) await store.escribirMeta('perfilActivoId', meta.perfilActivoId);
  }
  return resumen;
}
