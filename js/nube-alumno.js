// La nube del DISPOSITIVO DE UN ALUMNO (PLAN.md, fase 18). Su única nube es el aula (js/aulas.js); nunca usa la sincronización
// personal (appDataFolder) ni muestra pantallas de estado: el niño ve su pantalla tranquila y lo nuevo aparece en su lugar.
//
// Reglas:
//  - Nunca se sincroniza durante `#/nino/sesion`, ni sin conexión, ni sin un token vigente, ni con la app oculta.
//  - Nunca se abre una ventana de Google por cuenta propia: el token se renueva al TOCAR ▶ (un toque deja abrir la ventana),
//    en silencio; solo si ya falló y lleva más de 24 h sin sincronizar, ese toque abre la ventana con el correo puesto.
//  - Se sincroniza al abrir, al volver la conexión, al volver a la app, al volver al inicio o al premio (terminó una sesión)
//    y cuando, cada 60 s, `adulto.json` o `aula.json` cambiaron en Drive.

import { autenticacion as auth } from './nube.js';
import { ErrorCuenta } from './auth.js';
import { crearAulas } from './aulas.js';
import { crearDrive } from './drive.js';
import { crearSincronizador } from './sync.js';
import { CLAVE_ROL, esAlumno } from './acceso.js';
import { fijarPerfilActivo, obtenerStore } from './contexto.js';
import { borrarBD } from './store.js';
import { aplicarFondo, guardarFondo } from './ui/fondo.js';
import { pedirAlmacenamientoPersistente } from './hardware.js';
import { nuevoId } from './core/id.js';
import { VERSION } from './config.js';
import { REVISAR_NOVEDADES_CADA_MS, elegirAula, modoDeRenovacion, puedeSincronizarAlumno } from './core/dispositivo-alumno.js';

const CLAVE_ID = 'leo_id_dispositivo';
const CLAVE_ULTIMA_SYNC = 'leo_alumno_ultima_sync';
const CLAVE_CUENTA = 'leo_cuenta_google';
const META_AULA = 'alumnoAula';
const ESPERA_INICIAL_MS = 2_000;
const ESPERA_AL_VOLVER_MS = 1_500;

const leer = (clave) => { try { return localStorage.getItem(clave); } catch { return null; } };
const escribir = (clave, valor) => { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } };
const quitar = (clave) => { try { localStorage.removeItem(clave); } catch { /* sin almacenamiento */ } };

/** El identificador de este dispositivo (se crea la primera vez y se olvida al borrar sus datos). */
export function idDispositivo() {
  let id = leer(CLAVE_ID);
  if (!id) { id = nuevoId(); escribir(CLAVE_ID, id); }
  return id;
}

let aulasSinVentana = null;
let aulasConVentana = null;
let silenciosaFallo = false;
let enCurso = null;
let temporizador = null;
let iniciada = false;

async function obtenerAulasAlumno({ conVentana = false, alProgreso = () => {} } = {}) {
  const store = await obtenerStore();
  const comunes = { store, idDispositivo: idDispositivo(), nombreDispositivo: `Dispositivo ${idDispositivo().slice(0, 4)}`, versionApp: VERSION, alProgreso };
  if (conVentana) {
    aulasConVentana = crearAulas({ ...comunes, obtenerToken: (forzar) => auth.obtenerToken(forzar) });
    return aulasConVentana;
  }
  // Fuera de la configuración nunca se abre una ventana: si el token no sirve, no se sincroniza
  aulasSinVentana ??= crearAulas({
    ...comunes,
    alProgreso: (t) => alProgreso(t),
    obtenerToken: async () => {
      if (!auth.tokenVigente()) throw new ErrorCuenta('No hay una sesión de Google vigente.', { vuelveAIniciar: true });
      return auth.obtenerToken(false);
    },
  });
  return aulasSinVentana;
}

export async function aulaGuardada() {
  return (await (await obtenerStore()).leerMeta(META_AULA)) ?? null;
}

/**
 * Primer uso, tras un toque: marca el dispositivo como de alumno (así la sincronización personal no corre), pide el
 * permiso de Google con la cuenta del alumno y busca las aulas compartidas con ese Gmail.
 * @returns {{ email, eleccion }} eleccion = resultado de `elegirAula`
 */
