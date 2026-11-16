// Las aulas (PLAN.md, Ampliación 3, fase 16): lo que hacen el adulto y el alumno con las carpetas de Drive.
//
//   Mi unidad (del adulto)
//   └── Leo Conmigo/                 carpeta de trabajo, privada (leoConmigo = 'trabajo')
//       └── Alumno · Pedro/          un aula por perfil (leoConmigo = 'aula'): lectores = los correos invitados
//           ├── aula.json · adulto.json · medio-*          los escribe el adulto
//           └── del-alumno/          (leoConmigo = 'del-alumno'): editores = los correos invitados
//               └── alumno.json · dispositivo-<id>.json    los escribe el alumno
//
// Esta capa solo une las piezas (drive.js, store-perfil.js, sync-aula.js y core/aula.js); la seguridad está en ellas
// y, sobre todo, en los permisos de Drive que se ponen aquí: `reader` en el aula, `writer` solo en `del-alumno/`.

import { crearDriveAulas, crearDriveCarpeta, esCorreo, ErrorDrive } from './drive.js';
import { vistaDePerfil } from './store-perfil.js';
import { crearSincronizadorDeAula } from './sync-aula.js';
import { ARCHIVO_AULA, estadoDeAlumnos, nuevaAula, validarAula } from './core/aula.js';
import { estaDesvinculado, firmaDelAdulto } from './core/dispositivo-alumno.js';

const MIME_JSON = 'application/json';
const NOMBRE_TRABAJO = 'Leo Conmigo';
const minuscula = (s) => String(s ?? '').trim().toLowerCase();

export class ErrorAula extends Error {
  constructor(mensaje, { permisosExtranos = [], sinAcceso = false } = {}) {
    super(mensaje);
    this.name = 'ErrorAula';
    this.sinAcceso = sinAcceso;
    this.permisosExtranos = permisosExtranos;
  }
}

/**
 * @param store          el almacén de la app
 * @param obtenerToken   (forzar) => Promise<string>
 * @param emailAdulto    el correo de la cuenta del adulto (dueño de las carpetas)
 * @param idDispositivo  (alumno) el identificador de este dispositivo
 * @param versionApp     la versión de la app (se anota en el archivo del dispositivo)
 */
