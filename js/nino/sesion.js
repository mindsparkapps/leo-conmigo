// Sesión de práctica del niño. Esta pantalla solo dibuja y ejecuta efectos (voz, vibración, guardado);
// las reglas (toques, ayuda sin error, avance, fatiga) viven en js/core/controlador.js y están probadas.
//
// Reglas que se ven aquí (PLAN.md §2):
//  - Un error NUNCA suena ni vibra ni se pinta de rojo: la opción se atenúa, la correcta se ilumina y late,
//    y se vuelve a decir la palabra. Después de acertar hay un elogio breve.
//  - Sin cronómetro ni límite de tiempo. Sin textos: la consigna se dice en voz alta (la primera vez de cada actividad).

import { el } from '../ui/dom.js';
import { crearCandado } from '../ui/candado.js';
import { ajustarTextos } from '../ui/ajustar-texto.js';
import { habilitarAdulto, deshabilitarAdulto } from '../acceso.js';
import { NOMBRE_APP } from '../config.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { liberarUrls, urlDeMedio } from '../medios.js';
import { decirPalabra, desbloquearAudio, detener, hablarTexto } from '../audio.js';
import { vibrar } from '../hardware.js';
import { crearControlador } from '../core/controlador.js';
import { elegirCalcomania } from '../core/calcomanias.js';
import { ACTIVIDADES } from '../actividades/indice.js';
import { establecerPremio, lluviaDeEstrellas } from './premio.js';

export const titulo = NOMBRE_APP;

const PAUSA_CELEBRACION_MS = { normal: 1400, suave: 700, ninguna: 500 };
const BLOQUEO_MODELO_MS = 400;

export function montar(contenedor, { ir }) {
  deshabilitarAdulto();

  const area = el('div', { class: 'area-ensayo' });
  const candado = crearCandado({
    alDesbloquear: () => {
      habilitarAdulto();
      ir('/adulto');
    },
  });
  const vista = el('section', { class: 'vista-nino sesion-nino' }, area, candado);
  vista.addEventListener('contextmenu', (e) => e.preventDefault()); // sin menú de pulsación larga
  contenedor.append(vista);

  const sesion = { vivo: true, finalizada: false, limpiar: () => {} };
  const alOcultar = () => { if (document.hidden) detener(); };
  document.addEventListener('visibilitychange', alOcultar);

  iniciar({ vista, area, ir, sesion }).catch((error) => {
    console.error(error);
    area.replaceChildren(el('p', { class: 'mensaje-nino' }, 'Algo no funcionó. Un adulto puede tocar el candado.'));
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

  const [palabras, progresos, niveles] = await Promise.all([
    store.listar('palabras', { perfilId: perfil.id }),
    store.listar('progresos', { perfilId: perfil.id }),
    store.listar('niveles', { perfilId: perfil.id }),
  ]);
  const ctl = crearControlador({ perfil, palabras, progresos, niveles });
  const ajustes = ctl.ajustes;
  if (ctl.terminada) { ir('/nino'); return; } // no hay nada que practicar

  vista.classList.toggle('mayusculas', ajustes.mayusculas);
  vista.classList.toggle('letra-grande', ajustes.tamanoLetra === 'grande');
  vista.classList.toggle('alto-contraste', ajustes.altoContraste);

  // Las imágenes se preparan antes de empezar para que cada ensayo aparezca completo
  const urls = new Map();
  for (const p of ctl.palabras.values()) {
    if (p.medioImagenId) urls.set(p.medioImagenId, await urlDeMedio(store, p.medioImagenId));
  }
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
  const decirLaPalabra = () => decirPalabra(palabraActual(), { obtenerMedio, velocidad: ajustes.velocidadVoz });

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
    desbloquearAudio();
    decirLaPalabra();
  }

  function alToque(id) {
    if (cerrando || !sesion.vivo) return;
    desbloquearAudio();
    const r = ctl.tocar(id, ahora());
    if (r.efecto === 'ignorado') return;

    if (r.efecto === 'ayuda') {
      // Sin sonido de error, sin vibración, sin rojo: se guía hacia la correcta y se repite la palabra
      for (const a of r.atenuadas) manejador.atenuar(a);
      manejador.resaltar(r.correctaId);
      manejador.revelarAudio();
      turno += 1;
      decirLaPalabra();
      return;
    }

    // correcto
    cerrando = true;
    turno += 1;
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
    guardar(() => store.guardar('niveles', r.guardar.nivel));
    if (r.terminada) { await finalizar(); return; }
    cerrando = false;
    mostrar(r.siguiente);
  }

  async function finalizar() {
    sesion.finalizada = true;
    const fin = new Date();
    try {
      const tenidas = (await store.listar('calcomanias', { perfilId: perfil.id })).map((c) => c.codigo);
      const { codigo } = elegirCalcomania(tenidas);
      await guardado;
      await store.guardar('sesiones', ctl.registro({ inicio, fin }));
      await store.guardar('calcomanias', { perfilId: perfil.id, codigo, fecha: fin.toISOString() });
      establecerPremio({ codigo, ajustes });
    } catch (error) {
      console.error('No se pudo cerrar la sesión', error);
      establecerPremio({ codigo: 'estrella', ajustes }); // el niño igual recibe su premio
    }
    if (sesion.vivo) ir('/nino/premio');
  }

  // Si el adulto interrumpe a mitad (candado), se guarda lo que se alcanzó a hacer
  sesion.limpiar = () => {
    clearTimeout(temporizador);
    quitarAjuste();
    if (!sesion.finalizada && ctl.ensayosHechos > 0) {
      guardar(() => store.guardar('sesiones', ctl.registro({ inicio, fin: new Date() })));
    }
  };

  mostrar(ctl.iniciar(ahora()));
}
