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

// ---------------------------------------------------------------------------------------------------------------
// Una «nube» con VARIAS cuentas de Google y carpetas compartidas (para probar las aulas, fase 16).
// Imita lo que Drive real hace con los permisos y responde 403 (o 404 si ni siquiera se ve) a lo que Drive rechazaría:
//  - un permiso en una carpeta se hereda a todo lo que hay dentro; el dueño de una carpeta puede tocar lo de dentro;
//  - ver exige ser lector; escribir, editor; dar o quitar permisos, ser el dueño del archivo;
//  - `sharedWithMe` lista lo compartido DIRECTAMENTE conmigo (no lo heredado).
// ---------------------------------------------------------------------------------------------------------------

const MIME_CARPETA_FALSA = 'application/vnd.google-apps.folder';
const RANGO = { reader: 1, commenter: 2, writer: 3, owner: 4 };

function leerMultipartGeneral(bytes, limite) {
  const latin1 = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  const partes = latin1.split(`--${limite}`).slice(1, -1);
  const [cabecera1, cabecera2] = partes;
  const metadatos = JSON.parse(decodeURIComponent(escape(cabecera1.split('\r\n\r\n')[1].replace(/\r\n$/, ''))));
  const inicio = cabecera2.indexOf('\r\n\r\n') + 4;
  const texto = cabecera2.slice(inicio).replace(/\r\n$/, '');
  const mime = /Content-Type: ([^\r\n]+)/.exec(cabecera2)[1];
  return { metadatos, contenido: Uint8Array.from(texto, (c) => c.charCodeAt(0)), mime };
}

