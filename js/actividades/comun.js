// Lo que comparten todas las actividades de la etapa 1: armar el ensayo (sin DOM) y dibujarlo.
//
// Un ensayo visual:
//   { actividad, elementoId, tipo, esFacil, consigna,
//     modelo: { forma: 'tarjeta'|'imagen'|'palabra'|'audio', palabraId },
//     cartas: [{ id, forma }]  (las opciones, ya mezcladas; id = id de la palabra),
//     correctaId, audioInicial, posicionCorrecta }
// `audioInicial: false` (L4): la palabra escrita se lee sin ayuda; el audio solo aparece tras un error.

import { barajar } from '../core/azar.js';
import { el } from '../ui/dom.js';
import { crearCarta } from '../ui/carta.js';
import { crearBotonAudio } from '../ui/boton-audio.js';

/**
 * Un toque con un segundo dedo se ignora (PLAN.md §2.9). Un clic sin `pointerType` (teclado,
 * pulsador, lector de pantalla) es siempre válido: no tiene "dedos".
 */
export function esSegundoDedo(evento) {
  return Boolean(evento.pointerType) && evento.isPrimary === false;
}

/**
 * Mezcla las opciones. Evita que la correcta caiga 3 veces seguidas en el mismo lugar
 * (`ultimasPosiciones`: dónde estuvo la correcta en los ensayos anteriores).
 */
export function mezclarCartas(cartas, correctaId, aleatorio = Math.random, ultimasPosiciones = []) {
  const mezcladas = barajar(cartas, aleatorio);
  const posicion = mezcladas.findIndex((c) => c.id === correctaId);
  const [a, b] = ultimasPosiciones.slice(-2);
  if (cartas.length > 1 && a === posicion && b === posicion) {
    const otra = (posicion + 1 + Math.floor(aleatorio() * (cartas.length - 1))) % cartas.length;
    [mezcladas[posicion], mezcladas[otra]] = [mezcladas[otra], mezcladas[posicion]];
  }
  return mezcladas;
}

/** Arma un ensayo visual a partir de un ensayo del plan de sesión. Sin DOM: se puede probar en Node. */
export function armarEnsayo({
  actividad, ensayo, palabras, formaModelo, formaCarta, fuenteCarta = null, audioInicial, consigna,
  consignaSiempre = false, dicho = null, aleatorio = Math.random, ultimasPosiciones = [],
}) {
  const ids = [ensayo.elementoId, ...ensayo.distractorIds];
  for (const id of ids) {
    if (!palabras.has(id)) throw new Error(`Palabra desconocida en el ensayo: ${id}`);
  }
  const fuente = fuenteCarta ? { fuente: fuenteCarta } : {};
  const cartas = mezclarCartas(ids.map((id) => ({ id, forma: formaCarta, ...fuente })), ensayo.elementoId, aleatorio, ultimasPosiciones);
  return {
    modo: 'simple',
    actividad,
    elementoId: ensayo.elementoId,
    tipo: ensayo.tipo,
    esFacil: ensayo.esFacil,
    consigna,
    consignaSiempre, // true: la consigna cambia en cada ensayo (p. ej. la pregunta de «clasificar»)
    dicho, // texto que se dice al tocar el modelo; si es null, se dice la palabra o la frase
    modelo: { forma: formaModelo, palabraId: ensayo.elementoId },
    cartas,
    opciones: cartas.length,
    correctaId: ensayo.elementoId,
    audioInicial,
    posicionCorrecta: cartas.findIndex((c) => c.id === ensayo.elementoId),
  };
}

/**
 * Dibuja el ensayo: modelo arriba, opciones abajo (igual en todas las actividades).
 * @param ctx  { palabras: Map, urls: Map(medioId -> url), alToque(id), alToqueModelo() }
 * @returns un manejador para que la pantalla aplique la ayuda y la celebración
 */
export function renderEnsayo(contenedor, ensayo, ctx) {
  const { palabras, urls, alToque, alToqueModelo } = ctx;
  // `fuente`: 'principal' (su foto o pictograma) o 'simbolo' (el pictograma guardado al lado de la foto)
  const urlDe = (p, fuente = 'principal') => {
    const id = fuente === 'simbolo' ? p.medioSimboloId : p.medioImagenId;
    return id ? urls.get(id) ?? null : null;
  };
  const partesDe = (p) => (p.partes ?? []).map((parte) => ({ palabra: parte, url: urlDe(parte) }));
  const objetivo = palabras.get(ensayo.modelo.palabraId);

  let audioDisponible = ensayo.audioInicial;
  let modelo;
  let botonAudio = null;
  if (ensayo.modelo.forma === 'audio') {
    modelo = crearBotonAudio({ grande: true, alToque: alToqueModelo });
    audioDisponible = true;
  } else {
    modelo = crearCarta({ forma: ensayo.modelo.forma, palabra: objetivo, url: urlDe(objetivo), partes: partesDe(objetivo), grande: true, interactiva: false });
    modelo.addEventListener('click', (e) => {
      if (audioDisponible && !esSegundoDedo(e)) alToqueModelo(); // tocar lo que se ve permite escucharlo
    });
    botonAudio = crearBotonAudio({ alToque: alToqueModelo });
    botonAudio.hidden = !audioDisponible;
  }

  const zonaModelo = el('div', { class: 'zona-modelo' }, modelo, botonAudio);

  const elementos = new Map();
  const zonaOpciones = el('div', {
    class: 'zona-opciones',
    'data-forma': ensayo.cartas[0]?.forma ?? '',
    'data-n': String(ensayo.cartas.length),
    style: `--n:${ensayo.cartas.length}`,
  });
  for (const carta of ensayo.cartas) {
    const palabra = palabras.get(carta.id);
    const elemento = crearCarta({
      forma: carta.forma,
      palabra,
      url: urlDe(palabra, carta.fuente),
      partes: carta.fuente === 'simbolo' ? [] : partesDe(palabra),
    });
    elemento.addEventListener('click', (e) => {
      if (esSegundoDedo(e)) return;
      alToque(carta.id);
    });
    elementos.set(carta.id, elemento);
    zonaOpciones.append(elemento);
  }

  contenedor.replaceChildren(zonaModelo, zonaOpciones);

  return {
    raiz: contenedor,
    elementos,
    /** La opción equivocada se atenúa suavemente (sin sonido ni color de error). */
    atenuar(id) {
      const e = elementos.get(id);
      e?.classList.add('atenuada');
      e?.setAttribute('aria-disabled', 'true');
    },
    /** La correcta se ilumina y late. */
    resaltar(id) {
      elementos.get(id)?.classList.add('ayuda');
    },
    /** Tras un error el audio queda disponible (en L4 recién aquí aparece). */
    revelarAudio() {
      audioDisponible = true;
      if (botonAudio) botonAudio.hidden = false;
    },
    marcarAcierto(id, { celebrar = false } = {}) {
      const e = elementos.get(id);
      if (!e) return;
      e.classList.remove('ayuda');
      e.classList.add('acierto');
      if (celebrar) e.classList.add('celebrar');
    },
  };
}
