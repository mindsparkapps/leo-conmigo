// Lógica pura del vocabulario de un perfil (PLAN.md §5 y §8): categorías, orden,
// sílabas editables y armado de las palabras del asistente de primer uso.

import { nuevaPalabra } from './modelos.js';

export const CATEGORIAS = Object.freeze([
  { id: 'personas', nombre: 'Personas' },
  { id: 'cuerpo', nombre: 'Cuerpo' },
  { id: 'comida', nombre: 'Comida' },
  { id: 'casa', nombre: 'Casa' },
  { id: 'animales', nombre: 'Animales' },
  { id: 'juguetes', nombre: 'Juguetes y cosas' },
  { id: 'enlace', nombre: 'Palabras de enlace' },
  { id: 'otras', nombre: 'Otras' },
]);

export const TIPOS = Object.freeze([
  { id: 'sustantivo', nombre: 'Palabra con dibujo' },
  { id: 'enlace', nombre: 'Palabra de enlace' },
]);

export const MAX_LARGO_PALABRA = 30;

/** ¿Se puede mostrar? Con foto/pictograma o, al menos, con emoji. */
export function tieneImagen(palabra) {
  return Boolean(palabra.medioImagenId || palabra.emoji);
}

/** ¿Tiene un símbolo (pictograma o emoji) además de su imagen? Hace falta para «misma cosa». */
export function tieneSimbolo(palabra) {
  return Boolean(palabra.medioSimboloId || palabra.emoji);
}

/** Pregunta hablada de la actividad «clasificar» (P3). Las categorías sin sentido para preguntar no tienen. */
export const PREGUNTAS_CATEGORIA = Object.freeze({
  personas: '¿Cuál es una persona?',
  cuerpo: '¿Cuál es una parte del cuerpo?',
  comida: '¿Cuál es una comida?',
  casa: '¿Cuál es algo de la casa?',
  animales: '¿Cuál es un animal?',
  juguetes: '¿Cuál es un juguete o una cosa?',
});

export const preguntaDeCategoria = (categoria) => PREGUNTAS_CATEGORIA[categoria] ?? null;

export function nombreDeCategoria(id) {
  return CATEGORIAS.find((c) => c.id === id)?.nombre ?? 'Otras';
}

/** Texto para buscar o comparar "a grandes rasgos": sin tildes, en minúscula y con los espacios normalizados. */
export function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Identidad de una palabra: sin importar mayúsculas ni espacios, pero SÍ las tildes
 * (para leer, «bebé» y «bebe» son palabras distintas).
 */