export function crearAulas({ store, obtenerToken, fetchFn, emailAdulto = '', idDispositivo = '', nombreDispositivo = '', versionApp = '', ahora = () => new Date(), alProgreso = () => {} }) {
  const drive = crearDriveAulas({ obtenerToken, fetchFn });
  const clienteCarpeta = (carpetaId) => crearDriveCarpeta({ obtenerToken, carpetaId, fetchFn });
  const sincronizando = new Map(); // perfilId -> promesa (una sincronización por aula a la vez)

  const leerAulas = async () => (await store.leerMeta('aulas', {})) ?? {};
  async function aulaDe(perfilId) {
    const info = (await leerAulas())[perfilId];
    if (!info) throw new ErrorAula('Este perfil todavía no tiene un aula. Habilita al alumno primero.');
    return info;
  }
  async function guardarAula(info) {
    await store.escribirMeta('aulas', { ...(await leerAulas()), [info.perfilId]: info });
  }

  /** Lee y modifica `aula.json` (apariencia, dispositivos desvinculados). */
  async function cambiarAulaJson(perfilId, cambiar) {
    const info = await aulaDe(perfilId);
    const cliente = clienteCarpeta(info.carpetaId);
    const archivo = (await cliente.listar()).find((a) => a.name === ARCHIVO_AULA);
    if (!archivo) throw new ErrorAula('No se encontró aula.json en la carpeta del aula.');
    const actual = await cliente.leerJson(archivo.id);
    const error = validarAula(actual, { perfilId });
    if (error) throw new ErrorAula(error);
    const nuevo = { ...cambiar(actual), actualizado: ahora().toISOString() };
    await cliente.actualizar(archivo.id, JSON.stringify(nuevo), MIME_JSON);
    return nuevo;
  }

  // Qué había en `del-alumno/` la última vez que se sincronizó (archivos del alumno y su `modifiedTime`): una sola llamada de lista.
  const firmas = new Map();
  async function firmaDelAlumno(info) {
    const invitados = new Set(info.invitados);
    const archivos = await clienteCarpeta(info.carpetaAlumnoId).listar();
    return archivos
      .filter((a) => a.name.endsWith('.json') && invitados.has(minuscula(a.owners?.[0]?.emailAddress)))
      .map((a) => `${a.id}:${a.modifiedTime}`).sort().join('|');
  }

  const firmasAdulto = new Map(); // (alumno) perfilId -> firma de lo que había del adulto la última vez

  return {
    drive,

    // ---------------- el adulto ----------------

    /** Las aulas de este adulto: { [perfilId]: { perfilId, carpetaId, carpetaAlumnoId, invitados } }. */
    listarAulas: () => leerAulas(),

    /** ¿Cambió algo en `del-alumno/` desde la última sincronización? (para la revisión cada 60 s) */
    async huboCambios(perfilId) {
      return (await firmaDelAlumno(await aulaDe(perfilId))) !== firmas.get(perfilId);
    },

    /** Busca o crea `Leo Conmigo/` y comprueba que sea privada: si alguien la compartió a mano, no se habilita a nadie. */
    async asegurarCarpetaDeTrabajo() {
      const halladas = await drive.buscarCarpeta({ valor: 'trabajo' });
      const id = halladas[0]?.id ?? await drive.crearCarpeta(NOMBRE_TRABAJO, { propiedades: { leoConmigo: 'trabajo' } });
      const extranos = (await drive.permisos(id)).filter((p) => !(p.type === 'user' && p.role === 'owner'));
      if (extranos.length) {
        throw new ErrorAula(`La carpeta «${NOMBRE_TRABAJO}» de tu Drive está compartida con alguien más. Déjala privada (solo tú) y vuelve a intentarlo.`, { permisosExtranos: extranos });
      }
      await store.escribirMeta('carpetaTrabajoId', id);
      return id;
    },

    /** Crea el aula de un perfil (la carpeta, `del-alumno/` y `aula.json`). Si ya existe, la devuelve. */
    async crearAula(perfil, { fondo = null } = {}) {
      const existente = (await leerAulas())[perfil.id];
      if (existente) return existente;
      const trabajo = await this.asegurarCarpetaDeTrabajo();
      const carpetaId = await drive.crearCarpeta(`Alumno · ${perfil.nombre}`, { padre: trabajo, propiedades: { leoConmigo: 'aula', perfilId: perfil.id } });
      const carpetaAlumnoId = await drive.crearCarpeta('del-alumno', { padre: carpetaId, propiedades: { leoConmigo: 'del-alumno', perfilId: perfil.id } });
      const aula = nuevaAula({ perfilId: perfil.id, nombre: perfil.nombre, email: emailAdulto, fondo, ahora: ahora() });
      await clienteCarpeta(carpetaId).crear(ARCHIVO_AULA, JSON.stringify(aula), MIME_JSON);
      const info = { perfilId: perfil.id, carpetaId, carpetaAlumnoId, invitados: [] };
      await guardarAula(info);
      return info;
    },

    /** Invita a un correo: lector en el aula y editor SOLO en `del-alumno/`. */
    async invitar(perfilId, email) {
      const correo = minuscula(email);
      if (!esCorreo(correo)) throw new ErrorAula('El correo no parece válido.');
      if (correo === minuscula(emailAdulto)) throw new ErrorAula('Ese es tu propio correo: invita el Gmail del alumno.');
      const info = await aulaDe(perfilId);
      await drive.compartir(info.carpetaId, correo, 'reader', { avisar: true });
      await drive.compartir(info.carpetaAlumnoId, correo, 'writer', { avisar: false });
      info.invitados = [...new Set([...info.invitados, correo])];
      await guardarAula(info);
      return info;
    },

    /** Quita los permisos de ese correo en el aula y en `del-alumno/` (lo ya traído al adulto se queda). */
    async quitarAcceso(perfilId, email) {
      const correo = minuscula(email);
      const info = await aulaDe(perfilId);
      const suyos = (lista) => lista.filter((p) => p.type === 'user' && minuscula(p.emailAddress) === correo && p.role !== 'owner');
      for (const p of suyos(await drive.permisos(info.carpetaAlumnoId)).filter((x) => x.role === 'writer')) {
        try { await drive.quitarPermiso(info.carpetaAlumnoId, p.id); } catch (e) { if (!(e instanceof ErrorDrive) || e.estado !== 403) throw e; }
      }
      for (const p of suyos(await drive.permisos(info.carpetaId))) await drive.quitarPermiso(info.carpetaId, p.id);
      info.invitados = info.invitados.filter((c) => c !== correo);
      await guardarAula(info);
      return info;
    },

    /** Agrega el dispositivo a `aula.json`: en su siguiente sincronización borrará sus datos. */
    async desvincularDispositivo(perfilId, id) {
      return cambiarAulaJson(perfilId, (a) => ({ ...a, desvinculados: [...new Set([...a.desvinculados, id])] }));
    },

    /** Reescribe la apariencia (el fondo) de `aula.json`. */
    async cambiarApariencia(perfilId, fondo) {
      return cambiarAulaJson(perfilId, (a) => ({ ...a, apariencia: { ...a.apariencia, fondo } }));
    },

    /** Los permisos que la app NO puso (la tabla «Quién puede tocar qué»). No quita nada solo. */
    async revisarPermisos(perfilId) {
      const info = await aulaDe(perfilId);
      const permisos = { aula: await drive.permisos(info.carpetaId), delAlumno: await drive.permisos(info.carpetaAlumnoId) };
      return estadoDeAlumnos({ invitados: info.invitados, permisos, dispositivos: [], ahora: ahora() }).permisosExtranos;
    },

    /** El botón «Quitar» de un «Permiso extraño». */
    async quitarPermisoExtrano(perfilId, { carpeta, id }) {
      const info = await aulaDe(perfilId);
      await drive.quitarPermiso(carpeta === 'aula' ? info.carpetaId : info.carpetaAlumnoId, id);
    },

    /** Sincroniza el aula del adulto y devuelve el resumen, el estado de cada correo y los permisos extraños. */
    sincronizarAula(perfilId) {
      if (!sincronizando.has(perfilId)) {
        const promesa = (async () => {
          const info = await aulaDe(perfilId);
          const firma = await firmaDelAlumno(info); // antes de sincronizar: si el alumno escribe mientras tanto, se vuelve a revisar
          const conocidos = new Set((await store.leerMeta(`aula:${perfilId}:idsMediosConocidos`, [])) ?? []);
          const sincronizador = crearSincronizadorDeAula({
            store: vistaDePerfil(store, perfilId, { idsMediosConocidos: conocidos }),
            rol: 'adulto',
            aula: info,
            carpetaAula: clienteCarpeta(info.carpetaId),
            carpetaAlumno: clienteCarpeta(info.carpetaAlumnoId),
            invitados: info.invitados,
            ahora,
            alProgreso,
          });
          const resumen = await sincronizador.sincronizar();
          firmas.set(perfilId, firma);
          const permisos = { aula: await drive.permisos(info.carpetaId), delAlumno: await drive.permisos(info.carpetaAlumnoId) };
          return { resumen, ...estadoDeAlumnos({ invitados: info.invitados, permisos, dispositivos: resumen.dispositivos, ahora: ahora() }) };
        })().finally(() => sincronizando.delete(perfilId));
        sincronizando.set(perfilId, promesa);
      }
      return sincronizando.get(perfilId);
    },

    // ---------------- el alumno ----------------

    /** (alumno) ¿Cambió `adulto.json` o `aula.json` desde la última sincronización? Una sola llamada de lista. */
    async huboCambiosDelAdulto(aula) {
      const archivos = await clienteCarpeta(aula.carpetaId).listar();
      return firmaDelAdulto(archivos, aula.dueno) !== firmasAdulto.get(aula.perfilId);
    },

    /** Las aulas que me compartieron: [{ carpetaId, carpetaAlumnoId, perfilId, nombre, dueno }]. */
    async buscarMiAula() {
      const salida = [];
      for (const aula of await drive.buscarAulasCompartidasConmigo()) {
        const [delAlumno] = await drive.buscarCarpeta({ valor: 'del-alumno', padre: aula.id, mias: false });
        if (!delAlumno || !aula.properties?.perfilId) continue;
        salida.push({ carpetaId: aula.id, carpetaAlumnoId: delAlumno.id, perfilId: aula.properties.perfilId, nombre: aula.name, dueno: minuscula(aula.owners?.[0]?.emailAddress) });
      }
      return salida;
    },

    /**
     * Sincroniza este dispositivo del alumno (y lo registra en `del-alumno/dispositivo-<id>.json`).
     * Si el adulto lo desvinculó, no sincroniza nada y devuelve `{ desvinculado: true }`.
     * @param aula   un elemento de `buscarMiAula()`
     * @param email  el correo de esta cuenta
     */
    async sincronizarComoAlumno({ aula, email }) {
      const carpetaAula = clienteCarpeta(aula.carpetaId);
      const archivoAula = (await carpetaAula.listar()).find((a) => a.name === ARCHIVO_AULA && minuscula(a.owners?.[0]?.emailAddress) === aula.dueno);
      // Drive muestra vacía una carpeta que no se comparte con esta cuenta: sin aula.json, o ya no hay acceso o el aula no está lista
      if (!archivoAula) throw new ErrorAula('No se encontró el aula: ya no tienes acceso o tu adulto todavía no la termina de preparar.', { sinAcceso: true });
      const aulaJson = await carpetaAula.leerJson(archivoAula.id);
      const error = validarAula(aulaJson, { perfilId: aula.perfilId });
      if (error) throw new ErrorAula(error);
      if (estaDesvinculado(aulaJson, idDispositivo)) return { desvinculado: true, aula: aulaJson };
      const firma = firmaDelAdulto(await carpetaAula.listar(), aula.dueno); // antes de sincronizar: si el adulto cambia algo mientras tanto, se vuelve a bajar

      const conocidos = new Set((await store.leerMeta(`aula:${aula.perfilId}:idsMediosConocidos`, [])) ?? []);
      const sincronizador = crearSincronizadorDeAula({
        store: vistaDePerfil(store, aula.perfilId, { idsMediosConocidos: conocidos }),
        rol: 'alumno',
        aula,
        carpetaAula,
        carpetaAlumno: clienteCarpeta(aula.carpetaAlumnoId),
        emailPropio: email,
        duenoEmail: aula.dueno,
        dispositivo: { idDispositivo, email, nombre: nombreDispositivo, versionApp },
        ahora,
        alProgreso,
      });
      const resumen = await sincronizador.sincronizar();
      firmasAdulto.set(aula.perfilId, firma);
      return { ...resumen, aula: aulaJson, desvinculado: false };
    },
  };
}
