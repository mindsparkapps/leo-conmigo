// La cuenta de Google y la sincronización, vistas desde la app: un estado que las pantallas pueden mostrar
// y las acciones del adulto (iniciar sesión, sincronizar, cerrar sesión).
//
// Reglas:
//  - Primero local, luego la nube: nada de esto frena ni cambia lo que ve el niño.
//  - En modo niño NUNCA se abre una ventana de Google: solo se sincroniza si aún hay un token vigente.
//    Renovar la sesión (que puede abrir una ventana) solo ocurre con el modo adulto abierto.
//  - Se sincroniza al abrir, al volver la conexión, al volver a la app y unos segundos después de cada cambio.

import { crearAuth, ErrorCuenta } from './auth.js';
import { crearDrive, ErrorDrive } from './drive.js';
import { crearSincronizador } from './sync.js';
import { ErrorSync } from './core/sync.js';
import { obtenerStore } from './contexto.js';
import { adultoHabilitado, esAlumno } from './acceso.js';
import { crearAulas, ErrorAula } from './aulas.js';
import { VERSION } from './config.js';

const REVISAR_ALUMNOS_CADA_MS = 60_000; // ¿escribió algo el alumno? (una sola llamada de lista por aula)
const REVISAR_CADA_MS = 15_000;
const REINTENTAR_ERROR_MS = 60_000;
const ESPERA_INICIAL_MS = 2_000;

export const FASES = Object.freeze({
  SIN_CONFIGURAR: 'sin-configurar',
  SIN_CUENTA: 'sin-cuenta',
  SINCRONIZANDO: 'sincronizando',
  SINCRONIZADO: 'sincronizado',
  PENDIENTE: 'pendiente',
  SIN_CONEXION: 'sin-conexion',
  RECONECTAR: 'reconectar',
  ERROR: 'error',
});

const auth = crearAuth();
const oyentes = new Set();
let sincronizador = null;
let iniciada = false;
let ultimoError = 0;
let temporizador = null;

const estado = {
  fase: FASES.SIN_CUENTA,
  email: '',
  ultimo: null, // ISO de la última sincronización
  bytesDatos: 0, // tamaño del último data.json subido a Drive
  pendientes: 0,
  mensaje: '',
  progreso: '',
  resumen: null,
};

function publicar(cambios) {
  Object.assign(estado, cambios);
  for (const oyente of oyentes) oyente({ ...estado });
}

/** Suscribe a los cambios de estado. Devuelve la función para cancelar. */
export function observarNube(oyente) {
  oyentes.add(oyente);
  oyente({ ...estado });
  return () => oyentes.delete(oyente);
}

export const nubeConfigurada = () => auth.configurado();

/** La cuenta de Google de esta app (la comparte el dispositivo del alumno, js/nube-alumno.js). */
export const autenticacion = auth;

async function obtenerSincronizador() {
  if (sincronizador) return sincronizador;
  const store = await obtenerStore();
  const drive = crearDrive({ obtenerToken: (forzar) => auth.obtenerToken(forzar) });
  sincronizador = crearSincronizador({ store, drive, alProgreso: (texto) => publicar({ progreso: texto }) });
  return sincronizador;
}

/** Recalcula la fase en reposo (sin sincronizar) según la cuenta, la conexión y lo pendiente. */
export async function refrescarEstado() {
  if (esAlumno()) return; // el dispositivo del alumno solo usa el aula (js/nube-alumno.js), nunca la sincronización personal
  if (estado.fase === FASES.SINCRONIZANDO) return;
  const cuenta = auth.cuenta();
  if (!auth.configurado()) { publicar({ fase: FASES.SIN_CONFIGURAR, email: '', pendientes: 0 }); return; }
  if (!cuenta.vinculada) { publicar({ fase: FASES.SIN_CUENTA, email: '', pendientes: 0 }); return; }
  const store = await obtenerStore();
  const pendientes = (await store.pendientesSync()).length;
  const ultimo = (await store.leerMeta('syncUltimo')) ?? null;
  let fase = pendientes > 0 ? FASES.PENDIENTE : FASES.SINCRONIZADO;
  if (estado.fase === FASES.RECONECTAR || estado.fase === FASES.ERROR) fase = estado.fase; // sigue hasta que se arregle
  if (!navigator.onLine && fase !== FASES.RECONECTAR) fase = FASES.SIN_CONEXION;
  const bytesDatos = (await store.leerMeta('syncBytesDatos')) ?? 0;
  publicar({ fase, email: cuenta.email, pendientes, ultimo, bytesDatos });
}

