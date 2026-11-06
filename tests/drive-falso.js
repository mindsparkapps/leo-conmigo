// Un «Google Drive» falso en memoria (solo la parte que usa js/drive.js) para probar la sincronización en Node.
// No es una prueba: no termina en .test.js.

let numero = 0;

/**
 * @param tokenValido   el token que acepta; con otro responde 401
 * @param tamanoPagina  cuántos archivos devuelve por página al listar (para probar la paginación)
 */
export function crearDriveFalso({ tokenValido = 'token-1', tamanoPagina = 1000 } = {}) {
  const estado = {
    tokenValido,
    archivos: new Map(), // id -> { id, name, bytes: Uint8Array, mime, modifiedTime }
    peticiones: [], // [{ metodo, ruta }]
    fallar: null, // función (metodo, ruta) -> estado HTTP a devolver, o undefined para atender normal
    sinRed: false,
  };

  const aBytes = async (cuerpo) => {
    if (cuerpo == null) return new Uint8Array();
    if (typeof cuerpo === 'string') return new TextEncoder().encode(cuerpo);
    return new Uint8Array(await new Blob([cuerpo]).arrayBuffer());
  };
  const respuestaJson = (datos, estadoHttp = 200) => new Response(JSON.stringify(datos), { status: estadoHttp, headers: { 'Content-Type': 'application/json' } });

  // Separa un cuerpo multipart/related en { metadatos, contenido (bytes) }
  function leerMultipart(bytes, limite) {
    const latin1 = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
    const partes = latin1.split(`--${limite}`).slice(1, -1);
    const [cabecera1, cabecera2] = partes;
    const metadatos = JSON.parse(cabecera1.split('\r\n\r\n')[1].replace(/\r\n$/, ''));
    const inicio = cabecera2.indexOf('\r\n\r\n') + 4;
    const texto = cabecera2.slice(inicio).replace(/\r\n$/, '');
    const mime = /Content-Type: ([^\r\n]+)/.exec(cabecera2)[1];
    return { metadatos, contenido: Uint8Array.from(texto, (c) => c.charCodeAt(0)), mime };
  }

  async function fetchFalso(url, opciones = {}) {
    if (estado.sinRed) throw new TypeError('Failed to fetch');
    const u = new URL(url);
    const metodo = (opciones.method ?? 'GET').toUpperCase();
    estado.peticiones.push({ metodo, ruta: u.pathname + (u.searchParams.get('uploadType') ? `?${u.searchParams.get('uploadType')}` : '') });
    if (opciones.headers?.Authorization !== `Bearer ${estado.tokenValido}`) return respuestaJson({ error: 'no autorizado' }, 401);
    const forzado = estado.fallar?.(metodo, u.pathname);
    if (forzado) return respuestaJson({ error: 'fallo' }, forzado);

    const esSubida = u.pathname.startsWith('/upload/drive/v3/files');
    const id = decodeURIComponent(u.pathname.split('/').pop());

    if (metodo === 'GET' && u.pathname === '/drive/v3/files') {
      if (u.searchParams.get('spaces') !== 'appDataFolder') return respuestaJson({ error: 'solo appDataFolder' }, 400);
      const todos = [...estado.archivos.values()];
      const desde = Number(u.searchParams.get('pageToken') ?? 0);
      const trozo = todos.slice(desde, desde + tamanoPagina);
      const siguiente = desde + tamanoPagina < todos.length ? String(desde + tamanoPagina) : undefined;
      return respuestaJson({ files: trozo.map(({ id: i, name, modifiedTime }) => ({ id: i, name, modifiedTime })), nextPageToken: siguiente });
    }
    if (metodo === 'GET' && u.searchParams.get('alt') === 'media') {
      const a = estado.archivos.get(id);
      if (!a) return respuestaJson({ error: 'no existe' }, 404);
      return new Response(new Blob([a.bytes], { type: a.mime }), { status: 200, headers: { 'Content-Type': a.mime } });
    }
    if (metodo === 'POST' && esSubida && u.searchParams.get('uploadType') === 'multipart') {
      const limite = /boundary=(.+)$/.exec(opciones.headers['Content-Type'])[1];
      const { metadatos, contenido, mime } = leerMultipart(await aBytes(opciones.body), limite);
      if (!metadatos.parents?.includes('appDataFolder')) return respuestaJson({ error: 'falta la carpeta' }, 400);
      const nuevoId = `archivo-${++numero}`;
      estado.archivos.set(nuevoId, { id: nuevoId, name: metadatos.name, bytes: contenido, mime, modifiedTime: new Date().toISOString() });
      return respuestaJson({ id: nuevoId });
    }
    if (metodo === 'PATCH' && esSubida) {
      const a = estado.archivos.get(id);
      if (!a) return respuestaJson({ error: 'no existe' }, 404);
      a.bytes = await aBytes(opciones.body);
      a.mime = opciones.headers['Content-Type'];
      a.modifiedTime = new Date().toISOString();
      return respuestaJson({ id });
    }
    if (metodo === 'DELETE') {
      if (!estado.archivos.delete(id)) return respuestaJson({ error: 'no existe' }, 404);
      return new Response(null, { status: 204 });
    }
    return respuestaJson({ error: 'petición no soportada' }, 400);
  }

  return {
    estado,
    fetch: fetchFalso,
    nombres: () => [...estado.archivos.values()].map((a) => a.name).sort(),
    porNombre: (nombre) => [...estado.archivos.values()].find((a) => a.name === nombre),
    json: (nombre) => JSON.parse(new TextDecoder().decode(estado.archivos.get([...estado.archivos.values()].find((a) => a.name === nombre).id).bytes)),
    contar: (metodo) => estado.peticiones.filter((p) => p.metodo === metodo).length,
    reiniciarPeticiones: () => { estado.peticiones.length = 0; },
  };
}
