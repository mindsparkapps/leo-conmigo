// Ajustes del niño activo (PLAN.md §5). Se guardan en el perfil y se usan desde la sesión siguiente.
//   Sesión: ensayos por sesión, máximo de opciones, actividades habilitadas.
//   Pantalla: mayúsculas, tamaño de letra, alto contraste (con vista previa).
//   Sonido: voz y velocidad, vibración, intensidad de la celebración.

import { el } from '../ui/dom.js';
import { cabecera, campo, cargando, mostrarError, describirError } from '../ui/adulto.js';
import { crearCarta } from '../ui/carta.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { ACTIVIDADES } from '../actividades/indice.js';
import { AJUSTES_POR_DEFECTO, normalizarAjustes } from '../core/modelos.js';
import {
  ACTIVIDADES_POR_ETAPA, ETAPAS_HECHAS, NOMBRE_ETAPA, UMBRAL_ETAPA_2, UMBRAL_ETAPA_3, etapasDesbloqueadas, palabrasQueFaltan,
} from '../core/etapas.js';
import { hablarTexto, desbloquearAudio } from '../audio.js';
import { vibrar } from '../hardware.js';

export const titulo = 'Ajustes · Leo Conmigo';

export function montar(contenedor) {
  const raiz = el('section', { class: 'vista-adulto' }, cabecera('Ajustes'), cargando());
  contenedor.append(raiz);
  let vivo = true;
  pintar(raiz, () => vivo).catch((error) => mostrarError(raiz, error));
  return () => { vivo = false; };
}

function interruptor(etiqueta, marcado, ayuda = null) {
  const casilla = el('input', { type: 'checkbox', checked: marcado });
  return { casilla, elemento: el('label', { class: 'interruptor' }, casilla, el('span', {}, el('strong', {}, etiqueta), ayuda ? el('span', { class: 'ayuda' }, ayuda) : null)) };
}

