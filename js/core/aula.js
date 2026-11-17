// Núcleo puro del aula (PLAN.md, Ampliación 3, fase 15). Sin red ni DOM.
//
// Un «aula» es una carpeta del Drive del adulto compartida con el Gmail del alumno: el adulto escribe `adulto.json`,
// el alumno escribe `del-alumno/alumno.json`, y cada lado lee el del otro. Este módulo decide QUÉ se acepta y QUÉ se
// publica (la tabla «Quién puede tocar qué»), valida los archivos y resume el estado de los alumnos.

import { ALMACENES_RESPALDO } from './respaldo.js';
import { armarDocumento, validarDocumento } from './sync.js';
import { mediosDeRegistro } from './borrar-perfil.js';
import { ORIGEN_FAMILIA, limpiarContenidoFamilia } from './curso.js';

export const FORMATO_AULA = 'leo-conmigo-aula';
export const FORMATO_DISPOSITIVO = 'leo-conmigo-dispositivo';
export const VERSION_AULA = 2; // 2 (Ampliación 4): `alumnos` y `bibliotecaId`; la 1 se sigue leyendo y se migra
export const VERSION_DISPOSITIVO = 1;
export const NOMBRE_BIBLIOTECA = 'Biblioteca';
export const NOMBRE_CARPETA_ALUMNOS = 'alumnos';
export const NOMBRE_CARPETA_FAMILIA = 'familia';
export const ROLES = Object.freeze(['adulto', 'alumno']);

export const ARCHIVO_AULA = 'aula.json';
export const ARCHIVO_ADULTO = 'adulto.json';
export const ARCHIVO_ALUMNO = 'alumno.json';
export const nombreArchivoDispositivo = (idDispositivo) => `dispositivo-${idDispositivo}.json`;

const enOrden = (nombres) => Object.freeze(ALMACENES_RESPALDO.filter((a) => nombres.includes(a)));

/**
 * Solo los escribe el adulto; el alumno los acepta y nunca los publica.
 * Los `medios` ya NO van en el aula (Ampliación 4): las imágenes y audios del adulto están una sola vez en `Biblioteca/`.
 */
export const ALMACENES_SOLO_ADULTO = enOrden(['palabras', 'frases', 'libros', 'calcomaniasPropias', 'premios']);
/** Lo que el celular del alumno escribe en su `alumno.json` (en `perfiles`, solo su parte: `perfilPublicable`). */
export const ALMACENES_DEL_ALUMNO = enOrden(['perfiles', 'progresos', 'niveles', 'sesiones', 'respuestas', 'calcomanias', 'movimientos']);
/** Lo que el adulto escribe en `adulto.json`: el contenido del curso (el perfil del curso incluido). Nunca avance de alumnos. */
export const ALMACENES_DEL_CURSO = enOrden(['perfiles', ...ALMACENES_SOLO_ADULTO]);

const comprobarRol = (rol) => {
  if (!ROLES.includes(rol)) throw new Error(`Rol desconocido: ${rol}`);
  return rol;
};

/** Los almacenes que un rol escribe en su archivo de Drive. */
export function publicaRol(rol) {
  comprobarRol(rol);
  return rol === 'adulto' ? ALMACENES_DEL_CURSO : ALMACENES_DEL_ALUMNO;
}

/** Los almacenes que el rol local acepta del archivo del otro lado (solo lo que el otro lado puede publicar). */
export function aceptaDe(rolLocal, rolRemoto) {
  comprobarRol(rolLocal);
  comprobarRol(rolRemoto);
  if (rolLocal === rolRemoto) return Object.freeze([]);
  return publicaRol(rolRemoto);
}

const esRegistro = (r) => Boolean(r) && typeof r === 'object' && !Array.isArray(r) && typeof r.id === 'string' && r.id !== '';
const esDeFamilia = (r) => Boolean(r) && typeof r === 'object' && r.origen === ORIGEN_FAMILIA;

// ---------- medios del perfil ----------

