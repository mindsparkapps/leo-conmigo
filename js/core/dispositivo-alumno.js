// Reglas puras del dispositivo de un alumno (PLAN.md, fase 18). Sin red ni DOM.

export const HORAS_SIN_SYNC_PARA_VENTANA = 24; // más de esto sin sincronizar: la renovación puede abrir la ventana de Google
export const REVISAR_NOVEDADES_CADA_MS = 60_000;

/** ¿Una ruta es del modo adulto? (el alumno nunca llega a ellas). */
export const esRutaAdulta = (hash) => /^#?\/adulto(\/|$)/.test(String(hash ?? ''));

/** ¿Es la sesión de juego del niño? (ahí nunca se sincroniza ni se abre nada). */
export const esSesionDelNino = (hash) => /^#?\/nino\/sesion(\/|$|\?)/.test(String(hash ?? ''));

/**
 * Qué hacer con el token al tocar ▶ (sin hacer esperar al niño):
 *  - 'ninguna'     el token sirve;
 *  - 'silenciosa'  renovarlo sin que el niño vea nada;
 *  - 'interactiva' ya falló la silenciosa y lleva más de 24 h sin sincronizar: abrir la ventana de Google con el correo puesto.
 */
export function modoDeRenovacion({ tokenVigente, silenciosaFallo = false, ultimaSync = null, ahora = Date.now() }) {
  if (tokenVigente) return 'ninguna';
  const ultima = ultimaSync ? Date.parse(ultimaSync) : NaN;
  const horas = Number.isNaN(ultima) ? Infinity : (ahora - ultima) / 3_600_000;
  return silenciosaFallo && horas > HORAS_SIN_SYNC_PARA_VENTANA ? 'interactiva' : 'silenciosa';
}

/** ¿Se puede sincronizar ahora el dispositivo del alumno? Nunca durante la sesión del niño, y sin ventanas de Google. */
export function puedeSincronizarAlumno({ esAlumno, tieneAula, hash, enLinea, oculto, tokenVigente }) {
  return Boolean(esAlumno && tieneAula && enLinea && !oculto && tokenVigente && !esSesionDelNino(hash));
}

/**
 * Qué hacer con las aulas compartidas con este correo:
 * { tipo: 'ninguna', mensaje } | { tipo: 'una', aula } | { tipo: 'varias', aulas } (ordenadas por nombre).
 */
export function elegirAula(aulas, email) {
  const lista = [...(aulas ?? [])].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  if (!lista.length) return { tipo: 'ninguna', mensaje: `Pídele a tu adulto que invite a ${email}.` };
  if (lista.length === 1) return { tipo: 'una', aula: lista[0] };
  return { tipo: 'varias', aulas: lista };
}

/** Un dispositivo solo se convierte en dispositivo de alumno si no tiene perfiles. */
export const dispositivoVacio = (perfiles) => !(perfiles ?? []).some((p) => !p.deleted);

/**
 * El texto de la confirmación de «Convertir este dispositivo en celular de alumno» (borra todo lo del dispositivo).
 * @param pendientes  cambios que aún no se subieron a la nube personal
 */
export function textoConfirmarConversion({ pendientes = 0, sinCuenta = false } = {}) {
  const lineas = [
    '¿Convertir este dispositivo en celular de alumno?',
    '',
    'Se BORRARÁN de este dispositivo todos los perfiles, palabras, fotos, voces y progreso. No se puede deshacer.',
  ];
  if (sinCuenta) {
    lineas.push('', '¡Atención! Este dispositivo no está sincronizado con ninguna cuenta de Google: nada de lo que hay aquí está guardado en otro lado.');
  } else if (pendientes > 0) {
    lineas.push('', `¡Atención! Hay ${pendientes} ${pendientes === 1 ? 'cambio' : 'cambios'} que todavía NO se subieron a tu cuenta de Google: si sigues, se perderán.`);
  }
  lineas.push('', 'Antes, haz una copia de seguridad (Copia de seguridad) o comprueba que todo esté sincronizado en «Cuenta».', '', 'Después, el dispositivo pedirá entrar con el Gmail del alumno.');
  return lineas.join('\n');
}

/** ¿El adulto desvinculó este dispositivo? (`aula.json` lista los `idDispositivo` desvinculados). */
export const estaDesvinculado = (aulaJson, idDispositivo) => Array.isArray(aulaJson?.desvinculados) && aulaJson.desvinculados.includes(idDispositivo);

/**
 * Una «firma» de lo que el adulto tiene en el aula: `modifiedTime` de `adulto.json` y `aula.json` de su dueño.
 * Si cambia, hay novedades que bajar (una sola llamada de lista).
 */
export function firmaDelAdulto(archivos, duenoEmail) {
  const dueno = String(duenoEmail ?? '').trim().toLowerCase();
  return (archivos ?? [])
    .filter((a) => (a.name === 'adulto.json' || a.name === 'aula.json') && String(a.owners?.[0]?.emailAddress ?? '').toLowerCase() === dueno)
    .map((a) => `${a.id}:${a.modifiedTime}`).sort().join('|');
}
