// Panel «Revisar las voces» (Ajustes del modo adulto): reproduce de corrido todas las grabaciones de Catalina
// (frases fijas y palabras del catálogo) para escucharlas, con pausa, retroceso de 10 s y una barra para saltar.
// El adulto marca las que suenan mal; la lista queda en este dispositivo y se puede copiar para regenerarlas.

import { el } from '../ui/dom.js';
import { LISTA_DE_FRASES } from '../frases-voz.js';
import { LISTA_DE_SILABAS } from '../silabas-voz.js';

const CLAVE_MALAS = 'leo_voces_malas';
const PAUSA_ENTRE_AUDIOS_MS = 600;
// El último tramo generado (el botón «siguiente tramo»; se actualiza en cada tanda nueva): las frases genéricas
// nuevas y las sílabas sueltas
const FRASES_DEL_TRAMO = new Set(['Te faltan monedas', '¡Has ganado tus monedas!', '¡Completaste tu álbum! ¡Has ganado tus monedas!', '¿Cuál es una persona?', '¿Cuál es una parte del cuerpo?', '¿Cuál es una comida?', '¿Cuál es algo de la casa?', '¿Cuál es un animal?', '¿Cuál es un juguete o una cosa?', '¿Quién bebe leche?', '¿Qué come el gato?', '¿Qué tiene el perro?', '¿Quién duerme?', '¿Quién juega?', '¿Quién bebe agua?']);

function leerMalas() {
  try {
    // Antes se guardaba solo el texto; ahora cada marca lleva también su mp3 y su número en la lista completa
    return JSON.parse(localStorage.getItem(CLAVE_MALAS) ?? '[]').map((m) => (typeof m === 'string' ? { texto: m } : m));
  } catch { return []; }
}
function guardarMalas(lista) {
  try { localStorage.setItem(CLAVE_MALAS, JSON.stringify(lista)); } catch { /* sin almacenamiento: queda solo en pantalla */ }
}

function formato(segundos) {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Duración de un mp3 (0 si no se puede leer). */
function duracionDe(ruta) {
  return new Promise((resolver) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    const fin = (d) => { audio.removeAttribute('src'); resolver(Number.isFinite(d) ? d : 0); };
    audio.addEventListener('loadedmetadata', () => fin(audio.duration), { once: true });
    audio.addEventListener('error', () => fin(0), { once: true });
    audio.src = ruta;
  });
}

const POR_TANDA = 200; // cuántas voces nuevas de Escritura trae cada botón de tanda

// Sílabas del diccionario (docs/plan-silabas-diccionario.md, fase 4): se oyen por tandas de 200, en orden alfabético
// dentro de cada corte de cobertura (99, 99.9, 100). Mientras una tanda no esté aprobada, sus sílabas NO salen en
// «Probar sílabas» ni en «todas». Al aprobar una, se anota su número aquí y su botón desaparece.
const TANDAS_DEL_DICCIONARIO_APROBADAS = new Set([1, 2]);

let diccionario = null;
/** Las sílabas del diccionario que ya tienen mp3, en el orden de revisión. */
async function cargarDiccionario() {
  if (diccionario) return diccionario;
  const r = await fetch('data/voces/silabas-diccionario.json');
  const lista = r.ok ? await r.json() : [];
  const corte = (c) => (c <= 99 ? 0 : c <= 99.9 ? 1 : 2);
  const porRuta = new Map(LISTA_DE_SILABAS.map((x) => [x.texto, x.ruta]));
  diccionario = lista
    .filter((s) => porRuta.has(s.texto))
    .sort((a, b) => corte(a.cobertura) - corte(b.cobertura) || a.texto.localeCompare(b.texto, 'es'))
    .map((s) => ({ texto: s.texto, ruta: porRuta.get(s.texto), tipo: 'sílaba' }));
  return diccionario;
}
/** Las rutas de las sílabas del diccionario cuya tanda todavía no se aprobó. */
async function pendientesDelDiccionario() {
  const todas = await cargarDiccionario();
  return new Set(todas.filter((_, i) => !TANDAS_DEL_DICCIONARIO_APROBADAS.has(Math.floor(i / POR_TANDA) + 1)).map((x) => x.ruta));
}

