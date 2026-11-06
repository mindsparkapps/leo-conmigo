// Copia de seguridad en un solo archivo JSON (PLAN.md §5, «Cuenta»). Lógica pura.
//
// Incluye TODO lo del niño, también las fotos y las voces (en base64): sin ellas, restaurar dejaría
// las palabras sin imagen ni sonido. Al restaurar no se borra nada: se suma lo que falta y, si un
// registro existe en los dos lados, gana el más reciente (`updatedAt`). Restaurar dos veces el mismo
// archivo no cambia nada.

export const FORMATO = 'leo-conmigo-respaldo';
export const VERSION_RESPALDO = 1;
export const ALMACENES_RESPALDO = Object.freeze([
  'medios', // primero: las demás cosas los usan
  'perfiles',
  'palabras',
  'progresos',
  'niveles',
  'frases',
  'libros',
  'sesiones',
  'calcomanias',
  'calcomaniasPropias',
  'premios',
  'movimientos',
]);

export class ErrorRespaldo extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorRespaldo';
  }
}

// ---------- base64 <-> Blob ----------

export async function blobABase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = '';
  const TROZO = 0x8000; // por partes, para no pasar el límite de argumentos de fromCharCode
  for (let i = 0; i < bytes.length; i += TROZO) binario += String.fromCharCode(...bytes.subarray(i, i + TROZO));
  return btoa(binario);
}

export function base64ABlob(base64, tipo) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

// ---------- armar y validar ----------

/**
 * @param almacenes  { perfiles: [...], palabras: [...], medios: [{..., blob}], ... } (sin los borrados)
 * @param meta       datos sueltos, p. ej. { perfilActivoId }
 */
export async function armarRespaldo({ almacenes, meta = {}, appVersion = null, ahora = new Date() }) {
  const salida = {};
  for (const nombre of ALMACENES_RESPALDO) {
    salida[nombre] = [];
    for (const registro of almacenes[nombre] ?? []) {
      if (registro.deleted) continue;
      if (nombre === 'medios') {
        const { blob, ...resto } = registro;
        if (!blob) continue; // un medio sin contenido no sirve de nada
        salida.medios.push({ ...resto, blobBase64: await blobABase64(blob), mime: resto.mime || blob.type });
      } else {
        salida[nombre].push(registro);
      }
    }
  }
  return { formato: FORMATO, version: VERSION_RESPALDO, appVersion, creado: ahora.toISOString(), meta, almacenes: salida };
}

/** Devuelve un mensaje de error en español, o null si el archivo parece un respaldo válido. */
export function validarRespaldo(datos) {
  if (!datos || typeof datos !== 'object' || datos.formato !== FORMATO) {
    return 'Este archivo no es una copia de seguridad de Leo Conmigo.';
  }
  if (!Number.isInteger(datos.version) || datos.version < 1) return 'La copia de seguridad está dañada: no tiene versión.';
  if (datos.version > VERSION_RESPALDO) {
    return 'Esta copia es de una versión más nueva de la aplicación. Actualiza la app e inténtalo de nuevo.';
  }
  if (!datos.almacenes || typeof datos.almacenes !== 'object') return 'La copia de seguridad está dañada: no trae datos.';
  for (const nombre of ALMACENES_RESPALDO) {
    const lista = datos.almacenes[nombre];
    if (lista === undefined) continue; // una copia puede no traer algunos almacenes
    if (!Array.isArray(lista)) return `La copia de seguridad está dañada (${nombre}).`;
    for (const r of lista) {
      if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id) {
        return `La copia de seguridad está dañada: hay un registro sin identificador (${nombre}).`;
      }
      if (nombre === 'medios' && typeof r.blobBase64 !== 'string') {
        return 'La copia de seguridad está dañada: falta el contenido de una imagen o un audio.';
      }
    }
  }
  return null;
}

/** Convierte las imágenes y audios de base64 a Blob. Lanza ErrorRespaldo si alguno no se puede leer. */
export function decodificarRespaldo(datos) {
  const error = validarRespaldo(datos);
  if (error) throw new ErrorRespaldo(error);
  const almacenes = {};
  for (const nombre of ALMACENES_RESPALDO) {
    almacenes[nombre] = (datos.almacenes[nombre] ?? []).map((r) => {
      if (nombre !== 'medios') return r;
      const { blobBase64, ...resto } = r;
      try {
        return { ...resto, blob: base64ABlob(blobBase64, r.mime ?? '') };
      } catch {
        throw new ErrorRespaldo('La copia de seguridad está dañada: una imagen o un audio no se puede leer.');
      }
    });
  }
  return { almacenes, meta: datos.meta ?? {} };
}

/**
 * Qué registros entrantes hay que escribir: los que no existen o son más recientes.
 * `existentes` debe incluir los borrados, para que una eliminación más nueva no se deshaga.
 * @returns { aEscribir, omitidos }
 */
export function fusionar(existentes, entrantes) {
  const porId = new Map(existentes.map((r) => [r.id, r]));
  const aEscribir = [];
  let omitidos = 0;
  for (const nuevo of entrantes) {
    const actual = porId.get(nuevo.id);
    if (!actual || (nuevo.updatedAt ?? '') > (actual.updatedAt ?? '')) aEscribir.push(nuevo);
    else omitidos += 1;
  }
  return { aEscribir, omitidos };
}
