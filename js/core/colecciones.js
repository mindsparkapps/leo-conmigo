// Álbumes cargados por el adulto (lógica pura, sin DOM).
//
// Un «álbum» es una colección de láminas con su portada y la imagen de su sobre. Hay siempre uno de la app (id 'base':
// las láminas de data/laminas/ y las calcomanías propias sueltas) y los que el adulto carga desde una carpeta de fotos.
// Los datos de los cargados viven en `perfil.colecciones` ([{ id, nombre, medioPortadaId, medioSobreId }]) y sus
// láminas son registros de `calcomaniasPropias` con `coleccionId` (así se dibujan, se ganan y se pegan igual que el resto).

import { CODIGOS_CATALOGO, codigoDePropia, codigosEnJuego } from './calcomanias.js';
import { nuevoId } from './id.js';

export const ID_BASE = 'base';
export const NOMBRE_BASE = 'Mi álbum';
export const MAX_OPCIONES_RECOMPENSA = 3;

/** Un color «#rrggbb» válido para el fondo de la tapa, o null (la tapa azul de siempre). */
export const colorDePortada = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null);

/** La lista de álbumes cargados del perfil, sin datos inválidos ni ids repetidos. */
export function normalizarColecciones(lista) {
  const vistos = new Set();
  const salida = [];
  for (const c of Array.isArray(lista) ? lista : []) {
    if (!c || typeof c.id !== 'string' || !c.id || c.id === ID_BASE || vistos.has(c.id)) continue;
    vistos.add(c.id);
    salida.push({
      id: c.id,
      nombre: String(c.nombre ?? '').trim() || 'Álbum',
      medioPortadaId: c.medioPortadaId ?? null,
      medioSobreId: c.medioSobreId ?? null,
      colorPortada: colorDePortada(c.colorPortada),
      ...(typeof c.creado === 'string' && c.creado ? { creado: c.creado } : {}), // los que ya existían no tienen fecha: cuentan como los más antiguos
    });
  }
  return salida;
}

/**
 * Un solo orden «por fecha de creación» para álbumes y premios del curso y de la familia (PLAN.md, fase 24, respuesta del usuario:
 * «todo mezclado»). Lo que no tiene `creado` (lo que ya existía) cuenta como lo más antiguo y conserva su orden de siempre
 * (`sinFecha` lo desempata: por defecto, el orden en que viene); lo nuevo va detrás, por fecha.
 */
export function ordenarPorCreacion(lista, sinFecha = () => 0) {
  const antiguos = lista.filter((x) => !x.creado).sort(sinFecha);
  const nuevos = lista.filter((x) => x.creado).sort((a, b) => String(a.creado).localeCompare(String(b.creado)));
  return [...antiguos, ...nuevos];
}

/**
 * Lo que el adulto cambió del álbum de la app (las láminas de GTA 6), en `perfil.base`: nombre y las dos portadas.
 * Sin cambios, el álbum conserva su nombre y su portada de siempre.
 */
export function normalizarBase(base) {
  return {
    nombre: String(base?.nombre ?? '').trim(),
    medioPortadaId: base?.medioPortadaId ?? null,
    medioSobreId: base?.medioSobreId ?? null,
    colorPortada: colorDePortada(base?.colorPortada),
    quitado: base?.quitado === true,
  };
}

export function nuevaColeccion({ nombre, medioPortadaId = null, medioSobreId = null, creado = new Date().toISOString() }) {
  const limpio = String(nombre ?? '').trim();
  if (!limpio) throw new Error('El álbum necesita un nombre');
  return { id: nuevoId(), nombre: limpio, medioPortadaId, medioSobreId, creado };
}

/** Láminas vigentes (calcomanías propias) de un álbum cargado. */
export const laminasDeColeccion = (propias, id) => propias.filter((p) => !p.deleted && p.coleccionId === id);

