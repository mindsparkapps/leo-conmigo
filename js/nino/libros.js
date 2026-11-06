// «Mi libro» (B1): el estante de libros del niño (#/nino/libros) y la lectura de un libro (#/nino/libro/<id>).
// Cada página tiene una foto y una frase. Al tocar el altavoz o la foto se lee la frase entera resaltando
// cada palabra; al tocar una palabra se dice sola. No se evalúa nada: no hay aciertos ni errores.

import { el } from '../ui/dom.js';
import { crearCandado } from '../ui/candado.js';
import { crearCarta } from '../ui/carta.js';
import { crearBotonAudio } from '../ui/boton-audio.js';
import { habilitarAdulto, deshabilitarAdulto } from '../acceso.js';
import { NOMBRE_APP } from '../config.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { liberarUrls, urlDeMedio } from '../medios.js';
import { decirFrase, decirPalabra, desbloquearAudio, detener, hablarTexto } from '../audio.js';
import { vibrar } from '../hardware.js';
import { esSegundoDedo } from '../actividades/comun.js';
import { normalizarAjustes } from '../core/modelos.js';
import { librosParaElNino, paginasLeibles, palabrasDeFrase, partesDeCollage } from '../core/frases.js';
import { armarPregunta, preguntasLeibles } from '../core/cuentos.js';
import { nuevoId } from '../core/id.js';
import { crearIntento, tocar as tocarIntento } from '../core/intento.js';
import { construirRespuesta } from '../core/registro.js';
import { elegirElogio } from '../core/elogios.js';
import { lluviaDeEstrellas } from './premio.js';

export const titulo = NOMBRE_APP;

const BLOQUEO_NAVEGACION_MS = 400;
const RUTA_LIBRO = '/nino/libro/';
const PAUSA_CELEBRACION_MS = { normal: 1400, suave: 700, ninguna: 500 };

const ICONO_CASA = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 8L6 32h8v22h14V40h8v14h14V32h8z" fill="currentColor"/></svg>`;
const ICONO_SIGUIENTE = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M22 8l28 24-28 24z" fill="currentColor"/></svg>`;
const ICONO_ANTERIOR = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M42 8L14 32l28 24z" fill="currentColor"/></svg>`;
const ICONO_LISTO = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M10 34l14 14L54 16" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function boton(clase, etiqueta, icono, alToque) {
  const b = el('button', {
    type: 'button',
    class: clase,
    'aria-label': etiqueta,
    onclick: (e) => { if (!esSegundoDedo(e)) alToque(); },
  });
  b.innerHTML = icono;
  return b;
}

export function montar(contenedor, { ruta, ir }) {
  deshabilitarAdulto();
  const candado = crearCandado({ alDesbloquear: () => { habilitarAdulto(); ir('/adulto'); } });
  const vista = el('section', { class: 'vista-nino libros-nino' }, candado);
  vista.addEventListener('contextmenu', (e) => e.preventDefault());
  contenedor.append(vista);

  const estado = { vivo: true, limpiar: () => {} };
  const idLibro = ruta.startsWith(RUTA_LIBRO) ? decodeURIComponent(ruta.slice(RUTA_LIBRO.length)) : null;
  pintar({ vista, ir, estado, idLibro }).catch((error) => {
    console.error(error);
    vista.prepend(el('p', { class: 'mensaje-nino' }, 'Algo no funcionó. Un adulto puede tocar el candado.'));
  });

  return () => {
    estado.vivo = false;
    detener();
    liberarUrls();
    estado.limpiar();
  };
}

/** Lo que se ve de una página: su foto, o la de su frase, o un collage con las imágenes de sus palabras. */
function datosDePagina(pagina, frasesPorId, palabrasPorId) {
  const frase = frasesPorId.get(pagina.fraseId);
  const palabras = palabrasDeFrase(frase, palabrasPorId);
  const medioId = pagina.medioImagenId ?? frase.medioImagenId ?? null;
  const partes = medioId ? [] : partesDeCollage(palabras);
  return { frase, palabras, medioId, partes };
}

