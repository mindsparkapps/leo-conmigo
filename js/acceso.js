// Controla si el modo adulto está habilitado en esta sesión.
// Se habilita solo al pasar el candado y se apaga al volver al modo niño.

const CLAVE = 'leo_modo_adulto';
let enMemoria = false;

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