async function pintar(raiz, estaVivo) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!perfil) {
    raiz.replaceChildren(
      cabecera('Ajustes'),
      el('div', { class: 'panel' }, el('p', {}, 'Primero crea el perfil del niño.')),
      el('a', { class: 'boton', href: '#/adulto/asistente' }, 'Crear el primer perfil'),
    );
    return;
  }
  const progresos = await store.listar('progresos', { perfilId: perfil.id });
  if (!estaVivo()) return;
  const a = normalizarAjustes(perfil.ajustes);

  // ---------- Sesión ----------
  const ensayos = el('input', { type: 'range', min: '4', max: '15', step: '1', value: String(a.ensayosPorSesion) });
  const ensayosValor = el('output', { class: 'valor-ajuste' }, String(a.ensayosPorSesion));
  ensayos.addEventListener('input', () => { ensayosValor.textContent = ensayos.value; });

  const maxOpciones = el(
    'select',
    {},
    [[2, '2 (lo más fácil)'], [3, '3'], [4, '4 (lo más difícil)']].map(([v, t]) => el('option', { value: String(v), selected: v === a.maxOpciones }, t)),
  );

  // Las actividades de cada etapa (L6 no va aquí: se activa aparte, con su interruptor)
  const actividades = ETAPAS_HECHAS.flatMap((etapa) => ACTIVIDADES_POR_ETAPA[etapa].filter((id) => ACTIVIDADES[id]).map((id) => {
    const act = ACTIVIDADES[id];
    const casilla = el('input', { type: 'checkbox', checked: !a.actividadesHabilitadas || a.actividadesHabilitadas.includes(act.id) });
    return { id: act.id, etapa, casilla, elemento: el('label', { class: 'item-catalogo' }, casilla, el('span', {}, `${act.id} · ${act.nombre}`)) };
  }));
  const errorActividades = el('p', { class: 'error-texto', role: 'alert', hidden: true });

  const panelSesion = el(
    'div',
    { class: 'panel' },
    el('h2', {}, 'Las sesiones'),
    campo('Ensayos por sesión', el('div', { class: 'fila' }, ensayos, ensayosValor), 'De 4 a 15. Sesiones cortas funcionan mejor.'),
    campo('Máximo de opciones', maxOpciones, 'Cuántas opciones puede ver como mucho. Empieza con 2 y sube solo según cómo le va.'),
    el('p', { class: 'campo-etiqueta' }, 'Actividades que se usan'),
    ETAPAS_HECHAS.map((etapa) =>
      el(
        'div',
        { class: 'grupo-catalogo' },
        el('h3', {}, NOMBRE_ETAPA[etapa]),
        el('div', { class: 'catalogo-items' }, actividades.filter((x) => x.etapa === etapa).map((x) => x.elemento)),
      )),
    el('p', { class: 'ayuda' }, 'Si apagas L4, las palabras no llegarán a contar como «leídas».'),
    errorActividades,
  );

  // ---------- Etapas ----------
  const abiertas = etapasDesbloqueadas({ progresos, forzadas: a.etapasForzadas, bloqueadas: a.etapasBloqueadas });
  const selEtapaActual = el(
    'select',
    {},
    ETAPAS_HECHAS.map((e) => el('option', { value: String(e), selected: e === (perfil.etapaActual ?? 1) }, NOMBRE_ETAPA[e])),
  );
  const modosEtapa = ETAPAS_HECHAS.map((etapa) => {
    const valorInicial = a.etapasForzadas.includes(etapa) ? 'abrir' : a.etapasBloqueadas.includes(etapa) ? 'bloquear' : 'auto';
    const opciones = [
      ['auto', etapa >= 2 ? `Automática (se abre con ${etapa === 2 ? UMBRAL_ETAPA_2 : UMBRAL_ETAPA_3} palabras leídas)` : 'Siempre disponible'],
      ...(etapa >= 2 ? [['abrir', 'Abrir ahora']] : []),
      ['bloquear', 'Bloquear'],
    ];
    const seleccion = el('select', {}, opciones.map(([v, t]) => el('option', { value: v, selected: v === valorInicial }, t)));
    const falta = palabrasQueFaltan(etapa, progresos);
    const situacion = abiertas.includes(etapa) ? 'Abierta ahora.' : falta > 0 ? `Cerrada: faltan ${falta} palabra${falta === 1 ? '' : 's'} leída${falta === 1 ? '' : 's'}.` : 'Cerrada.';
    return { etapa, seleccion, elemento: campo(NOMBRE_ETAPA[etapa], seleccion, situacion) };
  });
  const lecturaVozAlta = interruptor(
    'Leo en voz alta (L6)',
    a.habilitarL6,
    'Con palabras que ya lee, hasta 2 por sesión. Él lee en voz alta y tú tocas ✓ («lo leyó») o ↻ («otra vez») en las esquinas de abajo. La app no evalúa su voz.',
  );
  const panelEtapas = el(
    'div',
    { class: 'panel' },
    el('h2', {}, 'Las etapas'),
    el('p', { class: 'ayuda' }, `La etapa 2 (frases) se abre sola cuando lee ${UMBRAL_ETAPA_2} palabras y la 3 (sílabas) cuando lee ${UMBRAL_ETAPA_3}. Tú eliges cuál practica hoy, y puedes abrir o bloquear etapas. Los cuentos con preguntas (etapa 4) se arman en Libros.`),
    campo('Etapa que practica', selEtapaActual, 'Si esa etapa está cerrada o no tiene nada que practicar, se usa la anterior.'),
    modosEtapa.map((m) => m.elemento),
    lecturaVozAlta.elemento,
  );

  // ---------- Pantalla ----------
  const mayusculas = interruptor('Letras MAYÚSCULAS', a.mayusculas, 'Por defecto se usan minúsculas.');
  const tamano = el(
    'select',
    {},
    [['normal', 'Normal'], ['grande', 'Grande']].map(([v, t]) => el('option', { value: v, selected: v === a.tamanoLetra }, t)),
  );
  const contraste = interruptor('Alto contraste', a.altoContraste, 'Bordes negros y colores más marcados.');

  const vistaPrevia = el(
    'div',
    { class: 'vista-previa', 'aria-label': 'Vista previa de las tarjetas' },
    crearCarta({ forma: 'tarjeta', palabra: { id: 'v1', texto: 'perro', emoji: '🐶' }, interactiva: false }),
    crearCarta({ forma: 'palabra', palabra: { id: 'v2', texto: 'pan' }, interactiva: false }),
  );
  const actualizarVista = () => {
    vistaPrevia.classList.toggle('mayusculas', mayusculas.casilla.checked);
    vistaPrevia.classList.toggle('letra-grande', tamano.value === 'grande');
    vistaPrevia.classList.toggle('alto-contraste', contraste.casilla.checked);
  };
  for (const control of [mayusculas.casilla, tamano, contraste.casilla]) control.addEventListener('change', actualizarVista);
  actualizarVista();

  const panelPantalla = el(
    'div',
    { class: 'panel' },
    el('h2', {}, 'La pantalla'),
    mayusculas.elemento,
    campo('Tamaño de las letras', tamano),
    contraste.elemento,
    el('p', { class: 'campo-etiqueta' }, 'Así se verá'),
    vistaPrevia,
  );

  // ---------- Sonido ----------
  const sonido = interruptor('Consignas y felicitaciones habladas', a.sonido, 'Las palabras siempre se dicen: las necesitan algunas actividades.');
  const velocidad = el('input', { type: 'range', min: '0.6', max: '1.2', step: '0.1', value: String(a.velocidadVoz) });
  const velocidadValor = el('output', { class: 'valor-ajuste' }, `${Number(a.velocidadVoz).toFixed(1)}×`);
  velocidad.addEventListener('input', () => { velocidadValor.textContent = `${Number(velocidad.value).toFixed(1)}×`; });
  const probar = el('button', { type: 'button', class: 'boton secundario chico' }, '🔊 Probar la velocidad');
  probar.addEventListener('click', () => {
    desbloquearAudio();
    hablarTexto('Hola, esta es la velocidad de la voz', { velocidad: Number(velocidad.value) });
  });
  const vibracion = interruptor('Vibrar al acertar', a.vibracion, 'Una vibración muy corta. Nunca vibra cuando se equivoca.');
  const celebracion = el(
    'select',
    {},
    [['normal', 'Normal: elogio, estrellas y salto'], ['suave', 'Suave: elogio y color verde'], ['ninguna', 'Ninguna']].map(([v, t]) =>
      el('option', { value: v, selected: v === a.intensidadCelebracion }, t)),
  );
  const probarVibracion = el('button', { type: 'button', class: 'boton secundario chico' }, 'Probar la vibración');
  probarVibracion.addEventListener('click', () => { vibrar(40); });

  const panelSonido = el(
    'div',
    { class: 'panel' },
    el('h2', {}, 'El sonido y la celebración'),
    sonido.elemento,
    campo('Velocidad de la voz', el('div', { class: 'fila' }, velocidad, velocidadValor, probar), 'Más lenta (0,6×) o más rápida (1,2×). También vale para tus grabaciones.'),
    vibracion.elemento,
    el('div', { class: 'acciones' }, probarVibracion),
    campo('Celebración al acertar', celebracion, 'Algunos niños se sobreestimulan: prueba con «Suave» o «Ninguna».'),
  );

  // ---------- Guardar ----------
  const estado = el('p', { class: 'ayuda', role: 'status' });
  const error = el('p', { class: 'error-texto', role: 'alert', hidden: true });

  function leer() {
    const marcadas = actividades.filter((x) => x.casilla.checked).map((x) => x.id);
    return normalizarAjustes({
      ...perfil.ajustes,
      ensayosPorSesion: Number(ensayos.value),
      maxOpciones: Number(maxOpciones.value),
      actividadesHabilitadas: marcadas.length === actividades.length ? null : marcadas,
      etapasForzadas: modosEtapa.filter((m) => m.seleccion.value === 'abrir').map((m) => m.etapa),
      etapasBloqueadas: modosEtapa.filter((m) => m.seleccion.value === 'bloquear').map((m) => m.etapa),
      habilitarL6: lecturaVozAlta.casilla.checked,
      mayusculas: mayusculas.casilla.checked,
      tamanoLetra: tamano.value,
      altoContraste: contraste.casilla.checked,
      sonido: sonido.casilla.checked,
      velocidadVoz: Number(velocidad.value),
      vibracion: vibracion.casilla.checked,
      intensidadCelebracion: celebracion.value,
    });
  }

  const guardar = el('button', { type: 'button', class: 'boton' }, 'Guardar los ajustes');
  guardar.addEventListener('click', async () => {
    error.hidden = true;
    errorActividades.hidden = true;
    estado.textContent = '';
    if (!actividades.some((x) => x.casilla.checked)) {
      errorActividades.textContent = 'Deja al menos una actividad activa.';
      errorActividades.hidden = false;
      return;
    }
    guardar.disabled = true;
    try {
      await store.guardar('perfiles', { ...perfil, etapaActual: Number(selEtapaActual.value), ajustes: leer() });
      estado.textContent = 'Guardado. Se usará desde la próxima sesión.';
    } catch (e) {
      console.error(e);
      error.textContent = describirError(e);
      error.hidden = false;
    } finally {
      guardar.disabled = false;
    }
  });

  const valores = el('button', { type: 'button', class: 'boton secundario' }, 'Volver a los valores originales');
  valores.addEventListener('click', () => {
    const d = AJUSTES_POR_DEFECTO;
    ensayos.value = String(d.ensayosPorSesion); ensayos.dispatchEvent(new Event('input'));
    maxOpciones.value = String(d.maxOpciones);
    for (const x of actividades) x.casilla.checked = true;
    selEtapaActual.value = '1';
    for (const m of modosEtapa) m.seleccion.value = 'auto';
    lecturaVozAlta.casilla.checked = d.habilitarL6;
    mayusculas.casilla.checked = d.mayusculas;
    tamano.value = d.tamanoLetra;
    contraste.casilla.checked = d.altoContraste;
    sonido.casilla.checked = d.sonido;
    velocidad.value = String(d.velocidadVoz); velocidad.dispatchEvent(new Event('input'));
    vibracion.casilla.checked = d.vibracion;
    celebracion.value = d.intensidadCelebracion;
    actualizarVista();
    estado.textContent = 'Valores originales puestos. Toca «Guardar» para quedarte con ellos.';
  });

  raiz.replaceChildren(
    cabecera('Ajustes'),
    el('p', { class: 'ayuda' }, `Ajustes de ${perfil.nombre}. Cambian desde la próxima sesión.`),
    panelEtapas,
    panelSesion,
    panelPantalla,
    panelSonido,
    error,
    el('div', { class: 'acciones' }, valores, guardar),
    estado,
  );
}
