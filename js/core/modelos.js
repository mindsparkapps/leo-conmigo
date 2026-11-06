// Modelos de datos y valores por defecto (PLAN.md §5 y §7). Lógica pura.

import { nuevoId } from './id.js';
import { silabear } from './silabas.js';
import { normalizarAlbum } from './album.js';

export const AJUSTES_POR_DEFECTO = Object.freeze({
  ensayosPorSesion: 8, // 4 a 15
  maxOpciones: 4, // 2 a 4
  actividadesHabilitadas: null, // null = todas las de la etapa
  mayusculas: false,
  tamanoLetra: 'normal', // 'normal' | 'grande'
  velocidadVoz: 1, // 0.6 a 1.2
  sonido: true,
  vibracion: true,
  intensidadCelebracion: 'normal', // 'ninguna' | 'suave' | 'normal'
  altoContraste: false,
  habilitarL6: false, // «Leo en voz alta» (L6): el adulto confirma si el niño leyó bien
  etapasForzadas: [], // etapas que el adulto abre aunque aún no se alcance el umbral
  etapasBloqueadas: [], // etapas que el adulto cierra aunque se haya alcanzado el umbral
});

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
const entero = (valor, porDefecto) => (Number.isFinite(Number(valor)) ? Math.round(Number(valor)) : porDefecto);
const dentroDe = (valor, permitidos, porDefecto) => (permitidos.includes(valor) ? valor : porDefecto);

/** Completa y acota los ajustes de un perfil (nunca devuelve valores fuera de rango). */
export function normalizarAjustes(ajustes = {}) {
  const a = { ...AJUSTES_POR_DEFECTO, ...ajustes };
  a.ensayosPorSesion = limitar(entero(a.ensayosPorSesion, 8), 4, 15);
  a.maxOpciones = limitar(entero(a.maxOpciones, 4), 2, 4);
  a.actividadesHabilitadas =
    Array.isArray(a.actividadesHabilitadas) && a.actividadesHabilitadas.length ? [...a.actividadesHabilitadas] : null;
  a.tamanoLetra = dentroDe(a.tamanoLetra, ['normal', 'grande'], 'normal');
  a.intensidadCelebracion = dentroDe(a.intensidadCelebracion, ['ninguna', 'suave', 'normal'], 'normal');
  a.velocidadVoz = limitar(Number.isFinite(Number(a.velocidadVoz)) ? Number(a.velocidadVoz) : 1, 0.6, 1.2);
  a.mayusculas = Boolean(a.mayusculas);
  a.sonido = Boolean(a.sonido);
  a.vibracion = Boolean(a.vibracion);
  a.altoContraste = Boolean(a.altoContraste);
  a.habilitarL6 = Boolean(a.habilitarL6);
  const etapas = (lista) => [...new Set((Array.isArray(lista) ? lista : []).map(Number).filter((e) => [0, 1, 2, 3].includes(e)))].sort();
  a.etapasForzadas = etapas(a.etapasForzadas);
  a.etapasBloqueadas = etapas(a.etapasBloqueadas).filter((e) => !a.etapasForzadas.includes(e)); // si hay duda, se abre
  return a;
}

export function nuevoPerfil({ nombre, fotoMedioId = null, fechaNacimiento = null, etapaActual = 1, ajustes = {}, album = {} }) {
  if (!String(nombre ?? '').trim()) throw new Error('El perfil necesita un nombre');
  return {
    id: nuevoId(),
    nombre: String(nombre).trim(),
    fotoMedioId,
    fechaNacimiento,
    ajustes: normalizarAjustes(ajustes),
    album: normalizarAlbum(album), // tamaño del álbum, monedas por álbum y calcomanías en juego (fase 11)
    etapaActual,
    creado: new Date().toISOString(),
  };
}

export function nuevaPalabra({
  perfilId,
  texto,
  silabas,
  categoria = 'otras',
  tipo = 'sustantivo',
  medioImagenId = null,
  arasaacId = null,
  emoji = null,
  medioAudioId = null,
  medioSimboloId = null, // pictograma guardado AL LADO de la foto (para «misma cosa»: foto → símbolo)
  busquedaPicto = null, // texto con el que se busca su pictograma (p. ej. «coche» para «auto»)
  orden = 0,
  activa = true,
}) {
  const limpio = String(texto ?? '').trim();
  if (!limpio) throw new Error('La palabra necesita texto');
  if (!perfilId) throw new Error('La palabra necesita un perfil');
  return {
    id: nuevoId(),
    perfilId,
    texto: limpio,
    silabas: silabas && silabas.length ? [...silabas] : silabear(limpio),
    categoria,
    tipo,
    medioImagenId,
    arasaacId,
    emoji,
    medioAudioId,
    medioSimboloId,
    busquedaPicto,
    orden,
    activa,
  };
}

/** Una frase corta armada con palabras del niño. `texto` es esas palabras unidas con espacios. */
export function nuevaFrase({ perfilId, palabraIds, texto, medioImagenId = null, orden = 0, activa = true }) {
  if (!perfilId) throw new Error('La frase necesita un perfil');
  if (!Array.isArray(palabraIds) || palabraIds.length < 2) throw new Error('Una frase necesita al menos dos palabras');
  const limpio = String(texto ?? '').trim();
  if (!limpio) throw new Error('La frase necesita texto');
  return { id: nuevoId(), perfilId, palabraIds: [...palabraIds], texto: limpio, medioImagenId, orden, activa };
}

/** Una pregunta de comprensión de un cuento: se responde tocando la imagen de una palabra. */
export function normalizarPregunta(pregunta) {
  return {
    texto: String(pregunta.texto ?? '').trim(),
    correctaId: pregunta.correctaId,
    distractorIds: [...(pregunta.distractorIds ?? [])],
  };
}

/**
 * Un libro: título y páginas { medioImagenId (foto de la página, opcional), fraseId }.
 * Con `preguntas` ({ texto, correctaId, distractorIds }) es un cuento: al final el niño responde por imagen.
 */
export function nuevoLibro({ perfilId, titulo, paginas = [], preguntas = [] }) {
  if (!perfilId) throw new Error('El libro necesita un perfil');
  const limpio = String(titulo ?? '').trim();
  if (!limpio) throw new Error('El libro necesita un título');
  return {
    id: nuevoId(),
    perfilId,
    titulo: limpio,
    paginas: paginas.map((p) => ({ medioImagenId: p.medioImagenId ?? null, fraseId: p.fraseId })),
    preguntas: preguntas.map(normalizarPregunta),
    creado: new Date().toISOString(),
  };
}
