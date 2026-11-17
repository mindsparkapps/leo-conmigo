// Controla si el modo adulto está habilitado en esta sesión.
// Se habilita solo al pasar el candado y se apaga al volver al modo niño.
//
// En el dispositivo de un ALUMNO (Ampliación 4, fase 24) el candado lleva al mismo panel del adulto pero con el menú REDUCIDO:
// qué rutas existen ahí lo decide `rutaPermitidaAlumno` (core/dispositivo-alumno.js) y lo aplica la guardia de app.js.

import { rutaPermitidaAlumno } from './core/dispositivo-alumno.js';

const CLAVE = 'leo_modo_adulto';
export const CLAVE_ROL = 'leo_rol'; // 'alumno' en el dispositivo de un alumno (en localStorage, para saberlo al instante)
let enMemoria = false;

/** ¿Este dispositivo es de un alumno? Se lee de `localStorage` para saberlo de inmediato, sin abrir la base. */
export function esAlumno() {
  try { return localStorage.getItem(CLAVE_ROL) === 'alumno'; } catch { return false; }
}

export function habilitarAdulto() {
  enMemoria = true;
  try { sessionStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento: queda solo en memoria */ }
}

export function deshabilitarAdulto() {
  enMemoria = false;
  try { sessionStorage.removeItem(CLAVE); } catch { /* ignorar */ }
}

export function adultoHabilitado() {
  if (enMemoria) return true;
  try { return sessionStorage.getItem(CLAVE) === '1'; } catch { return false; }
}

/** ¿Se puede abrir esta ruta del modo adulto ahora? (el alumno solo ve las del menú reducido). */
export function puedeAbrirRutaAdulta(ruta) {
  return adultoHabilitado() && (!esAlumno() || rutaPermitidaAlumno(ruta));
}

// ---------- administradores (Ampliación 5: funciones experimentales) ----------
// La lista de correos vive en `meta` (clave `administradores`; la edita la pantalla Cuenta, fase 30). `esAdministrador()` es síncrona
// para poder usarla al pintar: quien la necesite primero llama a `cargarAdministradores(store)`, que lee `meta` y la deja en memoria.
export const CLAVE_ADMINISTRADORES = 'administradores';
const CLAVE_CUENTA_GOOGLE = 'leo_cuenta_google'; // la misma que guarda auth.js: { email, ... }
let administradores = [];

const normalizarCorreo = (correo) => String(correo ?? '').trim().toLowerCase();

/** Pone la lista de administradores en memoria (la usa la pantalla Cuenta al editarla y `cargarAdministradores`). */
export function establecerAdministradores(lista) {
  administradores = [...new Set((Array.isArray(lista) ? lista : []).map(normalizarCorreo).filter(Boolean))];
}

/** Lee la lista de `meta` y la deja en memoria. Un fallo no la rompe: sin lista no hay administradores. */
export async function cargarAdministradores(store) {
  try {
    establecerAdministradores(await store.leerMeta(CLAVE_ADMINISTRADORES, []));
  } catch {
    establecerAdministradores([]);
  }
  return [...administradores];
}

/** Guarda la lista (con la fecha, para que la sincronización personal sepa cuál es la más reciente) y la deja en memoria. */
export async function guardarAdministradores(store, lista, ahora = new Date()) {
  establecerAdministradores(lista);
  await store.escribirMeta(CLAVE_ADMINISTRADORES, [...administradores]);
  await store.escribirMeta(`${CLAVE_ADMINISTRADORES}Fecha`, ahora.toISOString());
  return [...administradores];
}

/** El correo de la cuenta de Google con sesión iniciada en este dispositivo (o null). */
export function correoDeLaCuenta() {
  try {
    const cuenta = JSON.parse(localStorage.getItem(CLAVE_CUENTA_GOOGLE) ?? 'null');
    return typeof cuenta?.email === 'string' ? normalizarCorreo(cuenta.email) : null;
  } catch {
    return null;
  }
}

/** ¿La cuenta de Google con sesión es de un administrador? Sin sesión de Google, o en el dispositivo de un alumno, nunca. */
export function esAdministrador() {
  if (esAlumno()) return false;
  const correo = correoDeLaCuenta();
  return Boolean(correo) && administradores.includes(correo);
}

/** A dónde ir si no se puede: el alumno con el modo adulto abierto vuelve al panel reducido; los demás, al modo niño. */
export const destinoSiNoPasa = () => (esAlumno() && adultoHabilitado() ? '/adulto' : '/nino');
