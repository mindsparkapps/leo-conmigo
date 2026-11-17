// El almacén tal como lo ve el celular de un ALUMNO (PLAN.md, Ampliación 4, fase 24).
//
// Lo que la familia agrega (palabras, frases, libros, láminas, premios y sus fotos y voces) se marca `origen: 'familia'` al guardarlo, y
// lo del curso (que viene del adulto) no se puede cambiar ni borrar desde las pantallas que reutilizan los editores del adulto.
// En el celular del adulto este envoltorio no hace nada. La sincronización escribe con `importar`, que NO pasa por aquí.

import { aplicarOrigenDeFamilia, ALMACENES_DE_FAMILIA } from './core/curso.js';

/**
 * @param store        el almacén de la app
 * @param esAlumno     () => ¿este dispositivo es de un alumno? (se consulta en cada escritura)
 */
export function envolverParaFamilia(store, esAlumno) {
  const previoDe = (almacen, registro) => (registro?.id ? store.obtener(almacen, registro.id, { conBorrados: true }) : undefined);

  return {
    ...store,

    async guardar(almacen, registro) {
      if (!esAlumno() || !ALMACENES_DE_FAMILIA.includes(almacen)) return store.guardar(almacen, registro);
      return store.guardar(almacen, aplicarOrigenDeFamilia(almacen, registro, await previoDe(almacen, registro)));
    },

    async guardarVarios(almacen, registros) {
      if (!esAlumno() || !ALMACENES_DE_FAMILIA.includes(almacen)) return store.guardarVarios(almacen, registros);
      const listos = [];
      for (const r of registros) listos.push(aplicarOrigenDeFamilia(almacen, r, await previoDe(almacen, r)));
      return store.guardarVarios(almacen, listos);
    },

    async borrar(almacen, id) {
      if (esAlumno() && ALMACENES_DE_FAMILIA.includes(almacen)) {
        const previo = await store.obtener(almacen, id, { conBorrados: true });
        if (previo) aplicarOrigenDeFamilia(almacen, previo, previo); // lanza si es del curso
      }
      return store.borrar(almacen, id);
    },
  };
}
