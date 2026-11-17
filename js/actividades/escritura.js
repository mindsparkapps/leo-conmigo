// Dibujo del modo Escritura (Ampliación 5, fase 29): el modelo arriba, una caja por pieza en el medio y las piezas abajo.
// No decide nada: lo que pasa con cada pieza lo resuelve `core/escritura/controlador.js`; aquí solo se recoge lo que hace el niño
// (tocar una pieza, tocar una caja, arrastrar con el dedo) y se pinta el resultado.
//
//  - Tocar una pieza la dice (`alEscuchar`). Con `formaDeMover: 'tocar'` además la «toma» y tocar una caja la pone (sin arrastrar).
//    Con `'arrastrar'` solo la dice; el teclado (Enter sobre una pieza) siempre la toma.
//  - Arrastrar (Pointer Events): umbral de 10 px para distinguir un toque de un arrastre, un solo dedo, la pieza sigue al dedo y al soltar
//    vale la caja vacía más cercana (la caja + 24 px de margen). Soltar lejos de una caja devuelve la pieza sin contar como error.
//  - Verde al acertar (la pieza queda fija); al errar, rojo suave en la caja o la pieza solo se atenúa (`colorError`); ayuda amarilla.

import { el } from '../ui/dom.js';
import { crearCarta } from '../ui/carta.js';
import { crearBotonAudio } from '../ui/boton-audio.js';
import { esSegundoDedo } from './comun.js';

export const UMBRAL_ARRASTRE_PX = 10;
export const MARGEN_SOLTAR_PX = 24;
export const ERROR_VISIBLE_MS = 600;
const IGNORAR_CLICK_TRAS_ARRASTRE_MS = 300;

const escaparRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** El texto de un `E19` con la palabra que falta cambiada por un hueco: [{ texto } | { hueco: true }]. Sin DOM (se prueba en Node). */
export function partesDelTexto(frases, faltante) {
  const texto = (frases ?? []).join(' ');
  if (!faltante) return [{ texto }];
  const exp = new RegExp(`(?<![\\p{L}\\p{N}])${escaparRegex(faltante)}(?![\\p{L}\\p{N}])`, 'giu');
  const partes = [];
  let desde = 0;
  for (const m of texto.matchAll(exp)) {
    if (m.index > desde) partes.push({ texto: texto.slice(desde, m.index) });
    partes.push({ hueco: true, texto: m[0] });
    desde = m.index + m[0].length;
  }
  if (desde < texto.length) partes.push({ texto: texto.slice(desde) });
  return partes;
}

/**
 * @param contenedor  donde se dibuja
 * @param visual      el ensayo visual de `crearControladorEscritura().actual()` (`huecos`, `fichas`, `inicioDePalabra`, `elemento`…)
 * @param ctx         { urls: Map(medioId → url), partes?(elemento) → [{ palabra, url }], formaDeMover, alEscuchar(fichaId),
 *                      alSoltar({ fichaId, hueco, forma }), alToqueModelo() }
 */
