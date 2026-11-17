// Núcleo puro del curso y de las fichas de alumno (PLAN.md, Ampliación 4, fase 20). Sin red ni DOM.
//
// Un PERFIL es un CURSO: define qué se ve (palabras, frases, libros, álbumes, ajustes). Varios alumnos usan el mismo
// perfil y cada uno tiene su propio avance: en el celular del adulto cada alumno es una FICHA (almacén `alumnos`) y sus
// registros (progresos, niveles, sesiones…) se guardan con `perfilId = id de la ficha`.
//
// Este módulo decide:
//  - qué campos del perfil son del curso y cuáles del alumno (`combinarPerfil`, `perfilPublicable`);
//  - cómo se pasan los registros de un alumno a su ficha (`aFicha`);
//  - cómo se separa el contenido que agregó la familia en el celular del alumno (`separarFamilia`).

import { normalizarAjustes, AJUSTES_POR_DEFECTO } from './modelos.js';
import { idNivel, idProgreso } from './progreso.js';
import { idPremioAlbum } from './album.js';

// ---------- qué es del curso y qué del alumno ----------

/** Campos del perfil que pone el adulto y que gana siempre en el celular del alumno. */
export const CAMPOS_DEL_CURSO = Object.freeze([
  'id', 'nombre', 'fotoMedioId', 'fechaNacimiento', 'creado',
  'album', // tamaño, monedas y calcomanías en juego (el estado de cada álbum se calcula de calcomanías y movimientos)
  'colecciones', 'base', // los álbumes disponibles: cargados y el de la app
]);

/** Campos del perfil que calcula el celular del alumno (solo mientras el ajuste siga en «Automático»). */
export const CAMPOS_DEL_ALUMNO = Object.freeze(['etapaActual', 'cambiosAutomaticos']);

/**
 * Los ajustes que la app cambia sola: ajuste -> clave que lo marca en `ajustes.automaticos`.
 * Mientras esa marca esté en «Automático» el valor es del alumno; si el adulto lo pone en «Lo elijo yo», gana el del curso.
 */
export const AJUSTES_DEL_ALUMNO = Object.freeze({
  ensayosPorSesion: 'ensayosPorSesion',
  maxOpciones: 'maxOpciones',
  palabrasNuevasPorSesion: 'palabrasNuevas',
});
/**
 * Lo mismo dentro de `ajustes.escritura` (Ampliación 5): el nivel y las palabras por sesión son del alumno mientras su marca esté en
 * «Automático». TODO lo demás de `ajustes.escritura` (habilitada, extras, forma de mover, color del error, niveles, banco…) es del curso.
 * Los niveles de sílabas extra no van aquí: viven en `niveles` (`<perfil>:E07`), que ya es del alumno.
 */
export const AJUSTES_DE_ESCRITURA_DEL_ALUMNO = Object.freeze({
  nivelEscritura: 'nivelEscritura',
  palabrasPorSesion: 'palabrasEscritura',
});
/** La etapa también es automática (`ajustes.automaticos.etapa`), pero vive fuera de `ajustes`: `perfil.etapaActual`. */
export const AUTOMATICO_DE_ETAPA = 'etapa';

/** Ajustes que pone siempre el adulto (todo lo que no es automático, más `automaticos`, que es la propia elección). */
export const AJUSTES_DEL_CURSO = Object.freeze(Object.keys(AJUSTES_POR_DEFECTO).filter((k) => !(k in AJUSTES_DEL_ALUMNO)));

const esObjeto = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const esRegistro = (r) => esObjeto(r) && typeof r.id === 'string' && r.id !== '';

/**
 * El perfil tal como lo ve el celular de un alumno: el curso manda, salvo en lo que el alumno calcula solo.
 * @param curso   el perfil del curso (lo que llega del adulto)
 * @param propio  el perfil guardado en el celular del alumno (o solo su parte: `perfilPublicable`); puede faltar
 */
