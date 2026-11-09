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

const CLAVE_CAJAS = 'leo_dev_color_cajas';
const PREDETERMINADO = { fondo: '#ffffff', borde: '#6a8fa8' };

/** Colores de las cajas de la tienda (fondo y borde), elegidos en modo desarrollador. */
export function coloresDeCajas() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_CAJAS) ?? 'null');
    if (guardado && typeof guardado.fondo === 'string' && typeof guardado.borde === 'string') return guardado;
  } catch { /* se usan los de siempre */ }
  return null;
}

export const COLORES_CAJAS_PREDETERMINADOS = PREDETERMINADO;

/** Aplica los colores guardados (o los de la hoja de estilos si no hay). */
export function aplicarColoresDeCajas() {
  const c = coloresDeCajas();
  const raiz = document.documentElement.style;
  if (c) {
    raiz.setProperty('--caja-fondo', c.fondo);
    raiz.setProperty('--caja-borde', c.borde);
  } else {
    raiz.removeProperty('--caja-fondo');
    raiz.removeProperty('--caja-borde');
  }
}

export function fijarColoresDeCajas(colores) {
  try {
    if (colores) localStorage.setItem(CLAVE_CAJAS, JSON.stringify(colores));
    else localStorage.removeItem(CLAVE_CAJAS);
  } catch { /* sin almacenamiento: solo vale esta vez */ }
  aplicarColoresDeCajas();
}

export function fijarSaltarLeccion(activo) {
  try {
    if (activo) localStorage.setItem(CLAVE_SALTAR, '1');
    else localStorage.removeItem(CLAVE_SALTAR);
  } catch { /* sin almacenamiento: queda apagado */ }
}
