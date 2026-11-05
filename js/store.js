// Almacenamiento local en IndexedDB (PLAN.md §7).
//
// Un almacén por entidad (perfiles, palabras, progresos, ...) más:
//  - colaSync: qué registros cambiaron desde la última sincronización con Drive.
//  - meta: pares clave/valor sueltos (versión, último sync, ...).
//
// Todos los registros tienen `id`, `updatedAt` y `deleted`. Borrar es "suave"
// (deleted: true) para que el borrado viaje a los demás dispositivos al sincronizar.

import { nuevoId } from './core/id.js';

export const NOMBRE_BD = 'leo-conmigo';
const VERSION_BD = 1;

/** Almacenes de datos y los índices de cada uno. */
export const ALMACENES = Object.freeze({
  perfiles: [],
  palabras: ['perfilId'],
  progresos: ['perfilId'],
  niveles: ['perfilId'],
  frases: ['perfilId'],
  libros: ['perfilId'],
  sesiones: ['perfilId'],
  calcomanias: ['perfilId'],
  medios: [], // { id, tipo, mime, blob, driveFileId, subido }
});

const COLA = 'colaSync';
const META = 'meta';

function crearEsquema(db) {
  for (const [nombre, indices] of Object.entries(ALMACENES)) {
    if (db.objectStoreNames.contains(nombre)) continue;
    const almacen = db.createObjectStore(nombre, { keyPath: 'id' });
    for (const campo of indices) almacen.createIndex(campo, campo);
  }
  if (!db.objectStoreNames.contains(COLA)) db.createObjectStore(COLA, { keyPath: 'clave' });
  if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'clave' });
}

const pedir = (peticion) =>
  new Promise((resolver, rechazar) => {
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error);
  });

const terminar = (transaccion) =>
  new Promise((resolver, rechazar) => {
    transaccion.oncomplete = () => resolver();
    transaccion.onerror = () => rechazar(transaccion.error);
    transaccion.onabort = () => rechazar(transaccion.error ?? new Error('Transacción cancelada'));
  });

function validarAlmacen(almacen) {
  if (!Object.hasOwn(ALMACENES, almacen)) throw new Error(`Almacén desconocido: ${almacen}`);
}

/**
 * Abre (o crea) la base de datos.
 * @param nombre  nombre de la base (las pruebas usan una aparte)
 * @param idb     implementación de IndexedDB (por defecto la del navegador)
 * @param ahora   función que devuelve la hora actual en ISO (inyectable para pruebas)
 */
export function abrirStore({ nombre = NOMBRE_BD, idb = globalThis.indexedDB, ahora = () => new Date().toISOString(), alCerrarse = null } = {}) {
  if (!idb) return Promise.reject(new Error('IndexedDB no está disponible en este navegador'));
  return new Promise((resolver, rechazar) => {
    const peticion = idb.open(nombre, VERSION_BD);
    peticion.onupgradeneeded = () => crearEsquema(peticion.result);
    peticion.onerror = () => rechazar(peticion.error);
    peticion.onsuccess = () => {
      const db = peticion.result;
      // Otra pestaña quiere actualizar o borrar la base: se cierra esta conexión y se avisa, para que
      // quien la use pueda volver a abrirla (ver contexto.js). También si el navegador la cierra solo.
      db.onversionchange = () => {
        db.close();
        alCerrarse?.();
      };
      db.onclose = () => alCerrarse?.();
      resolver(crearStore(db, ahora));
    };
  });
}

/** Borra por completo una base de datos (solo para pruebas o "borrar todo"). */
export function borrarBD(nombre = NOMBRE_BD, idb = globalThis.indexedDB) {
  return new Promise((resolver, rechazar) => {
    const peticion = idb.deleteDatabase(nombre);
    peticion.onsuccess = () => resolver();
    peticion.onerror = () => rechazar(peticion.error);
    peticion.onblocked = () => resolver(); // se borrará al cerrarse las demás conexiones
  });
}