/**
 * Ids de los medios que usa un perfil: su foto, los de sus palabras, frases, libros (páginas), premios y calcomanías
 * propias, y lo anidado en el perfil (portada y sobre de cada álbum cargado y del álbum de la app).
 * Solo cuentan los registros vivos de ese perfil.
 * @param perfil     el registro del perfil
 * @param registros  { almacen: [registros] } (de uno o de varios perfiles; los de otros se ignoran)
 */
export function mediosDelPerfil({ perfil, registros = {} }) {
  const ids = new Set(mediosDeRegistro(perfil));
  for (const [almacen, lista] of Object.entries(registros)) {
    if (almacen === 'perfiles' || almacen === 'medios' || !Array.isArray(lista)) continue;
    for (const r of lista) {
      if (!esRegistro(r) || r.deleted || r.perfilId !== perfil?.id) continue;
      for (const id of mediosDeRegistro(r)) ids.add(id);
    }
  }
  return [...ids];
}

// ---------- filtrar lo que llega del otro lado ----------

/**
 * Deja pasar solo lo que este lado puede aceptar del archivo del otro: los almacenes aceptados, y de ellos solo los
 * registros de `perfilId` (en `perfiles`, solo el suyo). Los `medios` solo pasan si el perfil los usa (o si son un
 * borrado, para que el borrado viaje). Todo lo demás se descarta y se cuenta.
 * @returns {{ almacenes, descartados: { total, porAlmacen } }}
 */
export function filtrarEntrantes({ almacenes, perfilId, aceptados }) {
  const permitidos = new Set(aceptados ?? []);
  const salida = {};
  const porAlmacen = {};
  const descartar = (nombre, n = 1) => { porAlmacen[nombre] = (porAlmacen[nombre] ?? 0) + n; };
  const entrada = almacenes && typeof almacenes === 'object' ? almacenes : {};

  for (const [nombre, lista] of Object.entries(entrada)) {
    if (!permitidos.has(nombre) || !ALMACENES_RESPALDO.includes(nombre) || !Array.isArray(lista)) {
      descartar(nombre, Array.isArray(lista) ? lista.length : 1);
      continue;
    }
    if (nombre === 'medios') continue; // se decide al final, cuando se conocen los demás registros
    const buenos = [];
    for (const r of lista) {
      const suyo = nombre === 'perfiles' ? esRegistro(r) && r.id === perfilId : esRegistro(r) && r.perfilId === perfilId;
      // Lo de la familia viaja solo en `contenidoFamilia` (y en su carpeta): jamás como contenido del curso
      if (suyo && !esDeFamilia(r)) buenos.push(r); else descartar(nombre);
    }
    salida[nombre] = buenos;
  }

  if (permitidos.has('medios') && Array.isArray(entrada.medios)) {
    const perfil = (salida.perfiles ?? []).find((p) => p.id === perfilId) ?? { id: perfilId };
    const usados = new Set(mediosDelPerfil({ perfil, registros: salida }));
    salida.medios = [];
    for (const m of entrada.medios) {
      if (esRegistro(m) && !esDeFamilia(m) && (usados.has(m.id) || m.deleted === true)) salida.medios.push(m); else descartar('medios');
    }
  }

  const total = Object.values(porAlmacen).reduce((a, b) => a + b, 0);
  return { almacenes: salida, descartados: { total, porAlmacen } };
}

// ---------- formatos y validación ----------

const textoNoVacio = (v) => typeof v === 'string' && v.trim() !== '';
const esEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function revisarVersion(doc, esperada, nombre) {
  if (!Number.isInteger(doc.version) || doc.version < 1) return `${nombre} está dañado: no tiene versión.`;
  if (doc.version > esperada) return `${nombre} es de una versión más nueva de la aplicación. Actualiza la app e inténtalo de nuevo.`;
  return null;
}

/**
 * `aula.json` versión 2: el curso (perfil), su dueño, la apariencia, los dispositivos desvinculados, los alumnos
 * invitados con la carpeta `alumnos/<correo>/` de cada uno y la `Biblioteca/` común (null hasta que se crea).
 */
