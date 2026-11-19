// Modo Escritura del niño (Ampliación 5, fase 29): arma palabras poniendo sílabas en cajas. Esta pantalla solo dibuja y ejecuta
// efectos (voz, vibración, guardado); las reglas (qué es correcto, ayuda, avance, fatiga, progreso) viven en
// js/core/escritura/controlador.js y están probadas. El dibujo está en js/actividades/escritura.js.
//
// Reglas que se ven aquí (PLAN.md §2 y «Lo que respondió el usuario al aprobar» de la Ampliación 5):
//  - Por defecto se toca (no se arrastra) y el error es suave: la pieza se atenúa y vuelve. «Arrastrar» y «rojo» son opciones del adulto.
//  - Ningún error suena ni vibra. Tras 2 errores en la misma caja, la pieza correcta se ilumina en amarillo y se dice.
//  - Si la escritura NO está habilitada para el perfil, solo entra un administrador (o «Probar Escritura» del adulto) y todo lo que
//    se juega se guarda en la ficha de prueba `prueba:<perfilId>`, nunca en el perfil real. Habilitada, se guarda en el perfil.
//  - Mismo premio que la lectura al terminar la sesión; una sesión a medias se guarda con `interrumpida: true`.

import { el } from '../ui/dom.js';
import { cargarAdministradores, deshabilitarAdulto, esAdministrador } from '../acceso.js';
import { NOMBRE_APP } from '../config.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { liberarUrls, urlDeMedio } from '../medios.js';
import { decirTexto, desbloquearAudio, detener, hablarTexto } from '../audio.js';
import { avatarFelicita, prepararAvatar } from '../ui/avatar.js';
import { vibrar } from '../hardware.js';
import { aplicarAutoajusteEscritura } from '../autoajuste.js';
import { normalizarAjustes } from '../core/modelos.js';
import { idDePrueba } from '../core/curso.js';
import { crearControladorEscritura } from '../core/escritura/controlador.js';
import { nivelEfectivo, nivelesDisponibles, nivelesElegibles, elementosDeEscritura } from '../core/escritura/elementos.js';
import { NIVELES } from '../core/escritura/niveles.js';
import { analizarEscritura, dificultadesDeEscritura } from '../core/escritura/analisis.js';
import { renderEscritura } from '../actividades/escritura.js';
import { establecerPremio, lluviaDeEstrellas, terminarLeccion } from './premio.js';
import { establecerEleccion } from './elegir.js';
import { cargarColecciones } from '../colecciones.js';
import { opcionesDeRecompensa } from '../core/colecciones.js';

export const titulo = NOMBRE_APP;

const RUTA = '/nino/escritura';
const PAUSA_CELEBRACION_MS = { normal: 1400, suave: 700, ninguna: 500 };
const PAUSA_ENTRE_SILABAS_MS = 120;
const DURACION_MINIMA_SILABA_MS = 300; // aunque no haya voz, cada caja se resalta un momento
const PAUSA_AL_ELEGIR_NIVEL_MS = 700;
const CONSIGNA = 'Arma la palabra';
const ICONO_CASA = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 8L6 32h8v22h14V40h8v14h14V32h8z" fill="currentColor"/></svg>`;
const ICONO_NIVELES = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M10 12h12v12H10zM26 12h12v12H26zM42 12h12v12H42zM10 28h12v12H10zM26 28h12v12H26zM42 28h12v12H42zM10 44h12v10H10zM26 44h12v10H26zM42 44h12v10H42z" fill="currentColor"/></svg>`;

// «Probar Escritura» del panel adulto (fase 30) pide el modo de prueba con esto antes de abrir la ruta; se gasta al montar.
let pruebaPedida = false;
export function pedirPrueba(valor = true) {
  pruebaPedida = Boolean(valor);
}

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

