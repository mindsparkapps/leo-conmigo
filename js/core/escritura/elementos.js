// Qué se puede escribir y a qué nivel va cada cosa (Ampliación 5, fase 28). Lógica pura, sin DOM.
//
// Un «elemento» de escritura es lo que se arma en una sesión: una palabra (E01–E17, E20), una oración (E18) o la palabra
// que falta de un texto (E19). Sale de dos fuentes: las palabras del perfil (clasificadas solas por `nivelDe`, con su foto y su
// voz) y el banco incluido (`data/escritura/banco.json`). Las del perfil van primero y las del banco completan; si una palabra
// está en las dos, gana la del perfil.
//
// Elemento: { id, texto, silabas, nivel, origen: 'perfil'|'banco', palabra, activa, orden, ... }
//   `palabra` es lo que recibe `armarPiezas`: `{ texto, silabas }` o, en una oración, `{ texto, palabras: [{ texto, silabas }] }`.
//   El id es el de la palabra del perfil o `esc:<texto>` en el banco (`idDeBanco`): el progreso va en (id, nivel).

import { tieneImagen } from '../vocabulario.js';
import { IDS_DE_NIVELES, indiceDeNivel, nivelDe, nivelSiguiente } from './niveles.js';
import { PREFIJO_BANCO, idDeBanco } from './comun.js';

export const MIN_PALABRAS_POR_NIVEL = 3; // un nivel con menos palabras disponibles se salta solo
export const NIVEL_DICTADO = 'E20';
export const NIVEL_ORACIONES = 'E18';
export const NIVEL_TEXTOS = 'E19';

const minuscula = (t) => String(t ?? '').trim().toLowerCase();

/**
 * Todos los elementos de escritura de un perfil.
 * @param palabras      palabras del perfil (`{ id, texto, silabas, emoji, medioImagenId, activa, deleted, orden, origen }`)
 * @param frases        frases del perfil (`{ id, palabraIds, texto, activa }`): son las oraciones de `E18`
 * @param banco         el contenido de `data/escritura/banco.json` (`{ palabras, frases, textos }`)
 * @param bancoApagado  ids `esc:<texto>` de las palabras del banco que el adulto apagó
 */
export function elementosDeEscritura({ palabras = [], frases = [], banco = {}, bancoApagado = [] } = {}) {
  const apagadas = new Set(bancoApagado);
  const salida = [];
  let orden = 0;
  const agregar = (e) => salida.push({ activa: true, ...e, orden: orden++ });

  const vivas = palabras.filter((p) => !p.deleted && p.activa !== false && tieneImagen(p));
  const porId = new Map(palabras.filter((p) => !p.deleted).map((p) => [p.id, p]));
  const textosDelPerfil = new Set(vivas.map((p) => minuscula(p.texto)));

  // 1. Las palabras del perfil, cada una en el nivel de su rasgo más alto
  for (const p of vivas) {
    const silabas = p.silabas?.length ? p.silabas : null;
    const nivel = nivelDe(silabas ?? p);
    if (!nivel || nivel === 'E01') continue;
    agregar({ ...p, nivel, origen: p.origen ?? 'perfil', palabra: { texto: p.texto, silabas: silabas ?? undefined } });
  }
  // 2. Las del banco (las vocales de E01 siempre; las demás, salvo que el perfil ya tenga la palabra o el adulto la apagara)
  for (const b of banco.palabras ?? []) {
    const id = idDeBanco(b);
    if (b.nivel !== 'E01' && textosDelPerfil.has(minuscula(b.texto))) continue;
    agregar({
      id, texto: b.texto, silabas: b.silabas, nivel: b.nivel, origen: 'banco', emoji: b.emoji, arasaacBusqueda: b.arasaacBusqueda,
      voz: b.voz ?? null, modelo: b.modelo ?? null, palabra: { texto: b.texto, silabas: b.silabas }, activa: !apagadas.has(id),
    });
  }
  // 3. Oraciones (E18): las frases del perfil y las del banco
  for (const f of frases) {
    if (f.deleted || f.activa === false) continue;
    const partes = (f.palabraIds ?? []).map((id) => porId.get(id));
    if (partes.some((p) => !p)) continue; // una palabra borrada: la frase no se puede armar
    agregar({
      ...f, nivel: NIVEL_ORACIONES, origen: f.origen ?? 'perfil', esFrase: true,
      palabra: { texto: f.texto, palabras: partes.map((p) => ({ texto: p.texto, silabas: p.silabas?.length ? p.silabas : undefined })) },
    });
  }
  for (const f of banco.frases ?? []) {
    agregar({
      id: `${PREFIJO_BANCO}frase:${minuscula(f.texto)}`, texto: f.texto, nivel: NIVEL_ORACIONES, origen: 'banco', esFrase: true,
      emoji: f.emoji, arasaacBusqueda: f.arasaacBusqueda, palabra: { texto: f.texto, palabras: f.palabras },
    });
  }
  // 4. Textos (E19): una palabra que falta y se arma con sílabas
  for (const t of banco.textos ?? []) {
    agregar({
      id: `${PREFIJO_BANCO}texto:${t.id}`, texto: t.falta.texto, silabas: t.falta.silabas, nivel: NIVEL_TEXTOS, origen: 'banco', esTexto: true,
      frases: t.frases, emoji: t.emoji, arasaacBusqueda: t.arasaacBusqueda, palabra: { texto: t.falta.texto, silabas: t.falta.silabas },
    });
  }
  // 5. Dictados (E20): las mismas palabras de E02–E17, pero sin imagen (solo audio). El progreso va aparte (actividad E20).
  const dictables = salida.filter((e) => !e.esFrase && !e.esTexto && e.nivel !== 'E01');
  for (const e of dictables) {
    salida.push({ ...e, nivel: NIVEL_DICTADO, dictado: true, orden: orden++ });
  }
  return salida;
}