export function nuevaAula({ perfilId, nombre, email, fondo = null, desvinculados = [], alumnos = [], bibliotecaId = null, ahora = new Date() }) {
  return {
    formato: FORMATO_AULA,
    version: VERSION_AULA,
    perfilId,
    nombre,
    dueno: { email },
    apariencia: { fondo },
    desvinculados: [...desvinculados],
    alumnos: alumnos.map((a) => ({ email: minuscula(a.email), carpetaId: a.carpetaId ?? null })),
    bibliotecaId,
    actualizado: ahora.toISOString(),
  };
}

/** Un `aula.json` (versión 1 o 2 ya validado) en la forma de la versión 2. La versión 1 no tenía alumnos ni biblioteca. */
export function aulaComoV2(doc) {
  return {
    ...doc,
    version: VERSION_AULA,
    alumnos: Array.isArray(doc.alumnos) ? doc.alumnos.map((a) => ({ email: minuscula(a.email), carpetaId: a.carpetaId ?? null })) : [],
    bibliotecaId: doc.bibliotecaId ?? null,
  };
}

/** Mensaje de error en español, o null si `aula.json` es válido (y, si se pasa `perfilId`, es de ese perfil). */
export function validarAula(doc, { perfilId } = {}) {
  if (!doc || typeof doc !== 'object' || doc.formato !== FORMATO_AULA) return 'El archivo del aula no es de Leo Conmigo.';
  const v = revisarVersion(doc, VERSION_AULA, 'El aula');
  if (v) return v;
  if (!textoNoVacio(doc.perfilId)) return 'El aula está dañada: no dice de qué perfil es.';
  if (perfilId !== undefined && doc.perfilId !== perfilId) return 'El aula es de otro perfil.';
  if (!textoNoVacio(doc.nombre)) return 'El aula está dañada: no tiene nombre.';
  if (!doc.dueno || typeof doc.dueno !== 'object' || !esEmail(doc.dueno.email)) return 'El aula está dañada: no dice quién es su dueño.';
  if (doc.apariencia !== undefined && (!doc.apariencia || typeof doc.apariencia !== 'object' || Array.isArray(doc.apariencia))) {
    return 'El aula está dañada: la apariencia no se entiende.';
  }
  if (!Array.isArray(doc.desvinculados) || doc.desvinculados.some((d) => !textoNoVacio(d))) {
    return 'El aula está dañada: la lista de dispositivos desvinculados no se entiende.';
  }
  if (doc.version >= 2) {
    const alumnosOk = Array.isArray(doc.alumnos) && doc.alumnos.every((a) => a && typeof a === 'object' && esEmail(a.email) && (a.carpetaId == null || textoNoVacio(a.carpetaId)));
    if (!alumnosOk) return 'El aula está dañada: la lista de alumnos no se entiende.';
    if (doc.bibliotecaId != null && !textoNoVacio(doc.bibliotecaId)) return 'El aula está dañada: la biblioteca no se entiende.';
  }
  return null;
}

/**
 * Arma `adulto.json` o `alumno.json`: el mismo formato que `data.json`, con `perfilId` y `rol`, y solo los almacenes
 * que ese rol publica (y solo los registros de ese perfil). El adulto publica el contenido del curso y nunca avance de
 * alumnos; el alumno publica su avance y, aparte, `contenidoFamilia` (sin blobs). Nada con `origen: 'familia'` entra a
 * los almacenes normales.
 * @param contenidoFamilia   (alumno) { palabras, frases, libros, calcomaniasPropias, premios } de `separarFamilia`
 */
export function armarArchivoAula({ rol, perfilId, almacenes, contenidoFamilia, ahora = new Date() }) {
  const publica = publicaRol(rol);
  const { almacenes: propios } = filtrarEntrantes({ almacenes, perfilId, aceptados: publica });
  const doc = armarDocumento({ almacenes: propios, ahora });
  const soloPublicados = {};
  for (const nombre of publica) soloPublicados[nombre] = doc.almacenes[nombre];
  const archivo = { ...doc, almacenes: soloPublicados, perfilId, rol };
  if (rol === 'alumno') archivo.contenidoFamilia = limpiarContenidoFamilia(contenidoFamilia, { cursoId: perfilId }).contenido;
  return archivo;
}

/**
 * Mensaje de error, o null si `adulto.json` / `alumno.json` es válido.
 * @param rolEsperado  el rol que lo escribió ('adulto' o 'alumno')
 * @param perfilId     el perfil del aula (debe coincidir)
 */
