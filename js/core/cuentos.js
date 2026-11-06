// Etapa 4 — lectura con comprensión (PLAN.md §3). Lógica pura, sin DOM.
//
// Un cuento es un libro (páginas de una frase) que además trae 1 o 2 preguntas. Al terminar de leerlo, el niño
// responde tocando la imagen de una palabra («¿Quién comió pan?» → papá). Como en todo lo demás, no hay error:
// la opción equivocada se atenúa y la correcta se ilumina. Aquí no se evalúa ni se guarda nada.

import { barajar } from './azar.js';
import { nuevaFrase, nuevoLibro, normalizarPregunta } from './modelos.js';
import { clavePalabra, siguienteOrden, tieneImagen } from './vocabulario.js';

export const MAX_PREGUNTAS = 2;
export const MAX_LARGO_PREGUNTA = 80;
export const MAX_OTRAS_OPCIONES = 3; // la correcta + hasta 3 = 4 opciones como máximo

const usable = (palabrasPorId, id) => {
  const p = palabrasPorId.get(id);
  return Boolean(p) && !p.deleted && tieneImagen(p);
};

/** Mensaje de error en español, o null si las preguntas se pueden guardar. */
export function validarPreguntas({ preguntas, palabrasPorId }) {
  if (preguntas.length > MAX_PREGUNTAS) return `Un cuento puede tener hasta ${MAX_PREGUNTAS} preguntas.`;
  for (const [i, q] of preguntas.entries()) {
    const n = i + 1;
    const texto = String(q.texto ?? '').trim();
    if (!texto) return `Escribe la pregunta ${n}.`;
    if (texto.length > MAX_LARGO_PREGUNTA) return `La pregunta ${n} es demasiado larga (máximo ${MAX_LARGO_PREGUNTA} letras).`;
    if (!q.correctaId) return `Elige la respuesta de la pregunta ${n}.`;
    if (!usable(palabrasPorId, q.correctaId)) return `La respuesta de la pregunta ${n} ya no está o no tiene imagen.`;
    const otras = q.distractorIds ?? [];
    if (otras.length < 1) return `La pregunta ${n} necesita al menos otra opción además de la respuesta.`;
    if (otras.length > MAX_OTRAS_OPCIONES) return `La pregunta ${n} puede tener hasta ${MAX_OTRAS_OPCIONES} opciones más.`;
    if (new Set([q.correctaId, ...otras]).size !== otras.length + 1) return `La pregunta ${n} repite una opción.`;
    if (!otras.every((id) => usable(palabrasPorId, id))) return `Una opción de la pregunta ${n} ya no está o no tiene imagen.`;
  }
  return null;
}

/**
 * Las preguntas de un cuento que todavía se pueden contestar: la respuesta existe y tiene imagen, y queda al menos
 * otra opción. Las opciones que ya no existen se quitan (la pregunta sigue con las que quedan).
 */
export function preguntasLeibles(libro, palabrasPorId) {
  const salida = [];
  for (const q of (libro.preguntas ?? []).map(normalizarPregunta)) {
    if (!q.texto || !usable(palabrasPorId, q.correctaId)) continue;
    const otras = [...new Set(q.distractorIds)].filter((id) => id !== q.correctaId && usable(palabrasPorId, id));
    if (otras.length) salida.push({ ...q, distractorIds: otras });
  }
  return salida;
}

/** Arma lo que se muestra: el texto y las opciones mezcladas (sin que la correcta caiga siempre en el mismo lugar). */
export function armarPregunta({ pregunta, aleatorio = Math.random }) {
  const ids = [pregunta.correctaId, ...pregunta.distractorIds];
  return {
    texto: pregunta.texto,
    correctaId: pregunta.correctaId,
    cartas: barajar(ids, aleatorio).map((id) => ({ id, forma: 'imagen' })),
  };
}

// ---------- cuentos de ejemplo ----------
//
// Una plantilla es { titulo, paginas: ['papá come pan', ...], preguntas: [{ texto, respuesta: 'papá', otras: ['mamá'] }] }
// escrita con TEXTOS de palabras. Solo se puede agregar si el niño tiene todas esas palabras (y las de las preguntas con imagen).

const palabrasDe = (texto) => String(texto).trim().split(/\s+/).filter(Boolean);

/** Palabras de la plantilla que el niño no tiene (o que no tienen imagen, si van en una pregunta). */
function palabrasQueFaltan(plantilla, porClave) {
  const faltan = new Set();
  for (const pagina of plantilla.paginas) {
    for (const texto of palabrasDe(pagina)) if (!porClave.get(clavePalabra(texto))) faltan.add(texto);
  }
  for (const q of plantilla.preguntas ?? []) {
    for (const texto of [q.respuesta, ...(q.otras ?? [])]) {
      const p = porClave.get(clavePalabra(texto));
      if (!p || !tieneImagen(p)) faltan.add(texto);
    }
  }
  return [...faltan];
}

const mapaPorClave = (palabras) => new Map(palabras.filter((p) => !p.deleted).map((p) => [clavePalabra(p.texto), p]));

/** Cada plantilla con las palabras que le faltan al niño: [{ plantilla, faltan, completa }]. */
export function plantillasDisponibles(plantillas, palabras) {
  const porClave = mapaPorClave(palabras);
  return plantillas.map((plantilla) => {
    const faltan = palabrasQueFaltan(plantilla, porClave);
    return { plantilla, faltan, completa: faltan.length === 0 };
  });
}

/**
 * Convierte una plantilla en frases y un libro con preguntas para ese niño. Reutiliza las frases que ya existen.
 * @returns { frasesNuevas, libro }  (todavía sin guardar)
 */
export function armarCuentoDesdePlantilla({ plantilla, perfilId, palabras, frases = [] }) {
  const porClave = mapaPorClave(palabras);
  const faltan = palabrasQueFaltan(plantilla, porClave);
  if (faltan.length) throw new Error(`Faltan palabras: ${faltan.join(', ')}.`);

  const frasesNuevas = [];
  const paginas = plantilla.paginas.map((texto) => {
    const lista = palabrasDe(texto).map((t) => porClave.get(clavePalabra(t)));
    const palabraIds = lista.map((p) => p.id);
    const clave = palabraIds.join('|');
    const existente = [...frases, ...frasesNuevas].find((f) => !f.deleted && f.palabraIds.join('|') === clave);
    if (existente) return { fraseId: existente.id };
    const frase = nuevaFrase({
      perfilId,
      palabraIds,
      texto: lista.map((p) => p.texto).join(' '),
      orden: siguienteOrden([...frases, ...frasesNuevas]),
    });
    frasesNuevas.push(frase);
    return { fraseId: frase.id };
  });

  const preguntas = (plantilla.preguntas ?? []).map((q) => ({
    texto: q.texto,
    correctaId: porClave.get(clavePalabra(q.respuesta)).id,
    distractorIds: (q.otras ?? []).map((t) => porClave.get(clavePalabra(t)).id),
  }));
  return { frasesNuevas, libro: nuevoLibro({ perfilId, titulo: plantilla.titulo, paginas, preguntas }) };
}