export async function entrarComoAlumno() {
  escribir(CLAVE_ROL, 'alumno');
  try {
    await auth.pedirPermisoAulas();
    return await buscarAulasDelAlumno();
  } catch (error) {
    if (!(await aulaGuardada())) quitar(CLAVE_ROL); // no se llegó a configurar: el dispositivo sigue como nuevo
    throw error;
  }
}

/**
 * El respaldo del alumno en SU PROPIO Drive (`appDataFolder`, la misma sincronización personal de js/sync.js, con la cuenta del alumno):
 * su avance, lo que agregó su familia y las fotos y voces de esa familia. Los medios del curso (Biblioteca) y del catálogo no se suben.
 * Al reinstalar y entrar con su Gmail se baja primero esto (recupera su avance) y después el curso. Un fallo aquí nunca frena el aula.
 */
async function respaldarAlumno({ conVentana = false, alProgreso = () => {} } = {}) {
  try {
    const store = await obtenerStore();
    const obtenerToken = conVentana
      ? (forzar) => auth.obtenerToken(forzar)
      : async () => {
        if (!auth.tokenVigente()) throw new ErrorCuenta('No hay una sesión de Google vigente.', { vuelveAIniciar: true });
        return auth.obtenerToken(false);
      };
    return await crearSincronizador({ store, drive: crearDrive({ obtenerToken }), alProgreso }).sincronizar();
  } catch (error) {
    console.warn('El respaldo del alumno no se pudo hacer (se intentará de nuevo):', error?.message ?? error);
    return null;
  }
}

/** Busca (otra vez) las aulas compartidas con la cuenta que ya inició sesión. */
export async function buscarAulasDelAlumno() {
  const email = auth.cuenta().email;
  const aulas = await (await obtenerAulasAlumno({ conVentana: true })).buscarMiAula();
  return { email, eleccion: elegirAula(aulas, email) };
}

/**
 * Descarga completa del aula (se puede repetir: si se corta, al volver retoma). Al terminar el dispositivo queda como de
 * alumno: `meta.rol`, perfil activo y almacenamiento persistente.
 */
export async function descargarAula(aula, alProgreso = () => {}) {
  const store = await obtenerStore();
  escribir(CLAVE_ROL, 'alumno');
  await store.escribirMeta(META_AULA, aula); // desde aquí, un corte se retoma con el mismo aula
  // Primero lo propio (si el alumno reinstala, recupera su avance y lo de su familia); después el curso
  alProgreso('Buscando tu avance guardado…');
  await respaldarAlumno({ conVentana: true, alProgreso });
  const aulas = await obtenerAulasAlumno({ conVentana: true, alProgreso });
  const r = await aulas.sincronizarComoAlumno({ aula, email: auth.cuenta().email });
  if (r.desvinculado) {
    await olvidarTodo({ recargar: false });
    throw new Error('El adulto desvinculó este dispositivo. Pídele que lo vuelva a invitar.');
  }
  if (!(await store.obtener('perfiles', aula.perfilId))) throw new Error('El aula todavía no tiene los datos del niño. Pídele a tu adulto que la sincronice.');
  aplicarApariencia(r.aula);
  await fijarPerfilActivo(aula.perfilId);
  await store.escribirMeta('rol', 'alumno');
  escribir(CLAVE_ULTIMA_SYNC, r.fecha);
  pedirAlmacenamientoPersistente();
  await respaldarAlumno({ conVentana: true }); // y se guarda lo de ahora en su Drive
  return r;
}

/** El fondo del aula (`aula.json`) lo aplica el alumno; los colores de desarrollo no viajan. */
function aplicarApariencia(aulaJson) {
  const fondo = aulaJson?.apariencia?.fondo;
  if (!fondo) return;
  guardarFondo(fondo);
  aplicarFondo(fondo);
}

/** Borra todo lo de este dispositivo y lo deja como recién instalado (desvinculado, o primer uso cancelado). */
export async function olvidarTodo({ recargar = true } = {}) {
  try { auth.cerrarSesion(); } catch { /* ya no sirve de nada */ }
  try { (await obtenerStore()).cerrar(); } catch { /* la base puede no abrir */ }
  await borrarBD();
  for (const clave of [CLAVE_ROL, CLAVE_ID, CLAVE_ULTIMA_SYNC, CLAVE_CUENTA, 'leo_permiso_aulas', 'leo_fondo']) quitar(clave);
  try { sessionStorage.clear(); } catch { /* ignorar */ }
  aulasSinVentana = null;
  aulasConVentana = null;
  if (recargar) { location.hash = '#/nino'; location.reload(); }
}