export function combinarPerfil(curso, propio = null) {
  const ajustesCurso = normalizarAjustes(curso?.ajustes);
  const auto = ajustesCurso.automaticos;
  const propiosAjustes = esObjeto(propio?.ajustes) ? propio.ajustes : {};
  const ajustes = { ...ajustesCurso };
  for (const [clave, marca] of Object.entries(AJUSTES_DEL_ALUMNO)) {
    if (auto[marca] && propiosAjustes[clave] !== undefined) ajustes[clave] = propiosAjustes[clave];
  }
  const propiosEscritura = esObjeto(propiosAjustes.escritura) ? propiosAjustes.escritura : {};
  ajustes.escritura = { ...ajustesCurso.escritura };
  for (const [clave, marca] of Object.entries(AJUSTES_DE_ESCRITURA_DEL_ALUMNO)) {
    if (auto[marca] && propiosEscritura[clave] !== undefined) ajustes.escritura[clave] = propiosEscritura[clave];
  }
  const etapaActual = auto[AUTOMATICO_DE_ETAPA] && propio?.etapaActual !== undefined && propio?.etapaActual !== null
    ? propio.etapaActual
    : curso?.etapaActual ?? 1;
  return {
    ...curso,
    ajustes: normalizarAjustes(ajustes),
    etapaActual,
    cambiosAutomaticos: Array.isArray(propio?.cambiosAutomaticos) ? [...propio.cambiosAutomaticos] : [],
  };
}

/**
 * Lo que el celular del alumno publica de su perfil: solo lo suyo (los ajustes que están en «Automático», la etapa si
 * es automática y los avisos de cambios). Nada del curso: ni nombre, ni foto, ni álbumes, ni ajustes manuales.
 */
export function perfilPublicable(perfil) {
  const ajustes = normalizarAjustes(perfil?.ajustes);
  const propios = {};
  for (const [clave, marca] of Object.entries(AJUSTES_DEL_ALUMNO)) if (ajustes.automaticos[marca]) propios[clave] = ajustes[clave];
  const propiosEscritura = {};
  for (const [clave, marca] of Object.entries(AJUSTES_DE_ESCRITURA_DEL_ALUMNO)) if (ajustes.automaticos[marca]) propiosEscritura[clave] = ajustes.escritura[clave];
  if (Object.keys(propiosEscritura).length) propios.escritura = propiosEscritura;
  const salida = { id: perfil?.id, ajustes: propios };
  if (ajustes.automaticos[AUTOMATICO_DE_ETAPA]) salida.etapaActual = perfil?.etapaActual ?? 1;
  salida.cambiosAutomaticos = Array.isArray(perfil?.cambiosAutomaticos) ? [...perfil.cambiosAutomaticos] : [];
  if (perfil?.updatedAt !== undefined) salida.updatedAt = perfil.updatedAt;
  return salida;
}

// ---------- fichas de alumno ----------

const minuscula = (e) => String(e ?? '').trim().toLowerCase();
const esCorreo = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** El id de una ficha es determinista (curso + correo): dos dispositivos del adulto no crean fichas repetidas. */
export const idDeFicha = (cursoId, email) => `ficha:${cursoId}:${minuscula(email)}`;

/** Ficha de alumno: { id, cursoId, email, nombre, creado, estado }. `estado` es su `perfilPublicable` (o null). */
export function nuevaFicha({ cursoId, email, nombre = '', ahora = new Date() }) {
  if (typeof cursoId !== 'string' || !cursoId) throw new Error('La ficha necesita un curso');
  if (!esCorreo(email)) throw new Error('La ficha necesita un correo válido');
  const correo = minuscula(email);
  return {
    id: idDeFicha(cursoId, correo),
    cursoId,
    email: correo,
    nombre: String(nombre ?? '').trim() || correo.split('@')[0],
    creado: ahora.toISOString(),
    estado: null,
  };
}

