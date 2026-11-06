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
  constructor(mensaje, { estado = null, sinConexion = false, sesion = false } = {}) {
    super(mensaje);
    this.name = 'ErrorDrive';
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

export function crearDrive({ obtenerToken, fetchFn = (...args) => globalThis.fetch(...args) }) {
  async function pedir(url, opciones = {}, { permitir404 = false } = {}) {
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
      throw errorDeEstado(respuesta.status);
    }
    throw errorDeEstado(401);
  }

  const consulta = (obj) => new URLSearchParams(obj).toString();

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
