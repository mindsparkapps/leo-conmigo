// Cliente mínimo de Google Drive para la carpeta oculta de la app (appDataFolder, alcance drive.appdata).
// No guarda nada ni conoce a Leo Conmigo: solo lista, lee, crea, actualiza y borra archivos.
//
//   const drive = crearDrive({ obtenerToken });   // obtenerToken(forzar) -> Promise<string>
//
// Con un 401 pide un token nuevo (`obtenerToken(true)`) y repite la petición una sola vez.

const API = 'https://www.googleapis.com/drive/v3/files';
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3/files';
const CARPETA = 'appDataFolder';

export class ErrorDrive extends Error {
  constructor(mensaje, { estado = null, sinConexion = false, sesion = false, sinAcceso = false } = {}) {
    super(mensaje);
    this.name = 'ErrorDrive';
    this.sinAcceso = sinAcceso; // true: la carpeta del aula no existe o no se comparte con esta cuenta
    this.estado = estado;
    this.sinConexion = sinConexion;
    this.sesion = sesion; // true: hay que volver a iniciar sesión
  }
}

function errorDeEstado(estado) {
  if (estado === 401) return new ErrorDrive('La sesión de Google venció. Vuelve a iniciar sesión.', { estado, sesion: true });
  if (estado === 403) return new ErrorDrive('Google no dio permiso para guardar en Drive. Vuelve a iniciar sesión y acepta el permiso.', { estado, sesion: true });
  if (estado === 429 || estado >= 500) return new ErrorDrive('Google Drive no responde ahora. Se intentará de nuevo más tarde.', { estado });
  return new ErrorDrive(`Google Drive devolvió un error (${estado}).`, { estado });
}

const consulta = (obj) => new URLSearchParams(obj).toString();

/** Un cliente de peticiones con token: con un 401 renueva el token y repite una vez. */
function crearPedidor({ obtenerToken, fetchFn, errorDe = errorDeEstado }) {
  return async function pedir(url, opciones = {}, { permitir404 = false } = {}) {
    for (let intento = 0; intento < 2; intento++) {
      const token = await obtenerToken(intento > 0);
      let respuesta;
      try {
        respuesta = await fetchFn(url, { ...opciones, headers: { ...opciones.headers, Authorization: `Bearer ${token}` } });
      } catch (error) {
        throw new ErrorDrive('No hay conexión con Google Drive.', { sinConexion: true });
      }
      if (respuesta.status === 401 && intento === 0) continue; // token vencido: se renueva y se repite
      if (respuesta.ok || (permitir404 && respuesta.status === 404)) return respuesta;
      throw errorDe(respuesta.status);
    }
    throw errorDe(401);
  };
}

export function crearDrive({ obtenerToken, fetchFn = (...args) => globalThis.fetch(...args) }) {
  const pedir = crearPedidor({ obtenerToken, fetchFn });

  return {
    /** Todos los archivos de la carpeta de la app: [{ id, name, modifiedTime }]. */
    async listar() {
      const archivos = [];
      let pagina = null;
      do {
        const parametros = { spaces: CARPETA, pageSize: '1000', fields: 'nextPageToken,files(id,name,modifiedTime)' };
        if (pagina) parametros.pageToken = pagina;
        const datos = await (await pedir(`${API}?${consulta(parametros)}`)).json();
        archivos.push(...(datos.files ?? []));
        pagina = datos.nextPageToken ?? null;
      } while (pagina);
      return archivos;
    },

    async leerJson(id) {
      return (await pedir(`${API}/${encodeURIComponent(id)}?alt=media`)).json();
    },

    async leerBlob(id) {
      return (await pedir(`${API}/${encodeURIComponent(id)}?alt=media`)).blob();
    },

    /** Crea un archivo nuevo y devuelve su id. `contenido` es texto o Blob. */
    async crear(nombre, contenido, mime) {
      const limite = `leo${Math.random().toString(36).slice(2)}`;
      const metadatos = JSON.stringify({ name: nombre, parents: [CARPETA] });
      const cuerpo = new Blob([
        `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadatos}\r\n`,
        `--${limite}\r\nContent-Type: ${mime}\r\n\r\n`,
        contenido,
        `\r\n--${limite}--`,
      ]);
      const respuesta = await pedir(`${SUBIDA}?uploadType=multipart&fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
        body: cuerpo,
      });
      return (await respuesta.json()).id;
    },

    /** Reemplaza el contenido de un archivo. */
    async actualizar(id, contenido, mime) {
      await pedir(`${SUBIDA}/${encodeURIComponent(id)}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': mime },
        body: contenido,
      });
    },

    /** Borra un archivo (si ya no existe, no es un error). */
    async borrar(id) {
      await pedir(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' }, { permitir404: true });
    },
  };
}