export function clavePalabra(texto) {
  return String(texto ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** ¿Ya hay una palabra con ese texto (sin importar mayúsculas; las tildes sí cuentan)? */
export function existeTexto(palabras, texto, { exceptoId = null } = {}) {
  const buscado = clavePalabra(texto);
  return palabras.some((p) => !p.deleted && p.id !== exceptoId && clavePalabra(p.texto) === buscado);
}

/** Valida el texto de una palabra. Devuelve un mensaje de error o null si está bien. */
export function validarTexto(texto, palabras = [], { exceptoId = null } = {}) {
  const limpio = String(texto ?? '').trim();
  if (!limpio) return 'Escribe la palabra.';
  if (limpio.length > MAX_LARGO_PALABRA) return `La palabra es demasiado larga (máximo ${MAX_LARGO_PALABRA} letras).`;
  if (existeTexto(palabras, limpio, { exceptoId })) return 'Esa palabra ya está en la lista.';
  return null;
}

/** 'ma-má' -> ['ma', 'má'] (acepta guiones, puntos medios y espacios). */
export function parsearSilabas(texto) {
  return String(texto ?? '')
    .split(/[-·.\s]+/)
    .filter(Boolean);
}

/** ¿Las sílabas, unidas, forman exactamente la palabra? (las tildes sí cuentan) */
export function silabasForman(silabas, texto) {
  const unidas = silabas.join('').toLowerCase();
  const palabra = String(texto ?? '').replace(/\s+/g, '').toLowerCase();
  return unidas.length > 0 && unidas === palabra;
}

export function siguienteOrden(palabras) {
  return palabras.reduce((max, p) => Math.max(max, (p.orden ?? 0) + 1), 0);
}

/** Palabras vigentes en el orden que fijó el adulto (el de introducción). */
export function ordenadas(palabras) {
  return palabras
    .filter((p) => !p.deleted)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.texto.localeCompare(b.texto, 'es'));
}

/**
 * Mueve una palabra `delta` posiciones (−1 sube, +1 baja) y devuelve solo los cambios
 * de orden necesarios: [{ id, orden }]. La numeración queda consecutiva (0, 1, 2, ...).
 */
export function mover(palabras, id, delta) {
  const lista = ordenadas([...palabras]);
  const desde = lista.findIndex((p) => p.id === id);
  if (desde === -1) return [];
  const hasta = Math.min(lista.length - 1, Math.max(0, desde + delta));
  const resultado = [...lista];
  const [movida] = resultado.splice(desde, 1);
  resultado.splice(hasta, 0, movida);
  return resultado
    .map((p, orden) => ({ id: p.id, orden, antes: p.orden }))
    .filter((c) => c.orden !== c.antes)
    .map(({ id: cid, orden }) => ({ id: cid, orden }));
}

/** [{ categoria: {id, nombre}, items: [...] }] en el orden de CATEGORIAS, sin categorías vacías. */
export function agruparPorCategoria(items) {
  const grupos = CATEGORIAS.map((categoria) => ({ categoria, items: [] }));
  const otras = grupos.find((g) => g.categoria.id === 'otras');
  for (const item of items) {
    (grupos.find((g) => g.categoria.id === item.categoria) ?? otras).items.push(item);
  }
  return grupos.filter((g) => g.items.length > 0);
}

/**
 * Arma las palabras que crea el asistente de primer uso, en este orden:
 * el nombre del niño, su gente y sus cosas, y las palabras elegidas del catálogo inicial.
 * Ignora filas vacías y palabras repetidas (con las que ya existen o entre sí).
 *
 * @param nino        { nombre, medioImagenId? }
 * @param personales  [{ texto, categoria?, medioImagenId?, emoji? }]
 * @param catalogo    entradas elegidas de data/vocabulario-inicial.json
 * @param existentes  palabras que el perfil ya tiene (para no repetir y seguir su orden)
 * @returns { palabras, omitidas }  `omitidas` son los textos que ya estaban
 */
export function armarPalabrasDelAsistente({ perfilId, nino, personales = [], catalogo = [], existentes = [] }) {
  const vistos = existentes.filter((p) => !p.deleted).map((p) => clavePalabra(p.texto));
  const palabras = [];
  const omitidas = [];
  let orden = siguienteOrden(existentes);

  const agregar = (datos) => {
    const texto = String(datos.texto ?? '').trim();
    if (!texto || texto.length > MAX_LARGO_PALABRA) return;
    const clave = clavePalabra(texto);
    if (vistos.includes(clave)) {
      omitidas.push(texto);
      return;
    }
    vistos.push(clave);
    palabras.push(nuevaPalabra({ perfilId, orden: orden++, ...datos, texto }));
  };

  if (nino?.nombre) agregar({ texto: nino.nombre, categoria: 'personas', medioImagenId: nino.medioImagenId ?? null });
  for (const p of personales) {
    agregar({
      texto: p.texto,
      categoria: p.categoria ?? 'personas',
      medioImagenId: p.medioImagenId ?? null,
      emoji: p.emoji ?? null,
    });
  }
  for (const c of catalogo) {
    agregar({
      texto: c.texto,
      silabas: c.silabas,
      categoria: c.categoria,
      tipo: c.tipo ?? 'sustantivo',
      emoji: c.emoji ?? null,
      busquedaPicto: c.arasaacBusqueda ?? null,
    });
  }
  return { palabras, omitidas };
}