let tandaNueva = null;
/** Las voces generadas para el modo Escritura (data/voces/tanda-escritura.json), en el orden en que se revisan. */
async function cargarTandaNueva() {
  if (tandaNueva) return tandaNueva;
  const r = await fetch('data/voces/tanda-escritura.json');
  tandaNueva = r.ok ? await r.json() : [];
  return tandaNueva;
}

/**
 * Las grabaciones de una lista. «todas» y «tramo» siguen siendo las de antes de las voces de Escritura (así los números
 * que ya anotaste no cambian); «tanda1», «tanda2»… son las voces nuevas, de 200 en 200.
 */
async function cargarLista(modo = 'todas') {
  const nuevas = await cargarTandaNueva();
  const delDiccionario = /^diccionario(\d+)$/.exec(modo);
  if (delDiccionario) {
    const n = Number(delDiccionario[1]);
    // las que se corrigieron (`revisar`) se oyen aparte, en su botón de revisión
    const enRevision = new Set(nuevas.filter((x) => x.revisar).map((x) => x.ruta));
    return (await cargarDiccionario()).slice((n - 1) * POR_TANDA, n * POR_TANDA).filter((x) => !enRevision.has(x.ruta));
  }
  const sinAprobar = await pendientesDelDiccionario();
  // las que se corrigieron (`revisar`) salen de su tanda y se oyen aparte, en «revision1»
  // (`revisar` es el número de la tanda de la que salieron; `true` es la tanda 1)
  const revision = /^revision(\d+)$/.exec(modo);
  if (revision) return nuevas.filter((x) => (x.revisar === true ? 1 : x.revisar) === Number(revision[1]));
  const tanda = /^tanda(\d+)$/.exec(modo);
  if (tanda) return nuevas.slice((Number(tanda[1]) - 1) * POR_TANDA, Number(tanda[1]) * POR_TANDA).filter((x) => !x.revisar && !x.aprobada);
  // La tanda 1 ya está revisada, y lo que se aprobó después (`aprobada`) también: pasa a las listas por tipo
  // (palabras, sílabas, frases)
  const aprobadas = nuevas.filter((x, i) => x.aprobada || (i < POR_TANDA && !x.revisar));
  const porTipo = { palabras: 'palabra', silabas: 'sílaba', frases: 'frase' };
  if (porTipo[modo]) {
    const viejas = await cargarLista('todas');
    // en orden alfabético (las de antes y las nuevas mezcladas)
    return [...viejas.filter((x) => x.tipo === porTipo[modo]), ...aprobadas.filter((x) => x.tipo === porTipo[modo])]
      .sort((x, y) => x.texto.localeCompare(y.texto, 'es') || x.ruta.localeCompare(y.ruta));
  }
  const deTanda = new Set(nuevas.map((x) => x.ruta));
  const respuesta = await fetch('data/vocabulario-inicial.json');
  if (!respuesta.ok) throw new Error('No se pudo leer el catálogo de palabras.');
  const catalogo = await respuesta.json();
  const palabras = catalogo.filter((p) => p.voz && !deTanda.has(p.voz)).map((p) => ({ texto: p.texto, ruta: p.voz, tipo: 'palabra' }));
  const frases = LISTA_DE_FRASES.filter((f) => !deTanda.has(f.ruta)).map((f) => ({ texto: f.texto, ruta: f.ruta, tipo: 'frase' }));
  const silabas = LISTA_DE_SILABAS.filter((x) => !deTanda.has(x.ruta) && !sinAprobar.has(x.ruta)).map((x) => ({ texto: x.texto, ruta: x.ruta, tipo: 'sílaba' }));
  if (modo === 'tramo') return [...frases.filter((f) => FRASES_DEL_TRAMO.has(f.texto)), ...silabas];
  return [...frases, ...palabras, ...silabas];
}