// ---------- Carpetas compartidas (el «aula»; alcance `drive`) ----------

export const MIME_CARPETA = 'application/vnd.google-apps.folder';
export const PROPIEDAD = 'leoConmigo'; // propiedad pública de las carpetas de Leo Conmigo (trabajo | aula | del-alumno)
const ROLES_PERMITIDOS = Object.freeze(['reader', 'writer']);
const CAMPOS_ARCHIVO = 'id,name,modifiedTime,mimeType,properties,owners(emailAddress)';

/** Texto seguro dentro de comillas simples de una consulta `q` de Drive. */
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

function errorDeCarpeta(estado) {
  if (estado === 403 || estado === 404) {
    return new ErrorDrive('No tienes acceso al aula. Pídele a tu adulto que la comparta contigo.', { estado, sinAcceso: true });
  }
  return errorDeEstado(estado);
}

function cuerpoMultipart(metadatos, contenido, mime) {
  const limite = `leo${Math.random().toString(36).slice(2)}`;
  const cuerpo = new Blob([
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadatos)}\r\n`,
    `--${limite}\r\nContent-Type: ${mime}\r\n\r\n`,
    contenido,
    `\r\n--${limite}--`,
  ]);
  return { cuerpo, tipo: `multipart/related; boundary=${limite}` };
}

/**
 * Un cliente de Drive atado a UNA carpeta, con la misma interfaz que `crearDrive` (la usa el sincronizador):
 * solo lista lo que está dentro de ella y todo lo que crea queda dentro de ella. Un 403/404 es «sin acceso al aula».
 */
export function crearDriveCarpeta({ obtenerToken, carpetaId, fetchFn = (...args) => globalThis.fetch(...args) }) {
  if (typeof carpetaId !== 'string' || !carpetaId) throw new Error('Falta la carpeta del aula.');
  const pedir = crearPedidor({ obtenerToken, fetchFn, errorDe: errorDeCarpeta });
  return {
    carpetaId,

    /** Los archivos de la carpeta: [{ id, name, modifiedTime, mimeType, owners: [{ emailAddress }] }]. */
    async listar() {
      const archivos = [];
      let pagina = null;
      do {
        const parametros = { q: `'${esc(carpetaId)}' in parents and trashed = false`, pageSize: '1000', fields: `nextPageToken,files(${CAMPOS_ARCHIVO})` };
        if (pagina) parametros.pageToken = pagina;
        const datos = await (await pedir(`${API}?${consulta(parametros)}`)).json();
        archivos.push(...(datos.files ?? []));
        pagina = datos.nextPageToken ?? null;
      } while (pagina);
      return archivos;
    },

    async leerJson(id) {
      return (await pedir(`${API}/${encodeURIComponent(id)}?alt=media`)).json();
    },

    async leerBlob(id) {
      return (await pedir(`${API}/${encodeURIComponent(id)}?alt=media`)).blob();
    },

    /** Crea un archivo dentro de la carpeta (nunca en otro lugar) y devuelve su id. */
    async crear(nombre, contenido, mime) {
      const { cuerpo, tipo } = cuerpoMultipart({ name: nombre, parents: [carpetaId] }, contenido, mime);
      const respuesta = await pedir(`${SUBIDA}?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': tipo }, body: cuerpo });
      return (await respuesta.json()).id;
    },

    async actualizar(id, contenido, mime) {
      await pedir(`${SUBIDA}/${encodeURIComponent(id)}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': mime }, body: contenido });
    },

    async borrar(id) {
      await pedir(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' }, { permitir404: true });
    },
  };
}

/** Un correo con forma de correo (validación simple). */
export const esCorreo = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/**
 * Lo que el adulto (y el alumno, para encontrar su aula) hace con carpetas y permisos. Pide el alcance `drive`.
 * `compartir` solo acepta `reader` o `writer` para una persona con su correo exacto: nunca `anyone` ni `domain`.
 */
export function crearDriveAulas({ obtenerToken, fetchFn = (...args) => globalThis.fetch(...args) }) {
  const pedir = crearPedidor({ obtenerToken, fetchFn, errorDe: errorDeCarpeta });
  const listarArchivos = async (q) => {
    const archivos = [];
    let pagina = null;
    do {
      const parametros = { q, pageSize: '100', fields: `nextPageToken,files(${CAMPOS_ARCHIVO},parents)` };
      if (pagina) parametros.pageToken = pagina;
      const datos = await (await pedir(`${API}?${consulta(parametros)}`)).json();
      archivos.push(...(datos.files ?? []));
      pagina = datos.nextPageToken ?? null;
    } while (pagina);
    return archivos;
  };
  const propiedad = (valor) => `properties has { key='${PROPIEDAD}' and value='${esc(valor)}' }`;

  return {
    /** Carpetas de Leo Conmigo con esa propiedad (`trabajo`, `aula`, `del-alumno`), dentro de `padre` si se indica. Solo las del propio dueño con `mias`. */
    async buscarCarpeta({ valor, padre = null, mias = true, perfilId = null }) {
      const q = [`mimeType = '${MIME_CARPETA}'`, 'trashed = false', propiedad(valor)];
      if (padre) q.push(`'${esc(padre)}' in parents`);
      if (mias) q.push("'me' in owners");
      const todas = await listarArchivos(q.join(' and '));
      return perfilId ? todas.filter((c) => c.properties?.perfilId === perfilId) : todas;
    },

    /** Crea una carpeta (dentro de `padre`, o en Mi unidad) con sus propiedades. Devuelve su id. */
    async crearCarpeta(nombre, { padre = null, propiedades = {} } = {}) {
      const metadatos = { name: nombre, mimeType: MIME_CARPETA, properties: propiedades };
      if (padre) metadatos.parents = [padre];
      const respuesta = await pedir(`${API}?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metadatos) });
      return (await respuesta.json()).id;
    },

    /** Las aulas que otra cuenta compartió conmigo (carpetas con la propiedad `aula`). */
    async buscarAulasCompartidasConmigo() {
      return listarArchivos(`sharedWithMe and mimeType = '${MIME_CARPETA}' and trashed = false and ${propiedad('aula')}`);
    },

    /** Da acceso a UNA persona: `reader` o `writer`, con su correo exacto. Cualquier otra cosa lanza error. */
    async compartir(carpetaId, email, rol, { avisar = true, mensaje = 'Te invitaron a Leo Conmigo, la app para aprender a leer.' } = {}) {
      if (!ROLES_PERMITIDOS.includes(rol)) throw new Error(`Rol no permitido: ${rol}`);
      if (!esCorreo(email)) throw new Error('El correo no es válido.');
      const parametros = { sendNotificationEmail: avisar ? 'true' : 'false' };
      if (avisar) parametros.emailMessage = mensaje;
      const respuesta = await pedir(`${API}/${encodeURIComponent(carpetaId)}/permissions?${consulta({ ...parametros, fields: 'id' })}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'user', role: rol, emailAddress: email.trim() }),
      });
      return (await respuesta.json()).id;
    },

    /** Los permisos de una carpeta: [{ id, type, role, emailAddress }]. */
    async permisos(carpetaId) {
      const datos = await (await pedir(`${API}/${encodeURIComponent(carpetaId)}/permissions?${consulta({ fields: 'permissions(id,type,role,emailAddress)', pageSize: '100' })}`)).json();
      return datos.permissions ?? [];
    },

    async quitarPermiso(carpetaId, permisoId) {
      await pedir(`${API}/${encodeURIComponent(carpetaId)}/permissions/${encodeURIComponent(permisoId)}`, { method: 'DELETE' }, { permitir404: true });
    },
  };
}