/**
 * Todos los álbumes que el niño puede usar, el de la app primero:
 * [{ id, nombre, codigos, medioPortadaId, medioSobreId, esBase }]. Un álbum cargado sin láminas no cuenta.
 * @param perfil     perfil activo (`album` y `colecciones`, que son del curso)
 * @param propias    todas las calcomanías propias del perfil (las del curso y las de la familia)
 * @param familiares los álbumes que agregó la familia (almacén `colecciones`, solo en el celular del alumno): `esFamilia: true`
 * El orden es uno solo, por fecha de creación (ver `ordenarPorCreacion`).
 */
export function listarColecciones({ perfil, propias = [], familiares = [] }) {
  const vigentes = propias.filter((p) => !p.deleted);
  const base = codigosEnJuego(perfil?.album, vigentes);
  const ajustesBase = normalizarBase(perfil?.base);
  const lista = [];
  const deLaFamilia = normalizarColecciones((familiares ?? []).filter((f) => !f.deleted)).map((c) => ({ ...c, esFamilia: true }));
  const cargadas = [...normalizarColecciones(perfil?.colecciones), ...deLaFamilia]
    .map((c) => ({ c, codigos: laminasDeColeccion(vigentes, c.id).map((p) => codigoDePropia(p.id)) })).filter((x) => x.codigos.length);
  // el álbum de la app se puede quitar, pero siempre queda al menos un álbum
  if (!ajustesBase.quitado || !cargadas.length) lista.push({
    id: ID_BASE,
    nombre: ajustesBase.nombre || NOMBRE_BASE,
    codigos: base.length ? base : [...CODIGOS_CATALOGO],
    medioPortadaId: ajustesBase.medioPortadaId,
    medioSobreId: ajustesBase.medioSobreId,
    colorPortada: ajustesBase.colorPortada,
    esBase: true,
  });
  for (const { c, codigos } of cargadas) lista.push({ ...c, codigos, esBase: false });
  return ordenarPorCreacion(lista); // el de la app y lo anterior primero, en su orden; lo nuevo (curso o familia) por fecha
}

/** Cuántas láminas de un álbum aún no están pegadas (las que no tiene y las que tiene sueltas). */
export function faltantesPorPegar(coleccion, calcomanias) {
  const pegadas = new Set(calcomanias.filter((c) => !c.deleted && c.pegada !== false).map((c) => c.codigo));
  const codigos = [...new Set(coleccion.codigos)];
  return codigos.filter((c) => !pegadas.has(c)).length;
}

/** Cuántas láminas de un álbum tiene el niño sueltas, listas para pegar ahora mismo (las que le faltan por ganar no cuentan). */
export function laminasPorPegar(coleccion, calcomanias) {
  const delAlbum = new Set(coleccion.codigos);
  const vivas = calcomanias.filter((c) => !c.deleted);
  const pegadas = new Set(vivas.filter((c) => c.pegada !== false).map((c) => c.codigo));
  const sueltas = new Set(vivas.filter((c) => c.pegada === false && delAlbum.has(c.codigo) && !pegadas.has(c.codigo)).map((c) => c.codigo));
  return sueltas.size;
}

/** ¿Ya tiene pegadas todas las láminas del álbum? Entonces no se le venden más sobres de ese álbum. */
export function coleccionCompleta(coleccion, calcomanias) {
  return Boolean(coleccion?.codigos?.length) && faltantesPorPegar(coleccion, calcomanias) === 0;
}

/** Hasta `max` álbumes distintos al azar para que el niño elija de cuál recibe su lámina. */
export function opcionesDeRecompensa(colecciones, aleatorio = Math.random, max = MAX_OPCIONES_RECOMPENSA) {
  const mezcladas = [...colecciones];
  for (let i = mezcladas.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [mezcladas[i], mezcladas[j]] = [mezcladas[j], mezcladas[i]];
  }
  return mezcladas.slice(0, max);
}