export function renderEscritura(contenedor, visual, ctx) {
  const { urls, alEscuchar, alSoltar, alToqueModelo } = ctx;
  const formaDeMover = ctx.formaDeMover === 'arrastrar' ? 'arrastrar' : 'tocar';
  const reducido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const elemento = visual.elemento ?? {};
  let bloqueado = false;
  let tomada = null; // id de la pieza «tomada» con un toque
  const temporizadores = new Set();
  const luego = (ms, tarea) => {
    const t = setTimeout(() => { temporizadores.delete(t); tarea(); }, ms);
    temporizadores.add(t);
  };

  // ---- modelo ----
  const urlDe = (p) => (p?.medioImagenId ? urls?.get(p.medioImagenId) ?? null : null);
  let zonaModelo;
  if (visual.dictado) {
    // Dictado: sin imagen, solo el altavoz
    zonaModelo = el('div', { class: 'esc-modelo esc-dictado' }, crearBotonAudio({ grande: true, alToque: alToqueModelo }));
  } else {
    const palabra = { id: elemento.id, texto: elemento.modelo ?? elemento.texto ?? '', emoji: elemento.emoji, esFrase: Boolean(elemento.esFrase) };
    const carta = crearCarta({
      forma: 'imagen', palabra, url: urlDe(elemento), partes: ctx.partes?.(elemento) ?? [], grande: true, interactiva: false,
    });
    carta.addEventListener('click', (e) => { if (!esSegundoDedo(e)) alToqueModelo(); });
    zonaModelo = el('div', { class: 'esc-modelo' }, carta, crearBotonAudio({ alToque: alToqueModelo }));
  }

  // ---- E19: el texto con la caja ----
  let huecosDelTexto = [];
  let bloqueTexto = null;
  if (elemento.esTexto) {
    huecosDelTexto = [];
    const nodos = partesDelTexto(elemento.frases, elemento.texto).map((p) => {
      if (!p.hueco) return p.texto;
      const marca = el('span', { class: 'esc-texto-hueco', 'data-palabra': p.texto, 'aria-label': 'La palabra que falta' });
      huecosDelTexto.push(marca);
      return marca;
    });
    bloqueTexto = el('p', { class: 'esc-texto', 'aria-label': 'El texto' }, ...nodos);
  }

  // ---- cajas ----
  const cajas = [];
  const hijosCajas = [];
  visual.huecos.forEach((texto, i) => {
    if (visual.porSilabas && i > 0 && visual.inicioDePalabra?.[i]) hijosCajas.push(el('span', { class: 'esc-espacio', 'aria-hidden': 'true' }));
    const caja = el('button', { type: 'button', class: 'esc-caja', 'data-i': String(i), 'aria-label': `Caja ${i + 1}` }, el('span', { class: 'esc-texto-caja' }));
    caja.addEventListener('click', (e) => {
      if (esSegundoDedo(e) || bloqueado || !tomada || caja.classList.contains('llena')) return;
      alSoltar({ fichaId: tomada, hueco: i, forma: 'toque' });
    });
    cajas.push(caja);
    hijosCajas.push(caja);
  });
  const franja = el('div', { class: 'esc-cajas', 'data-n': String(cajas.length), 'aria-label': 'Las cajas' }, ...hijosCajas);

  // ---- piezas ----
  const piezas = new Map();
  const zonaPiezas = el('div', { class: 'esc-piezas', 'data-n': String(visual.fichas.length), 'aria-label': 'Las piezas' });

  /** La caja vacía más cercana al punto (con 24 px de margen alrededor), o null. */
  function cajaEn(x, y) {
    let mejor = null;
    let distancia = Infinity;
    cajas.forEach((caja, i) => {
      if (caja.classList.contains('llena')) return;
      const r = caja.getBoundingClientRect();
      if (x < r.left - MARGEN_SOLTAR_PX || x > r.right + MARGEN_SOLTAR_PX || y < r.top - MARGEN_SOLTAR_PX || y > r.bottom + MARGEN_SOLTAR_PX) return;
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (d < distancia) { distancia = d; mejor = i; }
    });
    return mejor;
  }
  const marcarCercana = (i) => cajas.forEach((c, k) => c.classList.toggle('cerca', k === i));

  function devolverAlLugar(boton) {
    boton.classList.remove('arrastrando');
    boton.style.transition = reducido ? 'none' : 'transform 0.18s ease-out';
    boton.style.transform = '';
  }

  function enlazar(boton, ficha) {
    let activo = null; // { id, x0, y0, arrastrando }
    let ultimoArrastre = -Infinity;
    boton.addEventListener('pointerdown', (e) => {
      if (bloqueado || activo || !e.isPrimary) return; // un solo dedo
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      activo = { id: e.pointerId, x0: e.clientX, y0: e.clientY, arrastrando: false };
      try { boton.setPointerCapture(e.pointerId); } catch { /* un puntero sintético no se puede capturar: no importa */ }
    });
    boton.addEventListener('pointermove', (e) => {
      if (!activo || e.pointerId !== activo.id) return;
      const dx = e.clientX - activo.x0;
      const dy = e.clientY - activo.y0;
      if (!activo.arrastrando) {
        if (formaDeMover !== 'arrastrar' || Math.hypot(dx, dy) < UMBRAL_ARRASTRE_PX) return; // todavía es un toque
        activo.arrastrando = true;
        boton.style.transition = 'none';
        boton.classList.add('arrastrando');
      }
      boton.style.transform = `translate(${dx}px, ${dy}px)`;
      marcarCercana(cajaEn(e.clientX, e.clientY));
    });
    const terminar = (e, cancelado) => {
      if (!activo || e.pointerId !== activo.id) return;
      const { arrastrando } = activo;
      activo = null;
      try { boton.releasePointerCapture(e.pointerId); } catch { /* ignorar */ }
      if (!arrastrando) return; // fue un toque: lo atiende `click`
      ultimoArrastre = performance.now();
      marcarCercana(null);
      const hueco = cancelado || bloqueado ? null : cajaEn(e.clientX, e.clientY);
      if (hueco === null) { devolverAlLugar(boton); return; } // soltada lejos de las cajas: vuelve, no es un error
      alSoltar({ fichaId: ficha.id, hueco, forma: 'arrastre' });
    };
    boton.addEventListener('pointerup', (e) => terminar(e, false));
    boton.addEventListener('pointercancel', (e) => terminar(e, true));
    boton.addEventListener('click', (e) => {
      if (esSegundoDedo(e) || bloqueado || boton.classList.contains('usada')) return;
      if (performance.now() - ultimoArrastre < IGNORAR_CLICK_TRAS_ARRASTRE_MS) return; // el clic que sigue a un arrastre
      alEscuchar(ficha.id); // tocar una pieza la dice (y se anota; no es un error)
      if (formaDeMover === 'tocar' || e.pointerType === '') manejador.tomar(tomada === ficha.id ? null : ficha.id); // el teclado también la toma
    });
  }

  for (const ficha of visual.fichas) {
    const boton = el('button', { type: 'button', class: 'esc-pieza', 'data-id': ficha.id, 'aria-label': ficha.texto }, el('span', { class: 'esc-texto-pieza' }, ficha.texto));
    enlazar(boton, ficha);
    piezas.set(ficha.id, boton);
    zonaPiezas.append(boton);
  }

  contenedor.replaceChildren(...[zonaModelo, bloqueTexto, franja, zonaPiezas].filter(Boolean));

  const manejador = {
    raiz: contenedor,
    piezas,
    cajas,
    /** «Toma» una pieza (para ponerla con un toque en una caja) o la suelta (`null`). */
    tomar(fichaId) {
      tomada = fichaId;
      for (const [id, p] of piezas) p.classList.toggle('tomada', id === fichaId);
    },
    tomadaActual: () => tomada,
    /** La pieza queda fija en su caja (verde). */
    colocar(fichaId, hueco) {
      const pieza = piezas.get(fichaId);
      const caja = cajas[hueco];
      if (!pieza || !caja) return;
      caja.classList.add('llena', 'acierto');
      caja.classList.remove('error-rojo', 'cerca', 'ayuda');
      caja.setAttribute('aria-label', pieza.getAttribute('aria-label'));
      caja.querySelector('.esc-texto-caja').textContent = pieza.getAttribute('aria-label');
      pieza.classList.remove('ayuda', 'tomada', 'arrastrando', 'atenuada');
      pieza.classList.add('usada');
      pieza.style.transform = '';
      pieza.disabled = true;
      pieza.tabIndex = -1;
      manejador.tomar(null);
    },
    /**
     * La pieza no era: vuelve a su lugar. `error`: 'rojo' (la caja se pone rojo suave un momento) o 'suave' (la pieza se atenúa un
     * momento). Sin sonido, sin vibración y sin cruz. `error: null`: solo vuelve (no era un intento).
     */
    devolver(fichaId, hueco, error = null) {
      const pieza = piezas.get(fichaId);
      if (!pieza) return;
      devolverAlLugar(pieza);
      manejador.tomar(null);
      if (error === 'rojo' && cajas[hueco]) {
        cajas[hueco].classList.add('error-rojo');
        luego(ERROR_VISIBLE_MS, () => cajas[hueco]?.classList.remove('error-rojo'));
      } else if (error === 'suave') {
        pieza.classList.add('atenuada');
        luego(ERROR_VISIBLE_MS, () => pieza.classList.remove('atenuada'));
      }
    },
    /** Ayuda amarilla: la caja y la pieza correcta se iluminan y laten. `null` la apaga. */
    ayudar(ayuda) {
      for (const c of cajas) c.classList.remove('ayuda');
      for (const p of piezas.values()) p.classList.remove('ayuda');
      if (!ayuda) return;
      cajas[ayuda.hueco]?.classList.add('ayuda');
      if (ayuda.fichaId) piezas.get(ayuda.fichaId)?.classList.add('ayuda');
    },
    /** La caja que suena en la lectura sílaba por sílaba (`-1` = ninguna). */
    resaltarCaja(i) {
      cajas.forEach((c, k) => c.classList.toggle('suena', k === i));
    },
    /** Palabra completa: todo en verde; en un texto, la palabra que faltaba aparece. */
    marcarAcierto({ celebrar = false } = {}) {
      franja.classList.add('acierto');
      if (celebrar) franja.classList.add('celebrar');
      for (const marca of huecosDelTexto) {
        marca.textContent = marca.dataset.palabra;
        marca.classList.add('completo');
      }
    },
    /** Mientras suena la lectura final no se acepta nada más. */
    bloquear(valor = true) { bloqueado = valor; },
    destruir() {
      for (const t of temporizadores) clearTimeout(t);
      temporizadores.clear();
    },
  };
  return manejador;
}
