// Sesión de práctica del niño. Esta pantalla solo dibuja y ejecuta efectos (voz, vibración, guardado);
// las reglas (toques, ayuda sin error, avance, fatiga) viven en js/core/controlador.js y están probadas.
//
// Reglas que se ven aquí (PLAN.md §2):
//  - Un error NUNCA suena ni vibra ni se pinta de rojo: la opción se atenúa, la correcta se ilumina y late,
//    y se vuelve a decir la palabra. Después de acertar hay un elogio breve.
//  - Sin cronómetro ni límite de tiempo. Sin textos: la consigna se dice en voz alta (la primera vez de cada actividad).

import { el } from '../ui/dom.js';
import { ajustarTextos } from '../ui/ajustar-texto.js';
import { deshabilitarAdulto } from '../acceso.js';
import { NOMBRE_APP } from '../config.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { liberarUrls, urlDeMedio } from '../medios.js';
import { decirFrase, decirPalabra, desbloquearAudio, detener, hablarTexto } from '../audio.js';
import { vibrar } from '../hardware.js';
import { crearControlador } from '../core/controlador.js';
import { aplicarAutoajuste } from '../autoajuste.js';

import { ACTIVIDADES } from '../actividades/indice.js';
import { establecerPremio, lluviaDeEstrellas, terminarLeccion } from './premio.js';

export const titulo = NOMBRE_APP;

const PAUSA_CELEBRACION_MS = { normal: 1400, suave: 700, ninguna: 500 };
const BLOQUEO_MODELO_MS = 400;
const ICONO_CASA = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 8L6 32h8v22h14V40h8v14h14V32h8z" fill="currentColor"/></svg>`;

export function montar(contenedor, { ir }) {
  deshabilitarAdulto();

  const area = el('div', { class: 'area-ensayo' });
  // Salida del niño: vuelve al inicio; lo avanzado se guarda como sesión interrumpida (ver sesion.limpiar)
  const casa = el('button', {
    type: 'button',
    class: 'boton-casa boton-casa-chico',
    'aria-label': 'Salir',
    onclick: () => { detener(); ir('/nino'); },
  });
  casa.innerHTML = ICONO_CASA;
  const vista = el('section', { class: 'vista-nino sesion-nino' }, area, casa);
  vista.addEventListener('contextmenu', (e) => e.preventDefault()); // sin menú de pulsación larga
  contenedor.append(vista);

  const sesion = { vivo: true, finalizada: false, limpiar: () => {} };
  const alOcultar = () => { if (document.hidden) detener(); };
  document.addEventListener('visibilitychange', alOcultar);

  iniciar({ vista, area, ir, sesion }).catch((error) => {
    console.error(error);
    area.replaceChildren(el('p', { class: 'mensaje-nino' }, 'Algo no funcionó. Toca la casa para volver.'));
  });

  return () => {
    sesion.vivo = false;
    document.removeEventListener('visibilitychange', alOcultar);
    detener();
    liberarUrls();
    sesion.limpiar();
  };
}