/** Cuántos elementos activos hay en cada nivel: `{ E01: n, … }` (todos los niveles, con 0 si no hay). */
export function palabrasPorNivel(elementos) {
  const cuenta = Object.fromEntries(IDS_DE_NIVELES.map((id) => [id, 0]));
  for (const e of elementos) if (e.activa !== false && !e.deleted && e.nivel in cuenta) cuenta[e.nivel] += 1;
  return cuenta;
}

/** Niveles con al menos `MIN_PALABRAS_POR_NIVEL` elementos disponibles, en orden. */
export function nivelesDisponibles(elementos, minimo = MIN_PALABRAS_POR_NIVEL) {
  const cuenta = palabrasPorNivel(elementos);
  return IDS_DE_NIVELES.filter((id) => cuenta[id] >= minimo);
}

/**
 * El nivel que se practica hoy: el que fijó el adulto o el automático (`nivelEscritura`); si está bloqueado o no tiene palabras
 * suficientes se salta al siguiente que sí (y, si no hay ninguno más arriba, al anterior). `null` si no hay ningún nivel posible.
 * Un nivel forzado cuenta como abierto aunque tenga pocas palabras.
 */
export function nivelEfectivo({ nivelEscritura = 'E01', disponibles, bloqueados = [], forzados = [] }) {
  const abiertos = IDS_DE_NIVELES.filter((id) => forzados.includes(id) || (disponibles.includes(id) && !bloqueados.includes(id)));
  if (!abiertos.length) return null;
  const desde = indiceDeNivel(nivelEscritura);
  return abiertos.find((id) => indiceDeNivel(id) >= desde) ?? abiertos[abiertos.length - 1];
}

/** El siguiente nivel abierto después de `nivel` (o null si no hay ninguno). */
export function siguienteNivelAbierto({ nivel, disponibles, bloqueados = [], forzados = [] }) {
  for (let id = nivelSiguiente(nivel); id; id = nivelSiguiente(id)) {
    if (forzados.includes(id) || (disponibles.includes(id) && !bloqueados.includes(id))) return id;
  }
  return null;
}

/**
 * Qué niveles puede elegir el niño desde el menú de la pantalla: `eleccionNino` 'ninguno' → ninguno; 'todos' → todos los abiertos;
 * 'alcanzados' → el actual y los anteriores (más los forzados).
 */
export function nivelesElegibles({ eleccionNino = 'alcanzados', nivelActual, disponibles, bloqueados = [], forzados = [] }) {
  if (eleccionNino === 'ninguno') return [];
  const abiertos = IDS_DE_NIVELES.filter((id) => forzados.includes(id) || (disponibles.includes(id) && !bloqueados.includes(id)));
  if (eleccionNino === 'todos') return abiertos;
  return abiertos.filter((id) => forzados.includes(id) || indiceDeNivel(id) <= indiceDeNivel(nivelActual));
}