function describir(error) {
  if (error instanceof ErrorDrive && error.sinConexion) return { fase: FASES.SIN_CONEXION, mensaje: '' };
  if ((error instanceof ErrorDrive && error.sesion) || (error instanceof ErrorCuenta && error.vuelveAIniciar)) {
    return { fase: FASES.RECONECTAR, mensaje: error.message };
  }
  if (error instanceof ErrorSync || error instanceof ErrorDrive || error instanceof ErrorCuenta) return { fase: FASES.ERROR, mensaje: error.message };
  console.error(error);
  return { fase: FASES.ERROR, mensaje: 'No se pudo sincronizar. Se intentará de nuevo más tarde.' };
}

// ---------------- las aulas de los alumnos (fase 17) ----------------
// Cada aula se sincroniza DESPUÉS de la sincronización personal, una por una, y un fallo en una no detiene a las demás
// ni a la personal. El estado de cada aula se ve en «Alumnos habilitados».

const oyentesAulas = new Set();
const estadoAulas = new Map(); // perfilId -> estado del aula
let aulasCreadas = null;
let aulasDe = '';
let temporizadorAlumnos = null;

const estadoAulaInicial = () => ({ fase: 'reposo', progreso: '', mensaje: '', ultimo: null, alumnos: [], permisosExtranos: [], avisos: [], descartados: 0 });

function publicarAula(perfilId, cambios) {
  estadoAulas.set(perfilId, { ...(estadoAulas.get(perfilId) ?? estadoAulaInicial()), ...cambios });
  const copia = new Map(estadoAulas);
  for (const oyente of oyentesAulas) oyente(copia);
}

/** Suscribe a los cambios de las aulas: oyente(Map perfilId -> { fase, progreso, mensaje, ultimo, alumnos, permisosExtranos, avisos, descartados }). */
export function observarAulas(oyente) {
  oyentesAulas.add(oyente);
  oyente(new Map(estadoAulas));
  return () => oyentesAulas.delete(oyente);
}

export const tienePermisoAulas = () => auth.tienePermisoAulas();

/** Pide el permiso de Drive del aula. Debe llamarse desde un toque del adulto. */
export const pedirPermisoAulas = () => auth.pedirPermisoAulas();

/** Las operaciones de aulas (crear, invitar, quitar acceso…) de la cuenta vinculada. */
export async function obtenerAulas() {
  const email = auth.cuenta().email;
  if (!aulasCreadas || aulasDe !== email) {
    const store = await obtenerStore();
    aulasDe = email;
    aulasCreadas = crearAulas({
      store,
      obtenerToken: (forzar) => auth.obtenerToken(forzar),
      emailAdulto: email,
      versionApp: VERSION,
      alProgreso: (texto) => {
        for (const [id, e] of estadoAulas) if (e.fase === 'sincronizando') publicarAula(id, { progreso: texto });
      },
    });
  }
  return aulasCreadas;
}

function textoDeErrorAula(error) {
  if (error instanceof ErrorDrive && error.sinConexion) return 'Sin conexión: se sincronizará al volver.';
  if (error instanceof ErrorSync || error instanceof ErrorDrive || error instanceof ErrorCuenta || error instanceof ErrorAula) return error.message;
  console.error(error);
  return 'No se pudo sincronizar el aula. Se intentará de nuevo más tarde.';
}

/** Sincroniza el aula de un perfil y deja su estado listo para la pantalla. Devuelve el resultado o null si falló. */
export async function sincronizarAulaAhora(perfilId) {
  publicarAula(perfilId, { fase: 'sincronizando', progreso: 'Preparando…', mensaje: '' });
  try {
    const r = await (await obtenerAulas()).sincronizarAula(perfilId);
    publicarAula(perfilId, {
      fase: 'reposo', progreso: '', mensaje: '', ultimo: r.resumen.fecha, alumnos: r.alumnos, permisosExtranos: r.permisosExtranos,
      avisos: r.resumen.avisos, descartados: r.resumen.descartados.total,
    });
    return r;
  } catch (error) {
    publicarAula(perfilId, { fase: 'error', progreso: '', mensaje: textoDeErrorAula(error) });
    return null;
  }
}

