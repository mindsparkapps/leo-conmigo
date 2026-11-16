// Controla si el modo adulto está habilitado en esta sesión.
// Se habilita solo al pasar el candado y se apaga al volver al modo niño.
//
// En el dispositivo de un ALUMNO (fase 18) no hay modo adulto nunca: `esAlumno()` lo bloquea todo, aunque
// `sessionStorage` diga lo contrario, y `habilitarAdulto()` no tiene efecto.

const CLAVE = 'leo_modo_adulto';
export const CLAVE_ROL = 'leo_rol'; // 'alumno' en el dispositivo de un alumno (en localStorage, para saberlo al instante)
let enMemoria = false;

/** ¿Este dispositivo es de un alumno? Se lee de `localStorage` para saberlo de inmediato, sin abrir la base. */
export function esAlumno() {
  try { return localStorage.getItem(CLAVE_ROL) === 'alumno'; } catch { return false; }
}

export function habilitarAdulto() {
  if (esAlumno()) return;
  enMemoria = true;
  try { sessionStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento: queda solo en memoria */ }
}

export function deshabilitarAdulto() {
  enMemoria = false;
  try { sessionStorage.removeItem(CLAVE); } catch { /* ignorar */ }
}

export function adultoHabilitado() {
  if (esAlumno()) return false;
  if (enMemoria) return true;
  try { return sessionStorage.getItem(CLAVE) === '1'; } catch { return false; }
}