async function cargarUrls(store, paginas, frasesPorId, palabrasPorId) {
  const urls = new Map();
  const ids = new Set();
  for (const p of paginas) {
    const { medioId, partes } = datosDePagina(p, frasesPorId, palabrasPorId);
    if (medioId) ids.add(medioId);
    for (const parte of partes) if (parte.medioImagenId) ids.add(parte.medioImagenId);
  }
  for (const id of ids) urls.set(id, await urlDeMedio(store, id));
  return urls;
}

/** La imagen de una página (solo se muestra): foto o collage. */
function crearImagenPagina(datos, urls) {
  const urlDe = (m) => (m ? urls.get(m) ?? null : null);
  return crearCarta({
    forma: 'imagen',
    palabra: { id: datos.frase.id, texto: datos.frase.texto, esFrase: true },
    url: urlDe(datos.medioId),
    partes: datos.partes.map((palabra) => ({ palabra, url: urlDe(palabra.medioImagenId) })),
    grande: true,
    interactiva: false,
  });
}

async function pintar({ vista, ir, estado, idLibro }) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!estado.vivo) return;
  if (!perfil) { ir('/nino'); return; }

  const [palabras, frases, libros] = await Promise.all([
    store.listar('palabras', { perfilId: perfil.id }),
    store.listar('frases', { perfilId: perfil.id }),
    store.listar('libros', { perfilId: perfil.id }),
  ]);
  if (!estado.vivo) return;
  const palabrasPorId = new Map(palabras.filter((p) => !p.deleted).map((p) => [p.id, p]));
  const frasesPorId = new Map(frases.filter((f) => !f.deleted).map((f) => [f.id, f]));
  const disponibles = librosParaElNino(libros, frasesPorId, palabrasPorId);
  const ajustes = normalizarAjustes(perfil.ajustes);

  vista.classList.toggle('mayusculas', ajustes.mayusculas);
  vista.classList.toggle('letra-grande', ajustes.tamanoLetra === 'grande');
  vista.classList.toggle('alto-contraste', ajustes.altoContraste);

  const casa = boton('boton-nav boton-nav-casa', 'Volver al inicio', ICONO_CASA, () => ir('/nino'));

  if (!idLibro) {
    await pintarEstante({ vista, ir, estado, store, disponibles, frasesPorId, palabrasPorId, casa });
    return;
  }
  const libro = disponibles.find((l) => l.id === idLibro);
  if (!libro) { ir('/nino/libros', true); return; }
  await pintarLibro({ vista, ir, estado, store, perfilId: perfil.id, libro, frasesPorId, palabrasPorId, ajustes });
}

function elegirImagenDe(palabra, urls) {
  return palabra.medioImagenId ? urls.get(palabra.medioImagenId) ?? null : null;
}

// ---------- el estante ----------

async function pintarEstante({ vista, ir, estado, store, disponibles, frasesPorId, palabrasPorId, casa }) {
  if (!disponibles.length) {
    vista.prepend(casa, el('p', { class: 'mensaje-nino' }, 'Un adulto debe armar un libro.'));
    return;
  }
  const portadas = disponibles.map((l) => paginasLeibles(l, frasesPorId, palabrasPorId)[0]);
  const urls = await cargarUrls(store, portadas, frasesPorId, palabrasPorId);
  if (!estado.vivo) return;

  const estante = el('div', { class: 'estante', 'data-n': String(disponibles.length) });
  disponibles.forEach((libro, i) => {
    const portada = crearImagenPagina(datosDePagina(portadas[i], frasesPorId, palabrasPorId), urls);
    portada.classList.add('portada');
    const tapa = el(
      'button',
      {
        type: 'button',
        class: 'tapa-libro',
        'aria-label': libro.titulo,
        onclick: (e) => {
          if (esSegundoDedo(e)) return;
          desbloquearAudio();
          ir(RUTA_LIBRO + encodeURIComponent(libro.id));
        },
      },
      portada,
      el('span', { class: 'palabra-texto titulo-libro' }, libro.titulo),
    );
    estante.append(tapa);
  });
  vista.prepend(casa, estante);
}

// ---------- un libro ----------