let temporizadorFondo = null;

/**
 * El fondo viaja a los alumnos en `aula.json`: cuando el adulto lo cambia se reescribe en cada aula (con una pausa, porque el
 * selector de color y la transparencia avisan muchas veces seguidas). No hace nada sin cuenta, sin el permiso del aula o
 * sin conexión; un fallo en un aula no detiene a las demás.
 */
export function publicarFondoEnAulas(fondo) {
  clearTimeout(temporizadorFondo);
  temporizadorFondo = setTimeout(async () => {
    try {
      if (esAlumno() || !navigator.onLine || !auth.configurado() || !auth.cuenta().vinculada || !auth.tienePermisoAulas()) return;
      const aulas = await obtenerAulas();
      for (const id of Object.keys(await aulas.listarAulas())) {
        try { await aulas.cambiarApariencia(id, fondo); } catch (error) { console.warn('No se pudo publicar el fondo en un aula:', error?.message ?? error); }
      }
    } catch (error) {
      console.warn('No se pudo publicar el fondo:', error?.message ?? error);
    }
  }, 1500);
}

/** Todas las aulas, una tras otra; nunca lanza. */
export async function sincronizarAulas() {
  try {
    if (!navigator.onLine || !auth.configurado() || !auth.cuenta().vinculada || !auth.tienePermisoAulas()) return;
    const ids = Object.keys(await (await obtenerAulas()).listarAulas());
    for (const id of ids) await sincronizarAulaAhora(id);
  } catch (error) {
    console.error(error);
  }
}

/** Cada 60 s: si el alumno escribió algo en su carpeta, se trae. */
async function revisarAlumnos() {
  try {
    if (esAlumno() || document.hidden || !navigator.onLine || !auth.configurado() || !auth.cuenta().vinculada || !auth.tienePermisoAulas()) return;
    if (location.hash.startsWith('#/nino/sesion')) return;
    if (!(auth.tokenVigente() || adultoHabilitado())) return;
    const aulas = await obtenerAulas();
    for (const id of Object.keys(await aulas.listarAulas())) {
      if (estadoAulas.get(id)?.fase === 'sincronizando') continue;
      try {
        if (await aulas.huboCambios(id)) await sincronizarAulaAhora(id);
      } catch (error) {
        publicarAula(id, { fase: 'error', mensaje: textoDeErrorAula(error) });
      }
    }
  } catch (error) {
    console.error(error);
  }
}

/** Sincroniza ahora: primero lo personal y después cada aula. Devuelve el resumen personal, o null si no se pudo. */
export async function sincronizarAhora() {
  if (esAlumno()) return null;
  const resumen = await sincronizarPersonal();
  await sincronizarAulas();
  return resumen;
}

/** Sincroniza ahora (solo lo personal). Devuelve el resumen, o null si no se pudo (el motivo queda en el estado). */
async function sincronizarPersonal() {
  const cuenta = auth.cuenta();
  if (!auth.configurado() || !cuenta.vinculada) { await refrescarEstado(); return null; }
  if (!navigator.onLine) { publicar({ fase: FASES.SIN_CONEXION, mensaje: '', progreso: '' }); return null; }
  publicar({ fase: FASES.SINCRONIZANDO, email: cuenta.email, mensaje: '', progreso: 'Preparando…' });
  try {
    const resumen = await (await obtenerSincronizador()).sincronizar();
    publicar({ fase: FASES.SINCRONIZADO, mensaje: '', progreso: '', resumen });
    await refrescarEstado();
    return resumen;
  } catch (error) {
    const { fase, mensaje } = describir(error);
    if (fase === FASES.ERROR) ultimoError = Date.now();
    publicar({ fase, mensaje, progreso: '' });
    if (fase === FASES.SIN_CONEXION) await refrescarEstado();
    return null;
  }
}

