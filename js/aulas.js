// Las aulas (PLAN.md, Ampliación 3 fase 16 y Ampliación 4 fase 22): lo que hacen el adulto y el alumno con las carpetas de Drive.
//
//   Mi unidad (del adulto)
//   └── Leo Conmigo/                 carpeta de trabajo, privada (leoConmigo = 'trabajo')
//       ├── Biblioteca/              (leoConmigo = 'biblioteca'): LECTORES = los correos invitados a algún curso
//       │   └── medio-*              UNA copia de cada imagen o audio del adulto (nunca lo de un alumno)
//       ├── Curso · Pedro/           un aula por perfil (leoConmigo = 'aula'): lectores = los correos invitados
//       │   └── aula.json · adulto.json                    los escribe el adulto
//       └── Alumnos · Pedro/         (leoConmigo = 'alumnos'): privada, NO se comparte; hermana del aula a propósito
//           └── <correo>/            (leoConmigo = 'del-alumno'): EDITOR = solo ese correo
//               └── alumno.json · dispositivo-<id>.json    los escribe el alumno
//
// Las carpetas de los alumnos NO están dentro del aula: en Drive un lector del aula hereda lectura de todo lo que hay dentro,
// y un alumno no debe poder ver la de otro (la tabla «Quién puede tocar qué» manda). El alumno encuentra la suya porque
// se la compartieron a él directamente. Las aulas de la fase 22 tenían una sola `del-alumno/` dentro del aula: se migran.
//
// Esta capa solo une las piezas (drive.js, store-perfil.js, sync-aula.js y core/aula.js); la seguridad está en ellas
// y, sobre todo, en los permisos de Drive que se ponen aquí: `reader` en la Biblioteca y en el aula, `writer` solo en la carpeta de cada alumno.

import { crearDrive, crearDriveAulas, crearDriveCarpeta, esCorreo, ErrorDrive } from './drive.js';
import { clasificarEspacio, idDeMedioDeArchivo, seleccionVigente } from './core/limpieza.js';
import { vistaDeFichas, vistaDePerfil } from './store-perfil.js';
import { crearSincronizadorDeAula } from './sync-aula.js';
import { ARCHIVO_AULA, aulaComoV2, estadoDeAlumnos, mediosDelPerfil, nuevaAula, validarAula } from './core/aula.js';
import { ALMACENES_DEL_PERFIL } from './core/borrar-perfil.js';
import { estaDesvinculado, firmaDelAdulto } from './core/dispositivo-alumno.js';
import { idDeFicha, nuevaFicha } from './core/curso.js';
import { guardarMaterial, idDeArchivoDeMedio } from './material-familia.js';