async function pintarLibro({ vista, ir, estado, store, perfilId, libro, frasesPorId, palabrasPorId, ajustes }) {
  const paginas = paginasLeibles(libro, frasesPorId, palabrasPorId);
  const preguntas = preguntasLeibles(libro, palabrasPorId); // cuento: al final, preguntas que se responden por imagen
  const urls = await cargarUrls(store, paginas, frasesPorId, palabrasPorId);
  for (const q of preguntas) {
    for (const id of [q.correctaId, ...q.distractorIds]) {
      const medioId = palabrasPorId.get(id).medioImagenId;
      if (medioId && !urls.has(medioId)) urls.set(medioId, await urlDeMedio(store, medioId));
    }
  }
  if (!estado.vivo) return;

  const obtenerMedio = (id) => store.obtener('medios', id);
  const velocidad = ajustes.velocidadVoz;
  const area = el('div', { class: 'pagina-libro' });
  const salir = boton('boton-nav boton-nav-casa', 'Volver a los libros', ICONO_CASA, () => ir('/nino/libros'));
  vista.prepend(salir, area);

  let indice = 0;
  let ultimaNavegacion = -Infinity;
  let palabrasEnPantalla = [];
  let datos = null;

  const marcar = (i) => palabrasEnPantalla.forEach((b, k) => b.classList.toggle('suena', k === i));

  function leerFrase() {
    if (!ajustes.sonido) return;
    desbloquearAudio();
    decirFrase(datos.palabras, { obtenerMedio, velocidad, alPalabra: marcar });
  }

  function leerPalabra(i) {
    if (!ajustes.sonido) return;
    desbloquearAudio();
    marcar(i);
    decirPalabra(datos.palabras[i], { obtenerMedio, velocidad }).finally(() => marcar(-1));
  }

  function mostrarPagina() {
    detener();
    datos = datosDePagina(paginas[indice], frasesPorId, palabrasPorId);
    const imagen = crearImagenPagina(datos, urls);
    imagen.classList.add('foto-libro');
    imagen.addEventListener('click', (e) => { if (!esSegundoDedo(e)) leerFrase(); });

    palabrasEnPantalla = datos.palabras.map((p, i) =>
      el('button', {
        type: 'button',
        class: 'palabra-libro',
        onclick: (e) => { if (!esSegundoDedo(e)) leerPalabra(i); },
      }, el('span', { class: 'palabra-texto' }, p.texto)),
    );
    const texto = el('p', { class: 'texto-libro', 'aria-label': datos.frase.texto }, palabrasEnPantalla);

    const esUltima = indice === paginas.length - 1;
    const anterior = boton('boton-nav', 'Página anterior', ICONO_ANTERIOR, () => cambiar(-1));
    anterior.disabled = indice === 0;
    anterior.classList.toggle('oculto', indice === 0);
    let siguiente;
    if (esUltima && preguntas.length) siguiente = boton('boton-nav boton-nav-listo', 'Responder las preguntas', ICONO_SIGUIENTE, () => mostrarPregunta(0));
    else if (esUltima) siguiente = boton('boton-nav boton-nav-listo', 'Terminé el libro', ICONO_LISTO, () => ir('/nino/libros'));
    else siguiente = boton('boton-nav', 'Página siguiente', ICONO_SIGUIENTE, () => cambiar(1));
    const navegacion = el(
      'div',
      { class: 'navegacion-libro' },
      anterior,
      crearBotonAudio({ grande: false, alToque: leerFrase }),
      siguiente,
    );
    area.replaceChildren(imagen, texto, navegacion);
  }

  // ---- etapa 4: las preguntas del cuento. Sin error: la opción equivocada se atenúa y la correcta se ilumina ----
  let temporizador = null;
  let ultimoElogio = null;
  estado.limpiar = () => clearTimeout(temporizador);
  const celebracion = ajustes.intensidadCelebracion;
  const sesionId = nuevoId(); // una «sesión» por lectura de las preguntas del cuento

  // Registro fino (fase 12): las preguntas no mueven el progreso, pero sirven para el análisis
  function registrarRespuesta(i, q, intento, repeticionesAudio) {
    const respuesta = construirRespuesta({
      perfilId,
      sesionId,
      numeroEnSesion: i + 1,
      fecha: new Date(),
      etapa: 4,
      ensayo: { elementoId: q.correctaId, actividad: 'B2', tipo: 'cuento', esFacil: false },
      elemento: palabrasPorId.get(q.correctaId),
      visual: { cartas: q.cartas, posicionCorrecta: q.cartas.findIndex((c) => c.id === q.correctaId) },
      intento,
      textoDe: (id) => palabrasPorId.get(id)?.texto ?? null,
      repeticionesAudio,
      extra: { libroId: libro.id, pregunta: q.texto },
    });
    store.guardar('respuestas', respuesta).catch((e) => console.error('No se pudo guardar la respuesta', e));
  }

  function mostrarPregunta(i) {
    detener();
    const q = armarPregunta({ pregunta: preguntas[i] });
    let intento = crearIntento({ correctaId: q.correctaId, cartas: q.cartas }, performance.now());
    let cerrando = false;
    let repeticionesAudio = 0; // veces que el niño tocó el altavoz para oír otra vez
    const decirPregunta = () => {
      if (!ajustes.sonido) return;
      desbloquearAudio();
      hablarTexto(q.texto, { velocidad });
    };

    const cartas = new Map();
    const zonaOpciones = el('div', { class: 'zona-opciones', 'data-forma': 'imagen', 'data-n': String(q.cartas.length), style: `--n:${q.cartas.length}` });
    for (const { id } of q.cartas) {
      const palabra = palabrasPorId.get(id);
      const carta = crearCarta({ forma: 'imagen', palabra, url: elegirImagenDe(palabra, urls) });
      carta.addEventListener('click', (e) => { if (!esSegundoDedo(e)) alToque(id); });
      cartas.set(id, carta);
      zonaOpciones.append(carta);
    }
    const zonaModelo = el('div', { class: 'zona-modelo' }, el('p', { class: 'texto-pregunta' }, q.texto), crearBotonAudio({ alToque: () => { if (!cerrando) repeticionesAudio += 1; decirPregunta(); } }));
    area.replaceChildren(el('div', { class: 'area-ensayo pregunta-libro' }, zonaModelo, zonaOpciones));

    function alToque(id) {
      if (cerrando) return;
      const r = tocarIntento(intento, id, performance.now());
      intento = r.intento;
      if (r.efecto === 'ignorado') return;
      desbloquearAudio();
      if (r.efecto === 'ayuda') {
        cartas.get(id).classList.add('atenuada');
        cartas.get(q.correctaId).classList.add('ayuda');
        decirPregunta();
        return;
      }
      cerrando = true;
      registrarRespuesta(i, q, intento, repeticionesAudio);
      const acertada = cartas.get(id);
      acertada.classList.remove('ayuda');
      acertada.classList.add('acierto');
      if (celebracion !== 'ninguna') acertada.classList.add('celebrar');
      if (celebracion === 'normal') lluviaDeEstrellas(vista);
      if (celebracion !== 'ninguna' && ajustes.sonido) {
        ultimoElogio = elegirElogio(ultimoElogio);
        hablarTexto(ultimoElogio, { velocidad });
      } else detener();
      if (celebracion !== 'ninguna' && ajustes.vibracion) vibrar(40);
      temporizador = setTimeout(() => {
        if (!estado.vivo) return;
        if (i + 1 < preguntas.length) mostrarPregunta(i + 1);
        else ir('/nino/libros');
      }, PAUSA_CELEBRACION_MS[celebracion]);
    }

    temporizador = setTimeout(decirPregunta, 300);
  }

  function cambiar(paso) {
    const t = performance.now();
    if (t - ultimaNavegacion < BLOQUEO_NAVEGACION_MS) return; // toques repetidos: uno solo
    ultimaNavegacion = t;
    const nuevo = indice + paso;
    if (nuevo < 0 || nuevo >= paginas.length) return;
    indice = nuevo;
    mostrarPagina();
  }

  mostrarPagina();
}