export function crearNubeFalsa() {
  const estado = {
    archivos: new Map(), // id -> { id, name, mimeType, parents, properties, owner, bytes, mime, modifiedTime }
    permisos: new Map(), // id de archivo -> [{ id, type, role, emailAddress }]  (los directos; el dueño va aparte)
    tokens: new Map(), // token -> correo
    peticiones: [], // [{ cuenta, metodo, ruta, padre }]
    sinRed: false,
    avisos: [], // correos de invitación enviados: [{ a, carpeta }]
  };
  let contador = 0;
  const nuevoId = (prefijo) => `${prefijo}-${++contador}`;
  const json = (datos, estadoHttp = 200) => new Response(JSON.stringify(datos), { status: estadoHttp, headers: { 'Content-Type': 'application/json' } });
  const error = (estadoHttp, mensaje) => json({ error: { code: estadoHttp, message: mensaje } }, estadoHttp);
  const aBytes = async (cuerpo) => {
    if (cuerpo == null) return new Uint8Array();
    if (typeof cuerpo === 'string') return new TextEncoder().encode(cuerpo);
    return new Uint8Array(await new Blob([cuerpo]).arrayBuffer());
  };
  const minuscula = (s) => String(s ?? '').toLowerCase();
  const padreDe = (a) => estado.archivos.get(a.parents?.[0]) ?? null;
  const cadena = (a) => { const r = []; for (let x = a; x; x = padreDe(x)) r.push(x); return r; };

  /** Rango del permiso de esta cuenta sobre un archivo (0 = no lo ve). */
  function rango(cuenta, archivo) {
    let mejor = 0;
    for (const [i, a] of cadena(archivo).entries()) {
      if (a.owner === cuenta) mejor = Math.max(mejor, i === 0 ? RANGO.owner : RANGO.writer);
      for (const p of estado.permisos.get(a.id) ?? []) {
        if (p.type === 'anyone') mejor = Math.max(mejor, RANGO[p.role] ?? 0);
        else if (p.type === 'user' && minuscula(p.emailAddress) === cuenta) mejor = Math.max(mejor, RANGO[p.role] ?? 0);
      }
    }
    return mejor;
  }

  /** Los permisos de un archivo como los lista Drive: uno por persona, con el rol más alto y marcando los heredados. */
  function permisosListados(archivo) {
    const porClave = new Map();
    porClave.set(`user:${archivo.owner}`, { id: `dueno-${archivo.id}`, type: 'user', role: 'owner', emailAddress: archivo.owner, inherited: false });
    for (const [i, a] of cadena(archivo).entries()) {
      for (const p of estado.permisos.get(a.id) ?? []) {
        const clave = `${p.type}:${minuscula(p.emailAddress)}`;
        const previo = porClave.get(clave);
        const nuevo = { ...p, inherited: i > 0 };
        if (!previo || (RANGO[p.role] > RANGO[previo.role]) || (RANGO[p.role] === RANGO[previo.role] && previo.inherited && !nuevo.inherited)) porClave.set(clave, nuevo);
      }
    }
    return [...porClave.values()];
  }

  const sinPrivados = (a) => ({
    id: a.id, name: a.name, mimeType: a.mimeType, modifiedTime: a.modifiedTime, parents: a.parents, properties: a.properties,
    owners: [{ emailAddress: a.owner }],
  });

  function consultar(cuenta, q) {
    const m = (re) => re.exec(q);
    const enPadre = m(/'([^']+)' in parents/)?.[1];
    const mime = m(/mimeType = '([^']+)'/)?.[1];
    const prop = m(/properties has \{ key='([^']+)' and value='([^']+)' \}/);
    const mias = /'me' in owners/.test(q);
    const compartidas = /sharedWithMe/.test(q);
    return [...estado.archivos.values()].filter((a) => {
      if (rango(cuenta, a) < RANGO.reader) return false;
      if (enPadre && a.parents?.[0] !== enPadre) return false;
      if (mime && a.mimeType !== mime) return false;
      if (prop && a.properties?.[prop[1]] !== prop[2]) return false;
      if (mias && a.owner !== cuenta) return false;
      if (compartidas && !(a.owner !== cuenta && (estado.permisos.get(a.id) ?? []).some((p) => p.type === 'user' && minuscula(p.emailAddress) === cuenta))) return false;
      return true;
    });
  }

  async function atender(cuenta, metodo, u, opciones, registro) {
    const partes = u.pathname.split('/').filter(Boolean); // drive v3 files [id] [permissions [pid]]
    const subida = partes[0] === 'upload';
    const base = subida ? partes.slice(3) : partes.slice(2); // lo que sigue a .../files
    const id = base[1] ? decodeURIComponent(base[1]) : null;
    const archivo = id ? estado.archivos.get(id) : null;
    if (id && base[0] === undefined) return error(400, 'ruta');

    // ---- listar ----
    if (metodo === 'GET' && base.length === 1 && !subida && u.searchParams.get('spaces') === 'appDataFolder') {
      // el `appDataFolder` de cada cuenta (fase 24: el respaldo del alumno): solo lo ve su dueño
      const suyos = [...estado.archivos.values()].filter((a) => a.parents?.[0] === 'appDataFolder' && a.owner === cuenta);
      return json({ files: suyos.map(sinPrivados) });
    }
    if (metodo === 'GET' && base.length === 1 && !subida) {
      const q = u.searchParams.get('q') ?? '';
      const todos = consultar(cuenta, q);
      const desde = Number(u.searchParams.get('pageToken') ?? 0);
      const tam = Number(u.searchParams.get('pageSize') ?? 100);
      const trozo = todos.slice(desde, desde + tam);
      return json({ files: trozo.map(sinPrivados), nextPageToken: desde + tam < todos.length ? String(desde + tam) : undefined });
    }
    // ---- permisos ----
    if (base[2] === 'permissions') {
      if (!archivo || rango(cuenta, archivo) < RANGO.reader) return error(404, 'File not found');
      registro.padre = archivo.id;
      if (rango(cuenta, archivo) < RANGO.owner) return error(403, 'El usuario no tiene permiso para administrar los permisos');
      const pid = base[3] ? decodeURIComponent(base[3]) : null;
      if (metodo === 'GET') return json({ permissions: permisosListados(archivo).map(({ id: i, type, role, emailAddress }) => ({ id: i, type, role, emailAddress })) });
      if (metodo === 'POST') {
        const cuerpo = JSON.parse(opciones.body);
        const lista = estado.permisos.get(archivo.id) ?? [];
        const nuevo = { id: nuevoId('perm'), type: cuerpo.type, role: cuerpo.role, emailAddress: cuerpo.emailAddress };
        estado.permisos.set(archivo.id, [...lista, nuevo]);
        if (u.searchParams.get('sendNotificationEmail') === 'true') estado.avisos?.push({ a: cuerpo.emailAddress, carpeta: archivo.name });
        return json({ id: nuevo.id });
      }
      if (metodo === 'DELETE') {
        const lista = estado.permisos.get(archivo.id) ?? [];
        if (!lista.some((p) => p.id === pid)) {
          const heredado = cadena(archivo).slice(1).some((a) => (estado.permisos.get(a.id) ?? []).some((p) => p.id === pid));
          return heredado ? error(403, 'No se puede quitar un permiso heredado') : error(404, 'Permission not found');
        }
        estado.permisos.set(archivo.id, lista.filter((p) => p.id !== pid));
        return new Response(null, { status: 204 });
      }
    }
    // ---- leer contenido ----
    if (metodo === 'GET' && archivo && u.searchParams.get('alt') === 'media') {
      if (rango(cuenta, archivo) < RANGO.reader) return error(404, 'File not found');
      return new Response(new Blob([archivo.bytes ?? new Uint8Array()], { type: archivo.mime }), { status: 200, headers: { 'Content-Type': archivo.mime ?? 'application/octet-stream' } });
    }
    // ---- crear carpeta (JSON) ----
    if (metodo === 'POST' && !subida && base.length === 1) {
      const meta = JSON.parse(opciones.body);
      const padre = meta.parents?.[0] ? estado.archivos.get(meta.parents[0]) : null;
      registro.padre = meta.parents?.[0] ?? null;
      if (meta.parents?.length && (!padre || rango(cuenta, padre) < RANGO.reader)) return error(404, 'Parent not found');
      if (padre && rango(cuenta, padre) < RANGO.writer) return error(403, 'El usuario no tiene permiso para crear aquí');
      const nuevoArchivo = { id: nuevoId('carpeta'), name: meta.name, mimeType: meta.mimeType ?? MIME_CARPETA_FALSA, parents: meta.parents ?? [], properties: meta.properties ?? {}, owner: cuenta, bytes: null, mime: null, modifiedTime: new Date().toISOString() };
      estado.archivos.set(nuevoArchivo.id, nuevoArchivo);
      return json({ id: nuevoArchivo.id });
    }
    // ---- subir archivo nuevo ----
    if (metodo === 'POST' && subida && u.searchParams.get('uploadType') === 'multipart') {
      const limite = /boundary=(.+)$/.exec(opciones.headers['Content-Type'])[1];
      const { metadatos, contenido, mime } = leerMultipartGeneral(await aBytes(opciones.body), limite);
      if (metadatos.parents?.[0] === 'appDataFolder') {
        const nuevoArchivo = { id: nuevoId('archivo'), name: metadatos.name, mimeType: mime, parents: ['appDataFolder'], properties: {}, owner: cuenta, bytes: contenido, mime, modifiedTime: new Date().toISOString() };
        estado.archivos.set(nuevoArchivo.id, nuevoArchivo);
        return json({ id: nuevoArchivo.id });
      }
      const padre = estado.archivos.get(metadatos.parents?.[0]);
      registro.padre = metadatos.parents?.[0] ?? null;
      if (!padre || rango(cuenta, padre) < RANGO.reader) return error(404, 'Parent not found');
      if (rango(cuenta, padre) < RANGO.writer) return error(403, 'El usuario no tiene permiso para crear archivos aquí');
      const nuevoArchivo = { id: nuevoId('archivo'), name: metadatos.name, mimeType: mime, parents: [padre.id], properties: {}, owner: cuenta, bytes: contenido, mime, modifiedTime: new Date().toISOString() };
      estado.archivos.set(nuevoArchivo.id, nuevoArchivo);
      return json({ id: nuevoArchivo.id });
    }
    // ---- mover (addParents / removeParents), sin volver a subir ----
    if (metodo === 'PATCH' && !subida && archivo) {
      const aAgregar = u.searchParams.get('addParents');
      const aQuitar = u.searchParams.get('removeParents');
      if (rango(cuenta, archivo) < RANGO.reader) return error(404, 'File not found');
      registro.padre = archivo.parents?.[0] ?? null;
      const destino = aAgregar ? estado.archivos.get(aAgregar) : null;
      if (rango(cuenta, archivo) < RANGO.writer || (aAgregar && (!destino || rango(cuenta, destino) < RANGO.writer))) return error(403, 'El usuario no tiene permiso para mover este archivo');
      archivo.parents = [...(archivo.parents ?? []).filter((p) => p !== aQuitar), ...(aAgregar ? [aAgregar] : [])];
      return json({ id });
    }
    // ---- reemplazar contenido ----
    if (metodo === 'PATCH' && subida) {
      if (!archivo || rango(cuenta, archivo) < RANGO.reader) return error(404, 'File not found');
      registro.padre = archivo.parents?.[0] ?? null;
      if (rango(cuenta, archivo) < RANGO.writer) return error(403, 'El usuario no tiene permiso para editar este archivo');
      archivo.bytes = await aBytes(opciones.body);
      archivo.mime = opciones.headers['Content-Type'];
      archivo.modifiedTime = new Date(Date.now() + (++contador)).toISOString(); // siempre distinto, para detectar cambios
      return json({ id });
    }
    // ---- borrar ----
    if (metodo === 'DELETE') {
      if (!archivo || rango(cuenta, archivo) < RANGO.reader) return error(404, 'File not found');
      registro.padre = archivo.parents?.[0] ?? null;
      if (rango(cuenta, archivo) < RANGO.writer) return error(403, 'El usuario no tiene permiso para borrar este archivo');
      estado.archivos.delete(id);
      return new Response(null, { status: 204 });
    }
    return error(400, 'petición no soportada');
  }

  async function fetchCon(token, url, opciones = {}) {
    if (estado.sinRed) throw new TypeError('Failed to fetch');
    const u = new URL(url);
    const metodo = (opciones.method ?? 'GET').toUpperCase();
    const registro = { cuenta: estado.tokens.get(token) ?? null, metodo, ruta: u.pathname, padre: null };
    estado.peticiones.push(registro);
    if (!registro.cuenta || opciones.headers?.Authorization !== `Bearer ${token}`) return error(401, 'no autorizado');
    return atender(registro.cuenta, metodo, u, opciones, registro);
  }

  return {
    estado,
    /** Una cuenta de Google: su token y un `fetch` que actúa como ella. */
    cuenta(email) {
      const correo = minuscula(email);
      const token = `token-${correo}`;
      estado.tokens.set(token, correo);
      return { email: correo, token, fetch: (url, opciones) => fetchCon(token, url, opciones), obtenerToken: async () => token };
    },
    /** Lo que hace falta para armar un cliente de la app que actúa como esa cuenta. */
    dep(email) {
      const c = this.cuenta(email);
      return { obtenerToken: c.obtenerToken, fetchFn: c.fetch };
    },
    /** El estado completo como texto plano (para compartirlo entre dos páginas de origen distinto en las pruebas del navegador). */
    exportar() {
      const aBase64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
      return {
        archivos: [...estado.archivos.values()].map((a) => ({ ...a, bytes: a.bytes ? aBase64(a.bytes) : null })),
        permisos: [...estado.permisos], tokens: [...estado.tokens], contador, avisos: estado.avisos,
      };
    },
    /** Carga un estado exportado (los tokens ya conocidos aquí se conservan). */
    importar(datos) {
      if (!datos?.archivos) return;
      estado.archivos.clear();
      for (const a of datos.archivos) {
        const bin = a.bytes ? atob(a.bytes) : null;
        estado.archivos.set(a.id, { ...a, bytes: bin ? Uint8Array.from(bin, (c) => c.charCodeAt(0)) : null });
      }
      estado.permisos.clear();
      for (const [k, v] of datos.permisos) estado.permisos.set(k, v);
      for (const [k, v] of datos.tokens) estado.tokens.set(k, v);
      contador = Math.max(contador, datos.contador ?? 0);
      estado.avisos = datos.avisos ?? [];
    },
    archivo: (id) => estado.archivos.get(id),
    hijos: (padreId) => [...estado.archivos.values()].filter((a) => a.parents?.[0] === padreId),
    porNombre: (nombre, padreId) => [...estado.archivos.values()].find((a) => a.name === nombre && (padreId === undefined || a.parents?.[0] === padreId)),
    json: (id) => JSON.parse(new TextDecoder().decode(estado.archivos.get(id).bytes)),
    /** Edita a mano el contenido de un archivo (como si alguien lo manipulara fuera de la app). */
    reescribir(id, texto) { estado.archivos.get(id).bytes = new TextEncoder().encode(typeof texto === 'string' ? texto : JSON.stringify(texto)); estado.archivos.get(id).modifiedTime = new Date(Date.now() + (++contador)).toISOString(); },
    /** Agrega un permiso a mano (p. ej. «cualquiera con el enlace»). */
    permitir(id, permiso) { estado.permisos.set(id, [...(estado.permisos.get(id) ?? []), { id: nuevoId('perm'), ...permiso }]); },
    permisosDe: (id) => permisosListados(estado.archivos.get(id)),
    reiniciarPeticiones: () => { estado.peticiones.length = 0; },
    peticionesDe: (email) => estado.peticiones.filter((p) => p.cuenta === minuscula(email)),
  };
}
