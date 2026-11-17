// Una «vista» del almacén que solo ve y toca lo de UN perfil (PLAN.md, fase 16: aulas).
//
// Con ella, el sincronizador del aula no puede leer ni escribir registros de otro perfil, aunque el archivo de Drive
// (o un error) lo intentara: `listar` solo devuelve lo del perfil e `importar` rechaza lo de otro. Es la segunda
// barrera después de `filtrarEntrantes` (core/aula.js).

import { ALMACENES_DEL_PERFIL } from './core/borrar-perfil.js';
import { mediosDelPerfil } from './core/aula.js';
import { ALMACENES_DE_FICHA } from './core/curso.js';

export class ErrorVistaPerfil extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorVistaPerfil';
  }
}

/**
 * Una «vista» que solo ve y toca las FICHAS de los alumnos de UN curso y sus registros (PLAN.md, Ampliación 4, fase 23).
 * Es lo único que el sincronizador del adulto puede escribir de lo que viene de un alumno: nunca el contenido del curso ni
 * lo de otro curso. Un registro entra solo si su `perfilId` es la ficha de un correo de este curso
 * (`ficha:<curso>:<correo>`), y una ficha, solo si es de este curso.
 */
export function vistaDeFichas(store, cursoId) {
  const prefijo = `ficha:${cursoId}:`;
  const esFicha = (r) => r?.cursoId === cursoId && typeof r.id === 'string' && r.id.startsWith(prefijo);
  const esDeFicha = (almacen, r) => (almacen === 'alumnos' ? esFicha(r) : typeof r?.perfilId === 'string' && r.perfilId.startsWith(prefijo));
  const comprobar = (almacen) => {
    if (almacen !== 'alumnos' && !ALMACENES_DE_FICHA.includes(almacen)) throw new ErrorVistaPerfil(`Una ficha no guarda «${almacen}».`);
  };

  return {
    cursoId,

    /** Las fichas del curso (con los borrados si se pide). */
    async fichas({ conBorrados = false } = {}) {
      return (await store.listar('alumnos', { conBorrados })).filter(esFicha);
    },

    /** Los registros de una ficha (`alumnos`: las fichas del curso). */
    async listar(almacen, { fichaId, conBorrados = false } = {}) {
      comprobar(almacen);
      if (almacen === 'alumnos') return (await store.listar('alumnos', { conBorrados })).filter(esFicha);
      if (!fichaId?.startsWith(prefijo)) throw new ErrorVistaPerfil('Esa ficha no es de este curso.');
      return store.listar(almacen, { perfilId: fichaId, conBorrados });
    },

    /** Escribe registros tal cual vienen (sin tocar `updatedAt` ni la cola). Rechaza todo si alguno no es de una ficha de este curso. */
    async importar(almacen, registros) {
      comprobar(almacen);
      if (registros.some((r) => !esDeFicha(almacen, r))) throw new ErrorVistaPerfil(`Se rechazó un registro que no es de una ficha de este curso (${almacen}).`);
      await store.importar(almacen, registros);
    },
  };
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
