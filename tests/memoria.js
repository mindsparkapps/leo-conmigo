// Almacén en memoria con la misma interfaz que js/store.js (la parte que usan el respaldo y las pantallas).
// Para probar en Node lo que en la app corre sobre IndexedDB. No es una prueba: no termina en .test.js.

/**
 * @param desde  segundo (desde las 10:00:00) en que empieza el reloj de este almacén; sirve para simular
 *               dos dispositivos con horas distintas. `prefijo` evita ids repetidos entre dos almacenes.
 */
export function crearStoreEnMemoria({ desde = 0, prefijo = 'id' } = {}) {
  const datos = new Map();
  const meta = new Map();
  const cola = new Map();
  let reloj = desde;
  let contador = 0;
  const tabla = (almacen) => {
    if (!datos.has(almacen)) datos.set(almacen, new Map());
    return datos.get(almacen);
  };
  const ahora = () => new Date(Date.UTC(2026, 10, 5, 10, 0, reloj++)).toISOString();
  const encolar = (almacen, id, fecha) => cola.set(`${almacen}/${id}`, { clave: `${almacen}/${id}`, almacen, id, fecha });

  return {
    async guardar(almacen, registro) {
      const guardado = {
        ...registro,
        id: registro.id ?? `${prefijo}-${++contador}`,
        updatedAt: ahora(),
        deleted: registro.deleted ?? false,
      };
      tabla(almacen).set(guardado.id, guardado);
      encolar(almacen, guardado.id, guardado.updatedAt);
      return guardado;
    },
    async pendientesSync() {
      return [...cola.values()].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.clave.localeCompare(b.clave));
    },
    async limpiarCola(subidos) {
      for (const item of subidos) if (cola.get(item.clave)?.fecha === item.fecha) cola.delete(item.clave);
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
      const fecha = ahora();
      tabla(almacen).set(id, { ...r, deleted: true, updatedAt: fecha });
      encolar(almacen, id, fecha);
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