export function crearRevisorVoces() {
  let items = [];
  let inicios = []; // segundo, dentro del total, en que empieza cada audio
  let total = 0;
  let actual = 0;
  let audio = null;
  let temporizador = null;
  let arrastrando = false;
  let malas = leerMalas();
  let numeros = new Map(); // ruta -> número en la lista «todas» (para completar marcas viejas)
  let totalTodas = 0;
  let modoActual = 'todas';
  let aislado = null; // audio de «Reproducir» de una marcada

  // Lo ya revisado y aprobado, por tipo (la tanda 1 entró aquí)
  const preparar = el('button', { type: 'button', class: 'boton' }, 'Probar palabras');
  const prepararTramo = el('button', { type: 'button', class: 'boton' }, 'Probar sílabas');
  const prepararFrases = el('button', { type: 'button', class: 'boton' }, 'Probar frases');
  const filaTandas = el('div', { class: 'acciones' });
  const estado = el('p', { class: 'ayuda', role: 'status' });
  const actualTexto = el('p', { class: 'revisor-actual', 'aria-live': 'polite' }, '');
  const barra = el('input', { type: 'range', min: '0', max: '0', step: '0.1', value: '0', 'aria-label': 'Posición en la lista de voces', disabled: true });
  const tiempo = el('p', { class: 'ayuda' }, '');
  const pausar = el('button', { type: 'button', class: 'boton secundario', disabled: true }, 'Pausar');
  const atras = el('button', { type: 'button', class: 'boton secundario', disabled: true }, '⟲ 10 s');
  const marcar = el('button', { type: 'button', class: 'boton secundario', disabled: true }, 'Marcar como mala');
  const controles = el('div', { class: 'acciones' }, atras, pausar, marcar);
  const listaMalas = el('ul', { class: 'revisor-malas' });
  const copiar = el('button', { type: 'button', class: 'boton secundario' }, 'Copiar la lista');
  const vaciar = el('button', { type: 'button', class: 'boton secundario' }, 'Vaciar la lista');
  const bloqueMalas = el('div', {}, el('h3', {}, 'Las que suenan mal'), listaMalas, el('div', { class: 'acciones' }, copiar, vaciar));

  const etiqueta = (x) => `${x.tipo === 'frase' ? 'Frase' : x.tipo === 'sílaba' ? 'Sílaba' : 'Palabra'}: ${x.texto}`;
  const esMala = (x) => malas.some((m) => m.texto === etiqueta(x));
  // El número es el mismo que se ve arriba cuando suena en su lista: «139 de 280» (tramo) o «442 de 901» (todas)
  const nombreLista = (l) => (l ?? 'todas').replace(/^tanda(\d+)$/, 'tanda $1').replace(/^revision(\d+)$/, 'revisión tanda $1').replace(/^diccionario(\d+)$/, 'diccionario $1').replace(/^silabas$/, 'sílabas');
  // De qué botón de tanda viene cada grabación (ruta -> «Probar voces nuevas de Escritura 201 a 400»), aunque la marca
  // se haya hecho oyéndola en «Probar sílabas» o en otra lista. Se llena al leer las tandas.
  const tandaDe = new Map();
  async function aprenderTandas() {
    const nuevas = await cargarTandaNueva();
    const enTandas = nuevas.filter((x) => !x.extra);
    enTandas.forEach((x, i) => {
      const t = Math.floor(i / POR_TANDA);
      if (t >= 1) tandaDe.set(x.ruta, `Probar voces nuevas de Escritura ${t * POR_TANDA + 1} a ${Math.min(enTandas.length, (t + 1) * POR_TANDA)}`);
    });
    const diccionarioLista = await cargarDiccionario();
    diccionarioLista.forEach((x, i) => {
      const t = Math.floor(i / POR_TANDA);
      tandaDe.set(x.ruta, `Probar sílabas del diccionario ${t * POR_TANDA + 1} a ${Math.min(diccionarioLista.length, (t + 1) * POR_TANDA)}`);
    });
    pintarMalas();
  }
  const textoMala = (m) => `${m.numero ? `N.º ${m.numero} de ${m.total ?? (totalTodas || '…')} (${nombreLista(m.lista)}) · ` : ''}${m.texto}${tandaDe.has(m.ruta) ? ` · tanda: «${tandaDe.get(m.ruta)}»` : ''}`;

  function pintarMalas() {
    listaMalas.replaceChildren(
      ...malas.map((m) => {
        const oir = el('button', { type: 'button', class: 'boton secundario', 'aria-label': `Reproducir ${m.texto}`, disabled: !m.ruta || undefined }, 'Reproducir');
        oir.addEventListener('click', () => reproducirAislada(m.ruta));
        const quitar = el('button', { type: 'button', class: 'boton secundario', 'aria-label': `Quitar ${m.texto}` }, 'Quitar');
        quitar.addEventListener('click', () => { malas = malas.filter((x) => x !== m); guardarMalas(malas); pintarMalas(); pintarActual(); });
        return el('li', {}, el('span', {}, textoMala(m)), ' ', oir, ' ', quitar);
      }),
    );
    bloqueMalas.hidden = malas.length === 0;
  }

  /** Reproduce una sola grabación, aparte de la lista (la lista queda en pausa). */
  function reproducirAislada(rutaMp3) {
    if (!rutaMp3) return;
    if (audio && !audio.paused) { audio.pause(); pausar.textContent = 'Seguir'; }
    if (aislado) { aislado.pause(); aislado = null; }
    aislado = new Audio(rutaMp3);
    aislado.play().catch(() => { estado.textContent = 'El navegador bloqueó el sonido.'; });
  }

  function pintarActual() {
    const x = items[actual];
    if (!x) { actualTexto.textContent = ''; return; }
    actualTexto.textContent = `${actual + 1} de ${items.length} · ${etiqueta(x)}`;
    marcar.textContent = esMala(x) ? 'Quitar la marca' : 'Marcar como mala';
  }

  function posicion() {
    return (inicios[actual] ?? 0) + (audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
  }
  function pintarPosicion() {
    if (!arrastrando) barra.value = String(posicion());
    tiempo.textContent = `${formato(arrastrando ? Number(barra.value) : posicion())} / ${formato(total)}`;
  }

  function detener() {
    clearTimeout(temporizador);
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio = null; }
  }

  /** Reproduce el audio `indice` desde `segundo`. */
  function reproducir(indice, segundo = 0) {
    detener();
    if (aislado) { aislado.pause(); aislado = null; }
    if (indice >= items.length) {
      actual = items.length - 1;
      estado.textContent = 'Terminó la lista.';
      pausar.textContent = 'Volver a empezar';
      pausar.dataset.reiniciar = '1';
      return;
    }
    actual = indice;
    delete pausar.dataset.reiniciar;
    pintarActual();
    audio = new Audio(items[actual].ruta);
    audio.addEventListener('timeupdate', pintarPosicion);
    audio.addEventListener('ended', () => {
      temporizador = setTimeout(() => reproducir(actual + 1), PAUSA_ENTRE_AUDIOS_MS);
    });
    audio.addEventListener('error', () => {
      estado.textContent = `No se pudo reproducir ${etiqueta(items[actual])}.`;
      temporizador = setTimeout(() => reproducir(actual + 1), PAUSA_ENTRE_AUDIOS_MS);
    });
    audio.addEventListener('loadedmetadata', () => { if (segundo > 0) audio.currentTime = segundo; }, { once: true });
    pausar.textContent = 'Pausar';
    audio.play().catch(() => { estado.textContent = 'El navegador bloqueó el sonido: toca «Pausar» y luego «Seguir».'; pausar.textContent = 'Seguir'; });
  }

  /** Salta a un segundo del total. */
  function irA(segundoTotal) {
    const t = Math.min(Math.max(0, segundoTotal), Math.max(0, total - 0.05));
    let i = inicios.findIndex((ini, k) => t >= ini && (k === inicios.length - 1 || t < inicios[k + 1]));
    if (i < 0) i = 0;
    const estabaPausado = audio ? audio.paused : false;
    reproducir(i, t - inicios[i]);
    if (estabaPausado && audio) { audio.pause(); pausar.textContent = 'Seguir'; }
    pintarPosicion();
  }

  pausar.addEventListener('click', () => {
    if (pausar.dataset.reiniciar) { reproducir(0); return; }
    if (!audio) return;
    if (audio.paused) { audio.play(); pausar.textContent = 'Pausar'; } else { audio.pause(); pausar.textContent = 'Seguir'; }
  });
  atras.addEventListener('click', () => irA(posicion() - 10));
  barra.addEventListener('input', () => { arrastrando = true; pintarPosicion(); });
  barra.addEventListener('change', () => { arrastrando = false; irA(Number(barra.value)); });
  marcar.addEventListener('click', () => {
    const x = items[actual];
    if (!x) return;
    const e = etiqueta(x);
    malas = esMala(x) ? malas.filter((m) => m.texto !== e) : [...malas, { texto: e, ruta: x.ruta, numero: actual + 1, total: items.length, lista: modoActual }];
    guardarMalas(malas);
    pintarMalas();
    pintarActual();
  });
  copiar.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(malas.map(textoMala).join('\n')); estado.textContent = 'Lista copiada.'; } catch { estado.textContent = 'No se pudo copiar: anótalas a mano.'; }
  });
  vaciar.addEventListener('click', () => { malas = []; guardarMalas(malas); pintarMalas(); pintarActual(); });

  /**
   * Las marcas viejas (sin lista guardada) se ponen con el número de su lista: las del tramo de frases y sílabas
   * con el «139 de 280» de ese tramo, y las demás con el de la lista completa.
   */
  async function normalizarMarcas() {
    const completa = await cargarLista('todas');
    const tramo = await cargarLista('tramo');
    numeros = new Map(completa.map((x, i) => [x.ruta, i + 1]));
    totalTodas = completa.length;
    malas = malas.map((m) => {
      if (m.lista) return m;
      const rutaMp3 = m.ruta ?? completa.find((y) => etiqueta(y) === m.texto)?.ruta;
      const i = tramo.findIndex((y) => y.ruta === rutaMp3);
      if (i >= 0) return { ...m, ruta: rutaMp3, numero: i + 1, total: tramo.length, lista: 'tramo' };
      const n = numeros.get(rutaMp3) ?? m.numero ?? null;
      return { ...m, ruta: rutaMp3, numero: n, total: n ? totalTodas : null, lista: 'todas' };
    });
    guardarMalas(malas);
    pintarMalas();
  }

  async function iniciar(modo) {
    detener();
    const botones = [preparar, prepararTramo, prepararFrases, ...botonesTanda];
    for (const b of botones) b.disabled = true;
    estado.textContent = 'Preparando la lista…';
    try {
      items = await cargarLista(modo);
      modoActual = modo;
      await normalizarMarcas();
      const duraciones = [];
      for (let i = 0; i < items.length; i += 20) {
        duraciones.push(...(await Promise.all(items.slice(i, i + 20).map((x) => duracionDe(x.ruta)))));
        estado.textContent = `Preparando la lista… ${Math.min(i + 20, items.length)} de ${items.length}`;
      }
      inicios = [];
      total = 0;
      for (const d of duraciones) { inicios.push(total); total += d; }
      barra.max = String(total);
      barra.value = '0';
      barra.disabled = false;
      for (const b of [pausar, atras, marcar]) b.disabled = false;
      estado.textContent = `${items.length} grabaciones, ${formato(total)} en total.`;
      reproducir(0);
    } catch (e) {
      console.error(e);
      estado.textContent = e?.message ?? 'No se pudo preparar la lista.';
    } finally {
      for (const b of botones) b.disabled = false;
    }
  }
  preparar.addEventListener('click', () => iniciar('palabras'));
  prepararTramo.addEventListener('click', () => iniciar('silabas'));
  prepararFrases.addEventListener('click', () => iniciar('frases'));

  // Un botón por cada 200 voces nuevas de Escritura (los pone cuando lee la lista)
  const botonesTanda = [];
  cargarTandaNueva().then((nuevas) => {
    // (`extra`: una sílaba corregida que no es de ninguna tanda; solo cuenta en su botón de revisión)
    const deTandas = nuevas.filter((x) => !x.extra);
    const enTandas = deTandas.length;
    for (let i = 1; i * POR_TANDA < enTandas; i++) { // la tanda 1 (i = 0) ya está en las listas por tipo
      // si ya no queda nada por oír (todo aprobado o corregido), el botón desaparece
      if (!deTandas.slice(i * POR_TANDA, (i + 1) * POR_TANDA).some((x) => !x.revisar && !x.aprobada)) continue;
      const desde = i * POR_TANDA + 1;
      const hasta = Math.min(enTandas, (i + 1) * POR_TANDA);
      const b = el('button', { type: 'button', class: 'boton secundario' }, `Probar voces nuevas de Escritura ${desde} a ${hasta}`);
      b.addEventListener('click', () => iniciar(`tanda${i + 1}`));
      botonesTanda.push(b);
      filaTandas.append(b);
    }
    // las que se regeneraron tras la primera revisión de la tanda 1
    const numeros = [...new Set(nuevas.filter((x) => x.revisar).map((x) => (x.revisar === true ? 1 : x.revisar)))].sort((a, b) => b - a);
    for (const n of numeros) {
      const corregidas = nuevas.filter((x) => (x.revisar === true ? 1 : x.revisar) === n).length;
      const b = el('button', { type: 'button', class: 'boton' }, `Revisión tanda ${n}: ${corregidas === 1 ? 'la que corregí' : `las ${corregidas} que corregí`}`);
      b.addEventListener('click', () => iniciar(`revision${n}`));
      botonesTanda.push(b);
      filaTandas.prepend(b);
    }
  }).catch((e) => console.error(e));

  // Un botón por cada 200 sílabas del diccionario que aún no se aprobaron
  cargarDiccionario().then((silabas) => {
    for (let i = 0; i * POR_TANDA < silabas.length; i++) {
      if (TANDAS_DEL_DICCIONARIO_APROBADAS.has(i + 1)) continue;
      const hasta = Math.min(silabas.length, (i + 1) * POR_TANDA);
      const b = el('button', { type: 'button', class: 'boton secundario' }, `Probar sílabas del diccionario ${i * POR_TANDA + 1} a ${hasta}`);
      b.addEventListener('click', () => iniciar(`diccionario${i + 1}`));
      botonesTanda.push(b);
      filaTandas.append(b);
    }
  }).catch((e) => console.error(e));

  pintarMalas();
  aprenderTandas().catch((e) => console.error(e));
  normalizarMarcas().catch((e) => console.error(e));

  const panel = el(
    'div',
    { class: 'panel revisor-voces' },
    el('h2', {}, 'Revisar las voces'),
    el('p', { class: 'ayuda' }, 'Reproduce de corrido las frases y palabras con la voz de Catalina, para escuchar cuáles suenan mal. Marca las malas y copia la lista para regenerarlas.'),
    el('div', { class: 'acciones' }, preparar, prepararTramo, prepararFrases),
    filaTandas,
    estado,
    actualTexto,
    barra,
    tiempo,
    controles,
    bloqueMalas,
  );
  // Al salir de la pantalla, el sonido se corta
  let estuvoEnPantalla = false;
  const observador = new MutationObserver(() => {
    if (panel.isConnected) { estuvoEnPantalla = true; return; }
    if (estuvoEnPantalla) { detener(); observador.disconnect(); }
  });
  observador.observe(document.body, { childList: true, subtree: true });
  return panel;
}