export function montar(contenedor, { ir }) {
  deshabilitarAdulto();
  const prueba = pruebaPedida;
  pruebaPedida = false;

  const area = el('div', { class: 'area-ensayo esc-area' });
  const casa = el('button', { type: 'button', class: 'boton-casa boton-casa-chico', 'aria-label': 'Salir', onclick: () => { detener(); ir('/nino'); } });
  casa.innerHTML = ICONO_CASA;
  const vista = el('section', { class: 'vista-nino sesion-nino escritura-nino' }, area, casa);
  vista.addEventListener('contextmenu', (e) => e.preventDefault()); // sin menú de pulsación larga
  contenedor.append(vista);

  const sesion = { vivo: true, finalizada: false, limpiar: () => {} };
  const alOcultar = () => { if (document.hidden) detener(); };
  document.addEventListener('visibilitychange', alOcultar);

  iniciar({ vista, area, ir, sesion, prueba }).catch((error) => {
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

async function cargarBanco() {
  try {
    const respuesta = await fetch('data/escritura/banco.json');
    return respuesta.ok ? await respuesta.json() : {};
  } catch {
    return {}; // sin red y sin la copia del service worker: solo las palabras del perfil
  }
}

async function iniciar({ vista, area, ir, sesion, prueba: pruebaForzada }) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  await cargarAdministradores(store);
  if (!sesion.vivo) return;
  if (!perfil) { ir('/nino'); return; }

  const ajustes = normalizarAjustes(perfil.ajustes);
  const esc = ajustes.escritura;
  // Habilitada: la ve todo el mundo. Si no, solo un administrador (o la prueba del adulto), y todo va a la ficha de prueba.
  // «Probar Escritura» del adulto (`pedirPrueba`) también juega en la ficha de prueba, esté o no prendida la casilla.
  const modoPrueba = !esc.habilitada || pruebaForzada;
  if (!esc.habilitada && !esAdministrador() && !pruebaForzada) { ir('/nino'); return; }
  const perfilIdJuego = modoPrueba ? idDePrueba(perfil.id) : perfil.id;
  // Para el álbum y las monedas de la ficha de prueba: el mismo perfil, con su id de prueba (su propio álbum y saldo)
  const perfilDelPremio = modoPrueba ? { ...perfil, id: perfilIdJuego } : perfil;

  const [palabras, frases, banco] = await Promise.all([
    store.listar('palabras', { perfilId: perfil.id }),
    store.listar('frases', { perfilId: perfil.id }),
    cargarBanco(),
  ]);
  if (!sesion.vivo) return;
  const palabrasPorId = new Map(palabras.filter((p) => !p.deleted).map((p) => [p.id, p]));
  const elementos = elementosDeEscritura({ palabras, frases, banco, bancoApagado: esc.bancoApagado });
  const disponibles = nivelesDisponibles(elementos.filter((e) => e.activa !== false && !e.deleted));
  const nivelGuardado = nivelEfectivo({ nivelEscritura: esc.nivelEscritura, disponibles, bloqueados: esc.nivelesBloqueados, forzados: esc.nivelesForzados });
  if (!nivelGuardado) {
    area.replaceChildren(el('p', { class: 'mensaje-nino' }, 'Un adulto debe agregar palabras con imagen.'));
    return;
  }

  vista.classList.toggle('mayusculas', ajustes.mayusculas);
  vista.classList.toggle('letra-grande', ajustes.tamanoLetra === 'grande');
  vista.classList.toggle('alto-contraste', ajustes.altoContraste);
  vista.classList.toggle('escritura-rojo', esc.colorError === 'rojo');
  if (modoPrueba) vista.prepend(el('p', { class: 'esc-etiqueta-admin' }, 'Modo administrador'));

  const urls = new Map();
  const ahora = () => performance.now();
  const obtenerMedio = (id) => store.obtener('medios', id);
  const celebracion = ajustes.intensidadCelebracion;
  const elegibles = nivelesElegibles({
    eleccionNino: esc.eleccionNino, nivelActual: nivelGuardado, disponibles, bloqueados: esc.nivelesBloqueados, forzados: esc.nivelesForzados,
  });

  // ---- estado de la sesión que se está jugando (cambia al elegir otro nivel) ----
  let ctl = null;
  let inicio = null;
  let manejador = null;
  let cerrando = false; // entre que la palabra se completa y aparece la siguiente
  let turno = 0; // invalida lecturas de palabras que ya pasaron
  let temporizador = null;
  let guardado = Promise.resolve();
  let piezasOracion = null; // 'palabras' | 'silabas' una vez que se eligió en E18
  let primeraVez = true; // la consigna se dice solo al empezar
  let ultimaAyuda = null;
  let botonNiveles = null;

  const guardar = (tarea) => {
    guardado = guardado.then(tarea).catch((e) => console.error('No se pudo guardar el progreso', e));
  };

  let avatar = null; // el avatar que felicita la última palabra armada (ui/avatar.js)
  if (ajustes.intensidadCelebracion !== 'ninguna') prepararAvatar();
  const hablar = (texto) => (ajustes.sonido ? hablarTexto(texto, { velocidad: ajustes.velocidadVoz }) : Promise.resolve(false));
  // La pieza se dice en minúscula para que use la grabación de la sílaba («Ma» de una oración suena como «ma»)
  const decirPieza = (texto, unidad) => hablar(unidad === 'silaba' ? String(texto).toLowerCase() : texto);

  /** Dice lo que se ve de modelo: la palabra (con su grabación o la voz de la app), la frase o el texto completo. */
  function decirModelo() {
    const e = ctl.actual().elemento;
    if (!ajustes.sonido) return Promise.resolve(false);
    const texto = e.esTexto ? e.frases.join(' ') : e.modelo ?? e.texto;
    return decirTexto(texto, { palabras: [e], obtenerMedio, velocidad: ajustes.velocidadVoz });
  }

  async function prepararImagenes(visuales) {
    for (const e of visuales) {
      const ids = [e.medioImagenId, ...(e.palabraIds ?? []).map((id) => palabrasPorId.get(id)?.medioImagenId)].filter(Boolean);
      for (const id of ids) if (!urls.has(id)) urls.set(id, await urlDeMedio(store, id));
    }
  }
  const partesDeFrase = (e) => (e.esFrase && e.palabraIds
    ? e.palabraIds.map((id) => palabrasPorId.get(id)).filter(Boolean).slice(0, 3).map((palabra) => ({ palabra, url: palabra.medioImagenId ? urls.get(palabra.medioImagenId) ?? null : null }))
    : []);

  // ---------- empezar una sesión (la del nivel guardado o la de un nivel que el niño eligió en el menú) ----------
  async function empezar({ nivel = null, elegidoPorNino = false } = {}) {
    clearTimeout(temporizador);
    turno += 1;
    detener();
    cerrando = false;
    const nivelAJugar = nivel ?? nivelGuardado;
    // E18: antes de empezar, el interruptor «Por palabras / Por sílabas»
    if (nivelAJugar === 'E18' && piezasOracion === null) {
      await preguntarPiezasDeOracion(() => empezar({ nivel, elegidoPorNino }));
      return;
    }
    await guardado;
    const [progresos, niveles, respuestas] = await Promise.all([
      store.listar('progresos', { perfilId: perfilIdJuego }),
      store.listar('niveles', { perfilId: perfilIdJuego }),
      store.listar('respuestas', { perfilId: perfilIdJuego }),
    ]);
    // Lo que le cuesta (fase 31): prioridad a lo difícil y a las sílabas que confunde. Del perfil real o de la ficha de prueba, nunca mezclados.
    const analisis = analizarEscritura(respuestas, { perfilId: perfilIdJuego });
    if (!sesion.vivo) return;
    const perfilJuego = piezasOracion
      ? { ...perfil, ajustes: { ...perfil.ajustes, escritura: { ...esc, piezasOracion } } }
      : perfil;
    ctl = crearControladorEscritura({
      perfil: perfilJuego, perfilId: perfilIdJuego, palabras: elementos, progresos, niveles, nivel: nivelAJugar, nivelElegidoPorNino: elegidoPorNino,
      dificultades: dificultadesDeEscritura(analisis), analisisEscritura: analisis,
    });
    if (ctl.terminada) {
      area.replaceChildren(el('p', { class: 'mensaje-nino' }, 'No hay palabras para este nivel.'));
      return;
    }
    const plan = [...ctl.plan.ensayos, ...ctl.plan.reservaFacil].map((en) => ctl.palabras.get(`${en.elementoId}:${en.actividad}`)).filter(Boolean);
    await prepararImagenes(plan);
    if (!sesion.vivo) return;
    inicio = new Date();
    sesion.finalizada = false;
    ultimaAyuda = null;
    mostrar(ctl.iniciar(ahora()));
    pintarBotonNiveles();
  }

  /** Pantalla del interruptor de E18: dos botones grandes. Lo elegido vale para lo que queda de la pantalla. */
  function preguntarPiezasDeOracion(continuar) {
    manejador?.destruir();
    manejador = null;
    const elegir = (valor, texto) => {
      desbloquearAudio();
      piezasOracion = valor;
      hablar(texto);
      continuar();
    };
    const boton = (valor, texto, ejemplo) => el(
      'button',
      { type: 'button', class: `esc-opcion${esc.piezasOracion === valor ? ' predeterminada' : ''}`, 'data-valor': valor, onclick: () => elegir(valor, texto) },
      el('span', { class: 'esc-opcion-ejemplo', 'aria-hidden': 'true' }, ejemplo),
      el('span', { class: 'esc-opcion-texto' }, texto),
    );
    area.replaceChildren(el('div', { class: 'esc-interruptor', role: 'group', 'aria-label': 'Cómo armar la oración' },
      boton('palabras', 'Por palabras', 'Mamá | toma | leche'),
      boton('silabas', 'Por sílabas', 'Ma·má | to·ma | le·che')));
    return Promise.resolve();
  }

  // ---------- un ensayo ----------
  function mostrar(visual) {
    manejador?.destruir();
    manejador = renderEscritura(area, visual, {
      urls,
      partes: partesDeFrase,
      formaDeMover: esc.formaDeMover,
      alEscuchar,
      alSoltar,
      alToqueModelo,
    });
    ultimaAyuda = null;
    presentar();
  }

  async function presentar() {
    const mio = ++turno;
    if (primeraVez) {
      primeraVez = false;
      await hablar(CONSIGNA);
      if (mio !== turno || !sesion.vivo) return;
    }
    await decirModelo();
  }

  function alToqueModelo() {
    if (cerrando || !sesion.vivo) return;
    ctl.oirOtraVez(); // cuenta para el registro fino
    desbloquearAudio();
    turno += 1;
    decirModelo();
  }

  function alEscuchar(fichaId) {
    if (cerrando || !sesion.vivo) return;
    desbloquearAudio();
    const visual = ctl.actual();
    const ficha = visual.fichas.find((f) => f.id === fichaId);
    ctl.escuchar(fichaId, ahora()); // se anota en `escuchasPieza`: no es un error
    turno += 1;
    if (ficha) decirPieza(ficha.texto, visual.unidad);
  }

  function alSoltar({ fichaId, hueco, forma }) {
    if (cerrando || !sesion.vivo) return;
    desbloquearAudio();
    const visual = ctl.actual();
    const r = ctl.soltar({ fichaId, hueco, forma }, ahora());
    if (r.efecto === 'ignorado') {
      if (forma === 'arrastre') manejador.devolver(fichaId, hueco, null); // una pieza arrastrada vuelve; la «tomada» sigue tomada
      return;
    }
    const ficha = visual.fichas.find((f) => f.id === fichaId);
    if (r.efecto === 'correcto') {
      manejador.colocar(fichaId, hueco);
      manejador.ayudar(r.ayuda);
      ultimaAyuda = r.ayuda ? `${r.ayuda.hueco}` : null;
      if (r.completo) { completar(r); return; }
      turno += 1;
      if (ficha) decirPieza(ficha.texto, visual.unidad); // la pieza que acaba de poner suena
      return;
    }
    // incorrecto: sin sonido de error, sin vibración. La pieza vuelve; tras 2 errores en la caja se ilumina la correcta y se dice.
    manejador.devolver(fichaId, hueco, r.colorError);
    manejador.ayudar(r.ayuda);
    if (r.ayuda && ultimaAyuda !== `${r.ayuda.hueco}`) {
      ultimaAyuda = `${r.ayuda.hueco}`;
      turno += 1;
      decirPieza(visual.huecos[r.ayuda.hueco], visual.unidad);
    }
  }

  /** La palabra quedó armada: se lee sílaba por sílaba (resaltando cada caja), luego entera, y vienen el elogio y la siguiente. */
  async function completar(r) {
    cerrando = true;
    manejador.bloquear(true);
    const mio = ++turno;
    const visual = ctl.actual();
    const sigue = () => sesion.vivo && mio === turno;
    detener();
    for (let i = 0; i < visual.huecos.length; i++) {
      manejador.resaltarCaja(i);
      await Promise.all([decirPieza(visual.huecos[i], visual.unidad), esperar(DURACION_MINIMA_SILABA_MS)]);
      if (!sigue()) return;
      await esperar(PAUSA_ENTRE_SILABAS_MS);
      if (!sigue()) return;
    }
    manejador.resaltarCaja(-1);
    await decirModelo(); // la palabra entera
    if (!sigue()) return;
    manejador.marcarAcierto({ celebrar: celebracion !== 'ninguna' });
    if (celebracion === 'normal') lluviaDeEstrellas(vista);
    // El avatar aparece antes de pedir la voz, para no perder el aviso de que empezó a sonar
    avatar = celebracion !== 'ninguna' ? avatarFelicita(vista, r.elogio, { conVoz: ajustes.sonido }) : null;
    if (celebracion !== 'ninguna') hablar(r.elogio);
    if (celebracion !== 'ninguna' && ajustes.vibracion) vibrar(40);
    const fin = avatar?.terminado ?? Promise.resolve();
    temporizador = setTimeout(() => fin.then(avanzar), PAUSA_CELEBRACION_MS[celebracion]);
  }

  async function avanzar() {
    if (!sesion.vivo) return;
    const r = ctl.avanzar(ahora());
    guardar(() => store.guardar('progresos', r.guardar.progreso));
    if (r.guardar.nivel) guardar(() => store.guardar('niveles', r.guardar.nivel));
    guardar(() => store.guardar('respuestas', r.guardar.respuesta)); // registro fino
    if (r.terminada) { await finalizar(); return; }
    cerrando = false;
    mostrar(r.siguiente);
  }

  async function finalizar() {
    sesion.finalizada = true;
    const fin = new Date();
    let destino = '/nino/premio';
    try {
      await guardado;
      await store.guardar('sesiones', ctl.registro({ inicio, fin }));
      // Ajustes automáticos de escritura: nunca a mitad de una sesión, y un fallo no debe afectar al niño. La ficha de prueba no cuenta.
      if (!ctl.esPrueba) {
        try {
          await aplicarAutoajusteEscritura(store, perfil.id, elementos, fin);
        } catch (error) {
          console.error('No se pudieron revisar los ajustes automáticos de escritura', error);
        }
      }
      // El mismo premio que la lectura. En modo administrador, en el álbum y el saldo de la ficha de prueba.
      const { colecciones } = await cargarColecciones(store, perfil);
      if (colecciones.length >= 2) {
        establecerEleccion({ opciones: opcionesDeRecompensa(colecciones), ajustes, perfil: perfilDelPremio, volverA: RUTA });
        destino = '/nino/elegir';
      } else {
        const unico = colecciones[0];
        await terminarLeccion(store, perfilDelPremio, ajustes, { coleccionId: unico && !unico.esBase ? unico.id : null, volverA: RUTA });
      }
    } catch (error) {
      console.error('No se pudo cerrar la sesión', error);
      establecerPremio({ codigo: 'estrella', ajustes, volverA: RUTA }); // el niño igual recibe su premio
      destino = '/nino/premio';
    }
    if (sesion.vivo) ir(destino);
  }

  /** Guarda lo avanzado de una sesión que no se terminó (se sale con la casa o se cambia de nivel). */
  function guardarInterrumpida() {
    if (!ctl || sesion.finalizada || ctl.ensayosHechos === 0) return;
    const actual = ctl;
    const desde = inicio;
    guardar(() => store.guardar('sesiones', actual.registro({ inicio: desde, fin: new Date(), interrumpida: true })));
    sesion.finalizada = true; // ya quedó guardada
  }

  // ---------- menú de niveles ----------
  function pintarBotonNiveles() {
    if (botonNiveles || elegibles.length < 2) return;
    botonNiveles = el('button', { type: 'button', class: 'esc-boton-niveles', 'aria-label': 'Elegir nivel', onclick: abrirMenu });
    botonNiveles.innerHTML = ICONO_NIVELES;
    vista.append(botonNiveles);
  }

  function abrirMenu() {
    if (vista.querySelector('.esc-menu')) return;
    desbloquearAudio();
    const actual = ctl.nivel;
    const cerrar = () => menu.remove();
    const celdas = NIVELES.filter((n) => elegibles.includes(n.id)).map((n) => {
      const celda = el(
        'button',
        { type: 'button', class: `esc-nivel${n.id === actual ? ' actual' : ''}`, 'data-nivel': n.id, 'aria-label': `${n.nombre}` },
        el('span', { class: 'esc-nivel-ejemplo' }, n.ejemplo),
        el('span', { class: 'esc-nivel-numero', 'aria-hidden': 'true' }, String(n.numero)),
      );
      celda.addEventListener('click', () => {
        if (celda.classList.contains('elegido')) return;
        celda.classList.add('elegido');
        if (n.id !== 'E20') hablar(n.ejemplo); // el dictado es un altavoz: no hay nada que decir
        setTimeout(() => {
          cerrar();
          if (!sesion.vivo || n.id === actual) return;
          guardarInterrumpida();
          empezar({ nivel: n.id, elegidoPorNino: true }).catch((error) => console.error(error));
        }, PAUSA_AL_ELEGIR_NIVEL_MS);
      });
      return celda;
    });
    const volver = el('button', { type: 'button', class: 'boton-casa boton-casa-chico esc-menu-cerrar', 'aria-label': 'Volver', onclick: cerrar });
    volver.innerHTML = ICONO_CASA;
    const menu = el('div', { class: 'esc-menu', role: 'dialog', 'aria-label': 'Niveles' }, volver, el('div', { class: 'esc-niveles' }, celdas));
    vista.append(menu);
  }

  sesion.limpiar = () => {
    clearTimeout(temporizador);
    avatar?.cerrar();
    manejador?.destruir();
    guardarInterrumpida();
  };

  await empezar();
}
