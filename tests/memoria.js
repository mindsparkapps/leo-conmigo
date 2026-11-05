// Almacén en memoria con la misma interfaz que js/store.js (la parte que usan el respaldo y las pantallas).
// Para probar en Node lo que en la app corre sobre IndexedDB. No es una prueba: no termina en .test.js.

export function crearStoreEnMemoria() {
  const datos = new Map();
  const meta = new Map();
  let reloj = 0;
  let contador = 0;
  const tabla = (almacen) => {
    if (!datos.has(almacen)) datos.set(almacen, new Map());
    return datos.get(almacen);
  };

  return {
    async guardar(almacen, registro) {
      const guardado = {
        ...registro,
        id: registro.id ?? `id-${++contador}`,
        updatedAt: new Date(Date.UTC(2026, 10, 5, 10, 0, reloj++)).toISOString(),
        deleted: registro.deleted ?? false,
      };
      tabla(almacen).set(guardado.id, guardado);
      return guardado;
    },
    async listar(almacen, { perfilId, conBorrados = false } = {}) {
      return [...tabla(almacen).values()].filter(
        (r) => (conBorrados || !r.deleted) && (perfilId === undefined || r.perfilId === perfilId),
      );
    },
    async obtener(almacen, id, { conBorrados = false } = {}) {
      const r = tabla(almacen).get(id);
      return r && (conBorrados || !r.deleted) ? r : undefined;
    },
    async importar(almacen, registros) {
      for (const r of registros) tabla(almacen).set(r.id, r);
    },
    async borrar(almacen, id) {
      const r = tabla(almacen).get(id);
      if (!r) return false;
      tabla(almacen).set(id, { ...r, deleted: true, updatedAt: new Date(Date.UTC(2026, 10, 5, 10, 0, reloj++)).toISOString() });
      return true;
    },
    async leerMeta(clave, porDefecto = undefined) {
      return meta.has(clave) ? meta.get(clave) : porDefecto;
    },
    async escribirMeta(clave, valor) {
      meta.set(clave, valor);
    },
  };
}

/** Bytes de un Blob como lista de números (para comparar contenidos). */
export async function bytesDe(blob) {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}
