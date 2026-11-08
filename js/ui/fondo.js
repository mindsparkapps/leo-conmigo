// Fondo de la app: color, textura (siempre en blanco y negro) y transparencia de la textura.
// Es una preferencia de este dispositivo (localStorage), no del perfil: no se sincroniza.

export const TEXTURAS = [
  { id: 'ninguna', nombre: 'Sin textura', ruta: null },
  { id: 'tierra', nombre: 'Tierra', ruta: 'data/fondos/tierra.jpg' },
  { id: 'textura2', nombre: 'Textura 2', ruta: 'data/fondos/textura2.jpg' },
  { id: 'textura3', nombre: 'Textura 3', ruta: 'data/fondos/textura3.jpg' },
  { id: 'cielo', nombre: 'Cielo', ruta: 'data/fondos/cielo.jpg' },
  { id: 'agua', nombre: 'Agua', ruta: 'data/fondos/agua.avif' },
];

const CLAVE = 'leo_fondo';
export const FONDO_POR_DEFECTO = Object.freeze({ color: '#eaf4f9', alpha: 0.5, textura: 'ninguna' });

/** Deja una configuración válida aunque venga rota o incompleta. */
export function normalizarFondo(f = {}) {
  const color = /^#[0-9a-f]{6}$/i.test(f?.color ?? '') ? f.color.toLowerCase() : FONDO_POR_DEFECTO.color;
  const alpha = Number.isFinite(Number(f?.alpha)) ? Math.min(1, Math.max(0, Number(f.alpha))) : FONDO_POR_DEFECTO.alpha;
  const textura = TEXTURAS.some((t) => t.id === f?.textura) ? f.textura : FONDO_POR_DEFECTO.textura;
  return { color, alpha, textura };
}

export function leerFondo() {
  try {
    return normalizarFondo(JSON.parse(localStorage.getItem(CLAVE) ?? '{}'));
  } catch {
    return { ...FONDO_POR_DEFECTO };
  }
}

export function guardarFondo(fondo) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(normalizarFondo(fondo)));
  } catch {
    /* sin almacenamiento: el fondo vale solo hasta recargar */
  }
}

/** Pinta el fondo: el color en --fondo y la textura en una capa fija detrás de todo. */
export function aplicarFondo(fondo = leerFondo()) {
  const f = normalizarFondo(fondo);
  const raiz = document.documentElement;
  raiz.style.setProperty('--fondo', f.color);
  let capa = document.getElementById('fondo-textura');
  if (!capa) {
    capa = document.createElement('div');
    capa.id = 'fondo-textura';
    capa.setAttribute('aria-hidden', 'true');
    document.body.prepend(capa);
  }
  const textura = TEXTURAS.find((t) => t.id === f.textura);
  capa.style.backgroundImage = textura?.ruta ? `url("${textura.ruta}")` : 'none';
  capa.style.opacity = String(f.alpha);
}