/** Abre la ventana de Google (llamar desde un toque del adulto) y sincroniza. */
export async function iniciarSesion({ cambiarCuenta = false } = {}) {
  publicar({ mensaje: '', progreso: '' });
  try {
    const usuario = await auth.iniciarSesion({ cambiarCuenta });
    publicar({ fase: FASES.PENDIENTE, email: usuario.email });
  } catch (error) {
    publicar({ fase: auth.cuenta().vinculada ? FASES.RECONECTAR : FASES.SIN_CUENTA, mensaje: error instanceof ErrorCuenta ? error.message : 'No se pudo iniciar sesión con Google.' });
    if (!(error instanceof ErrorCuenta)) console.error(error);
    return null;
  }
  return sincronizarAhora();
}

/** Cierra la sesión en este dispositivo. Los datos locales se quedan. */
export async function cerrarSesion() {
  auth.cerrarSesion();
  sincronizador = null;
  publicar({ fase: FASES.SIN_CUENTA, email: '', mensaje: '', progreso: '', pendientes: 0, resumen: null });
  await refrescarEstado();
}

function puedeSincronizarSola() {
  if (estado.fase === FASES.SINCRONIZANDO || estado.fase === FASES.RECONECTAR) return false;
  if (!auth.configurado() || !auth.cuenta().vinculada || !navigator.onLine) return false;
  if (location.hash.startsWith('#/nino/sesion')) return false; // no se interrumpe una sesión del niño
  if (estado.fase === FASES.ERROR && Date.now() - ultimoError < REINTENTAR_ERROR_MS) return false;
  // Sin modo adulto abierto no se puede renovar el token (podría abrir una ventana): solo si aún sirve
  return auth.tokenVigente() || adultoHabilitado();
}

async function revisar({ forzar = false } = {}) {
  if (document.hidden || esAlumno()) return;
  if (!puedeSincronizarSola()) { await refrescarEstado(); return; }
  const store = await obtenerStore();
  const hayPendientes = (await store.pendientesSync()).length > 0;
  const nunca = !(await store.leerMeta('syncUltimo'));
  if (forzar || hayPendientes || nunca) await sincronizarAhora();
  else await refrescarEstado();
}

/** Arranca las revisiones automáticas (una sola vez). */
export function iniciarNube() {
  if (iniciada) return;
  iniciada = true;
  window.addEventListener('online', () => revisar({ forzar: true }));
  window.addEventListener('offline', () => refrescarEstado());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) revisar({ forzar: true }); });
  temporizador = setInterval(() => revisar(), REVISAR_CADA_MS);
  temporizadorAlumnos = setInterval(() => revisarAlumnos(), REVISAR_ALUMNOS_CADA_MS);
  setTimeout(() => revisar({ forzar: true }), ESPERA_INICIAL_MS);
  refrescarEstado();
}

/** Para las pruebas: detiene el temporizador. */
export function detenerNube() {
  clearInterval(temporizador);
  clearInterval(temporizadorAlumnos);
  iniciada = false;
}

/** Color del punto de estado: 'ok' (todo al día), 'aviso' (hay algo en marcha o por hacer) o 'apagado'. */
export function clasePunto(fase) {
  switch (fase) {
    case FASES.SINCRONIZADO: return 'ok';
    case FASES.SINCRONIZANDO:
    case FASES.PENDIENTE:
    case FASES.RECONECTAR:
    case FASES.ERROR: return 'aviso';
    default: return 'apagado';
  }
}

/** Texto corto para mostrar el estado. */
export function textoDeEstado(e) {
  switch (e.fase) {
    case FASES.SIN_CONFIGURAR: return 'Falta configurar la cuenta de Google en la aplicación';
    case FASES.SIN_CUENTA: return 'Sin cuenta de Google';
    case FASES.SINCRONIZANDO: return e.progreso || 'Sincronizando…';
    case FASES.SINCRONIZADO: return 'Sincronizado';
    case FASES.PENDIENTE: return `Cambios por subir (${e.pendientes})`;
    case FASES.SIN_CONEXION: return 'Sin conexión: se sincronizará al volver';
    case FASES.RECONECTAR: return 'Hay que volver a iniciar sesión';
    case FASES.ERROR: return 'No se pudo sincronizar';
    default: return '';
  }
}