/**
 * Convierte este dispositivo (del adulto) en dispositivo de alumno: borra TODO lo suyo y lleva al primer uso, ya en el camino
 * «Este dispositivo es de un alumno». La confirmación la pide quien llama.
 */
export async function convertirEnDispositivoDeAlumno() {
  await olvidarTodo({ recargar: false });
  escribir(CLAVE_ROL, 'alumno'); // al recargar, el primer uso ya pide entrar con el Gmail del alumno
  location.hash = '#/nino';
  location.reload();
}

/** Sincroniza ahora (sin ventanas ni avisos). Devuelve el resumen o null si no se pudo (nunca lanza). */
export async function sincronizarAlumno() {
  if (enCurso) return enCurso;
  enCurso = (async () => {
    try {
      const aula = await aulaGuardada();
      if (!puedeSincronizar(aula)) return null;
      const r = await (await obtenerAulasAlumno()).sincronizarComoAlumno({ aula, email: auth.cuenta().email });
      if (r.desvinculado) { await olvidarTodo(); return null; }
      aplicarApariencia(r.aula);
      escribir(CLAVE_ULTIMA_SYNC, r.fecha);
      await respaldarAlumno(); // su avance y lo de su familia, en su propio Drive
      return r;
    } catch (error) {
      console.warn('El aula no se pudo sincronizar (se intentará de nuevo):', error?.message ?? error);
      return null;
    } finally {
      enCurso = null;
    }
  })();
  return enCurso;
}

function puedeSincronizar(aula) {
  return puedeSincronizarAlumno({
    esAlumno: esAlumno(), tieneAula: Boolean(aula), hash: location.hash, enLinea: navigator.onLine, oculto: document.hidden, tokenVigente: auth.tokenVigente(),
  });
}

/**
 * Al tocar ▶: renueva el token SIN hacer esperar al niño (la sesión empieza igual). Es un toque, así que el navegador
 * deja abrir la ventana de Google (que se cierra sola). Si falla y lleva más de 24 h sin sincronizar, el siguiente
 * toque abre la ventana con el correo del alumno ya puesto.
 */
export function alTocarJugar() {
  if (!esAlumno()) return;
  const modo = modoDeRenovacion({ tokenVigente: auth.tokenVigente(), silenciosaFallo, ultimaSync: leer(CLAVE_ULTIMA_SYNC) });
  if (modo === 'ninguna') return;
  auth.renovarAlTocar({ interactiva: modo === 'interactiva' }).then(() => { silenciosaFallo = false; }).catch(() => { silenciosaFallo = true; });
}

/** Cada 60 s: si `adulto.json` o `aula.json` cambiaron en Drive, se baja lo nuevo. */
async function revisarNovedades() {
  try {
    const aula = await aulaGuardada();
    if (!puedeSincronizar(aula) || enCurso) return;
    if (await (await obtenerAulasAlumno()).huboCambiosDelAdulto(aula)) await sincronizarAlumno();
  } catch (error) {
    console.warn('No se pudo revisar el aula:', error?.message ?? error);
  }
}

/** Arranca las sincronizaciones automáticas del alumno (una sola vez). Si el dispositivo no es de un alumno, no hace nada. */
export function iniciarNubeAlumno() {
  if (iniciada || !esAlumno()) return;
  iniciada = true;
  const intentar = () => { sincronizarAlumno(); };
  window.addEventListener('online', intentar);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) intentar(); });
  // Al terminar una sesión el niño llega al premio y luego al inicio: ahí se sube lo que jugó
  window.addEventListener('hashchange', () => {
    if (/^#\/nino(\/premio)?$/.test(location.hash)) setTimeout(intentar, ESPERA_AL_VOLVER_MS);
  });
  temporizador = setInterval(revisarNovedades, REVISAR_NOVEDADES_CADA_MS);
  setTimeout(intentar, ESPERA_INICIAL_MS);
}

/** Para las pruebas. */
export function detenerNubeAlumno() {
  clearInterval(temporizador);
  iniciada = false;
}
