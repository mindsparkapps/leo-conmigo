// La sección «Escritura» de «Qué le cuesta» (Ampliación 5, fase 31). Solo dibuja: todo sale de `core/escritura/analisis.js`.
// Barras azules (nunca rojas): el rojo de la escritura es solo informativo y aquí no se usa.

import { el } from '../ui/dom.js';
import { NIVELES } from '../core/escritura/niveles.js';
import { MIN_ENSAYOS } from '../core/analisis.js';

const porciento = (n) => `${Math.round(n * 100)} %`;
const segundos = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`);
const nombreNivel = (id) => { const n = NIVELES.find((x) => x.id === id); return n ? `${n.id} · ${n.nombre}` : id; };

const barra = (valor, etiqueta) => el('span', { class: 'barra-esc', role: 'img', 'aria-label': etiqueta }, el('span', { style: `width:${Math.max(Math.round(valor * 100), 3)}%` }));

const tarjeta = (titulo, ayuda, contenido) => el('div', { class: 'panel' }, el('h2', {}, titulo), ayuda ? el('p', { class: 'ayuda' }, ayuda) : null, contenido);

const lista = (items, vacio) => (items.length ? el('ul', { class: 'lista-filas' }, items) : el('p', { class: 'ayuda' }, vacio));

/**
 * @param analisis  `analizarEscritura(...)`
 * @param prueba    true: son los datos del «Perfil de prueba»
 * @returns un arreglo de paneles
 */
export function panelesDeEscritura({ analisis, prueba = false, nombre = 'el niño' }) {
  const encabezado = el('div', { class: 'panel' },
    el('h2', {}, prueba ? 'Escritura · Perfil de prueba' : 'Escritura (experimental)'),
    prueba ? el('p', { class: 'ayuda' }, 'Son los datos de lo que se jugó en modo administrador o con «Probar Escritura». No son del niño y no cuentan para sus ajustes automáticos.') : null,
    el('p', { class: 'ayuda' }, analisis.ensayos
      ? `${analisis.ensayos} palabra${analisis.ensayos === 1 ? '' : 's'} armada${analisis.ensayos === 1 ? '' : 's'} en los últimos ${analisis.dias} días.${analisis.sesiones.minutosMediana != null ? ` Las sesiones duran unos ${analisis.sesiones.minutosMediana} min.` : ''}`
      : `Todavía no hay palabras de escritura en los últimos ${analisis.dias} días.`),
    analisis.ensayos && analisis.porHora.length
      ? el('p', { class: 'ayuda' }, 'Según el momento del día: ', analisis.porHora.map((h) => `${h.nombre} ${porciento(h.tasa)} (${h.ensayos})`).join(' · '), '.')
      : null);
  if (!analisis.ensayos) return [encabezado];

  const filaPalabra = (p) => el('li', { class: 'fila-sesion' },
    el('strong', {}, p.texto, el('span', { class: 'insignia suave' }, p.nivel)),
    barra(p.indice / 100, `Dificultad ${p.indice} de 100`),
    el('span', { class: 'ayuda' }, `${porciento(p.tasa)} a la primera · ${segundos(p.tiempoMediano)}${p.confiable ? '' : ` · pocos datos (${p.ensayos} de ${MIN_ENSAYOS} ensayos)`}`));

  const paneles = [encabezado];
  if (!analisis.hayDatos) {
    paneles.push(el('div', { class: 'panel' }, el('h2', {}, 'Todavía hay pocos datos'),
      el('p', {}, `Ninguna palabra llega a ${MIN_ENSAYOS} ensayos, así que aún no hay listas. Cuando ${nombre} escriba unas sesiones más, aquí verás qué palabras y sílabas le cuestan.`)));
  } else {
    paneles.push(
      tarjeta('Le cuestan más', 'Palabras con mayor índice de dificultad (0 a 100).', lista(analisis.masDificiles.map(filaPalabra), 'Ninguna palabra le está costando.')),
      tarjeta('Le salen fácil', null, lista(analisis.masFaciles.map(filaPalabra), 'Aún no hay palabras que se distingan por lo fáciles.')),
    );
  }
  paneles.push(
    tarjeta('Sílabas que confunde', 'En la caja de la primera puso la segunda (hacen falta 2 veces).', lista(
      analisis.confusiones.slice(0, 8).map((c) => el('li', { class: 'fila-sesion' }, el('strong', {}, `${c.objetivo} → ${c.tocada}`), el('span', { class: 'ayuda' }, `${c.veces} veces · ${c.niveles.join(', ')}`))),
      'Todavía no se repite ninguna confusión.')),
    tarjeta('Sílabas que le cuestan', `Con al menos 3 apariciones. «Sin error» = veces que la puso bien a la primera.`, lista(
      analisis.silabasDificiles.map((s) => el('li', { class: 'fila-sesion' }, el('strong', {}, s.texto), barra(1 - s.tasa, `Se equivoca ${porciento(1 - s.tasa)} de las veces`), el('span', { class: 'ayuda' }, `${s.sinError} de ${s.apariciones} sin error · ${segundos(s.tiempoMediano)}`))),
      'Ninguna sílaba se destaca por costarle.')),
  );
  const pos = analisis.posicionDelError;
  if (pos.primera.oportunidades + pos.medio.oportunidades + pos.ultima.oportunidades > 0) {
    paneles.push(tarjeta('Dónde se equivoca en la palabra', 'Cuántas veces falla la caja de cada lugar (solo palabras de 2 cajas o más).',
      el('ul', { class: 'lista-filas' }, [['primera', 'La primera sílaba'], ['medio', 'Las del medio'], ['ultima', 'La última']].filter(([k]) => pos[k].oportunidades > 0).map(([k, t]) =>
        el('li', { class: 'fila-sesion' }, el('strong', {}, t), barra(pos[k].tasaError ?? 0, `Falla ${porciento(pos[k].tasaError ?? 0)}`), el('span', { class: 'ayuda' }, `${pos[k].errores} de ${pos[k].oportunidades} cajas`))))));
  }
  const mas = analisis.nivelMasDificil;
  paneles.push(tarjeta('Nivel más difícil', null, [
    mas ? el('p', {}, el('strong', {}, nombreNivel(mas.nivel)), `: ${porciento(mas.tasa)} a la primera en ${mas.ensayos} palabras.`) : el('p', { class: 'ayuda' }, `Ningún nivel tiene aún ${MIN_ENSAYOS} palabras.`),
    el('details', { class: 'detalle-numeros' }, el('summary', {}, 'Ver todos los niveles'),
      el('ul', { class: 'lista-ayuda' }, analisis.porNivel.map((n) => el('li', {}, el('strong', {}, nombreNivel(n.nivel)), `: ${porciento(n.tasa)} a la primera · ${segundos(n.tiempoMediano)} · ${n.ensayos} palabras · ${n.sesiones} sesión${n.sesiones === 1 ? '' : 'es'}`)))),
  ]));
  const g = analisis.generalizacion;
  paneles.push(tarjeta('Palabras nuevas que escribió bien a la primera', 'De las palabras que armó por primera vez, cuántas salieron sin ningún error: dice si generaliza a palabras nuevas.', g.total.palabras
    ? [
      el('p', {}, el('strong', {}, `${g.total.aciertos} de ${g.total.palabras}`), ` (${porciento(g.total.tasa)})`, barra(g.total.tasa, `${porciento(g.total.tasa)} de las palabras nuevas`)),
      el('ul', { class: 'lista-ayuda' }, g.porNivel.map((n) => el('li', {}, el('strong', {}, nombreNivel(n.nivel)), `: ${n.aciertos} de ${n.palabras}`))),
    ]
    : el('p', { class: 'ayuda' }, 'Todavía no hay palabras armadas por primera vez.')));
  return paneles;
}
