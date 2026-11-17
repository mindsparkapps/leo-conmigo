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

/** A dónde ir si no se puede: el alumno con el modo adulto abierto vuelve al panel reducido; los demás, al modo niño. */
export const destinoSiNoPasa = () => (esAlumno() && adultoHabilitado() ? '/adulto' : '/nino');