/** La ficha de un correo en un curso (o null). */
export function fichaDeCorreo(fichas, { cursoId, email }) {
  return (fichas ?? []).find((f) => !f.deleted && f.cursoId === cursoId && minuscula(f.email) === minuscula(email)) ?? null;
}

/**
 * De qué perfil se leen palabras, frases y libros: el propio perfil, o el curso de una ficha.
 * (Las pantallas de estadísticas reciben un perfil o una ficha y piden el contenido con esto.)
 */
export const contenidoDe = (perfilOFicha) => {
  const id = perfilOFicha?.cursoId ?? perfilOFicha?.id;
  return typeof id === 'string' && id ? id : null;
};

// ---------- ficha de prueba (Ampliación 5: modo administrador de Escritura) ----------
// Lo que se juega «de prueba» se guarda con `perfilId = prueba:<perfilId>`: una ficha que lee el contenido del perfil real
// (`contenidoDe` → `cursoId`) y tiene sus propios progresos, niveles, sesiones, respuestas, calcomanías y movimientos. Nunca se
// mezcla con el avance real: ni cuenta para su autoajuste, ni se publica en el aula.

export const PREFIJO_PRUEBA = 'prueba:';

/** Id determinista de la ficha de prueba de un perfil. */
export const idDePrueba = (perfilId) => `${PREFIJO_PRUEBA}${perfilId}`;

/** ¿Es el id (de perfil o de ficha) de un perfil de prueba? */
export const esIdDePrueba = (id) => typeof id === 'string' && id.startsWith(PREFIJO_PRUEBA) && id.length > PREFIJO_PRUEBA.length;

/** El perfil real al que pertenece un id de prueba (o null si no lo es). */
export const perfilDePrueba = (id) => (esIdDePrueba(id) ? id.slice(PREFIJO_PRUEBA.length) : null);

/** La ficha de prueba de un perfil: sirve donde se pide un perfil o una ficha (`contenidoDe` da el perfil real). */
export function fichaDePrueba(perfil) {
  const cursoId = typeof perfil === 'string' ? perfil : perfil?.id;
  if (typeof cursoId !== 'string' || !cursoId) throw new Error('La ficha de prueba necesita un perfil');
  return { id: idDePrueba(cursoId), cursoId, nombre: 'Perfil de prueba', esPrueba: true, estado: null };
}

/** ¿Este registro (progreso, nivel, sesión, respuesta…) es de un perfil de prueba? */
export const esDePrueba = (registro) => esIdDePrueba(registro?.perfilId);

/** De una lista de registros, los de la prueba de ese perfil (para «Borrar los datos de prueba») o, sin perfil, todos los de prueba. */
export const registrosDePrueba = (registros, perfilId) => (registros ?? []).filter((r) => (perfilId === undefined ? esDePrueba(r) : r?.perfilId === idDePrueba(perfilId)));

/** Los almacenes con registros del alumno que el adulto guarda bajo la ficha. */
export const ALMACENES_DE_FICHA = Object.freeze(['progresos', 'niveles', 'sesiones', 'respuestas', 'calcomanias', 'movimientos']);

const ID_POR_ALMACEN = {
  progresos: (r, cursoId, fichaId) => (typeof r.elementoId === 'string' && typeof r.actividad === 'string'
    ? idProgreso(fichaId, r.elementoId, r.actividad)
    : cambiarPrefijo(r.id, `${cursoId}:`, `${fichaId}:`)),
  niveles: (r, cursoId, fichaId) => (typeof r.actividad === 'string' ? idNivel(fichaId, r.actividad) : cambiarPrefijo(r.id, `${cursoId}:`, `${fichaId}:`)),
  movimientos: (r, cursoId, fichaId) => (r.tipo === 'album'
    ? (Number.isFinite(Number(r.albumNumero)) ? idPremioAlbum(fichaId, r.albumNumero) : cambiarPrefijo(r.id, `album:${cursoId}:`, `album:${fichaId}:`))
    : r.id),
};