export function validarArchivoAula(doc, { rolEsperado, perfilId }) {
  const error = validarDocumento(doc);
  if (error) return error;
  if (doc.rol !== rolEsperado) return `El archivo no lo escribió ${rolEsperado === 'adulto' ? 'el adulto' : 'el alumno'}.`;
  if (!textoNoVacio(doc.perfilId)) return 'El archivo del aula está dañado: no dice de qué perfil es.';
  if (perfilId !== undefined && doc.perfilId !== perfilId) return 'El archivo del aula es de otro perfil.';
  if (doc.contenidoFamilia !== undefined && (rolEsperado !== 'alumno' || !doc.contenidoFamilia || typeof doc.contenidoFamilia !== 'object' || Array.isArray(doc.contenidoFamilia))) {
    return 'El archivo del aula está dañado: el contenido de la familia no se entiende.';
  }
  return null;
}

export function nuevoDispositivo({ idDispositivo, email, nombre = '', versionApp, primeraConexion, ahora = new Date() }) {
  const iso = ahora.toISOString();
  return {
    formato: FORMATO_DISPOSITIVO,
    version: VERSION_DISPOSITIVO,
    idDispositivo,
    email,
    nombre,
    versionApp,
    primeraConexion: primeraConexion ?? iso,
    ultimaSync: iso,
  };
}

const fechaValida = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

export function validarDispositivo(doc) {
  if (!doc || typeof doc !== 'object' || doc.formato !== FORMATO_DISPOSITIVO) return 'El archivo del dispositivo no es de Leo Conmigo.';
  const v = revisarVersion(doc, VERSION_DISPOSITIVO, 'El archivo del dispositivo');
  if (v) return v;
  if (!textoNoVacio(doc.idDispositivo)) return 'El archivo del dispositivo está dañado: no tiene identificador.';
  if (!esEmail(doc.email)) return 'El archivo del dispositivo está dañado: no tiene correo.';
  if (!fechaValida(doc.ultimaSync)) return 'El archivo del dispositivo está dañado: la última sincronización no se entiende.';
  if (doc.primeraConexion !== undefined && !fechaValida(doc.primeraConexion)) return 'El archivo del dispositivo está dañado: la primera conexión no se entiende.';
  return null;
}

// ---------- estado de los alumnos ----------

const minuscula = (e) => String(e ?? '').trim().toLowerCase();

/**
 * Los permisos de las carpetas del aula que la app NO puso (la tabla de seguridad):
 *  - en el aula: solo el dueño y, como lector, los correos invitados;
 *  - en `del-alumno/`: el dueño y los correos invitados (como editor, o como lector heredado del aula);
 *  - nada de `anyone`, `domain` ni `group`, ni otros correos, ni un editor en el aula.
 * @param permisos  { aula: [permiso], delAlumno: [permiso] } con la forma de Drive { id, type, role, emailAddress }
 */