async function iniciar({ vista, area, ir, sesion }) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!sesion.vivo) return;
  if (!perfil) { ir('/nino'); return; }

  const [palabras, frases, progresos, niveles, respuestas] = await Promise.all([
    store.listar('palabras', { perfilId: perfil.id }),
    store.listar('frases', { perfilId: perfil.id }),
    store.listar('progresos', { perfilId: perfil.id }),
    store.listar('niveles', { perfilId: perfil.id }),
    store.listar('respuestas', { perfilId: perfil.id }),
  ]);
  const ctl = crearControlador({ perfil, palabras, frases, progresos, niveles, respuestas });
  const ajustes = ctl.ajustes;
  if (ctl.terminada) { ir('/nino'); return; } // no hay nada que practicar

  vista.classList.toggle('mayusculas', ajustes.mayusculas);
  vista.classList.toggle('letra-grande', ajustes.tamanoLetra === 'grande');
  vista.classList.toggle('alto-contraste', ajustes.altoContraste);

  // Las imágenes se preparan antes de empezar para que cada ensayo aparezca completo
  const urls = new Map();
  for (const id of ctl.idsDeMedios) urls.set(id, await urlDeMedio(store, id));
  if (!sesion.vivo) return;

  const inicio = new Date();
  const ahora = () => performance.now();
  const obtenerMedio = (id) => store.obtener('medios', id);
  const celebracion = ajustes.intensidadCelebracion;

  let manejador = null;
  let cerrando = false; // entre el acierto y el siguiente ensayo
  let ultimoToqueModelo = -Infinity;
  let turno = 0; // invalida audios de ensayos que ya pasaron
  let temporizador = null;
  let guardado = Promise.resolve();
  let quitarAjuste = () => {};

  const guardar = (tarea) => {
    guardado = guardado.then(tarea).catch((e) => console.error('No se pudo guardar el progreso', e));
  };

  const palabraActual = () => ctl.palabras.get(ctl.actual().elementoId);
  // Dice lo que corresponde al ensayo: un texto fijo (la pregunta de «clasificar»), una frase palabra por
  // palabra (resaltando la que suena) o una palabra suelta.
  function decirLaPalabra() {
    const ensayo = ctl.actual();
    if (ensayo.dicho) return hablarTexto(ensayo.dicho, { velocidad: ajustes.velocidadVoz });
    const elemento = palabraActual();
    if (elemento.esFrase) {
      const partes = elemento.palabraIds.map((id) => ctl.palabrasPorId.get(id)).filter(Boolean);
      const modelo = area.querySelector('.zona-modelo');
      return decirFrase(partes, {
        obtenerMedio,
        velocidad: ajustes.velocidadVoz,
        alPalabra: (i) => modelo?.setAttribute('data-suena', String(i)),
      }).finally(() => modelo?.removeAttribute('data-suena'));
    }
    return decirPalabra(elemento, { obtenerMedio, velocidad: ajustes.velocidadVoz });
  }

  async function presentar(ensayo) {
    const mio = ++turno;
    if (ensayo.decirConsigna && ajustes.sonido) {
      await hablarTexto(ensayo.consigna, { velocidad: ajustes.velocidadVoz });
      if (mio !== turno || !sesion.vivo) return;
    }
    if (ensayo.audioInicial) await decirLaPalabra();
  }

  function mostrar(ensayo) {
    manejador = ACTIVIDADES[ensayo.actividad].render(area, ensayo, {
      palabras: ctl.palabras,
      urls,
      alToque,
      alToqueModelo,
    });
    quitarAjuste();
    quitarAjuste = ajustarTextos(area);
    presentar(ensayo);
  }

  function alToqueModelo() {
    if (cerrando || !sesion.vivo) return;
    const t = ahora();
    if (t - ultimoToqueModelo < BLOQUEO_MODELO_MS) return; // toques repetidos: uno solo
    ultimoToqueModelo = t;
    ctl.oirOtraVez(); // cuenta para el registro fino: cuántas veces pidió oír otra vez
    desbloquearAudio();
    decirLaPalabra();
  }

  function alToque(id) {
    if (cerrando || !sesion.vivo) return;
    desbloquearAudio();
    const r = ctl.tocar(id, ahora());
    if (r.efecto === 'ignorado') return;

    if (r.efecto === 'paso') {
      // «Armo la frase»: la ficha acertada salta a la franja y vuelven a poder usarse las atenuadas
      manejador.limpiarAyudas();
      manejador.colocar(r.fichaId);
      return;
    }

    if (r.efecto === 'ayuda') {
      // Sin sonido de error, sin vibración, sin rojo: se guía hacia la correcta y se repite la palabra
      for (const a of r.atenuadas) manejador.atenuar(a);
      manejador.resaltar(r.siguienteId ?? r.correctaId);
      manejador.revelarAudio();
      turno += 1;
      decirLaPalabra();
      return;
    }

    // correcto
    cerrando = true;
    turno += 1;
    if (r.fichaId) { // la última ficha de la frase
      manejador.limpiarAyudas();
      manejador.colocar(r.fichaId);
    }
    manejador.marcarAcierto(id, { celebrar: celebracion !== 'ninguna' });
    if (celebracion === 'normal') lluviaDeEstrellas(vista);
    if (celebracion !== 'ninguna' && ajustes.sonido) hablarTexto(r.elogio, { velocidad: ajustes.velocidadVoz });
    else detener();
    if (celebracion !== 'ninguna' && ajustes.vibracion) vibrar(40);
    temporizador = setTimeout(avanzar, PAUSA_CELEBRACION_MS[celebracion]);
  }

  async function avanzar() {
    if (!sesion.vivo) return;
    const r = ctl.avanzar(ahora());
    guardar(() => store.guardar('progresos', r.guardar.progreso));
    if (r.guardar.nivel) guardar(() => store.guardar('niveles', r.guardar.nivel)); // la lectura asistida no mueve el nivel
    guardar(() => store.guardar('respuestas', r.guardar.respuesta)); // registro fino (fase 12)
    if (r.terminada) { await finalizar(); return; }
    cerrando = false;
    mostrar(r.siguiente);
  }

  async function finalizar() {
    sesion.finalizada = true;
    const fin = new Date();
    try {
      await guardado;
      await store.guardar('sesiones', ctl.registro({ inicio, fin }));
      // Ajustes automáticos (fase 14): se revisan al terminar, nunca a mitad de una sesión. Un fallo aquí no debe afectar al niño.
      try {
        await aplicarAutoajuste(store, perfil.id, fin);
      } catch (error) {
        console.error('No se pudieron revisar los ajustes automáticos', error);
      }
      // La calcomanía de hoy; si completa el álbum, también guarda sus monedas (fase 11)
      await terminarLeccion(store, perfil, ajustes);
    } catch (error) {
      console.error('No se pudo cerrar la sesión', error);
      establecerPremio({ codigo: 'estrella', ajustes }); // el niño igual recibe su premio
    }
    if (sesion.vivo) ir('/nino/premio');
  }

  // Si se sale a mitad (botón de la casa), se guarda lo que se alcanzó a hacer
  sesion.limpiar = () => {
    clearTimeout(temporizador);
    quitarAjuste();
    if (!sesion.finalizada && ctl.ensayosHechos > 0) {
      guardar(() => store.guardar('sesiones', { ...ctl.registro({ inicio, fin: new Date() }), interrumpida: true }));
    }
  };

  mostrar(ctl.iniciar(ahora()));
}
