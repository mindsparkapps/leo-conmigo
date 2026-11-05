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

  const actividades = Object.values(ACTIVIDADES).map((act) => {
    const casilla = el('input', { type: 'checkbox', checked: !a.actividadesHabilitadas || a.actividadesHabilitadas.includes(act.id) });
    return { id: act.id, casilla, elemento: el('label', { class: 'item-catalogo' }, casilla, el('span', {}, `${act.id} · ${act.nombre}`)) };
  });
  const errorActividades = el('p', { class: 'error-texto', role: 'alert', hidden: true });

  const panelSesion = el(
    'div',
    { class: 'panel' },
    el('h2', {}, 'Las sesiones'),
    campo('Ensayos por sesión', el('div', { class: 'fila' }, ensayos, ensayosValor), 'De 4 a 15. Sesiones cortas funcionan mejor.'),
    campo('Máximo de opciones', maxOpciones, 'Cuántas opciones puede ver como mucho. Empieza con 2 y sube solo según cómo le va.'),
    el('p', { class: 'campo-etiqueta' }, 'Actividades que se usan'),
    el('div', { class: 'catalogo-items' }, actividades.map((x) => x.elemento)),
    el('p', { class: 'ayuda' }, 'Si apagas L4, las palabras no llegarán a contar como «leídas».'),
    errorActividades,
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
      await store.guardar('perfiles', { ...perfil, ajustes: leer() });
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
    panelSesion,
    panelPantalla,
    panelSonido,
    error,
    el('div', { class: 'acciones' }, valores, guardar),
    estado,
  );
}