function cambiarPrefijo(id, de, a) {
  return id.startsWith(de) ? a + id.slice(de.length) : id;
}

/**
 * Pasa los registros que llegan del celular de un alumno (con `perfilId` = el curso) a su ficha: cambia `perfilId` y
 * rearma los ids que llevan el perfil (progresos, niveles y el premio de cada álbum), para que dos alumnos del mismo
 * curso no choquen. Lo que no sea de ese curso se descarta y se cuenta.
 * @param almacenes  { almacen: [registros] } (también `perfiles`: su registro del curso pasa a `estado`)
 * @returns {{ almacenes, estado, descartados }}  `estado`: el `perfilPublicable` del alumno (o null)
 */
export function aFicha(almacenes, { cursoId, fichaId }) {
  const salida = {};
  let descartados = 0;
  const entrada = esObjeto(almacenes) ? almacenes : {};
  for (const nombre of ALMACENES_DE_FICHA) {
    salida[nombre] = [];
    const lista = entrada[nombre];
    if (lista === undefined) continue;
    if (!Array.isArray(lista)) { descartados += 1; continue; }
    for (const r of lista) {
      if (!esRegistro(r) || r.perfilId !== cursoId) { descartados += 1; continue; }
      const id = ID_POR_ALMACEN[nombre] ? ID_POR_ALMACEN[nombre](r, cursoId, fichaId) : r.id;
      salida[nombre].push({ ...r, id, perfilId: fichaId });
    }
  }
  const perfil = (Array.isArray(entrada.perfiles) ? entrada.perfiles : []).find((p) => esRegistro(p) && p.id === cursoId && !p.deleted);
  for (const nombre of Object.keys(entrada)) {
    if (nombre === 'perfiles' || ALMACENES_DE_FICHA.includes(nombre)) continue;
    descartados += Array.isArray(entrada[nombre]) ? entrada[nombre].length : 1;
  }
  return { almacenes: salida, estado: perfil ? perfilPublicable(perfil) : null, descartados };
}

// ---------- contenido de la familia ----------

/** Los almacenes en que la familia puede agregar cosas propias (sus medios viajan aparte, en `familia/`). */
export const CLAVES_FAMILIA = Object.freeze(['palabras', 'frases', 'libros', 'calcomaniasPropias', 'premios', 'colecciones']);
export const ORIGEN_FAMILIA = 'familia';

const sinBlob = (r) => {
  const { blob, ...resto } = r;
  return resto;
};
const esDeFamilia = (r) => esObjeto(r) && r.origen === ORIGEN_FAMILIA;
const vacioFamilia = () => Object.fromEntries(CLAVES_FAMILIA.map((c) => [c, []]));

/**
 * Separa lo que agregó la familia en el celular del alumno de todo lo demás.
 * @param almacenes  { almacen: [registros] } del celular del alumno
 * @returns {{ delCurso, contenidoFamilia, mediosFamilia }}
 *   delCurso: lo mismo sin ningún registro con `origen: 'familia'` (el avance de sus palabras sí queda: va en `progresos`);
 *   contenidoFamilia: { palabras, frases, libros, calcomaniasPropias, premios } sin blobs ni medios;
 *   mediosFamilia: ids de los medios de la familia (sus blobs van a la carpeta `familia/`, nunca al aula).
 */
export function separarFamilia(almacenes) {
  const delCurso = {};
  const contenidoFamilia = vacioFamilia();
  const mediosFamilia = [];
  for (const [nombre, lista] of Object.entries(esObjeto(almacenes) ? almacenes : {})) {
    if (!Array.isArray(lista)) { delCurso[nombre] = lista; continue; }
    delCurso[nombre] = [];
    for (const r of lista) {
      if (!esDeFamilia(r)) { delCurso[nombre].push(r); continue; }
      if (CLAVES_FAMILIA.includes(nombre)) contenidoFamilia[nombre].push(sinBlob(r));
      else if (nombre === 'medios' && typeof r.id === 'string') mediosFamilia.push(r.id);
      // cualquier otro registro de la familia (p. ej. en `progresos`) no existe: se descarta
    }
  }
  return { delCurso, contenidoFamilia, mediosFamilia };
}

