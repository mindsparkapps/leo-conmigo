// Envoltorios del hardware del dispositivo: cámara/galería, micrófono, vibración y
// almacenamiento persistente. Todo detecta si hay soporte y, si no, explica por qué
// en español: nunca debe romper la app.

export class ErrorHardware extends Error {
  /** codigo: 'sin-soporte' | 'permiso-denegado' | 'sin-dispositivo' | 'ocupado' | 'otro' */
  constructor(codigo, mensaje, causa) {
    super(mensaje);
    this.name = 'ErrorHardware';
    this.codigo = codigo;
    this.causa = causa;
  }
}

/** Qué puede hacer este navegador/dispositivo. */
export function soporte(entorno = globalThis) {
  const nav = entorno.navigator ?? {};
  return {
    contextoSeguro: entorno.isSecureContext !== false,
    microfono: Boolean(nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === 'function'),
    grabacion: typeof entorno.MediaRecorder !== 'undefined',
    sintesisVoz: typeof entorno.speechSynthesis !== 'undefined' && typeof entorno.SpeechSynthesisUtterance !== 'undefined',
    vibracion: typeof nav.vibrate === 'function',
    almacenamientoPersistente: Boolean(nav.storage && typeof nav.storage.persist === 'function'),
  };
}

/** null si se puede grabar audio; si no, el motivo explicado al adulto. */
export function motivoSinGrabacion(s = soporte()) {
  if (!s.contextoSeguro) {
    return 'La grabación de voz solo funciona en una conexión segura (https).';
  }
  if (!s.microfono || !s.grabacion) {
    return 'Este navegador no permite grabar audio.';
  }
  return null;
}

const MIMES_AUDIO = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];

/** Primer formato de audio que acepte el navegador ('' = que elija él). */
export function elegirMime(esSoportado) {
  return MIMES_AUDIO.find((tipo) => {
    try {
      return Boolean(esSoportado(tipo));
    } catch {
      return false;
    }
  }) ?? '';
}

/** Convierte un error de getUserMedia/MediaRecorder en uno con mensaje claro. */
export function traducirErrorMedia(error) {
  if (error instanceof ErrorHardware) return error;
  const nombre = error?.name ?? '';
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError' || nombre === 'PermissionDeniedError') {
    return new ErrorHardware(
      'permiso-denegado',
      'El navegador no tiene permiso para usar el micrófono. Actívalo en los ajustes del sitio y vuelve a intentarlo.',
      error,
    );
  }
  if (nombre === 'NotFoundError' || nombre === 'DevicesNotFoundError' || nombre === 'OverconstrainedError') {
    return new ErrorHardware('sin-dispositivo', 'No se encontró ningún micrófono en este dispositivo.', error);
  }
  if (nombre === 'NotReadableError' || nombre === 'AbortError' || nombre === 'TrackStartError') {
    return new ErrorHardware('ocupado', 'No se pudo usar el micrófono: puede que otra aplicación lo esté usando.', error);
  }
  if (nombre === 'TypeError') {
    return new ErrorHardware('sin-soporte', 'Este navegador no permite grabar audio.', error);
  }
  return new ErrorHardware('otro', `No se pudo grabar el audio${nombre ? ` (${nombre})` : ''}.`, error);
}

/**
 * Prepara una grabadora de voz. Pide permiso del micrófono (puede lanzar ErrorHardware).
 * `obtenerStream` y `MediaRecorderImpl` se pueden inyectar para probarla sin micrófono.
 *
 *   const g = await crearGrabadora();
 *   g.iniciar(() => ...llegó al límite...);
 *   const { blob, mime, ms } = await g.detener();   // o await g.cancelar() -> null
 */
