// Modelos de datos y valores por defecto (PLAN.md §5 y §7). Lógica pura.

import { nuevoId } from './id.js';
import { silabear } from './silabas.js';
import { normalizarAlbum } from './album.js';
import { IDS_DE_NIVELES } from './escritura/niveles.js';

/** Ajustes del modo Escritura (Ampliación 5). Todo es del curso salvo `nivelEscritura` y `palabrasPorSesion` (los calcula el alumno). */
export const AJUSTES_ESCRITURA_POR_DEFECTO = Object.freeze({
  habilitada: false, // «Escritura (experimental)»: el niño ve el botón solo si está en true
  nivelEscritura: 'E01', // nivel actual (E01 a E20)
  palabrasPorSesion: 6, // 4 a 12
  maxSilabasExtra: 4, // sílabas que no son de la palabra: tope, 0 a 4
  silabasExtraManual: null, // con «Lo elijo yo»: número fijo de sílabas extra (null = el nivel automático)
  colorError: 'suave', // 'suave' (la pieza se atenúa) | 'rojo'
  formaDeMover: 'tocar', // 'tocar' | 'arrastrar'
  eleccionNino: 'alcanzados', // qué niveles puede elegir el niño: 'alcanzados' | 'todos' | 'ninguno'
  piezasOracion: 'palabras', // E18: 'palabras' | 'silabas'
  nivelesBloqueados: Object.freeze([]),
  nivelesForzados: Object.freeze([]),
  bancoApagado: Object.freeze([]), // ids `esc:<texto>` de palabras del banco que el adulto apagó
});

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
  avanceRapido: true, // fase 14: si acierta los 3 primeros ensayos de una actividad, queda dominada provisional
  palabrasNuevasPorSesion: 2, // fase 14: 1 o 2 (el tope del §2 sigue siendo 2)
  // fase 14: qué ajustes puede cambiar la app sola (true = «Automático», false = «Lo elijo yo»)
  automaticos: Object.freeze({
    ensayosPorSesion: true, maxOpciones: true, etapa: true, palabrasNuevas: true,
    nivelEscritura: true, palabrasEscritura: true, silabasExtra: true, // Ampliación 5
  }),
  escritura: AJUSTES_ESCRITURA_POR_DEFECTO,
});

export const AJUSTES_AUTOMATICOS = Object.freeze([
  'ensayosPorSesion', 'maxOpciones', 'etapa', 'palabrasNuevas', 'nivelEscritura', 'palabrasEscritura', 'silabasExtra',
]);

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
const entero = (valor, porDefecto) => (Number.isFinite(Number(valor)) ? Math.round(Number(valor)) : porDefecto);
const dentroDe = (valor, permitidos, porDefecto) => (permitidos.includes(valor) ? valor : porDefecto);

const listaDe = (valor, valido) => [...new Set((Array.isArray(valor) ? valor : []).filter(valido))];

/** Completa y acota los ajustes de escritura (nunca devuelve valores fuera de rango). */
export function normalizarAjustesEscritura(entrada) {
  const e = { ...AJUSTES_ESCRITURA_POR_DEFECTO, ...(entrada && typeof entrada === 'object' ? entrada : {}) };
  const esNivel = (id) => IDS_DE_NIVELES.includes(id);
  const crudo = e.silabasExtraManual;
  const manual = crudo === null || crudo === undefined || crudo === '' ? NaN : Number(crudo);
  const forzados = listaDe(e.nivelesForzados, esNivel).sort();
  return {
    habilitada: Boolean(e.habilitada),
    nivelEscritura: dentroDe(e.nivelEscritura, IDS_DE_NIVELES, 'E01'),
    palabrasPorSesion: limitar(entero(e.palabrasPorSesion, 6), 4, 12),
    maxSilabasExtra: limitar(entero(e.maxSilabasExtra, 4), 0, 4),
    silabasExtraManual: Number.isFinite(manual) ? limitar(Math.round(manual), 0, 4) : null,
    colorError: dentroDe(e.colorError, ['suave', 'rojo'], 'suave'),
    formaDeMover: dentroDe(e.formaDeMover, ['tocar', 'arrastrar'], 'tocar'),
    eleccionNino: dentroDe(e.eleccionNino, ['alcanzados', 'todos', 'ninguno'], 'alcanzados'),
    piezasOracion: dentroDe(e.piezasOracion, ['palabras', 'silabas'], 'palabras'),
    nivelesForzados: forzados,
    nivelesBloqueados: listaDe(e.nivelesBloqueados, esNivel).filter((id) => !forzados.includes(id)).sort(), // si hay duda, se abre
    bancoApagado: listaDe(e.bancoApagado, (id) => typeof id === 'string' && id !== '').sort(),
  };
}

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
  a.avanceRapido = a.avanceRapido !== false;
  a.palabrasNuevasPorSesion = limitar(entero(a.palabrasNuevasPorSesion, 2), 1, 2);
  const automaticos = a.automaticos && typeof a.automaticos === 'object' ? a.automaticos : {};
  a.automaticos = Object.fromEntries(AJUSTES_AUTOMATICOS.map((clave) => [clave, automaticos[clave] !== false]));
  a.escritura = normalizarAjustesEscritura(a.escritura);
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
