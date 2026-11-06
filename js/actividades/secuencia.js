// «Armo la frase» (F3): armado del ensayo (sin DOM) y dibujado.
//
// Se ve la imagen de la frase; abajo están las palabras desordenadas y arriba, una franja con un hueco
// por palabra. El niño toca las palabras EN ORDEN (sin arrastrar) y cada una salta a la franja.
// Si toca una que no corresponde, esa se atenúa un momento y se ilumina la que sigue.

import { barajar } from '../core/azar.js';
import { el } from '../ui/dom.js';
import { crearCarta } from '../ui/carta.js';
import { crearBotonAudio } from '../ui/boton-audio.js';
import { esSegundoDedo } from './comun.js';

const MAX_REINTENTOS_MEZCLA = 10;

/**
 * Un ensayo de secuencia:
 *   { modo: 'secuencia', orden: [palabraId, ...], fichas: [{ id, palabraId, texto }] (mezcladas), ... }
 * Con 2 opciones solo están las palabras de la frase; con 3 y 4 se suman 1 y 2 palabras de relleno
 * (de otras frases) para que haya que elegir.
 */
export function armarEnsayoSecuencia({ ensayo, palabras, palabrasPorId, aleatorio = Math.random }) {
  const frase = palabras.get(ensayo.elementoId);
  if (!frase?.palabraIds?.length) throw new Error(`Frase desconocida en el ensayo: ${ensayo.elementoId}`);
  const orden = [...frase.palabraIds];
  for (const id of orden) if (!palabrasPorId.has(id)) throw new Error(`Palabra desconocida en la frase: ${id}`);

  const extras = Math.max(0, ensayo.distractorIds.length - 1);
  const candidatas = [];
  for (const id of ensayo.distractorIds) {
    for (const pid of palabras.get(id)?.palabraIds ?? []) {
      if (!orden.includes(pid) && !candidatas.includes(pid) && palabrasPorId.has(pid)) candidatas.push(pid);
    }
  }
  const ids = [...orden, ...barajar(candidatas, aleatorio).slice(0, extras)];
  const hechas = ids.map((palabraId, i) => ({ id: `f${i}`, palabraId, texto: palabrasPorId.get(palabraId).texto }));

  // Que no queden ya en el orden correcto (si hay forma de evitarlo)
  let fichas = barajar(hechas, aleatorio);
  const enOrden = (lista) => lista.slice(0, orden.length).every((f, i) => f.palabraId === orden[i]);
  for (let k = 0; k < MAX_REINTENTOS_MEZCLA && enOrden(fichas) && new Set(ids).size > 1; k++) fichas = barajar(hechas, aleatorio);

  return {
    modo: 'secuencia',
    actividad: 'F3',
    elementoId: ensayo.elementoId,
    tipo: ensayo.tipo,
    esFacil: ensayo.esFacil,
    consigna: 'Arma la frase',
    consignaSiempre: false,
    dicho: null,
    modelo: { forma: 'imagen', palabraId: ensayo.elementoId },
    orden,
    fichas,
    cartas: fichas, // para contar las opciones mostradas
    opciones: fichas.length,
    correctaId: null,
    audioInicial: true,
    posicionCorrecta: -1,
  };
}

export function renderSecuencia(contenedor, ensayo, ctx) {
  const { palabras, urls, alToque, alToqueModelo } = ctx;
  const frase = palabras.get(ensayo.modelo.palabraId);
  const urlDe = (p) => (p.medioImagenId ? urls.get(p.medioImagenId) ?? null : null);
  const partes = (frase.partes ?? []).map((parte) => ({ palabra: parte, url: urlDe(parte) }));

  const modelo = crearCarta({ forma: 'imagen', palabra: frase, url: urlDe(frase), partes, grande: true, interactiva: false });
  modelo.addEventListener('click', (e) => { if (!esSegundoDedo(e)) alToqueModelo(); });
  const zonaModelo = el('div', { class: 'zona-modelo' }, modelo, crearBotonAudio({ alToque: alToqueModelo }));

  const huecos = ensayo.orden.map((_, i) => el('span', { class: 'hueco', 'data-i': String(i) }));
  const franja = el('div', { class: 'franja', 'aria-label': 'La frase que vas armando' }, huecos);

  const fichas = new Map();
  const zonaFichas = el('div', { class: 'zona-fichas', 'data-n': String(ensayo.fichas.length) });
  for (const f of ensayo.fichas) {
    const boton = el('button', { type: 'button', class: 'ficha', 'data-id': f.id, 'aria-label': f.texto }, el('span', { class: 'palabra-texto' }, f.texto));
    boton.addEventListener('click', (e) => {
      if (esSegundoDedo(e)) return;
      alToque(f.id);
    });
    fichas.set(f.id, boton);
    zonaFichas.append(boton);
  }
  contenedor.replaceChildren(zonaModelo, franja, zonaFichas);

  let puestas = 0;
  return {
    raiz: contenedor,
    elementos: fichas,
    atenuar(id) {
      const f = fichas.get(id);
      f?.classList.add('atenuada');
      f?.setAttribute('aria-disabled', 'true');
    },
    resaltar(id) {
      for (const f of fichas.values()) f.classList.remove('ayuda');
      fichas.get(id)?.classList.add('ayuda');
    },
    /** Tras un acierto se apagan las ayudas: las fichas atenuadas vuelven a poder usarse. */
    limpiarAyudas() {
      for (const f of fichas.values()) {
        f.classList.remove('atenuada', 'ayuda');
        f.removeAttribute('aria-disabled');
      }
    },
    /** La ficha salta al siguiente hueco de la franja. */
    colocar(id) {
      const f = fichas.get(id);
      const hueco = huecos[puestas];
      if (!f || !hueco) return;
      puestas += 1;
      hueco.classList.add('lleno');
      hueco.replaceChildren(el('span', { class: 'palabra-texto' }, f.getAttribute('aria-label')));
      f.classList.remove('ayuda', 'atenuada');
      f.classList.add('usada');
      f.disabled = true;
    },
    revelarAudio() {}, // el altavoz siempre está
    marcarAcierto(_id, { celebrar = false } = {}) {
      franja.classList.add('acierto');
      if (celebrar) franja.classList.add('celebrar');
    },
  };
}