function crearStore(db, ahora) {
  const claveCola = (almacen, id) => `${almacen}/${id}`;

  async function guardarVarios(almacen, registros) {
    validarAlmacen(almacen);
    const guardados = registros.map((r) => ({
      ...r,
      id: r.id ?? nuevoId(),
      updatedAt: ahora(),
      deleted: r.deleted ?? false,
    }));
    if (!guardados.length) return guardados;
    const tx = db.transaction([almacen, COLA], 'readwrite');
    const datos = tx.objectStore(almacen);
    const cola = tx.objectStore(COLA);
    try {
      for (const r of guardados) {
        datos.put(r);
        cola.put({ clave: claveCola(almacen, r.id), almacen, id: r.id, fecha: r.updatedAt });
      }
    } catch (error) {
      tx.abort(); // un registro no se puede guardar (p. ej. trae una función): no se guarda ninguno
      throw error;
    }
    await terminar(tx);
    return guardados;
  }

  return {
    /** Guarda (crea o reemplaza) un registro. Le pone `id` si no lo tiene, `updatedAt` y lo marca para sincronizar. */
    async guardar(almacen, registro) {
      return (await guardarVarios(almacen, [registro]))[0];
    },

    /** Guarda varios registros en una sola transacción (todos o ninguno). */
    guardarVarios,

    /** Devuelve un registro, o undefined si no existe o está borrado. */
    async obtener(almacen, id, { conBorrados = false } = {}) {
      validarAlmacen(almacen);
      const registro = await pedir(db.transaction(almacen).objectStore(almacen).get(id));
      return registro && (conBorrados || !registro.deleted) ? registro : undefined;
    },

    /** Lista los registros (de un perfil si se indica `perfilId`). Sin los borrados, salvo `conBorrados`. */
    async listar(almacen, { perfilId, conBorrados = false } = {}) {
      validarAlmacen(almacen);
      const datos = db.transaction(almacen).objectStore(almacen);
      let registros;
      if (perfilId !== undefined) {
        if (!ALMACENES[almacen].includes('perfilId')) throw new Error(`El almacén ${almacen} no se filtra por perfil`);
        registros = await pedir(datos.index('perfilId').getAll(perfilId));
      } else {
        registros = await pedir(datos.getAll());
      }
      return conBorrados ? registros : registros.filter((r) => !r.deleted);
    },

    /** Borrado suave: marca el registro como borrado y lo deja listo para sincronizar. Devuelve false si no existía. */
    async borrar(almacen, id) {
      validarAlmacen(almacen);
      const tx = db.transaction([almacen, COLA], 'readwrite');
      const datos = tx.objectStore(almacen);
      const registro = await pedir(datos.get(id));
      if (!registro) return false;
      const fecha = ahora();
      datos.put({ ...registro, deleted: true, updatedAt: fecha });
      tx.objectStore(COLA).put({ clave: claveCola(almacen, id), almacen, id, fecha });
      await terminar(tx);
      return true;
    },

    /**
     * Guarda registros tal cual vienen (sin tocar `updatedAt` ni la cola de sincronización).
     * Es lo que usa la sincronización al traer cambios de Drive, y la importación de respaldos.
     */
    async importar(almacen, registros) {
      validarAlmacen(almacen);
      if (!registros.length) return;
      if (registros.some((r) => !r.id)) throw new Error('Un registro importado necesita id');
      const tx = db.transaction(almacen, 'readwrite');
      const datos = tx.objectStore(almacen);
      try {
        for (const r of registros) datos.put(r);
      } catch (error) {
        tx.abort();
        throw error;
      }
      await terminar(tx);
    },

    /** Registros pendientes de subir a Drive: [{ clave, almacen, id, fecha }], del más viejo al más nuevo. */
    async pendientesSync() {
      const todos = await pedir(db.transaction(COLA).objectStore(COLA).getAll());
      return todos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.clave.localeCompare(b.clave));
    },

    /**
     * Quita de la cola los registros ya subidos. Solo quita los que no volvieron a cambiar
     * mientras se subían (misma `fecha`), para no perder una edición hecha a mitad de camino.
     */
    async limpiarCola(subidos) {
      const tx = db.transaction(COLA, 'readwrite');
      const cola = tx.objectStore(COLA);
      for (const item of subidos) {
        const actual = await pedir(cola.get(item.clave));
        if (actual && actual.fecha === item.fecha) cola.delete(item.clave);
      }
      await terminar(tx);
    },

    async leerMeta(clave, porDefecto = undefined) {
      const fila = await pedir(db.transaction(META).objectStore(META).get(clave));
      return fila ? fila.valor : porDefecto;
    },

    async escribirMeta(clave, valor) {
      const tx = db.transaction(META, 'readwrite');
      tx.objectStore(META).put({ clave, valor });
      await terminar(tx);
    },

    /** Vacía todos los almacenes (datos, cola y meta). */
    async vaciar() {
      const nombres = [...Object.keys(ALMACENES), COLA, META];
      const tx = db.transaction(nombres, 'readwrite');
      for (const n of nombres) tx.objectStore(n).clear();
      await terminar(tx);
    },

    cerrar() {
      db.close();
    },
  };
}