const MIME_JSON = 'application/json';
const NOMBRE_TRABAJO = 'Leo Conmigo';
const NOMBRE_BIBLIOTECA = 'Biblioteca';
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
export function crearAulas({ store, obtenerToken, fetchFn, emailAdulto = '', idDispositivo = '', nombreDispositivo = '', versionApp = '', ahora = () => new Date(), alProgreso = () => {}, traerDeApp = undefined }) {
  const drive = crearDriveAulas({ obtenerToken, fetchFn });
  const clienteCarpeta = (carpetaId) => crearDriveCarpeta({ obtenerToken, carpetaId, fetchFn });
  const sincronizando = new Map(); // perfilId -> promesa (una sincronización por aula a la vez)

  const leerAulas = async () => (await store.leerMeta('aulas', {})) ?? {};
  async function aulaDe(perfilId) {
    const info = (await leerAulas())[perfilId];
    if (!info) throw new ErrorAula('Este perfil todavía no tiene alumnos habilitados. Toca «Habilitar alumno» primero.');
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
    if (!archivo) throw new ErrorAula('No se encontró el archivo del curso en su carpeta de Drive. Vuelve a habilitar el perfil.');
    const actual = await cliente.leerJson(archivo.id);
    const error = validarAula(actual, { perfilId });
    if (error) throw new ErrorAula(error);
    const cambiado = cambiar(actual);
    if (JSON.stringify(cambiado) === JSON.stringify(actual)) return actual; // nada cambió: no se reescribe
    const nuevo = { ...cambiado, actualizado: ahora().toISOString() };
    await cliente.actualizar(archivo.id, JSON.stringify(nuevo), MIME_JSON);
    return nuevo;
  }

  const todasLasInvitaciones = async () => [...new Set(Object.values(await leerAulas()).flatMap((a) => a.invitados ?? []))];

  /** Busca o crea `Biblioteca/` dentro de `Leo Conmigo/`. Solo el dueño la ve hasta que se invita a alguien. */
  async function asegurarBiblioteca() {
    const trabajo = await asegurarTrabajo();
    const halladas = await drive.buscarCarpeta({ valor: 'biblioteca', padre: trabajo });
    const id = halladas[0]?.id ?? await drive.crearCarpeta(NOMBRE_BIBLIOTECA, { padre: trabajo, propiedades: { leoConmigo: 'biblioteca' } });
    await store.escribirMeta('bibliotecaId', id);
    return id;
  }

  /** Lector de la Biblioteca para un correo (si ya lo es, no se vuelve a compartir). Nunca `writer` ni `anyone`. */
  async function darLecturaDeBiblioteca(bibliotecaId, correo) {
    const ya = (await drive.permisos(bibliotecaId)).some((p) => p.type === 'user' && minuscula(p.emailAddress) === correo);
    if (!ya) await drive.compartir(bibliotecaId, correo, 'reader', { avisar: false });
  }

  /** Quita la lectura de la Biblioteca a un correo que ya no está en NINGÚN curso. */
  async function quitarLecturaDeBiblioteca(bibliotecaId, correo) {
    for (const p of await drive.permisos(bibliotecaId)) {
      if (p.type === 'user' && minuscula(p.emailAddress) === correo && p.role !== 'owner') await drive.quitarPermiso(bibliotecaId, p.id);
    }
  }

  /** Los alumnos de `aula.json`: cada correo con la carpeta que es solo suya. */
  const alumnosDeAula = (info) => info.invitados.map((email) => ({ email, carpetaId: info.carpetasAlumnos?.[email] ?? null }));

  /** La carpeta de un alumno: SOLO él puede escribir en ella (editor), y no está dentro del aula (ningún otro alumno la ve). */
  async function asegurarCarpetaDeAlumno(info, correo) {
    info.carpetasAlumnos = info.carpetasAlumnos ?? {};
    if (!info.carpetasAlumnos[correo]) {
      info.carpetasAlumnos[correo] = await drive.crearCarpeta(correo, {
        padre: info.carpetaAlumnosId, propiedades: { leoConmigo: 'del-alumno', perfilId: info.perfilId, email: correo },
      });
      await guardarAula(info); // aunque falle lo que sigue, no se crea otra carpeta al reintentar
    }
    const id = info.carpetasAlumnos[correo];
    const ya = (await drive.permisos(id)).some((p) => p.type === 'user' && minuscula(p.emailAddress) === correo && p.role === 'writer');
    if (!ya) await drive.compartir(id, correo, 'writer', { avisar: false });
    return id;
  }

  /** La ficha del correo en este curso (se crea al invitar; si ya existe no se toca). */
  async function asegurarFicha(perfilId, correo) {
    const fichas = vistaDeFichas(store, perfilId);
    if ((await fichas.fichas({ conBorrados: true })).some((f) => f.id === idDeFicha(perfilId, correo))) return;
    await fichas.importar('alumnos', [{ ...nuevaFicha({ cursoId: perfilId, email: correo, ahora: ahora() }), updatedAt: ahora().toISOString(), deleted: false }]);
  }

  /**
   * Pasa un aula de la fase 22 (una sola `del-alumno/` dentro del aula, con todos los invitados como editores) a la fase 23:
   * crea `Alumnos · <curso>/` con una carpeta por invitado (editor solo él), retira a todos como editores de la carpeta de
   * antes (que se queda como solo lectura: el adulto aún lee de ahí hasta que cada alumno sincronice) y crea las fichas.
   */
  async function migrarAlumnos(info) {
    const trabajo = await asegurarTrabajo();
    const perfil = await store.obtener('perfiles', info.perfilId);
    const nuevo = { ...info, carpetasAlumnos: { ...(info.carpetasAlumnos ?? {}) } };
    nuevo.carpetaAlumnosId = await drive.crearCarpeta(`Alumnos · ${perfil?.nombre ?? 'curso'}`, { padre: trabajo, propiedades: { leoConmigo: 'alumnos', perfilId: info.perfilId } });
    await guardarAula(nuevo);
    for (const correo of nuevo.invitados) {
      await asegurarCarpetaDeAlumno(nuevo, correo);
      await asegurarFicha(info.perfilId, correo);
    }
    if (nuevo.carpetaAlumnoId) {
      for (const p of await drive.permisos(nuevo.carpetaAlumnoId)) {
        if (p.type === 'user' && p.role === 'writer') {
          try { await drive.quitarPermiso(nuevo.carpetaAlumnoId, p.id); } catch (e) { if (!(e instanceof ErrorDrive) || e.estado !== 403) throw e; }
        }
      }
    }
    await guardarAula(nuevo);
    await cambiarAulaJson(info.perfilId, (a) => ({ ...a, alumnos: alumnosDeAula(nuevo) }));
    return nuevo;
  }

  async function asegurarTrabajo() {
    const halladas = await drive.buscarCarpeta({ valor: 'trabajo' });
    const id = halladas[0]?.id ?? await drive.crearCarpeta(NOMBRE_TRABAJO, { propiedades: { leoConmigo: 'trabajo' } });
    const extranos = (await drive.permisos(id)).filter((p) => !(p.type === 'user' && p.role === 'owner'));
    if (extranos.length) {
      throw new ErrorAula(`La carpeta «${NOMBRE_TRABAJO}» de tu Drive está compartida con alguien más. Déjala privada (solo tú) y vuelve a intentarlo.`, { permisosExtranos: extranos });
    }
    await store.escribirMeta('carpetaTrabajoId', id);
    return id;
  }

  /**
   * Pasa un aula de la versión 1 a la 2: crea la Biblioteca, MUEVE a ella los `medio-*` del aula (`addParents` /
   * `removeParents`: no se vuelven a subir), comparte la Biblioteca con los invitados y deja `aula.json` en versión 2.
   * Un medio que ya estaba en la Biblioteca (repetido) NO se borra: queda en el aula para la pantalla de limpieza.
   */
  async function migrarAula(info) {
    const bibliotecaId = await asegurarBiblioteca();
    const enAula = (await clienteCarpeta(info.carpetaId).listar()).filter((a) => /^medio-/.test(a.name) && !a.mimeType?.includes('folder'));
    const enBiblioteca = new Set((await clienteCarpeta(bibliotecaId).listar()).map((a) => a.name));
    let movidos = 0;
    for (const archivo of enAula) {
      if (enBiblioteca.has(archivo.name)) continue; // repetido: se queda donde está
      await drive.mover(archivo.id, { de: info.carpetaId, a: bibliotecaId });
      enBiblioteca.add(archivo.name);
      movidos += 1;
    }
    for (const correo of await todasLasInvitaciones()) await darLecturaDeBiblioteca(bibliotecaId, correo);
    const nuevo = { ...info, bibliotecaId };
    await guardarAula(nuevo);
    await cambiarAulaJson(info.perfilId, (a) => ({ ...aulaComoV2(a), bibliotecaId, alumnos: alumnosDeAula(nuevo) }));
    return { info: nuevo, movidos };
  }

  /** Antes de usar un aula: si es de la versión 1 (sin Biblioteca) o de la fase 22 (sin carpetas por alumno), se migra. */
  async function aulaLista(perfilId) {
    let info = await aulaDe(perfilId);
    if (!info.bibliotecaId) info = (await migrarAula(info)).info;
    if (!info.carpetaAlumnosId) info = await migrarAlumnos(info);
    return info;
  }

  /** Los permisos reales de las carpetas del aula (para revisar lo que la app no puso). */
  async function permisosDeAula(info) {
    const permisos = { aula: await drive.permisos(info.carpetaId), alumnos: {} };
    if (info.bibliotecaId) permisos.biblioteca = await drive.permisos(info.bibliotecaId);
    if (info.carpetaAlumnosId) permisos.alumnosRaiz = await drive.permisos(info.carpetaAlumnosId);
    for (const [correo, id] of Object.entries(info.carpetasAlumnos ?? {})) permisos.alumnos[correo] = await drive.permisos(id);
    if (info.carpetaAlumnoId) permisos.delAlumno = await drive.permisos(info.carpetaAlumnoId);
    return permisos;
  }

  /** Ids de los medios que usan los OTROS cursos del adulto (un medio de la Biblioteca solo se borra si ningún curso lo usa). */
  async function mediosDeOtrosCursos(perfilId) {
    const usados = new Set();
    for (const otro of Object.keys(await leerAulas())) {
      if (otro === perfilId) continue;
      const perfil = await store.obtener('perfiles', otro);
      if (!perfil) continue;
      const registros = {};
      for (const almacen of ALMACENES_DEL_PERFIL) registros[almacen] = await store.listar(almacen, { perfilId: otro });
      for (const id of mediosDelPerfil({ perfil, registros })) usados.add(id);
    }
    return usados;
  }

  // Qué había en las carpetas de los alumnos la última vez que se sincronizó (archivos del alumno y su `modifiedTime`): una llamada de lista por alumno.
  const firmas = new Map();
  async function firmaDelAlumno(info) {
    const invitados = new Set(info.invitados);
    const carpetas = [...info.invitados.map((c) => info.carpetasAlumnos?.[c]), info.carpetaAlumnoId].filter(Boolean);
    const firma = [];
    for (const carpeta of carpetas) {
      const archivos = await clienteCarpeta(carpeta).listar();
      firma.push(...archivos
        .filter((a) => a.name.endsWith('.json') && invitados.has(minuscula(a.owners?.[0]?.emailAddress)))
        .map((a) => `${a.id}:${a.modifiedTime}`));
    }
    return firma.sort().join('|');
  }

  /** La carpeta propia de un alumno para un aula (la nueva, o la `del-alumno/` de antes mientras el adulto no migre). */
  async function carpetaPropia(aula) {
    const todas = await drive.buscarCarpeta({ valor: 'del-alumno', mias: false, perfilId: aula.perfilId });
    // solo vale una carpeta cuyo dueño es el del aula: un tercero no puede hacer que el alumno escriba en una suya
    const delDueno = todas.filter((c) => minuscula(c.owners?.[0]?.emailAddress) === aula.dueno);
    return delDueno.find((c) => c.parents?.[0] !== aula.carpetaId) ?? delDueno.find((c) => c.parents?.[0] === aula.carpetaId) ?? null;
  }

  // ---------------- «Espacio en Drive» (fase 26): ver y limpiar lo repetido o sobrante ----------------
  // Revisar SOLO lee. Eliminar vuelve a clasificar justo antes de borrar y manda a la PAPELERA de Drive lo que está a la vista
  // (se puede recuperar); lo del respaldo oculto de la app (`appDataFolder`) no tiene papelera y se borra. Nunca toca las carpetas
  // de los alumnos, `data.json`, `adulto.json`, `aula.json` ni `alumno.json`.
  const appData = crearDrive({ obtenerToken, fetchFn });

  async function mediosEnUso() {
    const usados = new Set();
    for (const perfil of await store.listar('perfiles')) {
      const registros = {};
      for (const almacen of ALMACENES_DEL_PERFIL) registros[almacen] = await store.listar(almacen, { perfilId: perfil.id });
      for (const id of mediosDelPerfil({ perfil, registros })) usados.add(id);
    }
    return usados;
  }

  /** Lee lo que hay en el Drive del adulto y lo clasifica (no cambia nada). */
  async function leerEspacio({ alProgreso: avisar = () => {} } = {}) {
    const aulasInfo = Object.values(await leerAulas());
    const archivos = [];
    const comoArchivo = (a, espacio, lugar) => ({ id: a.id, name: a.name, size: Number(a.size) || 0, esCarpeta: false, espacio, lugar });
    avisar('Mirando el respaldo personal…');
    for (const a of await appData.listar()) if (idDeMedioDeArchivo(a.name)) archivos.push(comoArchivo(a, 'appdata', { tipo: 'respaldo' }));
    const bibliotecaId = (await store.leerMeta('bibliotecaId')) ?? aulasInfo.find((i) => i.bibliotecaId)?.bibliotecaId ?? null;
    if (bibliotecaId) {
      avisar('Mirando la Biblioteca…');
      for (const a of await clienteCarpeta(bibliotecaId).listar()) if (idDeMedioDeArchivo(a.name) && !a.mimeType?.includes('folder')) archivos.push(comoArchivo(a, 'drive', { tipo: 'biblioteca' }));
    }
    const aulas = [];
    for (const info of aulasInfo) {
      const nombre = (await store.obtener('perfiles', info.perfilId))?.nombre ?? '';
      avisar(`Mirando el curso ${nombre}…`);
      for (const a of await clienteCarpeta(info.carpetaId).listar()) {
        if (idDeMedioDeArchivo(a.name) && !a.mimeType?.includes('folder')) archivos.push(comoArchivo(a, 'drive', { tipo: 'curso', cursoId: info.perfilId, nombre }));
      }
      // la carpeta `del-alumno/` de antes: solo se ofrece si el avance de cada alumno ya está en su carpeta nueva
      let legadoSuperado = false;
      if (info.carpetaAlumnoId) {
        const delLegado = await clienteCarpeta(info.carpetaAlumnoId).listar();
        const suyo = (lista, correo) => lista.find((a) => a.name === 'alumno.json' && minuscula(a.owners?.[0]?.emailAddress) === correo);
        legadoSuperado = Boolean(info.carpetaAlumnosId);
        for (const correo of info.invitados) {
          if (!suyo(delLegado, correo)) continue;
          const nuevos = info.carpetasAlumnos?.[correo] ? await clienteCarpeta(info.carpetasAlumnos[correo]).listar() : [];
          if (!suyo(nuevos, correo)) legadoSuperado = false;
        }
        archivos.push({
          id: info.carpetaAlumnoId, name: 'del-alumno', size: delLegado.reduce((s, a) => s + (Number(a.size) || 0), 0), esCarpeta: true, espacio: 'drive', lugar: { tipo: 'legado', cursoId: info.perfilId, nombre },
        });
      }
      aulas.push({ cursoId: info.perfilId, migrada: Boolean(info.bibliotecaId), legadoSuperado });
    }
    const medios = await store.listar('medios', { conBorrados: true });
    return { archivos, medios, usados: await mediosEnUso(), aulas };
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
    asegurarCarpetaDeTrabajo: () => asegurarTrabajo(),

    /** Busca o crea la Biblioteca común (los medios del adulto, una sola copia). */
    asegurarBiblioteca: () => asegurarBiblioteca(),

    /** Crea el aula de un perfil (la carpeta, la carpeta privada de los alumnos y `aula.json` v2). Si ya existe, la devuelve (migrada si era de una versión anterior). */
    async crearAula(perfil, { fondo = null } = {}) {
      if ((await leerAulas())[perfil.id]) return aulaLista(perfil.id);
      const trabajo = await asegurarTrabajo();
      const bibliotecaId = await asegurarBiblioteca();
      const carpetaId = await drive.crearCarpeta(`Curso · ${perfil.nombre}`, { padre: trabajo, propiedades: { leoConmigo: 'aula', perfilId: perfil.id } });
      // hermana del aula, no dentro: un lector del aula heredaría lectura de la carpeta de cada compañero
      const carpetaAlumnosId = await drive.crearCarpeta(`Alumnos · ${perfil.nombre}`, { padre: trabajo, propiedades: { leoConmigo: 'alumnos', perfilId: perfil.id } });
      const aula = nuevaAula({ perfilId: perfil.id, nombre: perfil.nombre, email: emailAdulto, fondo, bibliotecaId, ahora: ahora() });
      await clienteCarpeta(carpetaId).crear(ARCHIVO_AULA, JSON.stringify(aula), MIME_JSON);
      const info = { perfilId: perfil.id, carpetaId, carpetaAlumnoId: null, carpetaAlumnosId, carpetasAlumnos: {}, bibliotecaId, invitados: [] };
      await guardarAula(info);
      return info;
    },

    /** Invita a un correo: lector en la Biblioteca y en el aula, y editor SOLO en su propia carpeta (que ningún otro alumno ve). */
    async invitar(perfilId, email) {
      const correo = minuscula(email);
      if (!esCorreo(correo)) throw new ErrorAula('El correo no parece válido.');
      if (correo === minuscula(emailAdulto)) throw new ErrorAula('Ese es tu propio correo: invita el Gmail del alumno.');
      const info = await aulaLista(perfilId);
      await drive.compartir(info.carpetaId, correo, 'reader', { avisar: true });
      await asegurarCarpetaDeAlumno(info, correo);
      await darLecturaDeBiblioteca(info.bibliotecaId, correo);
      info.invitados = [...new Set([...info.invitados, correo])];
      await guardarAula(info);
      await asegurarFicha(perfilId, correo);
      await cambiarAulaJson(perfilId, (a) => ({ ...a, alumnos: alumnosDeAula(info) }));
      return info;
    },

    /** Quita los permisos de ese correo en el aula y en su carpeta (lo ya traído al adulto, y su ficha, se quedan). */
    async quitarAcceso(perfilId, email) {
      const correo = minuscula(email);
      const info = await aulaDe(perfilId);
      const suyos = (lista) => lista.filter((p) => p.type === 'user' && minuscula(p.emailAddress) === correo && p.role !== 'owner');
      const quitarEscritura = async (carpeta) => {
        for (const p of suyos(await drive.permisos(carpeta)).filter((x) => x.role === 'writer')) {
          try { await drive.quitarPermiso(carpeta, p.id); } catch (e) { if (!(e instanceof ErrorDrive) || e.estado !== 403) throw e; }
        }
      };
      if (info.carpetasAlumnos?.[correo]) await quitarEscritura(info.carpetasAlumnos[correo]);
      if (info.carpetaAlumnoId) await quitarEscritura(info.carpetaAlumnoId);
      for (const p of suyos(await drive.permisos(info.carpetaId))) await drive.quitarPermiso(info.carpetaId, p.id);
      info.invitados = info.invitados.filter((c) => c !== correo);
      await guardarAula(info);
      // La Biblioteca se le quita solo si ya no está en NINGÚN curso
      if (info.bibliotecaId && !(await todasLasInvitaciones()).includes(correo)) await quitarLecturaDeBiblioteca(info.bibliotecaId, correo);
      if (info.bibliotecaId) await cambiarAulaJson(perfilId, (a) => ({ ...a, alumnos: alumnosDeAula(info) }));
      return info;
    },

    /**
     * «Traer el material de la familia»: baja a ESTE celular las fotos y voces que la familia del alumno guardó en su carpeta
     * `familia/` (archivos de su cuenta; aquí solo se leen) y las guarda aparte (`js/material-familia.js`), nunca en `medios`.
     * @returns {{ traidos, sinCarpeta }}
     */
    async traerMaterialDeFamilia(perfilId, correo, { alProgresoMaterial = () => {} } = {}) {
      const dueno = minuscula(correo);
      const info = await aulaDe(perfilId);
      const carpeta = info.carpetasAlumnos?.[dueno] ?? (dueno && info.carpetaAlumnoId);
      if (!carpeta) throw new ErrorAula('Ese alumno todavía no tiene su carpeta.');
      const suyos = (lista) => lista.filter((a) => minuscula(a.owners?.[0]?.emailAddress) === dueno);
      const lector = clienteCarpeta(carpeta);
      const familia = suyos(await lector.listar()).find((a) => a.name === 'familia' && a.mimeType?.includes('folder'));
      if (!familia) return { traidos: 0, sinCarpeta: true };
      const enFamilia = clienteCarpeta(familia.id);
      const archivos = suyos(await enFamilia.listar()).filter((a) => idDeArchivoDeMedio(a.name));
      const items = [];
      for (const [i, archivo] of archivos.entries()) {
        alProgresoMaterial(`Trayendo el material de la familia (${i + 1} de ${archivos.length})…`);
        const mime = archivo.mimeType && archivo.mimeType !== 'application/octet-stream' ? archivo.mimeType : '';
        const bajado = await enFamilia.leerBlob(archivo.id);
        const blob = mime && bajado.type !== mime ? new Blob([bajado], { type: mime }) : bajado;
        items.push({ id: idDeArchivoDeMedio(archivo.name), nombre: archivo.name, mime: blob.type || mime, tipo: String(blob.type || mime).startsWith('audio') ? 'audio' : 'imagen', blob });
      }
      await guardarMaterial(store, idDeFicha(perfilId, dueno), items);
      return { traidos: items.length, sinCarpeta: false };
    },

    /** «Revisar mi Drive»: qué quedó repetido o sobrante, por grupo, con cuántos archivos y cuánto pesan. Solo lee. */
    async revisarEspacio(opciones) {
      return clasificarEspacio(await leerEspacio(opciones));
    },

    /**
     * Elimina de UN grupo solo lo que el adulto marcó y que SIGUE siendo eliminable ahora (se vuelve a leer y clasificar antes de
     * borrar). Lo visible va a la papelera de Drive; el respaldo oculto se borra. Devuelve cuánto se liberó.
     * @returns {{ eliminados, liberado, omitidos, fallidos }}
     */
    async eliminarDelEspacio(grupoId, marcados, opciones = {}) {
      const grupo = clasificarEspacio(await leerEspacio(opciones)).grupos.find((g) => g.id === grupoId);
      const aEliminar = seleccionVigente(marcados, grupo);
      let eliminados = 0;
      let liberado = 0;
      let fallidos = 0;
      for (const a of aEliminar) {
        try {
          if (a.espacio === 'appdata') await appData.borrar(a.id);
          else await drive.papelera(a.id);
          eliminados += 1;
          liberado += a.size;
          if (a.esCarpeta && a.cursoId) {
            const info = (await leerAulas())[a.cursoId];
            if (info?.carpetaAlumnoId === a.id) await guardarAula({ ...info, carpetaAlumnoId: null }); // la carpeta de antes ya no se lee
          }
        } catch (error) {
          if (error?.sinConexion || error?.sesion) throw error;
          fallidos += 1;
        }
      }
      return { eliminados, liberado, omitidos: new Set(marcados).size - aEliminar.length, fallidos };
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
      const permisos = await permisosDeAula(info);
      return estadoDeAlumnos({ invitados: info.invitados, invitadosDeTodos: await todasLasInvitaciones(), permisos, dispositivos: [], ahora: ahora() }).permisosExtranos;
    },

    /** El botón «Quitar» de un «Permiso extraño». */
    async quitarPermisoExtrano(perfilId, { carpeta, id }) {
      const info = await aulaDe(perfilId);
      const carpetaId = carpeta === 'aula' ? info.carpetaId
        : carpeta === 'biblioteca' ? info.bibliotecaId
          : carpeta === 'alumnos' ? info.carpetaAlumnosId
            : carpeta.startsWith('alumnos/') ? info.carpetasAlumnos?.[carpeta.slice('alumnos/'.length)]
              : info.carpetaAlumnoId;
      if (!carpetaId) throw new ErrorAula('Esa carpeta ya no existe.');
      await drive.quitarPermiso(carpetaId, id);
    },

    /** Sincroniza el aula del adulto y devuelve el resumen, el estado de cada correo y los permisos extraños. */
    sincronizarAula(perfilId) {
      if (!sincronizando.has(perfilId)) {
        const promesa = (async () => {
          const info = await aulaLista(perfilId);
          const firma = await firmaDelAlumno(info); // antes de sincronizar: si el alumno escribe mientras tanto, se vuelve a revisar
          const conocidos = new Set((await store.leerMeta(`aula:${perfilId}:idsMediosConocidos`, [])) ?? []);
          const sincronizador = crearSincronizadorDeAula({
            store: vistaDePerfil(store, perfilId, { idsMediosConocidos: conocidos }),
            fichas: vistaDeFichas(store, perfilId),
            rol: 'adulto',
            traerDeApp,
            aula: info,
            carpetaAula: clienteCarpeta(info.carpetaId),
            carpetasAlumnos: Object.fromEntries(info.invitados.filter((c) => info.carpetasAlumnos?.[c]).map((c) => [c, clienteCarpeta(info.carpetasAlumnos[c])])),
            carpetaLegado: info.carpetaAlumnoId ? clienteCarpeta(info.carpetaAlumnoId) : null,
            carpetaMedios: clienteCarpeta(info.bibliotecaId),
            usadosPorOtros: () => mediosDeOtrosCursos(perfilId),
            invitados: info.invitados,
            ahora,
            alProgreso,
          });
          const resumen = await sincronizador.sincronizar();
          firmas.set(perfilId, firma);
          const permisos = await permisosDeAula(info);
          return { resumen, ...estadoDeAlumnos({ invitados: info.invitados, invitadosDeTodos: await todasLasInvitaciones(), permisos, dispositivos: resumen.dispositivos, ahora: ahora() }) };
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

    /** Las aulas que me compartieron: [{ carpetaId, carpetaAlumnoId (la carpeta que es solo mía), perfilId, nombre, dueno }]. */
    async buscarMiAula() {
      const salida = [];
      for (const aula of await drive.buscarAulasCompartidasConmigo()) {
        if (!aula.properties?.perfilId) continue;
        const datos = { carpetaId: aula.id, perfilId: aula.properties.perfilId, nombre: aula.name, dueno: minuscula(aula.owners?.[0]?.emailAddress) };
        const propia = await carpetaPropia(datos);
        if (!propia) continue; // el adulto todavía no terminó de preparar mi carpeta
        salida.push({ ...datos, carpetaAlumnoId: propia.id });
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
      if (!archivoAula) throw new ErrorAula('No se encontró el curso: ya no tienes acceso o tu adulto todavía no lo termina de preparar.', { sinAcceso: true });
      const aulaJson = await carpetaAula.leerJson(archivoAula.id);
      const error = validarAula(aulaJson, { perfilId: aula.perfilId });
      if (error) throw new ErrorAula(error);
      if (estaDesvinculado(aulaJson, idDispositivo)) return { desvinculado: true, aula: aulaJson };
      const firma = firmaDelAdulto(await carpetaAula.listar(), aula.dueno); // antes de sincronizar: si el adulto cambia algo mientras tanto, se vuelve a bajar
      // Mi carpeta se busca cada vez: si el adulto migró el aula (fase 23) la carpeta cambió y la de antes ya no me deja escribir
      const propia = await carpetaPropia(aula);
      const carpetaAlumnoId = propia?.id ?? aula.carpetaAlumnoId;
      if (!carpetaAlumnoId) throw new ErrorAula('Tu adulto todavía no terminó de preparar tu carpeta.', { sinAcceso: true });

      // Las fotos y voces de la familia van a `familia/`, dentro de MI carpeta (se crea solo cuando hace falta)
      const miCarpeta = clienteCarpeta(carpetaAlumnoId);
      let carpetaFamilia = null;
      const familiaYa = (await miCarpeta.listar()).find((a) => a.name === 'familia' && a.mimeType?.includes('folder') && minuscula(a.owners?.[0]?.emailAddress) === minuscula(email));
      const hayMaterial = (await store.listar('medios', { conBorrados: true })).some((m) => m.origen === 'familia');
      if (familiaYa || hayMaterial) {
        const familiaId = familiaYa?.id ?? await drive.crearCarpeta('familia', { padre: carpetaAlumnoId, propiedades: { leoConmigo: 'familia', perfilId: aula.perfilId } });
        carpetaFamilia = clienteCarpeta(familiaId);
      }

      const conocidos = new Set((await store.leerMeta(`aula:${aula.perfilId}:idsMediosConocidos`, [])) ?? []);
      const sincronizador = crearSincronizadorDeAula({
        store: vistaDePerfil(store, aula.perfilId, { idsMediosConocidos: conocidos }),
        carpetaFamilia,
        rol: 'alumno',
        traerDeApp,
        aula,
        carpetaAula,
        carpetaAlumno: clienteCarpeta(carpetaAlumnoId),
        // la Biblioteca del adulto; un aula versión 1 sin migrar todavía trae los medios dentro del aula
        carpetaMedios: aulaJson.bibliotecaId ? clienteCarpeta(aulaJson.bibliotecaId) : carpetaAula,
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
