// Herramientas de desarrollador (modo adulto → Ajustes). Se guardan en este dispositivo y están apagadas por defecto.

const CLAVE_SALTAR = 'leo_dev_saltar_leccion';

/** Con esto encendido, «Jugar» se salta la lección y va directo a la pantalla del premio. */
export function saltarLeccionActivo() {
  try {
    return localStorage.getItem(CLAVE_SALTAR) === '1';
  } catch {
    return false;
  }
}

export function fijarSaltarLeccion(activo) {
  try {
    if (activo) localStorage.setItem(CLAVE_SALTAR, '1');
    else localStorage.removeItem(CLAVE_SALTAR);
  } catch { /* sin almacenamiento: queda apagado */ }
}