/**
 * Valida el `contenidoFamilia` que llega del celular de un alumno. Deja pasar solo registros con id y
 * `origen: 'familia'` (y, si se pasa `cursoId`, de ese curso), sin blobs, y solo las claves conocidas.
 * @returns {{ contenido, descartados }}  contenido siempre tiene las cinco claves
 */
export function limpiarContenidoFamilia(contenido, { cursoId } = {}) {
  const salida = vacioFamilia();
  let descartados = 0;
  if (contenido === undefined || contenido === null) return { contenido: salida, descartados };
  if (!esObjeto(contenido)) return { contenido: salida, descartados: 1 };
  for (const [nombre, lista] of Object.entries(contenido)) {
    if (!CLAVES_FAMILIA.includes(nombre)) { descartados += Array.isArray(lista) ? lista.length || 1 : 1; continue; }
    if (!Array.isArray(lista)) { descartados += 1; continue; }
    for (const r of lista) {
      const bueno = esRegistro(r) && r.origen === ORIGEN_FAMILIA && (cursoId === undefined || r.perfilId === cursoId);
      if (bueno) salida[nombre].push(sinBlob(r)); else descartados += 1;
    }
  }
  return { contenido: salida, descartados };
}

// ---------- escribir en el celular del alumno ----------

/** Lo que se marca como «de la familia» al guardarlo en el celular de un alumno (sus medios también). */
export const ALMACENES_DE_FAMILIA = Object.freeze([...CLAVES_FAMILIA, 'medios']);

export class ErrorCurso extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorCurso';
  }
}

/**
 * La regla de escritura del celular de un alumno: lo NUEVO es de la familia (`origen: 'familia'`), lo de la familia se puede
 * cambiar y borrar, y lo del curso (que viene del adulto) NO se toca. Devuelve el registro a guardar o lanza `ErrorCurso`.
 * @param previo  el registro que ya había con ese id (o undefined)
 */
export function aplicarOrigenDeFamilia(almacen, registro, previo) {
  if (!ALMACENES_DE_FAMILIA.includes(almacen)) return registro;
  if (previo && previo.origen !== ORIGEN_FAMILIA) throw new ErrorCurso('Esto es del curso: solo lo puede cambiar tu adulto.');
  return { ...registro, origen: ORIGEN_FAMILIA };
}

/** Los registros vivos de un almacén que la familia agregó, a partir de las filas del almacén `contenidoFamilia`. */
export const registrosDeFamilia = (filas, almacen, fichaId) => (filas ?? [])
  .filter((f) => !f.deleted && f.almacen === almacen && (fichaId === undefined || f.fichaId === fichaId) && f.registro && !f.registro.deleted)
  .map((f) => f.registro);

/**
 * Las filas del almacén `contenidoFamilia` del adulto: { id, fichaId, almacen, registro, updatedAt, deleted }.
 * Es solo para mostrar nombres en las estadísticas: nunca se mezcla con `palabras`, `frases` ni `libros`.
 */
export function filasDeContenidoFamilia({ fichaId, contenido }) {
  const filas = [];
  for (const nombre of CLAVES_FAMILIA) {
    for (const registro of contenido?.[nombre] ?? []) {
      filas.push({
        id: `${fichaId}:${nombre}:${registro.id}`,
        fichaId,
        almacen: nombre,
        registro,
        updatedAt: registro.updatedAt,
        deleted: registro.deleted === true,
      });
    }
  }
  return filas;
}