export async function crearGrabadora({ maxMs = 8000, obtenerStream, MediaRecorderImpl } = {}) {
  if (!obtenerStream) {
    const motivo = motivoSinGrabacion();
    if (motivo) throw new ErrorHardware('sin-soporte', motivo);
  }

  let stream;
  try {
    stream = await (obtenerStream ? obtenerStream() : navigator.mediaDevices.getUserMedia({ audio: true }));
  } catch (error) {
    throw traducirErrorMedia(error);
  }

  const Grabador = MediaRecorderImpl ?? MediaRecorder;
  const mime = elegirMime((tipo) => Grabador.isTypeSupported?.(tipo));
  let grabador;
  try {
    grabador = new Grabador(stream, mime ? { mimeType: mime } : undefined);
  } catch (error) {
    stream.getTracks().forEach((t) => t.stop());
    throw traducirErrorMedia(error);
  }

  const trozos = [];
  let inicio = 0;
  let temporizador = null;
  let cancelada = false;
  let resolverFin;
  let rechazarFin;
  const fin = new Promise((resolver, rechazar) => {
    resolverFin = resolver;
    rechazarFin = rechazar;
  });
  const soltarMicrofono = () => stream.getTracks().forEach((t) => t.stop());

  grabador.ondataavailable = (e) => {
    if (e.data && e.data.size) trozos.push(e.data);
  };
  grabador.onerror = (e) => {
    clearTimeout(temporizador);
    soltarMicrofono();
    rechazarFin(traducirErrorMedia(e.error ?? e));
  };
  grabador.onstop = () => {
    clearTimeout(temporizador);
    soltarMicrofono();
    if (cancelada) { resolverFin(null); return; }
    const tipo = grabador.mimeType || mime || 'audio/webm';
    resolverFin({ blob: new Blob(trozos, { type: tipo }), mime: tipo, ms: Date.now() - inicio });
  };

  return {
    mime,
    get grabando() {
      return grabador.state === 'recording';
    },
    iniciar(alLlegarAlLimite) {
      inicio = Date.now();
      grabador.start();
      temporizador = setTimeout(() => {
        if (grabador.state === 'recording') grabador.stop();
        alLlegarAlLimite?.();
      }, maxMs);
    },
    detener() {
      if (grabador.state !== 'inactive') grabador.stop();
      return fin;
    },
    cancelar() {
      cancelada = true;
      if (grabador.state !== 'inactive') grabador.stop();
      else { soltarMicrofono(); resolverFin(null); }
      return fin;
    },
  };
}

/** Abre la cámara o la galería y devuelve el archivo elegido (null si se cancela). Llamar desde un toque. */
export function elegirImagen({ camara = false } = {}) {
  return new Promise((resolver) => {
    const entrada = document.createElement('input');
    entrada.type = 'file';
    entrada.accept = 'image/*';
    if (camara) entrada.setAttribute('capture', 'environment');
    entrada.style.display = 'none';
    entrada.addEventListener('change', () => {
      const archivo = entrada.files?.[0] ?? null;
      entrada.remove();
      resolver(archivo);
    });
    entrada.addEventListener('cancel', () => {
      entrada.remove();
      resolver(null);
    });
    document.body.append(entrada);
    entrada.click();
  });
}

/** Abre el selector de archivos y devuelve el archivo elegido (null si se cancela). Llamar desde un toque. */
export function elegirArchivo({ accept = '' } = {}) {
  return new Promise((resolver) => {
    const entrada = document.createElement('input');
    entrada.type = 'file';
    if (accept) entrada.accept = accept;
    entrada.style.display = 'none';
    entrada.addEventListener('change', () => {
      const archivo = entrada.files?.[0] ?? null;
      entrada.remove();
      resolver(archivo);
    });
    entrada.addEventListener('cancel', () => {
      entrada.remove();
      resolver(null);
    });
    document.body.append(entrada);
    entrada.click();
  });
}

/** Descarga un archivo (Blob) con el nombre dado. */
export function descargarArchivo(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.style.display = 'none';
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Copia un texto al portapapeles. true si se pudo; false si el navegador no lo permite. Llamar desde un toque. */
export async function copiarTexto(texto) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch { /* se prueba el otro método */ }
  try {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const bien = document.execCommand('copy');
    area.remove();
    return bien;
  } catch {
    return false;
  }
}

/** Vibración breve; no hace nada si el dispositivo no la tiene (p. ej. iPhone). */
export function vibrar(patron = 40) {
  try {
    if (typeof navigator.vibrate === 'function') return navigator.vibrate(patron);
  } catch { /* ignorar */ }
  return false;
}

/** Pide que el navegador no borre los datos de la app. true/false, o null si no hay soporte. */
export async function pedirAlmacenamientoPersistente() {
  if (!navigator.storage || typeof navigator.storage.persist !== 'function') return null;
  try {
    if (typeof navigator.storage.persisted === 'function' && (await navigator.storage.persisted())) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