function permisosExtranos(invitadosMin, permisos, enBibliotecaMin = invitadosMin) {
  const extranos = [];
  /** `rolesOk(email)`: los roles permitidos a ese correo en esa carpeta. */
  const revisar = (carpeta, lista, correosOk, rolesOk) => {
    for (const p of Array.isArray(lista) ? lista : []) {
      if (p?.role === 'owner' && p?.type === 'user') continue;
      let motivo = null;
      if (p?.type !== 'user') motivo = p?.type === 'anyone' ? 'Cualquiera con el enlace' : `Acceso de tipo «${p?.type ?? 'desconocido'}»`;
      else if (!correosOk.has(minuscula(p.emailAddress))) motivo = 'Un correo que no invitaste';
      else if (!rolesOk(minuscula(p.emailAddress)).includes(p.role)) motivo = `Puede ${p.role === 'writer' ? 'cambiar' : 'tocar'} más de lo debido (${p.role})`;
      if (motivo) extranos.push({ carpeta, id: p?.id ?? null, tipo: p?.type ?? null, rol: p?.role ?? null, email: p?.emailAddress ?? null, motivo });
    }
  };
  const soloLector = () => ['reader'];

  // Ampliación 4: Biblioteca (lector para los invitados de cualquier curso), curso (lector para sus invitados) y
  // `alumnos/<correo>/` (editor solo ese correo; los demás, como mucho lectores heredados del curso)
  revisar('aula', permisos?.aula, invitadosMin, soloLector);
  // Se compara por id y rol: el id de un permiso de Drive es el de la persona, igual en todas las carpetas
  const clave = (e) => `${e.id}:${e.rol}`;
  const yaDelAula = new Set(extranos.filter((e) => e.id).map(clave));
  revisar('biblioteca', permisos?.biblioteca, enBibliotecaMin, soloLector);
  const heredados = [];
  const antes = extranos.length;
  for (const [correo, lista] of Object.entries(permisos?.alumnos ?? {})) {
    const dueno = minuscula(correo);
    revisar(`alumnos/${dueno}`, lista, invitadosMin, (e) => (e === dueno ? ['reader', 'writer'] : ['reader']));
  }
  // Hasta la fase 23 los alumnos de un curso comparten una sola carpeta `del-alumno/` donde cualquier invitado puede ser editor
  revisar('del-alumno', permisos?.delAlumno, invitadosMin, () => ['reader', 'writer']);
  // un permiso extraño del aula se hereda a las carpetas de dentro: es el mismo, se quita una sola vez desde el aula
  for (const e of extranos.splice(antes)) if (!(e.id && yaDelAula.has(clave(e)))) heredados.push(e);
  return [...extranos, ...heredados];
}

/**
 * Estado de cada correo invitado a un aula.
 * @param invitados    correos (cadenas) invitados a este curso
 * @param invitadosDeTodos  correos invitados a cualquier curso del adulto (pueden leer la Biblioteca)
 * @param permisos     { biblioteca, aula, alumnos: { <correo>: [permiso] } } permisos reales de las carpetas
 *                     (si falta, no se revisa nada; `delAlumno` es de las aulas versión 1)
 * @param dispositivos contenido de los `dispositivo-<id>.json` ya leídos
 * @param ahora        Date
 * @returns {{ alumnos: [{ email, estado, dispositivos: [{ ..., haceMs }] }], permisosExtranos, dispositivosInvalidos }}
 *   estado: 'invitado' (aún no entra) | 'conectado' | 'sin acceso' (ya no tiene permiso en el aula)
 */
export function estadoDeAlumnos({ invitados = [], invitadosDeTodos = null, permisos = null, dispositivos = [], ahora = new Date() }) {
  const lista = [...new Set(invitados.map(minuscula).filter(Boolean))];
  const invitadosMin = new Set(lista);
  // La Biblioteca la leen los invitados de CUALQUIER curso (siempre incluye a los de este)
  const enBibliotecaMin = new Set([...lista, ...(invitadosDeTodos ?? []).map(minuscula).filter(Boolean)]);
  const conAcceso = permisos
    ? new Set((permisos.aula ?? []).filter((p) => p?.type === 'user' && p.emailAddress).map((p) => minuscula(p.emailAddress)))
    : null;
  const t0 = ahora instanceof Date ? ahora.getTime() : Date.parse(ahora);

  let dispositivosInvalidos = 0;
  const porCorreo = new Map();
  for (const d of dispositivos) {
    if (validarDispositivo(d)) { dispositivosInvalidos += 1; continue; }
    const email = minuscula(d.email);
    const haceMs = Math.max(0, t0 - Date.parse(d.ultimaSync));
    if (!porCorreo.has(email)) porCorreo.set(email, []);
    porCorreo.get(email).push({ ...d, haceMs });
  }

  const alumnos = lista.map((email) => {
    const suyos = (porCorreo.get(email) ?? []).sort((a, b) => a.haceMs - b.haceMs);
    let estado = suyos.length ? 'conectado' : 'invitado';
    if (conAcceso && !conAcceso.has(email)) estado = 'sin acceso';
    return { email, estado, dispositivos: suyos };
  });
  return { alumnos, permisosExtranos: permisos ? permisosExtranos(invitadosMin, permisos, enBibliotecaMin) : [], dispositivosInvalidos };
}
