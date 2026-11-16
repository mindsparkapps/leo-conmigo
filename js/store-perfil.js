// Una «vista» del almacén que solo ve y toca lo de UN perfil (PLAN.md, fase 16: aulas).
//
// Con ella, el sincronizador del aula no puede leer ni escribir registros de otro perfil, aunque el archivo de Drive
// (o un error) lo intentara: `listar` solo devuelve lo del perfil e `importar` rechaza lo de otro. Es la segunda
// barrera después de `filtrarEntrantes` (core/aula.js).

import { ALMACENES_DEL_PERFIL } from './core/borrar-perfil.js';
import { mediosDelPerfil } from './core/aula.js';

export class ErrorVistaPerfil extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorVistaPerfil';
  }
}

/**
 * @param store               el almacén de la app (js/store.js o el de pruebas)
 * @param perfilId            el único perfil que se ve
 * @param idsMediosConocidos  medios ya sincronizados alguna vez: se siguen viendo aunque el perfil ya no los use, para
 *                            que un medio borrado viaje como borrado y no «resucite»
 */
export function vistaDePerfil(store, perfilId, { idsMediosConocidos = [] } = {}) {
  const conocidos = idsMediosConocidos instanceof Set ? idsMediosConocidos : new Set(idsMediosConocidos); // un Set se comparte: quien sincroniza le suma los nuevos
  const prefijo = `aula:${perfilId}:`;
  const esDelPerfil = (almacen, r) => (almacen === 'perfiles' ? r?.id === perfilId : r?.perfilId === perfilId);

  async function registrosDelPerfil() {
    const registros = {};
    for (const almacen of ALMACENES_DEL_PERFIL) registros[almacen] = await store.listar(almacen, { perfilId });
    return registros;
  }

  async function mediosVisibles() {
    const perfil = (await store.obtener('perfiles', perfilId, { conBorrados: true })) ?? { id: perfilId };
    const usados = new Set(mediosDelPerfil({ perfil, registros: await registrosDelPerfil() }));
    return (await store.listar('medios', { conBorrados: true })).filter((m) => usados.has(m.id) || conocidos.has(m.id));
  }

  return {
    perfilId,
    mediosConocidos: conocidos,

    async listar(almacen, { conBorrados = false } = {}) {
      let lista;
      if (almacen === 'perfiles') lista = (await store.listar('perfiles', { conBorrados: true })).filter((p) => p.id === perfilId);
      else if (almacen === 'medios') lista = await mediosVisibles();
      else lista = await store.listar(almacen, { perfilId, conBorrados: true });
      return conBorrados ? lista : lista.filter((r) => !r.deleted);
    },

    async obtener(almacen, id, opciones) {
      const r = await store.obtener(almacen, id, opciones);
      if (!r) return r;
      if (almacen === 'medios') return (await mediosVisibles()).some((m) => m.id === id) ? r : undefined;
      return esDelPerfil(almacen, r) ? r : undefined;
    },

    /** Escribe registros tal cual vienen. Rechaza (y no escribe nada) si alguno es de otro perfil. */
    async importar(almacen, registros) {
      if (almacen !== 'medios' && registros.some((r) => !esDelPerfil(almacen, r))) {
        throw new ErrorVistaPerfil(`Se rechazó un registro de otro perfil (${almacen}).`);
      }
      await store.importar(almacen, registros);
    },

    /** La cola de la sincronización personal, solo con lo de este perfil. */
    async pendientesSync() {
      const cola = await store.pendientesSync();
      const propios = [];
      for (const item of cola) {
        if (item.almacen === 'medios') { if (conocidos.has(item.id)) propios.push(item); continue; }
        const r = await store.obtener(item.almacen, item.id, { conBorrados: true });
        if (r && esDelPerfil(item.almacen, r)) propios.push(item);
      }
      return propios;
    },

    /** La cola es de la sincronización personal: el aula no la toca. */
    async limpiarCola() {},

    async leerMeta(clave, porDefecto) {
      return store.leerMeta(prefijo + clave, porDefecto);
    },

    async escribirMeta(clave, valor) {
      return store.escribirMeta(prefijo + clave, valor);
    },
  };
}
